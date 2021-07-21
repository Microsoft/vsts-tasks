import tl = require('azure-pipelines-task-lib/task');
import ffl = require('./find-files-legacy');

var testRunner = tl.getInput('testRunner', true);
var testResultsFiles = tl.getInput('testResultsFiles', true);
var mergeResults = tl.getInput('mergeTestResults');
var platform = tl.getInput('platform');
var config = tl.getInput('configuration');
var testRunTitle = tl.getInput('testRunTitle');
var publishRunAttachments = tl.getInput('publishRunAttachments');

tl.debug('testRunner: ' + testRunner);
tl.debug('testResultsFiles: ' + testResultsFiles);
tl.debug('mergeResults: ' + mergeResults);
tl.debug('platform: ' + platform);
tl.debug('config: ' + config);
tl.debug('testRunTitle: ' + testRunTitle);
tl.debug('publishRunAttachments: ' + publishRunAttachments);

let matchingTestResultsFiles = ffl.findFiles(testResultsFiles, false, tl.getVariable('System.DefaultWorkingDirectory'));
if(!matchingTestResultsFiles || matchingTestResultsFiles.length == 0) {
  let warningMessage = "No test result files matching " + testResultsFiles + " were found.";
  tl.warning(warningMessage);
  tl.setResult(0, warningMessage);
}
else{
  let tp = new tl.TestPublisher(testRunner);
  tp.publish(matchingTestResultsFiles, mergeResults, platform, config, testRunTitle, publishRunAttachments);
}