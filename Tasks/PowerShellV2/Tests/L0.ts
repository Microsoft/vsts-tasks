import assert = require('assert');
import os = require('os');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('PowerShell Suite', function () {
    this.timeout(60000);

    function runValidations(validator: () => void, tr, done: Mocha.Done) {
        try {
            validator();
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    }

    it('Runs an inline script correctly', (done: Mocha.Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0Inline.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'PowerShell should have succeeded.');
            assert(tr.stderr.length === 0, 'PowerShell should not have written to stderr');
            assert(tr.stdout.indexOf(`Writing \ufeff$InformationPreference = 'Continue'${os.EOL}$WarningPreference = 'Continue'${os.EOL}$ErrorActionPreference = 'Stop'${os.EOL}Write-Host "my script output" to temp/path/fileName.ps1`) > 0, 'PowerShell should have written the script to a file');
            assert(tr.stdout.indexOf('my script output') > 0,'PowerShell should have correctly run the script');
        }, tr, done);
    });

    it('Runs a checked in script correctly', (done: Mocha.Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0External.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'PowerShell should have succeeded.');
            assert(tr.stderr.length === 0, 'PowerShell should not have written to stderr');
            assert(tr.stdout.indexOf(`Writing \ufeff$InformationPreference = 'Continue'${os.EOL}$WarningPreference = 'Continue'${os.EOL}$ErrorActionPreference = 'Stop'${os.EOL}. 'path/to/script.ps1' to temp/path/fileName.ps1`) > 0, 'PowerShell should have written the script to a file');
            assert(tr.stdout.indexOf('my script output') > 0,'PowerShell should have correctly run the script');
        }, tr, done);
    });

    it('Adds arguments to the script', (done: Mocha.Done) => {
        this.timeout(5000);        

        let tp: string = path.join(__dirname, 'L0Args.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'PowerShell should have succeeded.');
            assert(tr.stderr.length === 0, 'PowerShell should not have written to stderr');
            assert(tr.stdout.indexOf(`Writing \ufeff$InformationPreference = 'Continue'${os.EOL}$WarningPreference = 'Continue'${os.EOL}$ErrorActionPreference = 'Stop'${os.EOL}. 'path/to/script.ps1' myCustomArg to temp/path/fileName.ps1`) > 0, 'PowerShell should have written the script to a file');
            assert(tr.stdout.indexOf('my script output') > 0,'PowerShell should have correctly run the script');
        }, tr, done);
    });

    it('Reports stderr correctly', (done: Mocha.Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0StdErr.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.failed, 'Powershell should have failed');
            assert(tr.stdout.indexOf('##vso[task.issue type=error;]myErrorTest') > 0, 'Powershell should have correctly written myErrorTest');
            assert(tr.stdout.length > 1000, 'Powershell stderr output is not truncated');
        }, tr, done);
    });

    it('Runs scripts with & operator', (done: Mocha.Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0RunScriptInSeparateScope.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'PowerShell should have succeeded.');
            assert(tr.stderr.length === 0, 'PowerShell should not have written to stderr');
            assert(tr.stdout.indexOf(`Writing \ufeff$InformationPreference = 'Continue'${os.EOL}$WarningPreference = 'Continue'${os.EOL}$ErrorActionPreference = 'Stop'${os.EOL}. 'path/to/script.ps1' to temp/path/fileName.ps1`) > 0, 'PowerShell should have written the script to a file');
            assert(tr.stdout.indexOf('my script output') > 0,'PowerShell should have correctly run the script');
        }, tr, done);
    });
});
