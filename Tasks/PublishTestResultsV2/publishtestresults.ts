import * as path from 'path';
import * as fs from 'fs';
import  * as semver from "semver"
import * as publishTestResultsTool from './publishtestresultstool';
import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-task-lib/toolrunner';
import * as ci from './cieventlogger';

const MERGE_THRESHOLD = 100;
const TESTRUN_SYSTEM = 'VSTS - PTR';

function isNullOrWhitespace(input: any) {
    if (typeof input === 'undefined' || input === null) {
        return true;
    }
    return input.replace(/\s/g, '').length < 1;
}

function publish(testRunner, resultFiles, mergeResults, failTaskOnFailedTests, platform, config, runTitle, publishRunAttachments, testRunSystem) {
    var properties = <{ [key: string]: string }>{};
    properties['type'] = testRunner;

    if (mergeResults) {
        properties['mergeResults'] = mergeResults;
    }
    if (platform) {
        properties['platform'] = platform;
    }
    if (config) {
        properties['config'] = config;
    }
    if (runTitle) {
        properties['runTitle'] = runTitle;
    }
    if (publishRunAttachments) {
        properties['publishRunAttachments'] = publishRunAttachments;
    }
    if (resultFiles) {
        properties['resultFiles'] = resultFiles;
    }   
    if(failTaskOnFailedTests){
        properties['failTaskOnFailedTests'] = failTaskOnFailedTests;
    }
    properties['testRunSystem'] = testRunSystem;

    tl.command('results.publish', properties, '');
}

function getDotNetVersion() {
    let dotnet: tr.ToolRunner;
    const dotnetPath = tl.which('dotnet', false);
    
    if (dotnetPath){
        try {
            dotnet = tl.tool(dotnetPath);
            dotnet.arg('--version');
            return dotnet.execSync().stdout.trim();
        } catch (err) {}
    }
    return '';
}

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        const testRunner = tl.getInput('testRunner', true);
        const testResultsFiles: string[] = tl.getDelimitedInput('testResultsFiles', '\n', true);
        const mergeResults = tl.getInput('mergeTestResults');
        const platform = tl.getInput('platform');
        const config = tl.getInput('configuration');
        const testRunTitle = tl.getInput('testRunTitle');
        const publishRunAttachments = tl.getInput('publishRunAttachments');
        const failTaskOnFailedTests = tl.getInput('failTaskOnFailedTests');
        const failTaskOnMissingResultsFile: boolean = tl.getBoolInput('failTaskOnMissingResultsFile');
        let searchFolder = tl.getInput('searchFolder');

        tl.debug('testRunner: ' + testRunner);
        tl.debug('testResultsFiles: ' + testResultsFiles);
        tl.debug('mergeResults: ' + mergeResults);
        tl.debug('platform: ' + platform);
        tl.debug('config: ' + config);
        tl.debug('testRunTitle: ' + testRunTitle);
        tl.debug('publishRunAttachments: ' + publishRunAttachments);
        tl.debug('failTaskOnFailedTests: ' + failTaskOnFailedTests);
        tl.debug('failTaskOnMissingResultsFile: ' + failTaskOnMissingResultsFile);

        if (isNullOrWhitespace(searchFolder)) {
            searchFolder = tl.getVariable('System.DefaultWorkingDirectory');
        }
        
        if(tl.getVariable('System.DefaultWorkingDirectory') && (!path.isAbsolute(searchFolder)))
        {
            searchFolder = path.join(tl.getVariable('System.DefaultWorkingDirectory'),searchFolder);
        }
        // Sending allowBrokenSymbolicLinks as true, so we don't want to throw error when symlinks are broken.
        // And can continue with other files if there are any.
        const findOptions = <tl.FindOptions>{
            allowBrokenSymbolicLinks: true,
            followSpecifiedSymbolicLink: true,
            followSymbolicLinks: true
        }; 

        const matchingTestResultsFiles = tl.findMatch(searchFolder, testResultsFiles, findOptions);

        const testResultsFilesCount = matchingTestResultsFiles ? matchingTestResultsFiles.length : 0;

        tl.debug(`Detected ${testResultsFilesCount} test result files`);

        ci.addToConsolidatedCi('testRunner', testRunner);
        ci.addToConsolidatedCi('failTaskOnFailedTests', failTaskOnFailedTests);
        ci.addToConsolidatedCi('failTaskOnMissingResultsFile', failTaskOnMissingResultsFile);
        ci.addToConsolidatedCi('mergeResultsUserPreference', mergeResults);
        ci.addToConsolidatedCi('config', config);
        ci.addToConsolidatedCi('platform', platform);
        ci.addToConsolidatedCi('testResultsFilesCount', testResultsFilesCount);

        const dotnetVersion = getDotNetVersion();
        ci.addToConsolidatedCi('dotnetVersion', dotnetVersion);

        const forceMerge = testResultsFilesCount > MERGE_THRESHOLD;
        if (forceMerge) {
            tl.debug('Detected large number of test result files. Merged all of them into a single file and published a single test run to optimize for test result publish performance instead of publishing hundreds of test runs');
        }

        if (testResultsFilesCount === 0) {
            ci.addToConsolidatedCi('noResultsFileFound', true);

            if (failTaskOnMissingResultsFile) {
                tl.setResult(tl.TaskResult.Failed, tl.loc('NoMatchingFilesFound', testResultsFiles));
            } else {
                tl.warning(tl.loc('NoMatchingFilesFound', testResultsFiles));
            }
        } else {
            const osType = tl.osType();
            // This variable can be set as build variable to force the task to use command flow
            const isExeFlowOverridden = tl.getVariable('PublishTestResults.OverrideExeFlow');

            tl.debug('OS type: ' + osType);

            if (osType === 'Windows_NT' && isExeFlowOverridden != 'true') {
                const testResultsPublisher = new publishTestResultsTool.TestResultsPublisher(matchingTestResultsFiles,
                    forceMerge ? true.toString() : mergeResults,
                    failTaskOnFailedTests,
                    platform,
                    config,
                    testRunTitle,
                    publishRunAttachments,
                    testRunner,
                    TESTRUN_SYSTEM);
                const exitCode = await testResultsPublisher.publishResultsThroughExe();
                tl.debug("Exit code of TestResultsPublisher: " + exitCode);

                if (exitCode === 20000) {
                    // The exe returns with exit code: 20000 if the Feature flag is off or if it fails to fetch the Feature flag value
                    publish(testRunner, matchingTestResultsFiles,
                        forceMerge ? true.toString() : mergeResults,
                        failTaskOnFailedTests,
                        platform,
                        config,
                        testRunTitle,
                        publishRunAttachments,
                        TESTRUN_SYSTEM);
                } else if (exitCode === 40000) {
                    // The exe returns with exit code: 40000 if there are test failures found and failTaskOnFailedTests is true
                    ci.addToConsolidatedCi('failedTestsInRun', true);
                    tl.setResult(tl.TaskResult.Failed, tl.loc('ErrorFailTaskOnFailedTests'));
                }

                if (exitCode !== 20000) {
                    // Doing it only for test results published using TestResultPublisher tool.
                    // For other publishes, publishing to evidence store happens as part of results.publish command itself.
                    readAndPublishTestRunSummaryToEvidenceStore(testRunner);
                }
            } else {
                publish(testRunner, matchingTestResultsFiles,
                    forceMerge ? true.toString() : mergeResults,
                    failTaskOnFailedTests,
                    platform,
                    config,
                    testRunTitle,
                    publishRunAttachments,
                    TESTRUN_SYSTEM);
            }
        }
        tl.setResult(tl.TaskResult.Succeeded, '');
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    } finally {
        ci.fireConsolidatedCi();
    }
}

function readAndPublishTestRunSummaryToEvidenceStore(testRunner: string) {
    try {
        const agentVersion = tl.getVariable('Agent.Version');
        if (semver.lt(agentVersion, "2.164.0")) {
            throw "Required agent version greater than or equal to 2.164.0";
        }

        var tempPath = tl.getVariable('Agent.TempDirectory');
        var testRunSummaryPath = path.join(tempPath, "PTR_TEST_RUNSUMMARY.json");

        var testRunSummary = fs.readFileSync(testRunSummaryPath, 'utf-8');

        var properties = <{ [key: string]: string }>{};

        properties['name'] = "PublishTestResults";
        properties['testrunner'] = testRunner;
        properties['testrunsummary'] = testRunSummary;
        properties['description'] = "Test Results published from Publish Test Results tool";

        tl.command('results.publishtoevidencestore', properties, '');
    } catch (error) {
        tl.debug(`Unable to publish the test run summary to evidencestore, error details:${error}`);
    }

}

run();
