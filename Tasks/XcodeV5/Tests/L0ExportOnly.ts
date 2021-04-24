
import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'xcode.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['HOME'] = '/users/test'; //replace with mock of setVariable when task-lib has the support

tr.setInput('actions', '');
tr.setInput('packageApp', 'true');
tr.setInput('skipArchiveAction', 'true');
tr.setInput('signingOption', 'default');
tr.setInput('signingIdentity', '');
tr.setInput('provisioningProfileUuid', '');
tr.setInput('args', '');
tr.setInput('cwd', '/user/build');
tr.setInput('xcodeVersion', 'default');
tr.setInput('xcodeDeveloperDir', '');
tr.setInput('publishJUnitResults', 'false');
tr.setInput('archivePath', '/user/build/myscheme.xcarchive');
tr.setInput('exportPath', '/user/build');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "xcodebuild": "/home/bin/xcodebuild",
        "security": "/usr/bin/security",
        "/usr/libexec/PlistBuddy": "/usr/libexec/PlistBuddy",
        "rm": "/bin/rm"
    },
    "checkPath" : {
        "/home/bin/xcodebuild": true,
        "/usr/bin/security": true,
        "/usr/libexec/PlistBuddy": true,
        "/bin/rm": true,
    },
    "findMatch": {
        "**/*.xcodeproj/*.xcworkspace": [
          "/user/build/fun.xcodeproj/project.xcworkspace"
        ],
        "**/*.xcarchive": [
            "/user/build/myscheme.xcarchive"
        ],
        "**/embedded.mobileprovision": [
            "/user/build/myscheme.xcarchive/Products/myscheme.app/embedded.mobileprovision"
        ]
    },
    "exec": {
        "/home/bin/xcodebuild -version": {
          "code": 0,
          "stdout": "Xcode 7.2.1"
        },
        "/home/bin/xcodebuild -exportArchive -archivePath /user/build/myscheme.xcarchive -exportPath /user/build -exportOptionsPlist _XcodeTaskExportOptions.plist": {
          "code": 0,
          "stdout": "xcodebuild output here"
        },
        "/usr/libexec/PlistBuddy -c Clear _XcodeTaskExportOptions.plist": {
            "code": 0,
            "stdout": "plist initialized output here"
        },
        "/usr/libexec/PlistBuddy -c Add method string app-store _XcodeTaskExportOptions.plist": {
            "code": 0,
            "stdout": "plist add output here"
        },
        "/usr/libexec/PlistBuddy -c Print ProvisionsAllDevices _xcodetasktmp.plist": {
            "code": 1,
            "stdout": "ProvisionsAllDevices not found"
        },
        "/usr/libexec/PlistBuddy -c Print Entitlements:get-task-allow _xcodetasktmp.plist": {
            "code": 0,
            "stdout": "false"
        },
        "/usr/libexec/PlistBuddy -c Print ProvisionedDevices _xcodetasktmp.plist": {
            "code": 1,
            "stdout": "ProvisionedDevices not found"
        },
        "/usr/libexec/PlistBuddy -c Print Entitlements:com.apple.developer.icloud-container-environment _xcodetasktmp.plist": {
            "code": 1,
            "stdout": ":com.apple.developer.icloud-container-environment, Does Not Exist"
        },
        "/bin/rm -f _xcodetasktmp.plist": {
            "code": 0,
            "stdout": "delete output here"
        },
        "/usr/bin/security cms -D -i /user/build/testScheme.xcarchive/Products/testScheme.app/embedded.mobileprovision": {
            "code": 0,
            "stdout": "prov profile details here"
        }
    }
};
tr.setAnswers(a);

tr.run();

