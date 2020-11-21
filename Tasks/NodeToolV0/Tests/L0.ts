import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('NodeTool Suite', function () {
    this.timeout(60000);

    function runValidations(validator: () => void, tr, done) {
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

    it('Succeeds when the first download is available', (done: Mocha.Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0FirstDownloadSuccess.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'NodeTool should have succeeded.');
            assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
        }, tr, done);
    });

    it('Succeeds when the second download is available', (done: Mocha.Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0SecondDownloadSuccess.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'NodeTool should have succeeded.');
            assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
        }, tr, done);
    });

    it('Succeeds when the third download is available', (done: Mocha.Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0ThirdDownloadSuccess.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'NodeTool should have succeeded.');
            assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
        }, tr, done);
    });

    it('Removes "v" prefixes when evaluating latest version', (done: Mocha.Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0GetsLatestVersion.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'NodeTool should have succeeded.');
            assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
        }, tr, done);
    });

    it('Installs the right version on linux-armv7l', (done: MochaDone) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0DownloadLinuxArmv7l.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'NodeTool should have succeeded.');
            assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
        }, tr, done);
    });

    it('Installs the right version on linux-arm64', (done: MochaDone) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0DownloadLinuxArm64.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'NodeTool should have succeeded.');
            assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
        }, tr, done);
    });

});