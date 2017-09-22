import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');

let taskPath = path.join(__dirname, '..', 'preandroidsigning.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('jarsign', 'true');
tr.setInput('keystoreFile', 'mySecureFileId');

process.env['AGENT_VERSION'] = '2.116.0';

let secureFileHelperMock = require('securefiles-common/securefiles-common-mock');
tr.registerMock('securefiles-common/securefiles-common', secureFileHelperMock);

tr.registerMock('fs', {
    writeFileSync: function (filePath, contents) {
    }
});

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
};
tr.setAnswers(a);

tr.run();

