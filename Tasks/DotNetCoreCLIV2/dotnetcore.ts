import tl = require("azure-pipelines-task-lib/task");
import tr = require("azure-pipelines-task-lib/toolrunner");
import path = require("path");
import fs = require("fs");
import ltx = require("ltx");
var archiver = require('archiver');
var uuidV4 = require('uuid/v4');

import * as packCommand from './packcommand';
import * as pushCommand from './pushcommand';
import * as restoreCommand from './restorecommand';
import * as toolInstallCommand from './toolinstallcommand';
import * as utility from './Common/utility';

let MessagePrinted = false;

export class dotNetExe {
    private command: string;
    private projects: string[];
    private arguments: string;
    private publishWebProjects: boolean;
    private zipAfterPublish: boolean;
    private outputArgument: string = "";
    private outputArgumentIndex: number = 0;
    private workingDirectory: string;
    private testRunSystem: string = "VSTS - dotnet";

    constructor() {
        this.command = tl.getInput("command");
        this.projects = tl.getDelimitedInput("projects", "\n", false);
        this.arguments = tl.getInput("arguments", false) || "";
        this.publishWebProjects = tl.getBoolInput("publishWebProjects", false);
        this.zipAfterPublish = tl.getBoolInput("zipAfterPublish", false);
        this.workingDirectory = tl.getPathInput("workingDirectory", false);
    }

    public async execute() {
        tl.setResourcePath(path.join(__dirname, "node_modules", "packaging-common", "module.json"));
        tl.setResourcePath(path.join(__dirname, "task.json"));

        this.setConsoleCodePage();

        try {
            switch (this.command) {
                case "build":
                case "publish":
                case "run":
                    await this.executeBasicCommand();
                    break;
                case "custom":
                    this.command = tl.getInput("custom", true);
                    await this.executeBasicCommand();
                    break;
                case "test":
                    await this.executeTestCommand();
                    break;
                case "restore":
                    await restoreCommand.run();
                    break;
                case "pack":
                    await packCommand.run();
                    break;
                case "push":
                    await pushCommand.run();
                    break;
                case "toolinstall":
                    await toolInstallCommand.run();
                    break;
                default:
                    throw tl.loc("Error_CommandNotRecognized", this.command);
            }
        }
        finally {
            if (!MessagePrinted) {
               console.log(tl.loc('NetCore3Update'));
            }
        }
    }

    private setConsoleCodePage() {
        // set the console code page to "UTF-8"
        if (tl.osType() === 'Windows_NT') {
            try {
                tl.execSync(path.resolve(process.env.windir, "system32", "chcp.com"), ["65001"]);
            }
            catch (ex) {
                tl.warning(tl.loc("CouldNotSetCodePaging", JSON.stringify(ex)))
            }
        }
    }

    private async executeBasicCommand() {
        var dotnetPath = tl.which("dotnet", true);

        console.log(tl.loc('DeprecatedDotnet2_2_And_3_0'));

        this.extractOutputArgument();

        // Use empty string when no project file is specified to operate on the current directory
        var projectFiles = this.getProjectFiles();
        if (projectFiles.length === 0) {
            throw tl.loc("noProjectFilesFound");
        }
        var failedProjects: string[] = [];
        for (const fileIndex of Object.keys(projectFiles)) {
            var projectFile = projectFiles[fileIndex];
            var dotnet = tl.tool(dotnetPath);
            dotnet.arg(this.command);
            if (this.isRunCommand()) {
                if (!!projectFile) {
                    dotnet.arg("--project");
                    dotnet.arg(projectFile);
                }
            } else {
                dotnet.arg(projectFile);
            }
            if(this.isBuildCommand()) {
                var loggerAssembly = path.join(__dirname, 'dotnet-build-helpers/Microsoft.TeamFoundation.DistributedTask.MSBuild.Logger.dll');
                dotnet.arg(`-dl:CentralLogger,\"${loggerAssembly}\"*ForwardingLogger,\"${loggerAssembly}\"`);
            }
            var dotnetArguments = this.arguments;
            if (this.isPublishCommand() && this.outputArgument && tl.getBoolInput("modifyOutputPath")) {
                var output = dotNetExe.getModifiedOutputForProjectFile(this.outputArgument, projectFile);
                dotnetArguments = this.replaceOutputArgument(output);
            }
            dotnet.line(dotnetArguments);
            try {
                var result = await dotnet.exec(<tr.IExecOptions>{
                    cwd: this.workingDirectory
                });
                await this.zipAfterPublishIfRequired(projectFile);
            } catch (err) {
                tl.error(err);
                failedProjects.push(projectFile);
            }
        }
        if (failedProjects.length > 0) {
            if (this.command === 'publish' && !MessagePrinted) {
                tl.warning(tl.loc('NetCore3Update'));
                MessagePrinted = true;
            }

            throw tl.loc("dotnetCommandFailed", failedProjects);
        }
    }

    private async executeTestCommand(): Promise<void> {
        const dotnetPath = tl.which('dotnet', true);
        console.log(tl.loc('DeprecatedDotnet2_2_And_3_0'));
        const enablePublishTestResults: boolean = tl.getBoolInput('publishTestResults', false) || false;
        const resultsDirectory = tl.getVariable('Agent.TempDirectory');
        if (enablePublishTestResults && enablePublishTestResults === true) {
            this.arguments = ` --logger trx --results-directory "${resultsDirectory}" `.concat(this.arguments);
        }

        // Remove old trx files
        if (enablePublishTestResults && enablePublishTestResults === true) {
            this.removeOldTestResultFiles(resultsDirectory);
        }

        // Use empty string when no project file is specified to operate on the current directory
        const projectFiles = this.getProjectFiles();
        if (projectFiles.length === 0) {
            tl.warning(tl.loc('noProjectFilesFound'));
            return;
        }

        const failedProjects: string[] = [];
        for (const fileIndex of Object.keys(projectFiles)) {
            const projectFile = projectFiles[fileIndex];
            const dotnet = tl.tool(dotnetPath);
            dotnet.arg(this.command);
            dotnet.arg(projectFile);
            dotnet.line(this.arguments);
            try {
                const result = await dotnet.exec(<tr.IExecOptions>{
                    cwd: this.workingDirectory
                });
            } catch (err) {
                tl.error(err);
                failedProjects.push(projectFile);
            }
        }
        if (enablePublishTestResults && enablePublishTestResults === true) {
            this.publishTestResults(resultsDirectory);
        }
        if (failedProjects.length > 0) {
            throw tl.loc('dotnetCommandFailed', failedProjects);
        }
    }

    private publishTestResults(resultsDir: string): void {
        const buildConfig = tl.getVariable('BuildConfiguration');
        const buildPlaform = tl.getVariable('BuildPlatform');
        const testRunTitle = tl.getInput("testRunTitle", false) || "";
        const matchingTestResultsFiles: string[] = tl.findMatch(resultsDir, '**/*.trx');
        if (!matchingTestResultsFiles || matchingTestResultsFiles.length === 0) {
            tl.warning('No test result files were found.');
        } else {
            const tp: tl.TestPublisher = new tl.TestPublisher('VSTest');
            tp.publish(matchingTestResultsFiles, 'false', buildPlaform, buildConfig, testRunTitle, 'true', this.testRunSystem);
            //refer https://github.com/Microsoft/vsts-task-lib/blob/master/node/task.ts#L1620
        }
    }

    private removeOldTestResultFiles(resultsDir:string): void {
        const matchingTestResultsFiles: string[] = tl.findMatch(resultsDir, '**/*.trx');
        if (!matchingTestResultsFiles || matchingTestResultsFiles.length === 0) {
            tl.debug("No old result files found.");
            return;
        }
        for (const fileIndex of Object.keys(matchingTestResultsFiles)) {
            const resultFile = matchingTestResultsFiles[fileIndex];
            tl.rmRF(resultFile)
            tl.debug("Successfuly removed: " + resultFile);
        }
    }

    private replaceOutputArgument(modifiedOutput: string) {
        var str = this.arguments;
        var index = this.outputArgumentIndex;
        return str.substr(0, index) + str.substr(index).replace(this.outputArgument, modifiedOutput);
    }

    private async zipAfterPublishIfRequired(projectFile: string) {
        if (this.isPublishCommand() && this.zipAfterPublish) {
            var outputSource: string = "";
            var moveZipToOutputSource = false;
            if (this.outputArgument) {
                if (tl.getBoolInput("modifyOutputPath") && projectFile) {
                    outputSource = dotNetExe.getModifiedOutputForProjectFile(this.outputArgument, projectFile);
                } else {
                    outputSource = this.outputArgument;
                    moveZipToOutputSource = true;
                }

            }
            else {
                var pattern = "**/publish";
                var files = tl.findMatch(path.dirname(projectFile), pattern);
                for (var fileIndex in files) {
                    var file = files[fileIndex];
                    if (fs.lstatSync(file).isDirectory) {
                        outputSource = file;
                        break;
                    }
                }
            }

            tl.debug("Zip Source: " + outputSource);
            if (outputSource) {
                var outputTarget = outputSource + ".zip";
                await this.zip(outputSource, outputTarget);
                tl.rmRF(outputSource);
                if (moveZipToOutputSource) {
                    fs.mkdirSync(outputSource);
                    fs.renameSync(outputTarget, path.join(outputSource, path.basename(outputTarget)));
                }
            }
            else {
                throw tl.loc("noPublishFolderFoundToZip", projectFile);
            }
        }
    }

    private zip(source: string, target: string) {
        tl.debug("Zip arguments: Source: " + source + " , target: " + target);

        return new Promise((resolve, reject) => {
            var output = fs.createWriteStream(target);

            output.on('close', function () {
                tl.debug('Successfully created archive ' + target);
                resolve(target);
            });

            output.on('error', function (error) {
                reject(error);
            });

            var archive = archiver('zip');
            archive.pipe(output);
            archive.directory(source, '/');
            archive.finalize();
        });
    }

    private extractOutputArgument(): void {
        if (!this.arguments || !this.arguments.trim()) {
            return;
        }

        var argString = this.arguments.trim();
        var isOutputOption = false;
        var inQuotes = false;
        var escaped = false;
        var arg = '';
        var i = 0;
        var append = function (c) {
            // we only escape double quotes.
            if (escaped && c !== '"') {
                arg += '\\';
            }
            arg += c;
            escaped = false;
        };
        var nextArg = function () {
            arg = '';
            for (; i < argString.length; i++) {
                var c = argString.charAt(i);
                if (c === '"') {
                    if (!escaped) {
                        inQuotes = !inQuotes;
                    }
                    else {
                        append(c);
                    }
                    continue;
                }
                if (c === "\\" && inQuotes && !escaped) {
                    escaped = true;
                    continue;
                }
                if (c === ' ' && !inQuotes) {
                    if (arg.length > 0) {
                        return arg.trim();
                    }
                    continue;
                }
                append(c);
            }

            if (arg.length > 0) {
                return arg.trim();
            }

            return null;
        }

        var token = nextArg();
        while (token) {
            var tokenUpper = token.toUpperCase();
            if (this.isPublishCommand() && (tokenUpper === "--OUTPUT" || tokenUpper === "-O")) {
                isOutputOption = true;
                this.outputArgumentIndex = i;
            }
            else if (isOutputOption) {
                this.outputArgument = token;
                isOutputOption = false;
            }

            token = nextArg();
        }
    }

    private getProjectFiles(): string[] {
        var projectPattern = this.projects;
        var searchWebProjects = this.isPublishCommand() && this.publishWebProjects;
        if (searchWebProjects) {
            projectPattern = ["**/*.csproj", "**/*.vbproj", "**/*.fsproj"];
        }

        var projectFiles = utility.getProjectFiles(projectPattern);
        var resolvedProjectFiles: string[] = [];

        if (searchWebProjects) {
            resolvedProjectFiles = projectFiles.filter(function (file, index, files): boolean {
                var directory = path.dirname(file);
                return tl.exist(path.join(directory, "web.config"))
                    || tl.exist(path.join(directory, "wwwroot"));
            });

            if (!resolvedProjectFiles.length) {
                var projectFilesUsingWebSdk = projectFiles.filter(this.isWebSdkUsed);
                if(!projectFilesUsingWebSdk.length) {
                    tl.error(tl.loc("noWebProjectFound"));
                }
                return projectFilesUsingWebSdk;
            }
            return resolvedProjectFiles;
        }
        return projectFiles;
    }

    private isWebSdkUsed(projectfile: string): boolean {
        if (projectfile.endsWith('.vbproj')) return false

        try {
            var fileBuffer: Buffer = fs.readFileSync(projectfile);
            var webConfigContent: string;

            var fileEncodings = ['utf8', 'utf16le'];

            for(var i = 0; i < fileEncodings.length; i++) {
                tl.debug("Trying to decode with " + fileEncodings[i]);
                webConfigContent = fileBuffer.toString(fileEncodings[i]);
                try {
                    var projectSdkUsed: string = ltx.parse(webConfigContent).getAttr("sdk") || ltx.parse(webConfigContent).getAttr("Sdk");
                    return projectSdkUsed && projectSdkUsed.toLowerCase() == "microsoft.net.sdk.web";
                } catch (error) {}
            }
        } catch(error) {
            tl.warning(error);
        }
        return false;
    }

    private isBuildCommand(): boolean {
        return this.command === "build";
    }

    private isPublishCommand(): boolean {
        return this.command === "publish";
    }

    private isRunCommand(): boolean {
        return this.command === "run";
    }

    private static getModifiedOutputForProjectFile(outputBase: string, projectFile: string): string {
        return path.join(outputBase, path.basename(path.dirname(projectFile)));
    }
}

var exe = new dotNetExe();
exe.execute().catch((reason) => tl.setResult(tl.TaskResult.Failed, reason));