import tl = require('azure-pipelines-task-lib');
import { DeploymentFactory } from '../deploymentProvider/DeploymentFactory';
import { WindowsWebAppWarDeployProvider } from '../deploymentProvider/WindowsWebAppWarDeployProvider'
import { IWebAppDeploymentProvider } from '../deploymentProvider/IWebAppDeploymentProvider';
import { TaskParametersUtility, TaskParameters, DeploymentType } from '../operations/TaskParameters';
import { stringify } from 'querystring';
import { PackageType } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
import { getMockEndpoint } from '../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests/mock_utils';
import { mockAzureARMPreDeploymentSteps, mockRunFromZipSettings }  from "./mock_utils";

getMockEndpoint();
mockAzureARMPreDeploymentSteps();
mockRunFromZipSettings();

export class WindowsWebAppWarDeployProviderL0Tests  {

    public static async startWindowsWebAppWarDeployProviderL0Tests() {
        await WindowsWebAppWarDeployProviderL0Tests.testForPreDeploymentSteps_WarDeployProvider();
        await WindowsWebAppWarDeployProviderL0Tests.testForPreDeploymentStepsWithSlotEnabled_WarDeployProvider();
        await WindowsWebAppWarDeployProviderL0Tests.testForUpdateDeploymentStatus_WarDeployProvider();
        await WindowsWebAppWarDeployProviderL0Tests.testForDeployWebAppStep_WarDeployProvider();
    }

    public static async testForPreDeploymentSteps_WarDeployProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.Package.getPackageType = () :PackageType => {return PackageType.war};
            taskParameters.Package.getPath = () :string => { return "webAppPkg.war" };
            var windowsWebAppWarDeployProvider : WindowsWebAppWarDeployProvider  = new WindowsWebAppWarDeployProvider(taskParameters);
            await windowsWebAppWarDeployProvider.PreDeploymentStep();
            tl.setResult(tl.TaskResult.Succeeded, 'PreDeployment steps for war deploy should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps for war deploy failed with error');
        }
    }

    public static async testForPreDeploymentStepsWithSlotEnabled_WarDeployProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.Package.getPackageType = () :PackageType => {return PackageType.war};
            taskParameters.Package.getPath = () :string => { return "webAppPkg.war" };
            taskParameters.DeployToSlotOrASEFlag = true;
            taskParameters.ResourceGroupName = "MOCK_RESOURCE_GROUP_NAME";
            var windowsWebAppWarDeployProvider : WindowsWebAppWarDeployProvider  = new WindowsWebAppWarDeployProvider(taskParameters);
            await windowsWebAppWarDeployProvider.PreDeploymentStep();
            tl.setResult(tl.TaskResult.Succeeded, 'PreDeployment steps for war deploy with slot enabled should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps for war deploy with slot enabled failed with error');
        }
    }

    public static async testForUpdateDeploymentStatus_WarDeployProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.Package.getPackageType = () :PackageType => {return PackageType.war};
            taskParameters.Package.getPath = () :string => { return "webAppPkg.war" };
            var windowsWebAppWarDeployProvider : WindowsWebAppWarDeployProvider  = new WindowsWebAppWarDeployProvider(taskParameters);
            await windowsWebAppWarDeployProvider.PreDeploymentStep();
            await windowsWebAppWarDeployProvider.UpdateDeploymentStatus(true);
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'UpdateDeploymentStatus for war deploy steps should succeeded but failed with error');
        }
    }

    public static async testForDeployWebAppStep_WarDeployProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.Package.getPackageType = () :PackageType => {return PackageType.war};
            taskParameters.Package.getPath = () :string => { return "webAppPkg.war" };
            var windowsWebAppWarDeployProvider : WindowsWebAppWarDeployProvider  = new WindowsWebAppWarDeployProvider(taskParameters);
            await windowsWebAppWarDeployProvider.PreDeploymentStep();
            await windowsWebAppWarDeployProvider.DeployWebAppStep();
            tl.setResult(tl.TaskResult.Succeeded, 'DeployWebAppStep for war deploy steps with war package succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'DeployWebAppStep for war deploy steps with war package should succeeded but failed with error');
        }
    }

}

WindowsWebAppWarDeployProviderL0Tests.startWindowsWebAppWarDeployProviderL0Tests();