import tl = require('azure-pipelines-task-lib');
import { DeploymentFactory } from '../deploymentProvider/DeploymentFactory';
import { ContainerWebAppDeploymentProvider } from '../deploymentProvider/ContainerWebAppDeploymentProvider'
import { IWebAppDeploymentProvider } from '../deploymentProvider/IWebAppDeploymentProvider';
import { TaskParametersUtility, TaskParameters, DeploymentType } from '../operations/TaskParameters';
import { stringify } from 'querystring';
import { PackageType } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
import { getMockEndpoint } from '../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests/mock_utils';
import { mockAzureARMPreDeploymentSteps, mockContainerDeploySettings }  from "./mock_utils";

getMockEndpoint();
mockAzureARMPreDeploymentSteps();
mockContainerDeploySettings();

export class ContainerWebAppDeploymentProviderL0Tests  {

    public static async startContainerWebAppDeploymentProviderL0Tests() {
        await ContainerWebAppDeploymentProviderL0Tests.testForPreDeploymentSteps_ContainerWebApp();
        await ContainerWebAppDeploymentProviderL0Tests.testForPreDeploymentStepsWithSlotEnabled_ContainerWebApp();
        await ContainerWebAppDeploymentProviderL0Tests.testForUpdateDeploymentStatus_ContainerWebApp();
        await ContainerWebAppDeploymentProviderL0Tests.testForDeployWebSteps_ContainerWebApp();
    }

    public static async testForPreDeploymentSteps_ContainerWebApp() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            var containerWebAppDeploymentProvider : ContainerWebAppDeploymentProvider  = new ContainerWebAppDeploymentProvider(taskParameters);
            await containerWebAppDeploymentProvider.PreDeploymentStep();
            tl.setResult(tl.TaskResult.Succeeded, 'PreDeployment steps for container web app should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps for container web app failed with error');
        }
    }

    public static async testForPreDeploymentStepsWithSlotEnabled_ContainerWebApp() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.DeployToSlotOrASEFlag = true;
            taskParameters.ResourceGroupName = "MOCK_RESOURCE_GROUP_NAME";
            var containerWebAppDeploymentProvider : ContainerWebAppDeploymentProvider  = new ContainerWebAppDeploymentProvider(taskParameters);
            await containerWebAppDeploymentProvider.PreDeploymentStep();
            tl.setResult(tl.TaskResult.Succeeded, 'PreDeployment steps for container web app with slot enabled should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps for container web app with slot enabled failed with error');
        }
    }

    public static async testForUpdateDeploymentStatus_ContainerWebApp() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            var containerWebAppDeploymentProvider : ContainerWebAppDeploymentProvider  = new ContainerWebAppDeploymentProvider(taskParameters);
            await containerWebAppDeploymentProvider.PreDeploymentStep();
            await containerWebAppDeploymentProvider.UpdateDeploymentStatus(true);
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'UpdateDeploymentStatus for container web app steps should succeeded but failed with error');
        }
    }

    public static async testForDeployWebSteps_ContainerWebApp() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.ScriptType = null;
            var containerWebAppDeploymentProvider : ContainerWebAppDeploymentProvider  = new ContainerWebAppDeploymentProvider(taskParameters);
            await containerWebAppDeploymentProvider.PreDeploymentStep();
            await containerWebAppDeploymentProvider.DeployWebAppStep();
            tl.setResult(tl.TaskResult.Succeeded, 'Web app Deployment steps for container should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'Deployment web app steps for container failed with error');
        }
    }

}

ContainerWebAppDeploymentProviderL0Tests.startContainerWebAppDeploymentProviderL0Tests();
