import * as tl from 'vsts-task-lib/task';
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as trm from 'vsts-task-lib/toolrunner';
import { DotNetCoreReleaseFetcher } from "./releasesfetcher";
import * as utilities from "./utilities";
import * as fileSystem from "fs";
import * as os from 'os';
import * as path from 'path';
const SystemDefaultWorkingDirectory = process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'];
class DotnetCoreInstaller {
    constructor(workingDirectory: string, packageType: string, version?: string, useGlobalJson?: boolean) {
        this.useGlobalJson = useGlobalJson;
        this.packageType = packageType;
        this.workingDirectory = workingDirectory;

        if (!useGlobalJson) {
            if (!toolLib.isExplicitVersion(version)) {
                throw tl.loc("ImplicitVersionNotSupported", version);
            }
        }
        if (!useGlobalJson && (version == null || version.length == 0)) {
            throw tl.loc("VersionMissingException")
        }
        if (this.workingDirectory == null) {
            throw tl.loc("WorkingDirectoryCantBeNull");
        }
        this.version = version;
        this.cachedToolName = this.packageType === 'runtime' ? 'dncr' : 'dncs';
    }

    private async installFromGlobalJson(osSuffixes: string[]) {
        let filePathsToGlobalJson = tl.findMatch(this.workingDirectory, "**/*global.json");
        if (filePathsToGlobalJson == null || filePathsToGlobalJson.length == 0) {
            throw tl.loc("FailedToFindGlobalJson");
        }
        let sdkVersionNumber = new Array<{ name: string, toolPath?: string }>();
        // read all global files
        for (let index = 0; index < filePathsToGlobalJson.length; index++) {
            const filePath = filePathsToGlobalJson[index];
            let globalJson = {} as { sdk: { version: string } };
            console.log(tl.loc("GlobalJsonFound", filePath));
            try {
                globalJson = (JSON.parse(fileSystem.readFileSync(filePath).toString())) as { sdk: { version: string } };
            } catch (error) {
                throw tl.loc("FailedToReadGlobalJson", filePath);
            }
            if (globalJson == null || globalJson.sdk == null || globalJson.sdk.version == null) {
                throw tl.loc("FailedToReadGlobalJson", filePath);
            }
            sdkVersionNumber.push({ name: globalJson.sdk.version, toolPath: null });
        }

        let sortedDownloads = sdkVersionNumber
            .filter(d => {
                var cacheFolder = toolLib.findLocalTool(this.cachedToolName, "0.0.0", this.arch);
                if (cacheFolder == null || cacheFolder.length == 0) {
                    return true;
                }
                // We trust the installation of an sdk if all known folders exists.
                return !this
                    .knownFoldersInTheSdk
                    .every(knownPath => tl.exist(cacheFolder + "/" + knownPath + "/" + d.name + "/"));
            })
            // distinct on version name
            .filter(function (x, i, a) {
                return a.map(function (d) { return d.name }).indexOf(x.name) == i;
            });

        for (let index = 0; index < sortedDownloads.length; index++) {
            const element = sortedDownloads[index];
            // download, extract
            console.log(tl.loc("InstallingAfresh"));
            console.log(tl.loc("GettingDownloadUrl", this.packageType, element.name));
            let downloadUrls = await DotNetCoreReleaseFetcher.getDownloadUrls(osSuffixes, element.name, this.packageType);
            element.toolPath = await this.downloadAndInstall(downloadUrls, true, element.name);
            console.log(tl.loc("SuccessfullyInstalled", this.packageType, element.name));
            // Prepend the tools path. instructs the agent to prepend for future tasks            
            toolLib.prependPath(element.toolPath);
        }
        // set the biggest sdk as default
        let biggestSdkVersion = sdkVersionNumber.sort(function (a, b) { return a.name.localeCompare(b.name); })[sdkVersionNumber.length - 1];

        tl.setVariable('DOTNET_ROOT', biggestSdkVersion.toolPath);
    }

    private async installFromInputParameter(osSuffixes: string[]) {
        let toolPath = this.getLocalTool();
        if (!toolPath) {
            // download, extract, cache
            console.log(tl.loc("InstallingAfresh"));
            console.log(tl.loc("GettingDownloadUrl", this.packageType, this.version));
            let downloadUrls = await DotNetCoreReleaseFetcher.getDownloadUrls(osSuffixes, this.version, this.packageType);
            toolPath = await this.downloadAndInstall(downloadUrls);
            console.log(tl.loc("SuccessfullyInstalled", this.packageType, this.version));
        } else {
            console.log(tl.loc("UsingCachedTool", toolPath));
        }

        // Prepend the tools path. instructs the agent to prepend for future tasks
        toolLib.prependPath(toolPath);
        // Set DOTNET_ROOT for dotnet core Apphost to find runtime since it is installed to a non well-known location.
        tl.setVariable('DOTNET_ROOT', toolPath);
    }

    public async install() {
        // Check cache
        let osSuffixes = this.detectMachineOS();
        let parts = osSuffixes[0].split("-");
        this.arch = parts.length > 1 ? parts[1] : "x64";

        if (this.useGlobalJson) {
            await this.installFromGlobalJson(osSuffixes);
        } else {
            await this.installFromInputParameter(osSuffixes);
        }
        try {
            let globalToolPath: string = "";
            if (tl.osType().match(/^Win/)) {
                globalToolPath = path.join(process.env.USERPROFILE, ".dotnet\\tools");
            } else {
                globalToolPath = path.join(process.env.HOME, ".dotnet/tools");
            }

            console.log(tl.loc("PrependGlobalToolPath"));
            tl.mkdirP(globalToolPath);
            toolLib.prependPath(globalToolPath);
        } catch (error) {
            //nop
        }
    }

    private getLocalTool(version?: string): string | null {
        console.log(tl.loc("CheckingToolCache"));
        return toolLib.findLocalTool(
            this.cachedToolName,
            version != null ? version : this.version,
            this.arch);
    }

    private detectMachineOS(): string[] {
        let osSuffix = [];
        let scriptRunner: trm.ToolRunner;

        if (tl.osType().match(/^Win/)) {
            let escapedScript = path.join(utilities.getCurrentDir(), 'externals', 'get-os-platform.ps1').replace(/'/g, "''");
            let command = `& '${escapedScript}'`

            let powershellPath = tl.which('powershell', true);
            scriptRunner = tl.tool(powershellPath)
                .line('-NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command')
                .arg(command);
        }
        else {
            let scriptPath = path.join(utilities.getCurrentDir(), 'externals', 'get-os-distro.sh');
            utilities.setFileAttribute(scriptPath, "777");

            scriptRunner = tl.tool(tl.which(scriptPath, true));
        }

        let result: trm.IExecSyncResult = scriptRunner.execSync();

        if (result.code != 0) {
            throw tl.loc("getMachinePlatformFailed", result.error ? result.error.message : result.stderr);
        }

        let output: string = result.stdout;

        let index;
        if ((index = output.indexOf("Primary:")) >= 0) {
            let primary = output.substr(index + "Primary:".length).split(os.EOL)[0];
            osSuffix.push(primary);
            console.log(tl.loc("PrimaryPlatform", primary));
        }

        if ((index = output.indexOf("Legacy:")) >= 0) {
            let legacy = output.substr(index + "Legacy:".length).split(os.EOL)[0];
            osSuffix.push(legacy);
            console.log(tl.loc("LegacyPlatform", legacy));
        }

        if (osSuffix.length == 0) {
            throw tl.loc("CouldNotDetectPlatform");
        }

        return osSuffix;
    }

    private async downloadAndInstall(downloadUrls: string[], globalJson?: boolean, version?: string) {
        if (globalJson && (version == null || version.length == 0)) {
            throw tl.loc("ProvideAVersionIfYouUseGlobalJson");
        }
        let downloaded = false;
        let downloadPath = "";
        for (const url of downloadUrls) {
            try {
                downloadPath = await toolLib.downloadTool(url);
                downloaded = true;
                break;
            } catch (error) {
                tl.warning(tl.loc("CouldNotDownload", url, JSON.stringify(error)));
            }
        }

        if (!downloaded) {
            throw tl.loc("FailedToDownloadPackage");
        }

        // extract
        console.log(tl.loc("ExtractingPackage", downloadPath));
        let extPath: string = tl.osType().match(/^Win/) ? await toolLib.extractZip(downloadPath) : await toolLib.extractTar(downloadPath);

        // cache tool
        console.log(tl.loc("CachingTool"));
        let cachedDir: string;
        if (globalJson) {
            let availableGlobalTool = toolLib.findLocalTool(this.cachedToolName, "0.0.0", this.arch);
            if (availableGlobalTool == null || availableGlobalTool.length == 0) {
                // if we never installed any dotnet core sdk.
                cachedDir = await toolLib.cacheDir(extPath, this.cachedToolName, "0.0.0", this.arch);
            } else {
                // here we must do a little bit of magic.
                // copy all sdk files for the specific version
                for (let index = 0; index < this.knownFoldersInTheSdk.length; index++) {
                    const currentFolderToCopy = extPath + "/" + this.knownFoldersInTheSdk[index] + "/" + version + "/";
                    const destinationFolder = availableGlobalTool + "/" + this.knownFoldersInTheSdk[index] + "/" + version + "/";

                    // If the last copy was broken we delete the old trash if it exists
                    if (tl.exist(destinationFolder)) {
                        console.log(tl.loc("DeleteSdkFolderOfAnBrokenInstallation", destinationFolder));
                        tl.rmRF(destinationFolder);
                    }
                    console.log(tl.loc("CopySdkFromTo", currentFolderToCopy, destinationFolder));
                    tl.cp(extPath + "/", availableGlobalTool, "-rf", false);
                }
                //Override files that are there like dotnet.exe
                for (let index = 0; index < this.knowFilesInTheSdkThatWillOverride.length; index++) {
                    const fileToOverride = extPath + "/" + this.knowFilesInTheSdkThatWillOverride[index];
                    const clearPath = availableGlobalTool + "/" + this.knowFilesInTheSdkThatWillOverride[index];
                    const destinationPath = availableGlobalTool + "/";
                    console.log(tl.loc("RemoveSdkFile", clearPath));
                    tl.rmRF(clearPath);
                    console.log(tl.loc("InsertNewSdkFile", destinationPath));                    
                    tl.cp(fileToOverride, destinationPath, "-rf", false);
                }
                cachedDir = availableGlobalTool;
            }
            console.log(tl.loc("AddGlobalJsonViaToCache"));
        } else {
            cachedDir = await toolLib.cacheDir(extPath, this.cachedToolName, this.version, this.arch);
        }
        return cachedDir;
    }

    private packageType: string;
    private version?: string;
    private useGlobalJson: boolean = false;
    private cachedToolName: string;
    private arch: string;
    private workingDirectory: string;

    private readonly knownFoldersInTheSdk: string[] = [
        "shared/Microsoft.AspNetCore.All",
        "shared/Microsoft.AspNetCore.App",
        "shared/Microsoft.NETCore.App",
        "sdk",
        "host/fxr"
    ];
    // we use here the index "0" because this is the primary platform
    // private readonly pathToDotnet: string = tl.osType().match(/^Win/) ? "dotnet.exe" : "dotnet"
    private readonly knowFilesInTheSdkThatWillOverride: string[] = [
        tl.osType().match(/^Win/) ? "dotnet.exe" : "dotnet",
        "LICENSE.txt",
        "ThirdPartyNotices.txt"
    ];
}

async function run() {
    let useGlobalJson = tl.getBoolInput('useGlobalJson');
    let workingDirectory = tl.getPathInput("workingDirectory", false);
    workingDirectory = workingDirectory ? workingDirectory : SystemDefaultWorkingDirectory;
    let packageType = tl.getInput('packageType', true);
    if (useGlobalJson) {
        console.log(tl.loc("UseGlobalJson"));
        await new DotnetCoreInstaller(workingDirectory, packageType, null, useGlobalJson).install();
    } else {
        let version = tl.getInput('version', true);
        console.log(tl.loc("UseVersion"), version);
        version = version.trim();
        await new DotnetCoreInstaller(workingDirectory, packageType, version, useGlobalJson).install();
        console.log(tl.loc("ToolToInstall", packageType, version));
    }
}

var taskManifestPath = path.join(__dirname, "task.json");
tl.debug("Setting resource path to " + taskManifestPath);
tl.setResourcePath(taskManifestPath);

run()
    .then(() => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch((error) => tl.setResult(tl.TaskResult.Failed, !!error.message ? error.message : error));