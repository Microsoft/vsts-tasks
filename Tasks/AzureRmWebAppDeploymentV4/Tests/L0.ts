import * as path from "path";
import * as assert from "assert";
import * as ttm from "azure-pipelines-task-lib/mock-test";
import tl = require('azure-pipelines-task-lib');
var ltx = require('ltx');
import fs = require('fs');

var AppServiceTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests/L0-azure-arm-app-service.js");
var KuduServiceTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests/L0-azure-arm-app-service-kudu-tests.js");
var ApplicationInsightsTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests/L0-azure-arm-appinsights-tests.js");
var ResourcesTests = require("../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests/L0-azure-arm-resource-tests.js");

describe('AzureRmWebAppDeployment Suite', function() {
    
    this.timeout(60000);

     before((done) => {
        if(!tl.exist(path.join(__dirname, '..', 'node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests/node_modules'))) {
            tl.cp(path.join( __dirname, 'node_modules'), path.join(__dirname, '..', 'node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests'), '-rf', true);
        }

        tl.cp(path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub', 'Web.config'), path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub', 'Web_test.config'), '-f', false);
        tl.cp(path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub', 'Web.Debug.config'), path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub', 'Web_test.Debug.config'), '-f', false);
        tl.cp(path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub', 'parameters.xml'), path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub', 'parameters_test.xml'), '-f', false);
        tl.cp(path.join(__dirname, "..", "node_modules","azure-pipelines-tasks-webdeployment-common","Tests", 'L1XdtTransform', 'Web.config'), path.join(__dirname, "..", "node_modules","azure-pipelines-tasks-webdeployment-common","Tests", 'L1XdtTransform', 'Web_test.config'), '-f', false);
        done();
    });
    after(function() {
        try {
            tl.rmRF(path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub', 'parameters_test.xml'));
        }
        catch(error) {
            tl.debug(error);
        }
    });

    ApplicationInsightsTests.ApplicationInsightsTests();
    AppServiceTests.AzureAppServiceMockTests();
    KuduServiceTests.KuduServiceTests();
    ResourcesTests.ResourcesTests(); 
    
    if (tl.osType().match(/^Win/)) {
        it('Runs successfully with XML Transformation (L1)', (done:MochaDone) => {
            this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

            let tp = path.join(__dirname, "..", "node_modules","azure-pipelines-tasks-webdeployment-common","Tests","L1XdtTransform.js");
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            var resultFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "node_modules","azure-pipelines-tasks-webdeployment-common","Tests", 'L1XdtTransform', 'Web_test.config')));
            var expectFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "node_modules","azure-pipelines-tasks-webdeployment-common","Tests", 'L1XdtTransform','Web_Expected.config')));
            assert(ltx.equal(resultFile, expectFile) , 'Should Transform attributes on Web.config');
            done();
        });

        it('Validate MSDeploy parameters', (done:MochaDone) => {
            let tp = path.join(__dirname, "..", "node_modules","azure-pipelines-tasks-webdeployment-common","Tests","L0MSDeployUtility.js");
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            assert(tr.stdout.search('MSBUILD DEFAULT PARAMS PASSED') > 0, 'should have printed MSBUILD DEFAULT PARAMS PASSED');
            assert(tr.stdout.search('ARGUMENTS WITH SET PARAMS PASSED') > 0, 'should have printed ARGUMENTS WITH SET PARAMS PASSED');
            assert(tr.stdout.search('ARGUMENT WITH FOLDER PACKAGE PASSED') > 0, 'should have printed ARGUMENT WITH FOLDER PACKAGE PASSED');
            assert(tr.stdout.search('ARGUMENT WITH EXCLUDE APP DATA PASSED') > 0, 'should have printed ARGUMENT WITH EXCLUDE APP DATA PASSED');
            assert(tr.stdout.search('ARGUMENT WITH WAR PACKAGE PASSED') > 0, 'should have printed ARGUMENT WITH WAR PACKAGE PASSED');
            assert(tr.stdout.search('ARGUMENT WITH OVERRIDE RETRY FLAG PASSED') > 0, 'should have printed ARGUMENT WITH OVERRIDE RETRY FLAG PASSED');
            assert(tr.stdout.search('MSDEPLOY getWebDeployErrorCode passed') > 0, 'should have printed MSDEPLOY getWebDeployErrorCode passed');
            done();
        });
    }

    it('Validate operations.ParameterParserUtility.parse()', (done:MochaDone) => {
        let tp = path.join(__dirname, 'L0ParameterParserUtility.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search('PARAMETERPARSERUTILITY CASE 1 PASSED') >=0, 'should have printed PARAMETERPARSERUTILITY CASE 1 PASSED');
        assert(tr.stdout.search('PARAMETERPARSERUTILITY CASE 2 WITH EMPTY VALUE PASSED') >= 0, 'should have printed PARAMETERPARSERUTILITY CASE 2 WITH EMPTY VALUE PASSED');
        assert(tr.stdout.search('PARAMETERPARSERUTILITY CASE 3 WITH EXTRA SPACES PASSED') >= 0, 'should have printed PARAMETERPARSERUTILITY CASE 3 WITH EXTRA SPACES PASSED');
        done();
    });

    it('Runs successfully with XML variable substitution', (done:MochaDone) => {
        let tp = path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        var resultFile = ltx.parse(fs.readFileSync(path.join(__dirname,  "..", "node_modules","azure-pipelines-tasks-webdeployment-common","Tests", 'L1XmlVarSub', 'Web_test.config')));
        var expectFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "node_modules","azure-pipelines-tasks-webdeployment-common","Tests", 'L1XmlVarSub', 'Web_Expected.config')));
        assert(ltx.equal(resultFile, expectFile) , 'Should have substituted variables in Web.config file');
        var resultFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub', 'Web_test.Debug.config')));
        var expectFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1XmlVarSub', 'Web_Expected.Debug.config')));
        assert(ltx.equal(resultFile, expectFile) , 'Should have substituted variables in Web.Debug.config file');   
        var resultParamFile = ltx.parse(fs.readFileSync(path.join(__dirname,  "..", "node_modules","azure-pipelines-tasks-webdeployment-common","Tests", 'L1XmlVarSub', 'parameters_test.xml')));
        var expectParamFile = ltx.parse(fs.readFileSync(path.join(__dirname,  "..", "node_modules","azure-pipelines-tasks-webdeployment-common","Tests", 'L1XmlVarSub', 'parameters_Expected.xml')));
        assert(ltx.equal(resultParamFile, expectParamFile) , 'Should have substituted variables in parameters.xml file');

        done();
    });

    it('Runs successfully with JSON variable substitution', (done:MochaDone) => {
        let tp = path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1JsonVarSub.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search('JSON - eliminating object variables validated') > 0, 'JSON - eliminating object variables validation error');
        assert(tr.stdout.search('JSON - simple string change validated') > 0,'JSON -simple string change validation error' );
        assert(tr.stdout.search('JSON - system variable elimination validated') > 0, 'JSON -system variable elimination validation error');
        assert(tr.stdout.search('JSON - special variables validated') > 0, 'JSON - special variables validation error');
        assert(tr.stdout.search('JSON - variables with dot character validated') > 0, 'JSON variables with dot character validation error');
        assert(tr.stdout.search('JSON - substitute inbuilt JSON attributes validated') > 0, 'JSON inbuilt variable substitution validation error');
        assert(tr.stdout.search('VALID JSON COMMENTS TESTS PASSED') > 0, 'VALID JSON COMMENTS TESTS PASSED');
        assert(tr.stdout.search('INVALID JSON COMMENTS TESTS PASSED') > 0, 'INVALID JSON COMMENTS TESTS PASSED');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Runs successfully with JSON variable substitution V2', (done:MochaDone) => {
        let tp = path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1JsonVarSubV2.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search('JSON - simple string change validated') > 0,'JSON -simple string change validation error' );
        assert(tr.stdout.search('JSON - system variable elimination validated') > 0, 'JSON -system variable elimination validation error');
        assert(tr.stdout.search('JSON - special variables validated') > 0, 'JSON - special variables validation error');
        assert(tr.stdout.search('JSON - substitute inbuilt JSON attributes validated') > 0, 'JSON inbuilt variable substitution validation error');
        assert(tr.stdout.search('JSON - Array Object validated') > 0, 'JSON - Array Object validation error');
        assert(tr.stdout.search('JSON - Boolean validated') > 0, 'JSON - Boolean validation error');
        assert(tr.stdout.search('(float)') > 0, 'JSON - Number(float) validation error');
        assert(tr.stdout.search('(int)') > 0, 'JSON - Number(int) validation error');
        assert(tr.stdout.search('JSON - Object validated') > 0, 'JSON - Object validation error');
        assert(tr.stdout.search('VALID JSON COMMENTS TESTS PASSED') > 0, 'VALID JSON COMMENTS TESTS PASSED');
        assert(tr.stdout.search('INVALID JSON COMMENTS TESTS PASSED') > 0, 'INVALID JSON COMMENTS TESTS PASSED');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Validate File Encoding', (done:MochaDone) => {
        let tp = path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L1ValidateFileEncoding.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search('UTF-8 with BOM validated') >= 0, 'Should have validated UTF-8 with BOM');
        assert(tr.stdout.search('UTF-16LE with BOM validated') >= 0, 'Should have validated UTF-16LE with BOM');
        assert(tr.stdout.search('UTF-16BE with BOM validated') >= 0, 'Should have validated UTF-16BE with BOM');
        assert(tr.stdout.search('UTF-32LE with BOM validated') >= 0, 'Should have validated UTF-32LE with BOM');
        assert(tr.stdout.search('UTF-32BE with BOM validated') >= 0, 'Should have validated UTF-32BE with BOM');

        assert(tr.stdout.search('UTF-8 without BOM validated') >= 0, 'Should have validated UTF-8 without BOM');
        assert(tr.stdout.search('UTF-16LE without BOM validated') >= 0, 'Should have validated UTF-16LE without BOM');
        assert(tr.stdout.search('UTF-16BE without BOM validated') >= 0, 'Should have validated UTF-16BE without BOM');
        assert(tr.stdout.search('UTF-32LE without BOM validated') >= 0, 'Should have validated UTF-32LE without BOM');
        assert(tr.stdout.search('UTF-32BE without BOM validated') >= 0, 'Should have validated UTF-32BE without BOM');

        assert(tr.stdout.search('Short File Buffer Error') >= 0, 'Should have validated short Buffer');
        assert(tr.stdout.search('Unknown encoding type') >= 0, 'Should throw for Unknown File Buffer');
        done();
    });

    it('Validate azure-pipelines-tasks-webdeployment-common.utility.copyDirectory()', (done:MochaDone) => {
        let tp = path.join(__dirname, "..", "node_modules", "azure-pipelines-tasks-webdeployment-common", "Tests", 'L0CopyDirectory.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.stdout.search('## Copy Files Successful ##') >=0, 'should have copied the files');
        assert(tr.stdout.search('## mkdir Successful ##') >= 0, 'should have created dir including dest folder');
        done();
    });

    it('AzureRmWebAppDeploymentV4 DeploymentFactoryTests', (done: MochaDone) => {
        let tp = path.join(__dirname,'DeploymentFactoryTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('LinuxWebAppDeploymentProvider should be excepted.'), 'Should have printed: LinuxWebAppDeploymentProvider should be expected.');
            assert(tr.stdOutContained('WindowsWebAppRunFromZipProvider should be excepted.'), 'Should have printed: WindowsWebAppRunFromZipProvider should be expected.');
            assert(tr.stdOutContained('WindowsWebAppWarDeployProvider should be excepted.'), 'Should have printed: WindowsWebAppWarDeployProvider should be expected.');
            assert(tr.stdOutContained('WindowsWebAppZipDeployProvider should be excepted.'), 'Should have printed: WindowsWebAppZipDeployProvider should be expected.');
            assert(tr.stdOutContained('PublishProfileWebAppDeploymentProvider should be excepted.'), 'Should have printed: PublishProfileWebAppDeploymentProvider should be excepted.');
            assert(tr.stdOutContained('ContainerWebAppDeploymentProvider should be excepted.'), 'Should have printed: ContainerWebAppDeploymentProvider should be excepted.');
            assert(tr.stdOutContained('WindowsWebAppRunFromZipProvider for user selected should be excepted.'), 'Should have printed: WindowsWebAppRunFromZipProvider for user selected should be excepted.');
            assert(tr.stdOutContained('WindowsWebAppZipDeployProvider for user selected should be excepted.'), 'Should have printed: WindowsWebAppZipDeployProvider for user selected should be excepted.');
            assert(tr.stdOutContained('WindowsWebAppWebDeployProvider for user selected should be excepted.'), 'Should have printed: WindowsWebAppWebDeployProvider for user selected should be excepted.');
            done();
        }
        catch(error) {
            done(error);
        }
    });

    it('AzureRmWebAppDeploymentV4 AzureRmWebAppDeploymentProviderTests', (done: MochaDone) => {
        let tp = path.join(__dirname,'AzureRmWebAppDeploymentProviderTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('Resource Group: MOCK_RESOURCE_GROUP_NAME'), 'Should have printed: Resource Group: MOCK_RESOURCE_GROUP_NAME');
            assert(tr.stdOutContained('PreDeployment steps with slot enabled should succeeded'), 'Should have printed: PreDeployment steps withSlotEnabled should succeeded');
            assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.');
            assert(tr.stdOutContained('PreDeployment steps with virtual application should succeeded'), 'Should have printed: PreDeployment steps with slot enabled should succeeded');
            done();
        }
        catch(error) {
            done(error);
        }
    });

    it('AzureRmWebAppDeploymentV4 BuiltInLinuxWebAppDeploymentProviderTests', (done: MochaDone) => {
        let tp = path.join(__dirname,'BuiltInLinuxWebAppDeploymentProviderTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('PreDeployment steps for built in linux web app should succeeded'), 'Should have printed: PreDeployment steps for built in linux web app should succeeded');
            assert(tr.stdOutContained('PreDeployment steps for built in linux web app with slot enabled should succeeded'), 'Should have printed: PreDeployment steps for built in linux web app withSlotEnabled should succeeded');
            assert(tr.stdOutContained('set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net'), 'Should have printed: set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net');
            assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.');
            assert(tr.stdOutContained('loc_mock_PackageDeploymentSuccess'), 'Should have printed: loc_mock_PackageDeploymentSuccess');
            assert(tr.stdOutContained('Skipped updating the SCM value'), 'Should have printed: Skipped updating the SCM value');
            assert(tr.stdOutContained('DeployWebAppStep for built in linux web app steps with zip package succeeded'), 'Should have printed: DeployWebAppStep for built in linux web app steps with zip package succeeded');
            assert(tr.stdOutContained('DeployWebAppStep for built in linux web app steps with folder package succeeded'), 'Should have printed: DeployWebAppStep for built in linux web app steps with folder package succeeded'); 
            assert(tr.stdOutContained('DeployWebAppStep for built in linux web app steps with war package succeeded'), 'Should have printed: DeployWebAppStep for built in linux web app steps with war package succeeded');
            assert(tr.stdOutContained('DeployWebAppStep for built in linux web app steps with jar package succeeded'), 'Should have printed: DeployWebAppStep for built in linux web app steps with jar package succeeded');
            done();
        }
        catch(error) {
            done(error);
        }
    });

    it('AzureRmWebAppDeploymentV4 ContainerWebAppDeploymentProviderTests', (done: MochaDone) => {
        let tp = path.join(__dirname,'ContainerWebAppDeploymentProviderTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('PreDeployment steps for container web app should succeeded'), 'Should have printed: PreDeployment steps for container web app should succeeded');
            assert(tr.stdOutContained('PreDeployment steps for container web app with slot enabled should succeeded'), 'Should have printed: PreDeployment steps for container web app withSlotEnabled should succeeded');
            assert(tr.stdOutContained('Resource Group: MOCK_RESOURCE_GROUP_NAME'), 'Should have printed: Resource Group: MOCK_RESOURCE_GROUP_NAME');
            assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.');
            assert(tr.stdOutContained('loc_mock_UpdatingAppServiceConfigurationSettings {"linuxFxVersion":"DOCKER|dockernamespace/dockerrepository:DockerImageTag"}'), 'Should have printed: loc_mock_UpdatingAppServiceConfigurationSettings {"linuxFxVersion":"DOCKER|dockernamespace/dockerrepository:DockerImageTag"}');
            assert(tr.stdOutContained('loc_mock_UpdatedAppServiceConfigurationSettings'), 'Should have printed: loc_mock_UpdatedAppServiceConfigurationSettings');
            assert(tr.stdOutContained('loc_mock_UpdatedAppServiceApplicationSettings') || tr.stdOutContained('loc_mock_AppServiceApplicationSettingsAlreadyPresent'), 'Should have printed: loc_mock_UpdatedAppServiceApplicationSettings or loc_mock_AppServiceApplicationSettingsAlreadyPresent');
            assert(tr.stdOutContained('Web app Deployment steps for container should succeeded'), 'Should have printed: Web app Deployment steps for container should succeeded');
            done();
        }
        catch(error) {
            done(error);
        }
    });

    it('AzureRmWebAppDeploymentV4 WindowsWebAppRunFromZipProviderTests', (done: MochaDone) => {
        let tp = path.join(__dirname,'WindowsWebAppRunFromZipProviderTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('PreDeployment steps for run from zip should succeeded'), 'Should have printed: PreDeployment steps for run from zip should succeeded');
            assert(tr.stdOutContained('PreDeployment steps for run from zip with slot enabled should succeeded'), 'Should have printed: PreDeployment steps for run from zip with slot enabled should succeeded');
            assert(tr.stdOutContained('set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net'), 'Should have printed: set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net');
            assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.');
            assert(tr.stdOutContained('DeployWebAppStep for run from zip steps with zip package succeeded'), 'Should have printed: DeployWebAppStep for run from zip steps with zip package succeeded.')
            assert(tr.stdOutContained('loc_mock_UpdatingAppServiceApplicationSettings {"WEBSITE_RUN_FROM_PACKAGE":"1"}'), 'Should have printed: loc_mock_UpdatingAppServiceApplicationSettings {"WEBSITE_RUN_FROM_PACKAGE":"1"}');
            assert(tr.stdOutContained('loc_mock_UpdatedAppServiceApplicationSettings') || tr.stdOutContained('loc_mock_AppServiceApplicationSettingsAlreadyPresent'), 'Should have printed: loc_mock_UpdatedAppServiceApplicationSettings or loc_mock_AppServiceApplicationSettingsAlreadyPresent');
            assert(tr.stdOutContained('loc_mock_PackageDeploymentSuccess'), 'Should have printed: loc_mock_PackageDeploymentSuccess.');
            assert(tr.stdOutContained('Compressed folder into zip webAppPkg.zip'), 'Should have printed: Compressed folder into zip webAppPkg.zip.');
            assert(tr.stdOutContained('DeployWebAppStep for run from zip steps with folder package succeeded'), 'Should have printed: DeployWebAppStep for run from zip steps with folder package succeeded.');
            done();
        }
        catch(error) {
            done(error);
        }
    });

    it('AzureRmWebAppDeploymentV4 WindowsWebAppWarDeployProviderTests', (done: MochaDone) => {
        let tp = path.join(__dirname,'WindowsWebAppWarDeployProviderTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('PreDeployment steps for war deploy should succeeded'), 'Should have printed: PreDeployment steps for war deploy should succeeded');
            assert(tr.stdOutContained('PreDeployment steps for war deploy with slot enabled should succeeded'), 'Should have printed: PreDeployment steps for war deploy with slot enabled should succeeded');
            assert(tr.stdOutContained('set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net'), 'Should have printed: set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net');
            assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.');   
            assert(tr.stdOutContained('DeployWebAppStep for war deploy steps with war package succeeded'), 'Should have printed: DeployWebAppStep for war deploy steps with war package succeeded.')
            assert(tr.stdOutContained('loc_mock_AppServiceApplicationURL http://mytestapp.azurewebsites.net'), 'Should have printed: loc_mock_AppServiceApplicationURL http://mytestapp.azurewebsites.net');
            assert(tr.stdOutContained('loc_mock_WarPackageDeploymentInitiated'), 'Should have printed: loc_mock_WarPackageDeploymentInitiated.');
            assert(tr.stdOutContained('loc_mock_PackageDeploymentSuccess'), 'Should have printed: loc_mock_PackageDeploymentSuccess.');
            done();
        }
        catch(error) {
            done(error);
        }
    });

    it('AzureRmWebAppDeploymentV4 WindowsWebAppZipDeployProviderTests', (done: MochaDone) => {
        let tp = path.join(__dirname,'WindowsWebAppZipDeployProviderTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('PreDeployment steps for zip deploy should succeeded'), 'Should have printed: PreDeployment steps for zip deploy should succeeded');
            assert(tr.stdOutContained('PreDeployment steps for zip deploy with slot enabled should succeeded'), 'Should have printed: PreDeployment steps for zip deploy with slot enabled should succeeded');
            assert(tr.stdOutContained('set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net'), 'Should have printed: set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net');
            assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.');
            assert(tr.stdOutContained('DeployWebAppStep for zip deploy steps with zip package succeeded'), 'Should have printed: DeployWebAppStep for zip deploy steps with zip package succeeded.')
            assert(tr.stdOutContained('loc_mock_GotconnectiondetailsforazureRMWebApp0 mytestapp'), 'Should have printed: loc_mock_GotconnectiondetailsforazureRMWebApp0 mytestapp');
            assert(tr.stdOutContained('loc_mock_PackageDeploymentSuccess'), 'Should have printed: loc_mock_PackageDeploymentSuccess.');
            assert(tr.stdOutContained('DeployWebAppStep for zip deploy steps with folder package succeeded'), 'Should have printed: DeployWebAppStep for zip deploy steps with folder package succeeded.');
            assert(tr.stdOutContained('Compressed folder into zip webAppPkg.zip'), 'Should have printed: Compressed folder into zip webAppPkg.zip.');
            done();
        }
        catch(error) {
            done(error);
        }
    });

    
    it('AzureRmWebAppDeploymentV4 WindowsWebAppWebDeployProviderTests', (done: MochaDone) => {
        let tp = path.join(__dirname,'WindowsWebAppWebDeployProviderTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('PreDeployment steps for web deploy should succeeded'), 'Should have printed: PreDeployment steps for web deploy should succeeded');
            assert(tr.stdOutContained('PreDeployment steps for web deploy with slot enabled should succeeded'), 'Should have printed: PreDeployment steps for web deploy with slot enabled should succeeded');
            assert(tr.stdOutContained('set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net'), 'Should have printed: set AppServiceApplicationUrl=http://mytestapp.azurewebsites.net');
            assert(tr.stdOutContained('Active DeploymentId :MOCK_DEPLOYMENT_ID'), 'Should have printed: Active DeploymentId :MOCK_DEPLOYMENT_ID.');
            assert(tr.stdOutContained('DeployWebAppStep for web deploy steps with zip package succeeded'), 'Should have printed: DeployWebAppStep for web deploy steps with zip package succeeded.')
            assert(tr.stdOutContained('loc_mock_GotconnectiondetailsforazureRMWebApp0 mytestapp'), 'Should have printed: loc_mock_GotconnectiondetailsforazureRMWebApp0 mytestapp');
            assert(tr.stdOutContained('loc_mock_AppServiceApplicationURL http://mytestapp.azurewebsites.net'), 'Should have printed: loc_mock_AppServiceApplicationURL http://mytestapp.azurewebsites.net.');
            assert(tr.stdOutContained('loc_mock_Successfullydeployedpackageusingkuduserviceat webAppPkg.zip /site/wwwroot'), 'Should have printed: loc_mock_Successfullydeployedpackageusingkuduserviceat webAppPkg.zip /site/wwwroot.');
            assert(tr.stdOutContained('loc_mock_Successfullydeployedpackageusingkuduserviceat webAppPkg.zip physicalPath'), 'Should have printed: loc_mock_Successfullydeployedpackageusingkuduserviceat webAppPkg.zip physicalPath');
            assert(tr.stdOutContained('DeployWebAppStep for web deploy steps with virtual application with zip package succeeded'), 'Should have printed: DeployWebAppStep for web deploy steps with virtual application with zip package succeeded');
            done();
        }
        catch(error) {
            done(error);
        }
    });

    it('AzureRmWebAppDeploymentV4 PublishProfileWebAppDeploymentProviderTests', (done: MochaDone) => {
        let tp = path.join(__dirname,'PublishProfileWebAppDeploymentProviderTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('PreDeployment steps for publish profile should succeeded'), 'Should have printed: PreDeployment steps for publish profile should succeeded');
            assert(tr.stdOutContained('set AppServiceApplicationUrl=SiteUrl'), 'Should have printed: set AppServiceApplicationUrl=SiteUrl');
            assert(tr.stdOutContained('UpdateDeploymentStatus for publish profile steps should succeeded'), 'Should have printed: UpdateDeploymentStatus for publish profile steps should succeeded');
            assert(tr.stdOutContained('DeployWebAppStep for publish profile steps steps failed with errorError: loc_mock_PublishusingwebdeployoptionsaresupportedonlywhenusingWindowsagent'), 'Should have printed: DeployWebAppStep for publish profile steps steps failed with errorError: loc_mock_PublishusingwebdeployoptionsaresupportedonlywhenusingWindowsagent');
            done();
        }
        catch(error) {
            done(error);
        }
    });

    it('AzureRmWebAppDeploymentV4 Validate TaskParameters', (done: MochaDone) => {
        let tp = path.join(__dirname,'TaskParametersTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('SCM_COMMAND_IDLE_TIMEOUT variable PRESENT'), 'Should have printed: SCM_COMMAND_IDLE_TIMEOUT variable PRESENT');
            done();
        }
        catch(error) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            done();
        }
    });

});