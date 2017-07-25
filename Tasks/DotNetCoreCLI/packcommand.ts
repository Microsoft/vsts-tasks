import * as ngToolRunner from "nuget-task-common/NuGetToolRunner2";
import * as nuGetGetter from "nuget-task-common/NuGetToolGetter";
import * as nutil from "nuget-task-common/Utility";
import * as path from "path";
import * as tl from "vsts-task-lib/task";
import * as utility from './Common/utility';

import { IExecOptions } from "vsts-task-lib/toolrunner";

export async function run(): Promise<void> {

    let searchPattern = tl.getPathInput("searchPatternPack", true);
    let configuration = tl.getInput("configurationToPack");
    let versioningScheme = tl.getInput("versioningScheme");
    let versionEnvVar = tl.getInput("versionEnvVar");
    let majorVersion = tl.getInput("requestedMajorVersion");
    let minorVersion = tl.getInput("requestedMinorVersion");
    let patchVersion = tl.getInput("requestedPatchVersion");
    let propertiesInput = tl.getInput("buildProperties");
    let verbosity = tl.getInput("verbosityPack");
    let nobuild = tl.getBoolInput("nobuild");
    let outputDir = undefined;

    try {
        // If outputDir is not provided then the root working directory is set by default.
        // By requiring it, it will throw an error if it is not provided and we can set it to undefined.
        outputDir = tl.getPathInput("outputDir", true);
    }
    catch (error) {
        outputDir = undefined;
    }

    try {
        let version: string = undefined;
        switch (versioningScheme) {
            case "off":
                break;
            case "byPrereleaseNumber":
                tl.debug(`Getting prerelease number`);

                let nowUtcString = utility.getUtcDateString();
                version = `${majorVersion}.${minorVersion}.${patchVersion}-CI-${nowUtcString}`;
                break;
            case "byEnvVar":
                tl.debug(`Getting version from env var: ${versionEnvVar}`);
                version = tl.getVariable(versionEnvVar);
                if (!version) {
                    tl.setResult(tl.TaskResult.Failed, tl.loc("Error_NoValueFoundForEnvVar"));
                    break;
                }
                break;
            case "byBuildNumber":
                tl.debug("Getting version number from build number")

                if (tl.getVariable("SYSTEM_HOSTTYPE") === "release") {
                    tl.setResult(tl.TaskResult.Failed, tl.loc("Error_AutomaticallyVersionReleases"));
                    return;
                }

                let buildNumber: string = tl.getVariable("BUILD_BUILDNUMBER");
                tl.debug(`Build number: ${buildNumber}`);

                let versionRegex = /\d+\.\d+\.\d+(?:\.\d+)?/;
                let versionMatches = buildNumber.match(versionRegex);
                if (!versionMatches) {
                    tl.setResult(tl.TaskResult.Failed, tl.loc("Error_NoVersionFoundInBuildNumber"));
                    return;
                }

                if (versionMatches.length > 1) {
                    tl.warning(tl.loc("Warning_MoreThanOneVersionInBuildNumber"))
                }

                version = versionMatches[0];
                break;
        }

        tl.debug(`Version to use: ${version}`);

        if (outputDir && !tl.exist(outputDir)) {
            tl.debug(`Creating output directory: ${outputDir}`);
            tl.mkdirP(outputDir);
        }

        let useLegacyFind: boolean = tl.getVariable("NuGet.UseLegacyFindFiles") === "true";
        let filesList: string[] = [];
        if (!useLegacyFind) {
            let findOptions: tl.FindOptions = <tl.FindOptions>{};
            let matchOptions: tl.MatchOptions = <tl.MatchOptions>{};
            filesList = tl.findMatch(undefined, searchPattern, findOptions, matchOptions);
        }
        else {
            filesList = nutil.resolveFilterSpec(searchPattern);
        }

        if (filesList && filesList.length < 1 && searchPattern) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("Info_NoFilesMatchedTheSearchPattern"));
            return;
        } else {
            filesList = [""];
        }

        tl.debug(`Found ${filesList.length} files`);
        filesList.forEach(file => {
            tl.debug(`--File: ${file}`);
        });

        let props: string[] = [];
        if (configuration && configuration !== "$(BuildConfiguration)") {
            props.push(`Configuration=${configuration}`);
        }
        if (propertiesInput) {
            props = props.concat(propertiesInput.split(";"));
        }

        let environmentSettings: ngToolRunner.NuGetEnvironmentSettings = {
            credProviderFolder: null,
            extensionsDisabled: true
        };

        const dotnetPath = tl.which("dotnet", true);

        for (const file of filesList) {
            await dotnetPackAsync(dotnetPath, file, outputDir, nobuild, version, props, verbosity);
        }
    } catch (err) {
        tl.error(err);
        tl.setResult(tl.TaskResult.Failed, tl.loc("Error_PackageFailure"));
    }
}

function dotnetPackAsync(dotnetPath: string, packageFile: string, outputDir: string, nobuild: boolean, version: string, properties: string[], verbosity: string): Q.Promise<number> {
    let dotnet = tl.tool(dotnetPath);

    dotnet.arg("pack");
    dotnet.arg(packageFile);

    if (outputDir) {
        dotnet.arg("--output");
        dotnet.arg(outputDir);
    }

    if (nobuild) {
        dotnet.arg("--no-build");
    }

    if (properties && properties.length > 0) {
        dotnet.arg("/p:" + properties.join(";"));
    }

    if (version) {
        dotnet.arg("/p:PackageVersion=" + version);
    }

    if (verbosity && verbosity !== "-") {
        dotnet.arg("--verbosity");
        dotnet.arg(verbosity);
    }

    return dotnet.exec({ cwd: path.dirname(packageFile) } as IExecOptions);
}
