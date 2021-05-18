
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'xcode.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['HOME'] = '/users/test'; //replace with mock of setVariable when task-lib has the support

// Xcode task defaults used for version 5
tr.setInput('actions', 'archive');
tr.setInput('configuration', '$(Configuration)');
tr.setInput('sdk', '$(SDK)');
tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
tr.setInput('scheme', 'myscheme');
tr.setInput('packageApp', 'false');
tr.setInput('signingOption', 'default');
tr.setInput('signingIdentity', '');
tr.setInput('provisioningProfileUuid', '');
tr.setInput('args', '');
tr.setInput('cwd', '/user/build');
tr.setInput('xcodeVersion', 'default');
tr.setInput('xcodeDeveloperDir', '');
tr.setInput('publishJUnitResults', 'false');
tr.setInput('archivePath', '/user/build');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "xcodebuild": "/home/bin/xcodebuild"
    },
    "checkPath" : {
        "/home/bin/xcodebuild": true
    },
    "getVariable": {
        "build.sourcesDirectory": "/user/build",
        "HOME": "/users/test"
    },
    "findMatch": {
        "**/*.xcodeproj/*.xcworkspace": [
          "/user/build/fun.xcodeproj/project.xcworkspace"
        ],
        "**/*.app": [
          "/user/build/output/$(SDK)/$(Configuration)/build.sym/Release.iphoneos/fun.app"
        ]
    },
    "exec": {
        "/home/bin/xcodebuild -version": {
          "code": 0,
          "stdout": "Xcode 7.2.1"
        },
        "/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme myscheme archive -archivePath /user/build/myscheme": {
          "code": 0,
          "stdout": "xcodebuild output here"
        }
    }
};
tr.setAnswers(a);

tr.run();

