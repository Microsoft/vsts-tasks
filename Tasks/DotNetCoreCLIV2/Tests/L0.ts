import * as assert from 'assert';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

import os = require('os');
import fs = require('fs');

describe('DotNetCoreExe Suite', function () {
    before(() => {
    });

    after(function () {
    });

    it('fails if the dotnet tool is not found', (done: MochaDone) => {
        let tp = path.join(__dirname, 'dotnetExeNotFound.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
        assert(tr.failed, 'task should have failed');
        assert(tr.errorIssues.length > 0, "error reason should have been recorded");
        done();
    });

    it('restore fails when zero match found', (done: MochaDone) => {
        process.env["__projects__"] = "*fail*/project.json";
        process.env["__command__"] = "restore";
        let tp = path.join(__dirname, 'validInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        assert(tr.invokedToolCount == 0, 'should not have invoked tool');
        assert(tr.failed, 'task should have failed');
        done();
    });

    it('restore passes when zero match found with empty string', (done: MochaDone) => {
        process.env["__projects__"] = "";
        process.env["__command__"] = "restore";
        let tp = path.join(__dirname, './RestoreTests/emptyProjectField.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('restore single solution', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './RestoreTests/singleProject.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('restore nocache', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './RestoreTests/singleProject.js')
        process.env["__nocache__"] = "true";
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config --no-cache'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output, no-cache'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        process.env["__nocache__"] = undefined;
        done();
    });

    it('restore verbosity Detailed', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './RestoreTests/singleProject.js')
        process.env["__verbosity__"] = "Detailed";
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config --verbosity Detailed'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output, verbosity Detailed'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        process.env["__verbosity__"] = undefined;
        done();
    });

    it('restore verbosity - omits switch', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './RestoreTests/singleProject.js')
        process.env["__verbosity__"] = "-";
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        process.env["__verbosity__"] = undefined;
        done();
    });

    it('restore with config file', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './RestoreTests/singleProjectConfigFile.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('restore with packages directory', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './RestoreTests/packagesDirectory.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --packages path\\to\\packages --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('restore with vsts feed', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './RestoreTests/selectSourceVsts.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.stdOutContained('adding package source uri: https://vsts/packagesource'), 'it should have added vsts source to config');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.stdOutContained('Using project scope 98320bea-3915-4ef2-9333-908d3290289c'), "should have used project scope");
        assert(tr.stdOutContained("Using feed registry url"), "should have used feed url, not session url");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('restore select nuget.org source', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './RestoreTests/selectSourceNuGetOrg.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.stdOutContained('adding package source uri: https://api.nuget.org/v3/index.json'), "should have added nuget.org source to config");
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('restore single solution with nuget config and multiple service connections', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './RestoreTests/multipleServiceConnections.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe restore c:\\agent\\home\\directory\\single.csproj --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet with ConfigFile specified');
        assert(tr.stdOutContained('adding token auth entry for feed https://endpoint1.visualstudio.com/path'), 'it should have added auth entry for endpoint 1');
        assert(tr.stdOutContained('adding token auth entry for feed https://endpoint2.visualstudio.com/path'), 'it should have added auth entry for endpoint 2');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('build fails when zero match found', (done: MochaDone) => {
        process.env["__projects__"] = "*fail*/project.json";
        process.env["__command__"] = "build";
        let tp = path.join(__dirname, 'validInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 0, 'should not have invoked tool');
        assert(tr.failed, 'task should have failed');
        done();
    });

    it('test throws warning when zero match found', (done: MochaDone) => {
        process.env["__projects__"] = "*fail*/project.json";
        process.env["__command__"] = "test";
        let tp = path.join(__dirname, 'validInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 0, 'should not have invoked tool');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.warningIssues && tr.warningIssues.length, 'Should have thrown a warning in the stream');
        done();
    });

    it('publish works with explicit project files setting modifyoutput to false', (done: MochaDone) => {

        process.env["__projects__"] = '*customoutput/project.json';
        process.env["__arguments__"] = "--configuration release --output /usr/out";
        process.env["modifyOutput"] = "false";
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool');
        assert(tr.stdOutContained("published web3 without adding project name to path"), "shouldn't have appended the project name");
        assert(tr.stdOutContained("published lib2 without adding project name to path"), "shouldn't have appended the project name");
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('publish works with explicit project files', (done: MochaDone) => {

        process.env["__projects__"] = '**/project.json';
        process.env["modifyOutput"] = "true";
        process.env["__arguments__"] = " ";
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 4, 'should have invoked tool');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('publish works with no project file is specified', (done: MochaDone) => {

        process.env["__projects__"] = "";
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool');
        assert(tr.succeeded, 'task should have suceeded');

        done();
    });

    it('publish fails with when the dotnet publish fails', (done: MochaDone) => {

        process.env["__projects__"] = "dummy/project.json";
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool once');
        assert(tr.failed, 'task should have failed');
        done();
    });

    it('publish fails with error when the project file pattern return zero match', (done: MochaDone) => {
        process.env["__projects__"] = "*fail*/project.json"
        process.env["__publishWebProjects__"] = "false";
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 0, 'should not have invoked tool');
        assert(tr.failed, 'task should have failed');
        assert(tr.errorIssues && tr.errorIssues.length, "No error was reported for this issue.");
        done();
    });


    it('publish works with publishWebProjects option', (done: MochaDone) => {

        process.env["__projects__"] = "";
        process.env["__publishWebProjects__"] = "true";
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked been invoked once');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });


    it('publish works with publishWebProjects option if .csproj have Microsoft.Net.Sdk.Web', (done: MochaDone) => {
        process.env["__projects__"] = "validateWebProject.csproj";
        process.env["workingDirectory"] = ".";
        process.env["__publishWebProject__"] = "true";
        let tp = path.join(__dirname, 'validateWebProject.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked been invoked once');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    })

    it('publish updates the output with the project name appended', (done: MochaDone) => {
        process.env["__projects__"] = "*customoutput/project.json";
        process.env["__publishWebProjects__"] = "false";
        process.env["__arguments__"] = "--configuration release --output /usr/out"
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool two times');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('publish works with zipAfterPublish option', (done: MochaDone) => {
        // TODO
        done();
    });

    it('publish fails with zipAfterPublish and publishWebProjects option with no project file specified', (done: MochaDone) => {
        process.env["__projects__"] = "";
        process.env["__publishWebProjects__"] = "false";
        process.env["__arguments__"] = "--configuration release --output /usr/out"
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        // TODO: Add Zip
        assert(tr.invokedToolCount == 1, 'should have invoked tool');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('packs with prerelease', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './PackTests/packPrerelease.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe pack c:\\agent\\home\\directory\\foo.nuspec --output C:\\out\\dir /p:PackageVersion=x.y.z-CI-YYYYMMDD-HHMMSS'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('packs with env var', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './PackTests/packEnvVar.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe pack c:\\agent\\home\\directory\\foo.nuspec --output C:\\out\\dir /p:PackageVersion=XX.YY.ZZ'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('packs with build number', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './PackTests/packBuildNumber.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe pack c:\\agent\\home\\directory\\single.csproj --output C:\\out\\dir /p:PackageVersion=1.2.3'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('pack fails no files are found', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './PackTests/noProjectsFound.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.invokedToolCount == 0, 'should not have run dotnet');
        assert(tr.failed, 'should have fai;ed');
        assert.equal(tr.errorIssues.length, 1, "should have thrown an error");
        done();
    });

    it('pushes successfully to internal hosted feed', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './PushTests/internalFeed.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe nuget push c:\\agent\\home\\directory\\foo.nupkg --source https://vsts/packagesource --api-key VSTS'), 'it should have run dotnet');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.stdOutContained("Using project scope ProjectId"), "should have used project scope");
        assert(tr.stdOutContained("Using session registry url"), "should have set up a session");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('push fails when projects are not found', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './PushTests/noProjectsFound.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.invokedToolCount == 0, 'should not have run dotnet');
        assert(tr.failed, 'should have failed');
        assert.equal(tr.errorIssues.length, 1, "should have thrown an error");
        done();
    });

    it('test command with publish test results should call trx logger and publish test results', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './TestCommandTests/publishtests.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe test c:\\agent\\home\\directory\\temp.csproj --logger trx --results-directory c:\\agent\\home\\temp'), 'it should have run dotnet test');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.stdOutContained('vso[results.publish type=VSTest;mergeResults=false;publishRunAttachments=true;resultFiles=c:\\agent\\home\\temp\\sample.trx;]'), "should publish trx");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
        done();
    });

    it('test command with publish test results directory containing spaces should call trx logger and publish test results', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './TestCommandTests/publishtestsWithSpaceDir.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        console.log(tr.stdout);
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe test c:\\agent new\\home\\directory\\temp.csproj --logger trx --results-directory c:\\agent new\\home\\temp'), 'it should have run dotnet test');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.stdOutContained('vso[results.publish type=VSTest;mergeResults=false;publishRunAttachments=true;resultFiles=c:\\agent new\\home\\temp\\sample.trx;]'), "should publish trx");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
        done();
    });

    it('test command with publish test results should call trx logger and publish test results without build props', (done: MochaDone) => {
        this.timeout(1000);

        const tp = path.join(__dirname, './TestCommandTests/publishtestsWithoutBuildConfig.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe test c:\\agent\\home\\directory\\temp.csproj --logger trx --results-directory c:\\agent\\home\\temp'), 'it should have run dotnet test');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.stdOutContained('vso[results.publish type=VSTest;mergeResults=false;publishRunAttachments=true;resultFiles=c:\\agent\\home\\temp\\sample.trx;]'), "should publish trx");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('test command with publish test results should call trx logger and publish test results with failed dotnet test', (done: MochaDone) => {
        this.timeout(1000);

        const tp = path.join(__dirname, './TestCommandTests/publishtestsWithFailedTestCommand.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe test c:\\agent\\home\\directory\\temp.csproj --logger trx --results-directory c:\\agent\\home\\temp'), 'it should have run dotnet test');
        assert(tr.stdOutContained('dotnet error'), "should have dotnet output");
        assert(tr.stdOutContained('vso[results.publish type=VSTest;mergeResults=false;publishRunAttachments=true;resultFiles=c:\\agent\\home\\temp\\sample.trx;]'), "should publish trx");
        assert(tr.failed, 'should have failed');
        done();
    });

    it('test command without publish test results', (done: MochaDone) => {
        this.timeout(1000);

        const tp = path.join(__dirname, './TestCommandTests/runTestsWithoutPublish.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.invokedToolCount === 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe test c:\\agent\\home\\directory\\temp.csproj'), 'it should have run dotnet test');
        assert(tr.stdOutContained('dotnet output'), 'should have dotnet output');
        assert(!tr.stdOutContained('vso[results.publish'), 'it shouldnt contain publish command');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, 'should have no errors');
        done();
    });

    it('custom command fails when no project match found', (done: MochaDone) => {
        process.env["__command__"] = "custom";
        process.env["__custom__"] = "test";
        process.env["__projects__"] = "*nomatch*/project.json";

        let tp = path.join(__dirname, 'customInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 0, 'should not have invoked tool');
        assert(tr.failed, 'task should have failed');
        assert.equal(tr.errorIssues.length, 1, "should have thrown an error");
        done();
    });

    it('custom command executes without projects if none supplied', (done: MochaDone) => {
        process.env["__command__"] = "custom";
        process.env["__custom__"] = "vstest";
        process.env["__projects__"] = "";
        process.env["__arguments__"] = "supplied/in/arguments.dll --framework netcoreapp2.0"

        let tp = path.join(__dirname, 'customInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool');
        assert(tr.ran('c:\\path\\dotnet.exe vstest supplied/in/arguments.dll --framework netcoreapp2.0'), 'it should have run dotnet with expected arguments');
        assert(tr.stdOutContained('vstest succeeded'), "should have dotnet output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('custom command fails if dotnet returns error', (done: MochaDone) => {
        process.env["__command__"] = "custom";
        process.env["__custom__"] = "test";
        process.env["__projects__"] = "fails/project.json";
        process.env["__arguments__"] = "--no-build --no-restore"

        let tp = path.join(__dirname, 'customInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool');
        assert(tr.ran('c:\\path\\dotnet.exe test fails/project.json --no-build --no-restore'), 'it should have run dotnet with expected arguments');
        assert(tr.stdOutContained('test failed'), "should have dotnet output");
        assert(tr.failed, 'task should have failed');
        assert(tr.errorIssues.length > 0, "error reason should have been recorded");
        done();
    });

    it('custom command runs once for each matched project', (done: MochaDone) => {
        process.env["__command__"] = "custom";
        process.env["__custom__"] = "test";
        process.env["__projects__"] = "**/project.json";
        process.env["__arguments__"] = ""

        let tp = path.join(__dirname, 'customInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 4, 'should not have invoked tool 4 times');
        assert(tr.succeeded, 'task should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('toolinstall command with vsts feed', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './ToolInstallTests/selectSourceVsts.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe tool install MyPackage --global --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.stdOutContained('adding package source uri: https://vsts/packagesource'), 'it should have added vsts source to config');
        assert(tr.stdOutContained('dotnet output'), "should have dotnet output");
        assert(tr.stdOutContained('Using project scope 98320bea-3915-4ef2-9333-908d3290289c'), "should have used project scope");
        assert(tr.stdOutContained("Using feed registry url"), "should have used feed url, not session url");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('toolinstall command uses tool version when provided', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './ToolInstallTests/withVersion.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.invokedToolCount == 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe tool install MyPackage --version 1.0.0 --global --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

    it('toolinstall command uses custom tool install path when provided', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, './ToolInstallTests/withInstallLocation.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert.equal(tr.invokedToolCount, 1, 'should have run dotnet once');
        assert(tr.ran('c:\\path\\dotnet.exe tool install MyPackage --tool-path c:\\installpath --configfile c:\\agent\\home\\directory\\NuGet\\tempNuGet_.config'), 'it should have run dotnet');
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });

});