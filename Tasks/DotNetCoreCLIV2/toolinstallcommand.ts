import * as tl from 'azure-pipelines-task-lib/task';
import * as Q from 'q';
import * as auth from 'packaging-common/nuget/Authentication';
import { NuGetConfigHelper2 } from 'packaging-common/nuget/NuGetConfigHelper2';
import * as ngRunner from 'packaging-common/nuget/NuGetToolRunner2';
import { IExecOptions } from 'azure-pipelines-task-lib/toolrunner';
import * as nutil from 'packaging-common/nuget/Utility';
import * as commandHelper from 'packaging-common/nuget/CommandHelper';
import * as pkgLocationUtils from 'packaging-common/locationUtilities';
import { getProjectAndFeedIdFromInputParam, logError } from 'packaging-common/util';

export async function run(): Promise<void> {
    console.log(tl.loc('DeprecatedDotnet2_2_And_3_0'));
    let packagingLocation: pkgLocationUtils.PackagingLocation;
    try {
        packagingLocation = await pkgLocationUtils.getPackagingUris(pkgLocationUtils.ProtocolType.NuGet);
    } catch (error) {
        tl.debug('Unable to get packaging URIs, using default collection URI');
        logError(error);
        const collectionUrl = tl.getVariable('System.TeamFoundationCollectionUri');
        packagingLocation = {
            PackagingUris: [collectionUrl],
            DefaultPackagingUri: collectionUrl
        };
    }

    const buildIdentityDisplayName: string = null;
    const buildIdentityAccount: string = null;

    try {
        const verbosity = tl.getInput('verbosityRestore');

        // Setting up auth-related variables
        tl.debug('Setting up auth');
        let urlPrefixes = packagingLocation.PackagingUris;
        tl.debug(`Discovered URL prefixes: ${urlPrefixes}`);

        // Note to readers: This variable will be going away once we have a fix for the location service for
        // customers behind proxies
        const testPrefixes = tl.getVariable('DotNetCoreCLITask.ExtraUrlPrefixesForTesting');
        if (testPrefixes) {
            urlPrefixes = urlPrefixes.concat(testPrefixes.split(';'));
            tl.debug(`All URL prefixes: ${urlPrefixes}`);
        }

        const accessToken = pkgLocationUtils.getSystemAccessToken();

        const externalAuthArr: auth.ExternalAuthInfo[] = commandHelper.GetExternalAuthInfoArray('externalEndpoints');
        const authInfo = new auth.NuGetExtendedAuthInfo(new auth.InternalAuthInfo(urlPrefixes, accessToken, /*useCredProvider*/ null, /*useCredConfig*/ true), externalAuthArr);

        // Setting up sources, either from provided config file or from feed selection
        tl.debug('Setting up sources');
        let nuGetConfigPath: string = undefined;
        const selectOrConfig = tl.getInput('selectOrConfig');

        // This IF is here in order to provide a value to nuGetConfigPath (if option selected, if user provided it)
        // and then pass it into the config helper
        if (selectOrConfig === 'config') {
            nuGetConfigPath = tl.getPathInput('nugetConfigPath', false, true);
            if (!tl.filePathSupplied('nugetConfigPath')) {
                nuGetConfigPath = undefined;
            }
        }

        // If there was no nuGetConfigPath, NuGetConfigHelper will create one
        const nuGetConfigHelper = new NuGetConfigHelper2(
            null,
            nuGetConfigPath,
            authInfo,
            { credProviderFolder: null, extensionsDisabled: true },
            null /* tempConfigPath */,
            false /* useNugetToModifyConfigFile */);

        let credCleanup = () => { return; };

        // Now that the NuGetConfigHelper was initialized with all the known information we can proceed
        // and check if the user picked the 'select' option to fill out the config file if needed
        if (selectOrConfig === 'select') {
            const sources: Array<auth.IPackageSource> = new Array<auth.IPackageSource>();
            const feed = getProjectAndFeedIdFromInputParam('feedRestore');

            if (feed.feedId) {
                const feedUrl: string = await nutil.getNuGetFeedRegistryUrl(packagingLocation.DefaultPackagingUri, feed.feedId, feed.projectId, null, accessToken);
                sources.push(<auth.IPackageSource>
                    {
                        feedName: feed.feedId,
                        feedUri: feedUrl,
                        isInternal: true
                    });
            }

            const includeNuGetOrg = tl.getBoolInput('includeNuGetOrg', false);
            if (includeNuGetOrg) {
                sources.push(auth.NuGetOrgV3PackageSource);
            }

            // Creating NuGet.config for the user
            if (sources.length > 0) {
                tl.debug(`Adding the following sources to the config file: ${sources.map(x => x.feedName).join(';')}`);
                nuGetConfigHelper.addSourcesToTempNuGetConfig(sources);
                credCleanup = () => { tl.rmRF(nuGetConfigHelper.tempNugetConfigPath); };
                nuGetConfigPath = nuGetConfigHelper.tempNugetConfigPath;
            } else {
                tl.debug('No sources were added to the temp NuGet.config file');
            }
        }

        // Setting creds in the temp NuGet.config if needed
        nuGetConfigHelper.setAuthForSourcesInTempNuGetConfig();

        const configFile = nuGetConfigHelper.tempNugetConfigPath;

        nuGetConfigHelper.backupExistingRootNuGetFiles();

        const dotnetPath = tl.which('dotnet', true);

        try {
            const packageName = tl.getInput('toolPackageName');
            const toolPackageVersion = tl.getInput('toolPackageVersion');
            const installGlobal = tl.getBoolInput('toolInstallGlobal');
            const installPath = tl.getInput('toolInstallPath');
            await dotNetToolInstallAsync(dotnetPath, packageName, toolPackageVersion, configFile, installGlobal, installPath, verbosity);
        } finally {
            credCleanup();
            nuGetConfigHelper.restoreBackupRootNuGetFiles();
        }

        tl.setResult(tl.TaskResult.Succeeded, tl.loc('ToolInstalledSuccessfully'));

    } catch (err) {

        tl.error(err);

        if (buildIdentityDisplayName || buildIdentityAccount) {
            tl.warning(tl.loc('BuildIdentityPermissionsHint', buildIdentityDisplayName, buildIdentityAccount));
        }

        tl.setResult(tl.TaskResult.Failed, tl.loc('ToolFailedToInstall'));
    }
}

function dotNetToolInstallAsync(dotnetPath: string, packageName: string, packageVersion: string, configFile: string, installGlobal: boolean, installLocation: string, verbosity: string): Q.Promise<number> {
    const dotnet = tl.tool(dotnetPath);
    dotnet.arg('tool');

    dotnet.arg('install');

    dotnet.arg(packageName);

    if (packageVersion && packageVersion.length > 0) {
        dotnet.arg('--version');
        dotnet.arg(packageVersion);
    }

    if (installGlobal === true) {
        dotnet.arg('--global');
    } 
    else if (installLocation && installLocation.length > 0) {
        dotnet.arg('--tool-path');
        dotnet.arg(installLocation);
    }

    dotnet.arg('--configfile');
    dotnet.arg(configFile);

    if (verbosity && verbosity !== '-') {
        dotnet.arg('--verbosity');
        dotnet.arg(verbosity);
    }

    const envWithProxy = ngRunner.setNuGetProxyEnvironment(process.env, configFile, null);
    return dotnet.exec({ env: envWithProxy } as IExecOptions);
}