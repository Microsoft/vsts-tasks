
import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import fs = require('fs');
import { basicSetup } from './UnitTests/TestHelpers';
var Readable = require('stream').Readable
var Stats = require('fs').Stats

var nock = require('nock');

let taskPath = path.join(__dirname, '..', 'appcenterdistribute.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['VSMOBILECENTERUPLOAD_CONTINUEIFSYMBOLSNOTFOUND']='true';

tmr.setInput('serverEndpoint', 'MyTestEndpoint');
tmr.setInput('appSlug', 'testuser/testapp');
tmr.setInput('app', './test.ipa');
tmr.setInput('releaseNotesSelection', 'releaseNotesInput');
tmr.setInput('releaseNotesInput', 'my release notes');
tmr.setInput('symbolsType', 'Apple');
tmr.setInput('dsymPath', '/test/path/to/symbols.dSYM');

basicSetup();

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "findMatch": {
        "./test.ipa": [
            "./test.ipa"
        ],
        "/test/path/to/symbols.dSYM": [
            "/test/path/to/symbols.dSYM"
        ]
    },
    "checkPath" : {
        "./test.ipa": true
    },
    "exist": {
        "/test/path/to/symbols.dSYM": false
    }
};

tmr.setAnswers(a);

fs.createReadStream = (s) => {
    let stream = new Readable;
    stream.push(s);
    stream.push(null);

    return stream;
};

fs.statSync = (s) => {
    let stat = new Stats;
    stat.isFile = () => {
        return true;
    }
    stat.size = 100;
    return stat;
};

tmr.registerMock('fs', fs);

tmr.run();

