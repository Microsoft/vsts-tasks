import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('../DotnetMockHelper');

let taskPath = path.join(__dirname, '../..', 'dotnetcore.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let nmh: util.DotnetMockHelper = new util.DotnetMockHelper(tmr);

nmh.setNugetVersionInputDefault();
tmr.setInput('command', 'toolinstall');
tmr.setInput('toolPackageName', 'MyPackage');
tmr.setInput('toolInstallPath', 'c:\\installpath');
tmr.setInput('selectOrConfig', 'select');
tmr.setInput('feedRestore', '98320bea-3915-4ef2-9333-908d3290289c/b7fb1a0d-637d-4dc0-978c-a5e43d8e0a98');

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "osType": {},
    "checkPath": {
        "c:\\agent\\home\\directory\\single.csproj": true,
        "c:\\path\\dotnet.exe": true
    },
    "which": {
        "dotnet": "c:\\path\\dotnet.exe"
    },
    "exec": {
        "c:\\path\\dotnet.exe tool install MyPackage --tool-path c:\\installpath --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config": {
            "code": 0,
            "stdout": "dotnet output",
            "stderr": ""
        }
    },
    "exist": {
        "D:\\src\\github\\vsts-tasks\\Tests\\Nuget" : true,
        "c:\\installpath": true
    },
    "stats": {
        "c:\\agent\\home\\directory\\single.csproj": {
            "isFile": true
        }
    },
    "rmRF": {
        "c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config": {
            "success": true
        }
    }, 
    "findMatch": {
        "single.csproj" : ["c:\\agent\\home\\directory\\single.csproj"]
    }
};
nmh.setAnswers(a);

process.env["NuGet_ForceEnableCredentialConfig"] = "false";
nmh.registerNugetUtilityMock(["c:\\agent\\home\\directory\\single.csproj"]);
nmh.registerDefaultNugetVersionMock();
nmh.registerToolRunnerMock();
nmh.registerNugetConfigMock();

tmr.run();