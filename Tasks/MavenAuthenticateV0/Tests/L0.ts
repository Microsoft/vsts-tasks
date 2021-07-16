import fs = require("fs");
import assert = require("assert");
import path = require("path");
import * as tl from "azure-pipelines-task-lib/task";
import * as ttm from "azure-pipelines-task-lib/mock-test";

const testUserHomeDir = path.join(__dirname, "USER_HOME");
const m2DirName = ".m2"
const m2DirPath = path.join(testUserHomeDir, m2DirName);
const settingsXmlName = "settings.xml";
const settingsXmlPath = path.join(m2DirPath, settingsXmlName);
const settingsOtherFeedName = path.join(__dirname, "Samples", "settingsOtherFeedName.xml");
const settingsFeedName1 = path.join(__dirname, "Samples", "settingsFeedName1.xml");

const serversRegex = /<servers>/mig;
const serverRegex = /<server>/mig;

describe("authenticate azure artifacts feeds for maven", function() {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
    var env;

    this.beforeAll(() => {
        env = Object.assign({}, process.env);
        process.env["USERPROFILE"] = testUserHomeDir;
        process.env["HOME"] = testUserHomeDir;
        process.env["AGENT_TEMPDIRECTORY"] = testUserHomeDir;
    });

    beforeEach(() => {
        tl.mkdirP(m2DirPath);
    })

    this.afterAll(() => {
        process.env = env;
    })

    afterEach(() => {
        tl.rmRF(m2DirPath);
    });

    it("it should create a new settings.xml in the .m2 folder and add auth for 1 feed.", (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, "L0AuthSettingsXml.js");

        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tl.ls(null, [m2DirPath]).length, 1, "Should have one file.");
        const settingsXmlStats = tl.stats(settingsXmlPath);
        assert(settingsXmlStats && settingsXmlStats.isFile(), "settings.xml file should be created.");

        const data = fs.readFileSync(settingsXmlPath, 'utf-8');

        assert.equal(data.match(serversRegex).length, 1, "Only one <servers> entry should be created.");
        assert.equal(data.match(serverRegex).length, 1, "Only one <server> entry should be created.");
        assert.equal(data.match(/<id>feedName1<\/id>/gi).length, 1, "Only one id entry should be created.");

        assert(tr.stderr.length === 0, "should not have written to stderr");
        assert(tr.succeeded, "task should have succeeded");

        done();
    });

    it("it should read the existing settings.xml and add auth for 1 new feed", (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, "L0AuthSettingsXmlExists.js");

        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tl.cp(settingsOtherFeedName, settingsXmlPath);

        tr.run();

        assert.equal(tl.ls(null, [m2DirPath]).length, 1, "Should have one file.");
        const settingsXmlStats = tl.stats(settingsXmlPath);
        assert(settingsXmlStats && settingsXmlStats.isFile(), "settings.xml file should be present.");

        const data = fs.readFileSync(settingsXmlPath, 'utf-8');

        assert.equal(data.match(serversRegex).length, 1, "Only one <servers> entry should be created.");
        assert.equal(data.match(serverRegex).length, 2, "2 <server> entries should be created.");
        assert.equal(data.match(/<id>feedName1<\/id>/gi).length, 1, "Only one id entry should be created.");
        assert.equal(data.match(/<id>otherFeedName<\/id>/gi).length, 1, "Older entry for otherFeedName should not be deleted.");

        assert(tr.stderr.length === 0, "should not have written to stderr");
        assert(tr.succeeded, "task should have succeeded");

        done();
    });

    it("it should read the existing settings.xml and not add any new entries.", (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, "L0AuthSettingsXmlExists.js");

        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tl.cp(settingsFeedName1, settingsXmlPath);

        tr.run();

        assert.equal(tl.ls(null, [m2DirPath]).length, 1, "Should have one file.");
        const settingsXmlStats = tl.stats(settingsXmlPath);
        assert(settingsXmlStats && settingsXmlStats.isFile(), "settings.xml file should be present.");

        const data = fs.readFileSync(settingsXmlPath, 'utf-8');

        assert.equal(data.match(serversRegex).length, 1, "Only one <servers> entry should be present.");
        assert.equal(data.match(serverRegex).length, 1, "Only one <server> entry should be present.");
        assert.equal(data.match(/<id>feedName1<\/id>/gi).length, 1, "Only one id entry should be present.");

        assert(tr.stderr.length === 0, "should not have written to stderr");
        assert(tr.stdOutContained("vso[task.issue type=warning;]loc_mock_Warning_FeedEntryAlreadyExists"), "Entry already exists warning should be displayed");
        assert(tr.succeeded, "task should have succeeded");

        done();
    });

    it("it should create a new settings.xml in the .m2 folder and add auth for 3 different types of service connections.", (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, "L0ServiceConnections.js");

        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tl.ls(null, [m2DirPath]).length, 1, "Should have one file.");
        const settingsXmlStats = tl.stats(settingsXmlPath);
        assert(settingsXmlStats && settingsXmlStats.isFile(), "settings.xml file should be created.");

        const data = fs.readFileSync(settingsXmlPath, 'utf-8');

        assert.equal(data.match(serversRegex).length, 1, "Only one <servers> entry should be created.");
        assert.equal(data.match(serverRegex).length, 3, "3 <server> entries should be created.");

        assert.equal(data.match(/<id>tokenBased<\/id>/gi).length, 1, "Only one tokenBased entry should be created.");
        assert.equal(data.match(/<id>privateKeyBased<\/id>/gi).length, 1, "Only one privateKeyBased entry should be created.");
        assert.equal(data.match(/<id>usernamePasswordBased<\/id>/gi).length, 1, "Only one usernamePasswordBased entry should be created.");

        assert.equal(data.match(/<username>--testUserName--<\/username>/gi).length, 1, "Only one username entry should be created.");
        assert.equal(data.match(/<password>--testPassword--<\/password>/gi).length, 1, "Only one password entry should be created.");

        assert.equal(data.match(/<privateKey>--privateKey--<\/privateKey>/gi).length, 1, "Only one privateKey entry should be created.");
        assert.equal(data.match(/<passphrase>--passphrase--<\/passphrase>/gi).length, 1, "Only one passphrase entry should be created.");

        assert.equal(data.match(/<username>AzureDevOps<\/username>/gi).length, 1, "Only one username entry should be created for api token.");
        assert.equal(data.match(/<password>--token--<\/password>/gi).length, 1, "Only one password entry should be created for api token.");

        assert(tr.stderr.length === 0, "should not have written to stderr");
        assert(tr.succeeded, "task should have succeeded");

        done();
    });

    it("it should warn if no inputs are provided.", (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, "L0EmptyInput.js");

        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tl.ls(null, [m2DirPath]).length, 0, "Settings.xml file should not be created.");

        assert(tr.stderr.length === 0, "should not have written to stderr");
        assert(tr.succeeded, "task should have succeeded");
        assert(tr.stdOutContained("vso[task.issue type=warning;]loc_mock_Warning_NoEndpointsToAuth"), "No endpoints warning should be displayed");

        done();
    });
});
