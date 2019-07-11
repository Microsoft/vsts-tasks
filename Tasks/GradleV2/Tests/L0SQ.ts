import * as ma from 'azure-pipelines-task-lib/mock-answer';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import path = require('path');

let taskPath = path.join(__dirname, '..', 'gradletask.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

 //escape for Windows directories
let tempDir: string = path.join(__dirname, '_temp');
let sqAnalysisDirReplaced: string = path.join(tempDir, '.sqAnalysis').replace(/\\/g, '/');
let taskReportValidDir: string = path.join(__dirname, 'data', 'taskreport-valid');
let taskReportValidBuildDir: string = path.join(taskReportValidDir, 'build');
let taskReportValidBuildDirReplaced: string = path.join(taskReportValidDir, 'build').replace(/\\/g, '/');
let taskReportValidBuildSonarDir: string = path.join(taskReportValidBuildDir, 'sonar');
let taskReportValidBuildSonarDirReplaced: string = path.join(taskReportValidBuildDir, 'sonar').replace(/\\/g, '/');
let taskReportValidBuildSonarReportTaskTextDirReplaced: string = path.join(taskReportValidBuildSonarDir, 'report-task.txt').replace(/\\/g, '/');
let ccReportDirReplaced: string = path.join(__dirname, 'CCReport43F6D5EF', 'coverage.xml').replace(/\\/g, '/');

//Env vars in the mock framework must replace '.' with '_'
//replace with mock of setVariable when task-lib has the support
process.env['MOCK_IGNORE_TEMP_PATH'] = 'true';
process.env['MOCK_TEMP_PATH'] = path.join(__dirname, '..', '..');
process.env['MOCK_NORMALIZE_SLASHES'] = 'true';

process.env['JAVA_HOME_8_X86'] = '/user/local/bin/Java8';

process.env['BUILD_BUILDNUMBER'] = '14';
process.env['BUILD_SOURCESDIRECTORY'] = `${taskReportValidDir}`;
process.env['BUILD_ARTIFACTSTAGINGDIRECTORY'] = `${tempDir}`;
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = `${taskReportValidDir}`;

tr.setInput('wrapperScript', 'gradlew');
tr.setInput('cwd', '/home/repo/src');
tr.setInput('options', '');
tr.setInput('tasks', 'build');
tr.setInput('javaHomeSelection', 'JDKVersion');
tr.setInput('jdkVersion', 'default');
tr.setInput('publishJUnitResults', 'true');
tr.setInput('testResultsFiles', '**/build/test-results/TEST-*.xml');

tr.setInput('sqAnalysisEnabled', 'true');
tr.setInput('sqGradlePluginVersionChoice', 'specify');
tr.setInput('sqGradlePluginVersion', '2.6.1');

//construct a string that is JSON, call JSON.parse(string), send that to ma.TaskLibAnswers
let myAnswers: string = `{
   "exec":{
      "gradlew build -I /GradleV2/node_modules/codeanalysis-common/sonar.gradle sonarqube":{
         "code":0,
         "stdout":"Gradle build and SQ analysis done"
      },
      "gradlew.bat build -I /GradleV2/node_modules/codeanalysis-common/sonar.gradle sonarqube":{
         "code":0,
         "stdout":"Gradle build and SQ analysis done"
      }
   },
   "checkPath":{
      "gradlew":true,
      "gradlew.bat":true,
      "/home/repo/src":true,
      "${sqAnalysisDirReplaced}":true,
      "${taskReportValidBuildDirReplaced}":true,
      "${taskReportValidBuildSonarDirReplaced}":true,
      "${taskReportValidBuildSonarReportTaskTextDirReplaced}":true
   },
   "findMatch":{
      "**/build/test-results/TEST-*.xml":[
         "/user/build/fun/test-123.xml"
      ]
   },
   "stats":{
      "${ccReportDirReplaced}":{
         "isFile":true
      },
      "${sqAnalysisDirReplaced}":{
         "isFile":true
      },
      "${taskReportValidBuildDirReplaced}":{
         "isFile":true
      },
      "${taskReportValidBuildSonarDirReplaced}":{
         "isFile":true
      },
      "${taskReportValidBuildSonarReportTaskTextDirReplaced}":{
         "isFile":true
      }
   },
   "exist":{
      "${sqAnalysisDirReplaced}":true,
      "${taskReportValidBuildDirReplaced}":true,
      "${taskReportValidBuildSonarDirReplaced}":true,
      "${taskReportValidBuildSonarReportTaskTextDirReplaced}":true
   },
   "mkdirP":{
      "${sqAnalysisDirReplaced}":true,
      "${taskReportValidBuildDirReplaced}":true,
      "${taskReportValidBuildSonarDirReplaced}":true,
      "${taskReportValidBuildSonarReportTaskTextDirReplaced}":true
   }
}`;

let json: any = JSON.parse(myAnswers);

// Cast the json blob into a TaskLibAnswers
tr.setAnswers(<ma.TaskLibAnswers>json);

tr.run();
