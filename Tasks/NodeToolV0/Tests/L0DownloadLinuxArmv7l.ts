import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'nodetool.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('versionSpec', '11.3.0');
tmr.setInput('checkLatest', 'false');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "assertAgent": {
        "2.115.1": true
    }};
tmr.setAnswers(a);

tmr.registerMock('os', {
    platform: () => 'linux',
    arch: () => 'arm'
});

//Create assertAgent and getVariable mocks
const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.getVariable = function(variable: string) {
    if (variable.toLowerCase() == 'agent.tempdirectory') {
        return 'temp';
    }
    return null;
};
tlClone.assertAgent = function(variable: string) {
    return;
};
tlClone.execSync = function(tool: string, args: string[]) {
    if (tool !== 'bash') {
        throw new Error(`Expected "bash" but got "${tool}" in execSync`);
    }

    if (args[0] !== 'uname' || args[1] !== '-m') {
        throw new Error(`Expected execSync args to be ["uname", "-m"]`);
    }

    return {
        stdout: 'armv7l'
    };
};
tmr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

//Create tool-lib mock
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    isExplicitVersion: function(versionSpec) {
        return false;
    },
    findLocalTool: function(toolName, versionSpec) {
        if (toolName != 'node') {
            throw new Error('Searching for wrong tool');
        }
        return false;
    },
    evaluateVersions: function(versions, versionSpec) {
        let version: string;
        for (let i = versions.length - 1; i >= 0; i--) {
            const potential: string = versions[i];
            const satisfied: boolean = potential === versionSpec;
            if (satisfied) {
                version = potential;
                break;
            }
        }
        return version;
    },
    cleanVersion: function(version) {
        return version.slice(1);
    },
    downloadTool(url: string) {
        if (url !== `https://nodejs.org/dist/v11.3.0/node-v11.3.0-linux-armv7l.tar.gz`) {
            throw {
                httpStatusCode: '404'
            };
        }

        return 'node-v11.3.0-linux-armv7l.tar.gz';
    },
    extractTar(downloadPath, extPath, _7zPath) {
        return 'extPath';
    },
    cacheDir(dir, tool, version) {
        return 'path to tool';
    },
    prependPath(toolPath) {
        return;
    }
});

tmr.run();