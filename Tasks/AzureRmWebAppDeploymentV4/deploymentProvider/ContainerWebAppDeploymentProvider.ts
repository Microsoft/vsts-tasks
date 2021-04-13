import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('azure-pipelines-task-lib/task');
import * as ParameterParser from 'azure-pipelines-tasks-webdeployment-common/ParameterParserUtility';
import { ContainerBasedDeploymentUtility } from '../operations/ContainerBasedDeploymentUtility';
const linuxFunctionStorageSetting: string = '-WEBSITES_ENABLE_APP_SERVICE_STORAGE false';

export class ContainerWebAppDeploymentProvider extends AzureRmWebAppDeploymentProvider{

    public async DeployWebAppStep() {
        tl.debug("Performing container based deployment.");

        if(this.taskParams.isFunctionApp) {
            var customApplicationSetting = ParameterParser.parse(linuxFunctionStorageSetting);
            await this.appServiceUtility.updateAndMonitorAppSettings(customApplicationSetting);
        }

        let containerDeploymentUtility: ContainerBasedDeploymentUtility = new ContainerBasedDeploymentUtility(this.appService);
        await containerDeploymentUtility.deployWebAppImage(this.taskParams);

        if(this.taskParams.ScriptType) {
            await this.kuduServiceUtility.runPostDeploymentScript(this.taskParams);
        }
        await this.appServiceUtility.updateScmTypeAndConfigurationDetails();
    }
}
