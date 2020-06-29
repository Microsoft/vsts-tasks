
import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
var Readable = require('stream').Readable

var nock = require('nock');

let taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', './*.ipa');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "checkPath" : {
        "./test.ipa": true,
        "./test2.ipa": true
    },
    "findMatch" : {
        "./*.ipa": [
            "./test.ipa",
            "./test2.ipa"
        ]
    }
};
tmr.setAnswers(a);

tmr.registerMock('./utils.js', {
    resolveSinglePath: function(s, b1, b2) {
       throw new Error("Matched multiple files"); 
    },
    checkAndFixFilePath: function(p, name) {
        return p;
    }
});

tmr.run();

