import { IWebAppDeploymentProvider } from './IWebAppDeploymentProvider';
import { TaskParameters } from '../operations/TaskParameters';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-endpoint';
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
import { AzureResourceFilterUtility } from '../operations/AzureResourceFilterUtility';
import { KuduServiceUtility } from '../operations/KuduServiceUtility';
import { AzureAppService } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-app-service';
import { Kudu } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-app-service-kudu';
import { AzureAppServiceUtility } from '../operations/AzureAppServiceUtility';
import tl = require('azure-pipelines-task-lib/task');
import * as ParameterParser from 'azure-pipelines-tasks-webdeployment-common/ParameterParserUtility';
import { addReleaseAnnotation } from '../operations/ReleaseAnnotationUtility';
import { PackageUtility } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
import { AzureDeployPackageArtifactAlias } from '../operations/Constants';

export class AzureRmWebAppDeploymentProvider implements IWebAppDeploymentProvider{
    protected taskParams:TaskParameters;
    protected appService: AzureAppService;
    protected kuduService: Kudu;
    protected appServiceUtility: AzureAppServiceUtility;
    protected kuduServiceUtility: KuduServiceUtility;
    protected virtualApplicationPath: string = "";
    protected azureEndpoint: AzureEndpoint;
    protected activeDeploymentID;

    constructor(taskParams: TaskParameters) {
        this.taskParams = taskParams;
        let packageArtifactAlias = this.taskParams.Package ? PackageUtility.getArtifactAlias(this.taskParams.Package.getPath()) : null;
        tl.setVariable(AzureDeployPackageArtifactAlias, packageArtifactAlias);
    }

    public async PreDeploymentStep() {
        this.azureEndpoint = await new AzureRMEndpoint(this.taskParams.connectedServiceName).getEndpoint();
        console.log(tl.loc('GotconnectiondetailsforazureRMWebApp0', this.taskParams.WebAppName));
        if(!this.taskParams.DeployToSlotOrASEFlag) {
            this.taskParams.ResourceGroupName = await AzureResourceFilterUtility.getResourceGroupName(this.azureEndpoint, this.taskParams.WebAppName);
        }

        this.appService = new AzureAppService(this.azureEndpoint, this.taskParams.ResourceGroupName, this.taskParams.WebAppName, 
            this.taskParams.SlotName, this.taskParams.WebAppKind);
        this.appServiceUtility = new AzureAppServiceUtility(this.appService);

        this.kuduService = await this.appServiceUtility.getKuduService();
        this.kuduServiceUtility = new KuduServiceUtility(this.kuduService);
        tl.debug(`Resource Group: ${this.taskParams.ResourceGroupName}`);
    }

    public async DeployWebAppStep() {}

    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        if(this.kuduServiceUtility) {
            await addReleaseAnnotation(this.azureEndpoint, this.appService, isDeploymentSuccess);
            this.activeDeploymentID = await this.kuduServiceUtility.updateDeploymentStatus(isDeploymentSuccess, null, {'type': 'Deployment', slotName: this.appService.getSlot()});
            tl.debug('Active DeploymentId :'+ this.activeDeploymentID);
        }
        
        let appServiceApplicationUrl: string = await this.appServiceUtility.getApplicationURL(!this.taskParams.isLinuxApp 
            ? this.taskParams.VirtualApplication : null);
        console.log(tl.loc('AppServiceApplicationURL', appServiceApplicationUrl));
        tl.setVariable('AppServiceApplicationUrl', appServiceApplicationUrl);
    }

    protected async PostDeploymentStep() {
        if(this.taskParams.AppSettings) {
            var customApplicationSettings = ParameterParser.parse(this.taskParams.AppSettings);
            await this.appServiceUtility.updateAndMonitorAppSettings(customApplicationSettings);
        }

        if(this.taskParams.ConfigurationSettings) {
            var customApplicationSettings = ParameterParser.parse(this.taskParams.ConfigurationSettings);
            await this.appServiceUtility.updateConfigurationSettings(customApplicationSettings);
        }

        if(this.taskParams.ScriptType) {
            await this.kuduServiceUtility.runPostDeploymentScript(this.taskParams, this.virtualApplicationPath);
        }

        await this.appServiceUtility.updateScmTypeAndConfigurationDetails();
    }
}