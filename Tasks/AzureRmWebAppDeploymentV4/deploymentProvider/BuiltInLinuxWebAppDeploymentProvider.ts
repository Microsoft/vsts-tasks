import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('azure-pipelines-task-lib/task');
import { PackageType } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
import path = require('path');
import * as ParameterParser from 'azure-pipelines-tasks-webdeployment-common/ParameterParserUtility';

var webCommonUtility = require('azure-pipelines-tasks-webdeployment-common/utility.js');
var deployUtility = require('azure-pipelines-tasks-webdeployment-common/utility.js');
var zipUtility = require('azure-pipelines-tasks-webdeployment-common/ziputility.js');

const linuxFunctionStorageSetting: string = '-WEBSITES_ENABLE_APP_SERVICE_STORAGE true';
const linuxFunctionRuntimeSettingName: string = '-FUNCTIONS_WORKER_RUNTIME ';

const linuxFunctionRuntimeSettingValue = new Map([
    [ 'DOCKER|microsoft/azure-functions-dotnet-core2.0:2.0', 'dotnet ' ],
    [ 'DOCKER|microsoft/azure-functions-node8:2.0', 'node ' ],
    [ 'DOCKER|microsoft/azure-functions-python3.6:2.0', 'python '],
    [ 'DOTNET|2.2', 'dotnet ' ],
    [ 'DOTNET|3.1', 'dotnet ' ],
    [ 'JAVA|8', 'java ' ],
    [ 'JAVA|11', 'java ' ],
    [ 'NODE|8', 'node ' ],
    [ 'NODE|10', 'node ' ],
    [ 'NODE|12', 'node ' ],
    [ 'NODE|14', 'node ' ],
    [ 'PYTHON|3.6', 'python '],
    [ 'PYTHON|3.7', 'python '],
    [ 'PYTHON|3.8', 'python ']
]);

export class BuiltInLinuxWebAppDeploymentProvider extends AzureRmWebAppDeploymentProvider{
    private zipDeploymentID: string;

    public async DeployWebAppStep() {
        let packageType = this.taskParams.Package.getPackageType();
        let deploymentMethodtelemetry = packageType === PackageType.war ? '{"deploymentMethod":"War Deploy"}' : '{"deploymentMethod":"Zip Deploy"}';
        console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureWebAppDeployment]" + deploymentMethodtelemetry);

        tl.debug('Performing Linux built-in package deployment');
        var isNewValueUpdated: boolean = false;

        if(this.taskParams.isFunctionApp) {
            var linuxFunctionRuntimeSetting = "";
            if(this.taskParams.RuntimeStack){
                linuxFunctionRuntimeSetting = linuxFunctionRuntimeSettingName + linuxFunctionRuntimeSettingValue.get(this.taskParams.RuntimeStack);
            }
            var linuxFunctionAppSetting = linuxFunctionRuntimeSetting + linuxFunctionStorageSetting;
            var customApplicationSetting = ParameterParser.parse(linuxFunctionAppSetting);
            isNewValueUpdated = await this.appServiceUtility.updateAndMonitorAppSettings(customApplicationSetting);
        }
        
        if(!isNewValueUpdated) {
            await this.kuduServiceUtility.warmpUp();
        }
        
        switch(packageType){
            case PackageType.folder:
                let tempPackagePath = deployUtility.generateTemporaryFolderOrZipPath(tl.getVariable('AGENT.TEMPDIRECTORY'), false);
                let archivedWebPackage = await zipUtility.archiveFolder(this.taskParams.Package.getPath(), "", tempPackagePath);
                tl.debug("Compressed folder into zip " +  archivedWebPackage);
                this.zipDeploymentID = await this.kuduServiceUtility.deployUsingZipDeploy(archivedWebPackage, this.taskParams.TakeAppOfflineFlag, 
                    { slotName: this.appService.getSlot() });
            break;
            case PackageType.zip:
                this.zipDeploymentID = await this.kuduServiceUtility.deployUsingZipDeploy(this.taskParams.Package.getPath(), this.taskParams.TakeAppOfflineFlag, 
                { slotName: this.appService.getSlot() });
            break;

            case PackageType.jar:
                tl.debug("Initiated deployment via kudu service for webapp jar package : "+ this.taskParams.Package.getPath());
                var folderPath = await webCommonUtility.generateTemporaryFolderForDeployment(false, this.taskParams.Package.getPath(), PackageType.jar);
                var output = await webCommonUtility.archiveFolderForDeployment(false, folderPath);
                var webPackage = output.webDeployPkg;
                tl.debug("Initiated deployment via kudu service for webapp jar package : "+ webPackage);
                this.zipDeploymentID = await this.kuduServiceUtility.deployUsingZipDeploy(webPackage, this.taskParams.TakeAppOfflineFlag, 
                { slotName: this.appService.getSlot() });
            break;

            case PackageType.war:
                tl.debug("Initiated deployment via kudu service for webapp war package : "+ this.taskParams.Package.getPath());
                var warName = webCommonUtility.getFileNameFromPath(this.taskParams.Package.getPath(), ".war");
                this.zipDeploymentID = await this.kuduServiceUtility.deployUsingWarDeploy(this.taskParams.Package.getPath(), 
                { slotName: this.appService.getSlot() }, warName);
            break;

            default:
                throw new Error(tl.loc('Invalidwebapppackageorfolderpathprovided', this.taskParams.Package.getPath()));
        }

        await this.appServiceUtility.updateStartupCommandAndRuntimeStack(this.taskParams.RuntimeStack, this.taskParams.StartupCommand);

        await this.PostDeploymentStep();
    }

    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        if(this.kuduServiceUtility) {
            await super.UpdateDeploymentStatus(isDeploymentSuccess);
            if(this.zipDeploymentID && this.activeDeploymentID && isDeploymentSuccess) {
                await this.kuduServiceUtility.postZipDeployOperation(this.zipDeploymentID, this.activeDeploymentID);
            }
        }
    }
}