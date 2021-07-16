var path = require('path');
var url = require('url');
var fs = require('fs');

import * as tl from 'azure-pipelines-task-lib/task';
import { IBuildApi } from 'azure-devops-node-api/BuildApi';
import { IRequestHandler } from 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces';
import { WebApi, getHandlerFromToken } from 'azure-devops-node-api/WebApi';
import { BuildStatus, BuildResult, BuildQueryOrder, Build, BuildDefinitionReference } from 'azure-devops-node-api/interfaces/BuildInterfaces';

import * as models from 'artifact-engine/Models';
import * as engine from 'artifact-engine/Engine';
import * as webHandlers from 'artifact-engine/Providers/typed-rest-client/Handlers';
import { IBaseHandlerConfig, IContainerHandlerConfig, IContainerHandlerZipConfig } from './DownloadHandlers/HandlerConfigs';

import { DownloadHandlerContainer } from './DownloadHandlers/DownloadHandlerContainer';
import { DownloadHandlerContainerZip } from './DownloadHandlers/DownloadHandlerContainerZip';
import { DownloadHandlerFilePath } from './DownloadHandlers/DownloadHandlerFilePath';

import { resolveParallelProcessingLimit } from './download_helper';

import { extractTarsIfPresent, cleanUpFolder } from './file_helper';

var taskJson = require('./task.json');

tl.setResourcePath(path.join(__dirname, 'task.json'));

const area: string = 'DownloadBuildArtifacts';
const DefaultParallelProcessingLimit: number = 8;

function getDefaultProps() {
    var hostType = (tl.getVariable('SYSTEM.HOSTTYPE') || "").toLowerCase();
    return {
        hostType: hostType,
        definitionName: '[NonEmail:' + (hostType === 'release' ? tl.getVariable('RELEASE.DEFINITIONNAME') : tl.getVariable('BUILD.DEFINITIONNAME')) + ']',
        processId: hostType === 'release' ? tl.getVariable('RELEASE.RELEASEID') : tl.getVariable('BUILD.BUILDID'),
        processUrl: hostType === 'release' ? tl.getVariable('RELEASE.RELEASEWEBURL') : (tl.getVariable('SYSTEM.TEAMFOUNDATIONSERVERURI') + tl.getVariable('SYSTEM.TEAMPROJECT') + '/_build?buildId=' + tl.getVariable('BUILD.BUILDID')),
        taskDisplayName: tl.getVariable('TASK.DISPLAYNAME'),
        jobid: tl.getVariable('SYSTEM.JOBID'),
        agentVersion: tl.getVariable('AGENT.VERSION'),
        agentOS: tl.getVariable('AGENT.OS'),
        agentName: tl.getVariable('AGENT.NAME'),
        version: taskJson.version
    };
}

function publishEvent(feature, properties: any): void {
    try {
        var splitVersion = (process.env.AGENT_VERSION || '').split('.');
        var major = parseInt(splitVersion[0] || '0');
        var minor = parseInt(splitVersion[1] || '0');
        let telemetry = '';
        if (major > 2 || (major == 2 && minor >= 120)) {
            telemetry = `##vso[telemetry.publish area=${area};feature=${feature}]${JSON.stringify(Object.assign(getDefaultProps(), properties))}`;
        }
        else {
            if (feature === 'reliability') {
                let reliabilityData = properties;
                telemetry = "##vso[task.logissue type=error;code=" + reliabilityData.issueType + ";agentVersion=" + tl.getVariable('Agent.Version') + ";taskId=" + area + "-" + JSON.stringify(taskJson.version) + ";]" + reliabilityData.errorMessage
            }
        }
        console.log(telemetry);;
    }
    catch (err) {
        tl.warning("Failed to log telemetry, error: " + err);
    }
}

async function main(): Promise<void> {
    var promise = new Promise<void>(async (resolve, reject) => {
        var buildType: string = tl.getInput("buildType", true);
        var isCurrentBuild: boolean = buildType.toLowerCase() === 'current';
        var isSpecificBuildWithTriggering: boolean = tl.getBoolInput("specificBuildWithTriggering", false);
        var projectId: string = null;
        var definitionId: string = null;
        var definitionIdSpecified: string = null;
        var definitionIdTriggered: string = null;
        var buildId: number = null;
        var buildVersionToDownload: string = tl.getInput("buildVersionToDownload", false);
        var allowPartiallySucceededBuilds: boolean = tl.getBoolInput("allowPartiallySucceededBuilds", false);
        var branchName: string = tl.getInput("branchName", false);
        var downloadPath: string = path.normalize(tl.getInput("downloadPath", true));
        var cleanDestinationFolder: boolean = tl.getBoolInput("cleanDestinationFolder", false);
        var downloadType: string = tl.getInput("downloadType", true);
        var tagFiltersInput: string = tl.getInput("tags", false);
        var tagFilters = [];
        if (!!tagFiltersInput) {
            tagFilters = tagFiltersInput.split(",");
        }
        const checkDownloadedFiles: boolean = tl.getBoolInput('checkDownloadedFiles', false);

        const shouldExtractTars: boolean = tl.getBoolInput('extractTars');
        const isWin = process.platform === 'win32';
        if (shouldExtractTars && isWin) {
            reject(tl.loc('TarExtractionNotSupportedInWindows'));
            return;
        }

        var endpointUrl: string = tl.getVariable("System.TeamFoundationCollectionUri");
        var accessToken: string = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'AccessToken', false);
        var credentialHandler: IRequestHandler = getHandlerFromToken(accessToken);
        var webApi: WebApi = new WebApi(endpointUrl, credentialHandler);
        const retryLimitRequest: number  = parseInt(tl.getVariable('VSTS_HTTP_RETRY')) ? parseInt(tl.getVariable("VSTS_HTTP_RETRY")) : 4;
        const retryLimitDownload: number = parseInt(tl.getInput('retryDownloadCount', false)) ? parseInt(tl.getInput('retryDownloadCount', false)) : 4;

        var templatePath: string = path.join(__dirname, 'vsts.handlebars.txt');
        var buildApi: IBuildApi = await executeWithRetries("getBuildApi", () => webApi.getBuildApi(), retryLimitRequest).catch((reason) => {
            reject(reason);
            return;
        });
        var artifacts = [];

        // Clean destination folder if requested
        if (cleanDestinationFolder) {
            cleanUpFolder(downloadPath);
        }

        if (isCurrentBuild) {
            projectId = tl.getVariable("System.TeamProjectId");
            definitionId = '';
            buildId = parseInt(tl.getVariable("Build.BuildId"));
        }
        else {
            var releaseAlias: string = tl.getVariable("release.triggeringartifact.alias");
            var triggeringBuildFound: boolean = false;
            definitionIdSpecified = tl.getInput("definition", true);
            if (isSpecificBuildWithTriggering) {
                let hostType = tl.getVariable('system.hostType');
                if ((hostType && hostType.toUpperCase() != 'BUILD')) {
                    // try to use alias to grab triggering artifact for release, starting with definition to verify parity with specified definition
                    definitionIdTriggered = tl.getVariable("release.artifacts." + releaseAlias + ".definitionId");
                    if (definitionIdTriggered == definitionIdSpecified) {
                        // populate values using the triggering build
                        projectId = tl.getVariable("release.artifacts." + releaseAlias + ".projectId");
                        definitionId = definitionIdTriggered;
                        buildId = parseInt(tl.getVariable("release.artifacts." + releaseAlias + ".buildId"));

                        // verify that the triggerring bruild's info was found
                        if (projectId && definitionId && buildId) {
                            triggeringBuildFound = true;
                        }
                    }
                }
                else {
                    //Verify that the triggering build's definition is the same as the specified definition
                    definitionIdTriggered = tl.getVariable("build.triggeredBy.definitionId");
                    if (definitionIdTriggered == definitionIdSpecified) {
                        // populate values using the triggering build
                        projectId = tl.getVariable("build.triggeredBy.projectId");
                        definitionId = definitionIdTriggered;
                        buildId = parseInt(tl.getVariable("build.triggeredBy.buildId"));

                        // verify that the triggerring bruild's info was found
                        if (projectId && definitionId && buildId) {
                            triggeringBuildFound = true;
                        }
                    }
                }
            }

            if (!triggeringBuildFound) {
                // Triggering build info not found, or requested, default to specified build info
                projectId = tl.getInput("project", true);
                definitionId = definitionIdSpecified;
                buildId = parseInt(tl.getInput("buildId", buildVersionToDownload == "specific"));
            }

            // if the definition name includes a variable then definitionIdSpecified is a name vs a number
            if (!!definitionIdSpecified && Number.isNaN(parseInt(definitionIdSpecified))) {
                var definitions: BuildDefinitionReference[] = await executeWithRetries("getBuildDefinitions", () => buildApi.getDefinitions(projectId, definitionIdSpecified), retryLimitRequest).catch((reason) => {
                    reject(reason);
                    return;
                });

                if (!definitions || definitions.length < 1) {
                    reject(tl.loc("InvalidBuildDefinitionName", definitionIdSpecified));
                    return;
                }

                definitionId = String(definitions[0].id);
                console.log(tl.loc("DefinitionNameMatchFound", definitionIdSpecified, definitionId));
            }

            if (!definitionId) {
                reject(tl.loc("UnresolvedDefinitionId"));
                return;
            }
        }

        // verify that buildId belongs to the definition selected
        if (definitionId) {
            var build: Build;
            if (buildVersionToDownload != "specific" && !triggeringBuildFound) {
                var resultFilter = BuildResult.Succeeded;
                if (allowPartiallySucceededBuilds) {
                    resultFilter |= BuildResult.PartiallySucceeded;
                }
                var branchNameFilter = (buildVersionToDownload == "latest") ? null : branchName;

                // get latest successful build filtered by branch
                var buildsForThisDefinition = await executeWithRetries("getBuildId", () => buildApi.getBuilds(projectId, [parseInt(definitionId)], null, null, null, null, null, null, BuildStatus.Completed, resultFilter, tagFilters, null, null, null, null, null, BuildQueryOrder.FinishTimeDescending, branchNameFilter), retryLimitRequest).catch((reason) => {
                    reject(reason);
                    return;
                });

                if (!buildsForThisDefinition || buildsForThisDefinition.length == 0) {
                    if (buildVersionToDownload == "latestFromBranch") reject(tl.loc("LatestBuildFromBranchNotFound", branchNameFilter));
                    else reject(tl.loc("LatestBuildNotFound"));
                    return;
                }

                build = buildsForThisDefinition[0];
                console.log(tl.loc("LatestBuildFound", build.id));
                buildId = build.id
            }

            if (!build) {
                build = await executeWithRetries("getBuild", () => buildApi.getBuild(buildId, projectId), retryLimitRequest).catch((reason) => {
                    reject(reason);
                    return;
                });
            }

            if (build) {
                if (!build.definition || build.definition.id !== parseInt(definitionId)) {
                    reject(tl.loc("BuildIdBuildDefinitionMismatch", buildId, definitionId));
                    return;
                }
            }
            else {
                reject(tl.loc("BuildNotFound", buildId));
                return;
            }
        }

        console.log(tl.loc("DownloadingArtifactsForBuild", buildId));

        // populate output variable 'BuildNumber' with buildId
        tl.setVariable('BuildNumber', buildId.toString());

        // populate itempattern and artifacts based on downloadType
        if (downloadType === 'single') {
            var artifactName = tl.getInput("artifactName", true);
            var artifact = await executeWithRetries("getArtifact", () => buildApi.getArtifact(buildId, artifactName, projectId), retryLimitRequest).catch((reason) => {
                reject(reason);
                return;
            });

            if (!artifact) {
                reject(tl.loc("BuildArtifactNotFound", artifactName, buildId));
                return;
            }

            artifacts.push(artifact);
        }
        else {
            var buildArtifacts = await executeWithRetries("getArtifacts", () => buildApi.getArtifacts(buildId, projectId), retryLimitRequest).catch((reason) => {
                reject(reason);
            });

            if (!buildArtifacts) {
                tl.warning(tl.loc("NoArtifactsFound", buildId));
                resolve();
                return;
            }

            console.log(tl.loc("LinkedArtifactCount", buildArtifacts.length));
            artifacts = artifacts.concat(buildArtifacts);
        }

        if (artifacts) {
            var downloadPromises: Array<Promise<models.ArtifactDownloadTicket[]>> = [];
            artifacts.forEach(async function (artifact, index, artifacts) {
                const downloaderOptions: engine.ArtifactEngineOptions = configureDownloaderOptions();

                const config: IBaseHandlerConfig = {
                    artifactInfo: artifact,
                    downloadPath: downloadPath,
                    downloaderOptions: downloaderOptions,
                    checkDownloadedFiles: checkDownloadedFiles
                };

                if (artifact.resource.type.toLowerCase() === "container") {
                    var handler = new webHandlers.PersonalAccessTokenCredentialHandler(accessToken);
                    // this variable uses to force enable zip download option, it is used only in test purpose and shouldn't be used for other reasons
                    const forceEnableZipDownloadOption = tl.getVariable("DownloadBuildArtifacts.ForceEnableDownloadZipForCanary");
                    const forceEnableZipDownloadOptionBool = forceEnableZipDownloadOption ? forceEnableZipDownloadOption.toLowerCase() == 'true' : false;
                    var isPullRequestFork = tl.getVariable("SYSTEM.PULLREQUEST.ISFORK");
                    var isPullRequestForkBool = isPullRequestFork ? isPullRequestFork.toLowerCase() == 'true' : false;
                    var isZipDownloadDisabled = tl.getVariable("SYSTEM.DisableZipDownload");
                    var isZipDownloadDisabledBool = isZipDownloadDisabled ? isZipDownloadDisabled.toLowerCase() != 'false' : false;

                    // Disable zip download if selective itemPattern provided
                    if (downloaderOptions.itemPattern !== "**") {
                        isZipDownloadDisabledBool = true;
                    }

                    if (isWin && ((!isZipDownloadDisabledBool && isPullRequestForkBool) || forceEnableZipDownloadOptionBool)) {
                        const operationName: string = `Download zip - ${artifact.name}`;

                        const handlerConfig: IContainerHandlerZipConfig = { ...config, projectId, buildId, handler, endpointUrl };
                        const downloadHandler: DownloadHandlerContainerZip = new DownloadHandlerContainerZip(handlerConfig);

                        const downloadPromise: Promise<models.ArtifactDownloadTicket[]> = executeWithRetries(
                            operationName,
                            () => downloadHandler.downloadResources(),
                            retryLimitDownload
                        ).catch((reason) => {
                            reject(reason);
                            return;
                        });

                        downloadPromises.push(downloadPromise);
                        await downloadPromise;
                    } else {
                        const operationName: string = `Download container - ${artifact.name}`;

                        const handlerConfig: IContainerHandlerConfig = { ...config, endpointUrl, templatePath, handler };
                        const downloadHandler: DownloadHandlerContainer = new DownloadHandlerContainer(handlerConfig);
                        const downloadPromise: Promise<models.ArtifactDownloadTicket[]> = executeWithRetries(
                            operationName,
                            () => downloadHandler.downloadResources(),
                            retryLimitDownload
                        ).catch((reason) => {
                            reject(reason);
                            return;
                        });

                        downloadPromises.push(downloadPromise);
                        await downloadPromise;
                    }
                } else if (artifact.resource.type.toLowerCase() === "filepath") {
                    const operationName: string = `Download by FilePath - ${artifact.name}`;

                    const downloadHandler: DownloadHandlerFilePath = new DownloadHandlerFilePath(config);
                    const downloadPromise: Promise<models.ArtifactDownloadTicket[]> = executeWithRetries(
                        operationName,
                        () => downloadHandler.downloadResources(),
                        retryLimitDownload
                    ).catch((reason) => {
                        reject(reason);
                        return;
                    });

                    downloadPromises.push(downloadPromise);
                    await downloadPromise;
                } else {
                    console.log(tl.loc("UnsupportedArtifactType", artifact.resource.type));
                }
            });

            Promise.all(downloadPromises).then((tickets: models.ArtifactDownloadTicket[][]) => {
                console.log(tl.loc('ArtifactsSuccessfullyDownloaded', downloadPath));

                if (shouldExtractTars) {
                    extractTarsIfPresent(tickets, downloadPath);
                }

                resolve();
            }).catch((error) => {
                reject(error);
            });
        }
    });
    return promise;
}

function executeWithRetries(operationName: string, operation: () => Promise<any>, retryCount): Promise<any> {
    var executePromise = new Promise((resolve, reject) => {
        executeWithRetriesImplementation(operationName, operation, retryCount, resolve, reject, retryCount);
    });

    return executePromise;
}

function executeWithRetriesImplementation(operationName: string, operation: () => Promise<any>, currentRetryCount, resolve, reject, retryCountLimit) {
    operation().then((result) => {
        resolve(result);
    }).catch((error) => {
        if (currentRetryCount <= 0) {
            tl.error(tl.loc("OperationFailed", operationName, error));
            reject(error);
        }
        else {
            console.log(tl.loc('RetryingOperation', operationName, currentRetryCount));
            currentRetryCount = currentRetryCount - 1;
            setTimeout(() => executeWithRetriesImplementation(operationName, operation, currentRetryCount, resolve, reject, retryCountLimit), getRetryIntervalInSeconds(retryCountLimit - currentRetryCount) * 1000);
        }
    });
}

function getRetryIntervalInSeconds(retryCount: number): number {
    let MaxRetryLimitInSeconds = 360;
    let baseRetryIntervalInSeconds = 5;
    var exponentialBackOff = baseRetryIntervalInSeconds * Math.pow(3, (retryCount + 1));
    return exponentialBackOff < MaxRetryLimitInSeconds ? exponentialBackOff : MaxRetryLimitInSeconds ;
}

function configureDownloaderOptions(): engine.ArtifactEngineOptions {
    const downloaderOptions: engine.ArtifactEngineOptions = new engine.ArtifactEngineOptions();

    const debugMode: string = tl.getVariable('System.Debug');
    downloaderOptions.verbose = debugMode ? debugMode.toLowerCase() !== 'false' : false;

    const artifactDownloadLimit: string = tl.getVariable('release.artifact.download.parallellimit');
    const taskInputParallelLimit: string = tl.getInput('parallelizationLimit', false);
    downloaderOptions.parallelProcessingLimit = resolveParallelProcessingLimit(artifactDownloadLimit, taskInputParallelLimit, DefaultParallelProcessingLimit);

    downloaderOptions.itemPattern = tl.getInput('itemPattern', false) || '**';

    return downloaderOptions;
}

main()
    .then((result) => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch((err) => {
        publishEvent('reliability', { issueType: 'error', errorMessage: JSON.stringify(err, Object.getOwnPropertyNames(err)) });
        tl.setResult(tl.TaskResult.Failed, err);
    });
