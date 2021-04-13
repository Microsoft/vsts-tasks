import tl = require('azure-pipelines-task-lib');
import { DeploymentFactory } from '../deploymentProvider/DeploymentFactory';
import { PublishProfileWebAppDeploymentProvider } from '../deploymentProvider/PublishProfileWebAppDeploymentProvider'
import { IWebAppDeploymentProvider } from '../deploymentProvider/IWebAppDeploymentProvider';
import { TaskParametersUtility, TaskParameters, DeploymentType } from '../operations/TaskParameters';
import { stringify } from 'querystring';
import { PackageType } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
import { getMockEndpoint } from '../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests/mock_utils';
import { mockAzureARMPreDeploymentSteps, mockRunFromZipSettings }  from "./mock_utils";

getMockEndpoint();
mockAzureARMPreDeploymentSteps();
mockRunFromZipSettings();

export class PublishProfileWebAppDeploymentProviderL0Tests  {

    public static async startPublishProfileWebAppDeploymentProviderL0Tests() {
        await PublishProfileWebAppDeploymentProviderL0Tests.testForPreDeploymentSteps_PublishProfileProvider();
        await PublishProfileWebAppDeploymentProviderL0Tests.testForUpdateDeploymentStatus_PublishProfileProvider();
        await PublishProfileWebAppDeploymentProviderL0Tests.testForDeployWebAppStep_PublishProfileProvider();
    }

    public static async testForPreDeploymentSteps_PublishProfileProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            var publishProfileWebAppDeploymentProvider : PublishProfileWebAppDeploymentProvider  = new PublishProfileWebAppDeploymentProvider(taskParameters);
            await publishProfileWebAppDeploymentProvider.PreDeploymentStep();
            tl.setResult(tl.TaskResult.Succeeded, 'PreDeployment steps for publish profile should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps for publish profile failed with error');
        }
    }

    public static async testForUpdateDeploymentStatus_PublishProfileProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            var publishProfileWebAppDeploymentProvider : PublishProfileWebAppDeploymentProvider  = new PublishProfileWebAppDeploymentProvider(taskParameters);
            await publishProfileWebAppDeploymentProvider.PreDeploymentStep();
            await publishProfileWebAppDeploymentProvider.UpdateDeploymentStatus(true);
            tl.setResult(tl.TaskResult.Succeeded, 'UpdateDeploymentStatus for publish profile steps should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'UpdateDeploymentStatus for publish profile steps failed with error');
        }
    }

    public static async testForDeployWebAppStep_PublishProfileProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            var publishProfileWebAppDeploymentProvider : PublishProfileWebAppDeploymentProvider  = new PublishProfileWebAppDeploymentProvider(taskParameters);
            await publishProfileWebAppDeploymentProvider.PreDeploymentStep();
            await publishProfileWebAppDeploymentProvider.DeployWebAppStep();
            tl.setResult(tl.TaskResult.Succeeded, 'DeployWebAppStep for publish profile steps steps should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'DeployWebAppStep for publish profile steps steps failed with error'+ error);
        }
    }

}

PublishProfileWebAppDeploymentProviderL0Tests.startPublishProfileWebAppDeploymentProviderL0Tests();