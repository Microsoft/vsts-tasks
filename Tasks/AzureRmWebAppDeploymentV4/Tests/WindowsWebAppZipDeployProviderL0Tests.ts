import tl = require('azure-pipelines-task-lib');
import { DeploymentFactory } from '../deploymentProvider/DeploymentFactory';
import { WindowsWebAppZipDeployProvider } from '../deploymentProvider/WindowsWebAppZipDeployProvider'
import { IWebAppDeploymentProvider } from '../deploymentProvider/IWebAppDeploymentProvider';
import { TaskParametersUtility, TaskParameters, DeploymentType } from '../operations/TaskParameters';
import { stringify } from 'querystring';
import { PackageType } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
import { getMockEndpoint } from '../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests/mock_utils';
import { mockAzureARMPreDeploymentSteps, mockZipDeploySettings }  from "./mock_utils";

getMockEndpoint();
mockAzureARMPreDeploymentSteps();
mockZipDeploySettings();

export class WindowsWebAppZipDeployProviderL0Tests  {

    public static async startWindowsWebAppZipDeployProviderL0Tests() {
        await WindowsWebAppZipDeployProviderL0Tests.testForPreDeploymentSteps_ZipDeployProvider();
        await WindowsWebAppZipDeployProviderL0Tests.testForPreDeploymentStepsWithSlotEnabled_ZipDeployProvider();
        await WindowsWebAppZipDeployProviderL0Tests.testForUpdateDeploymentStatus_ZipDeployProvider();
        await WindowsWebAppZipDeployProviderL0Tests.testForDeployWebAppStep_ZipDeployProvider();
        await WindowsWebAppZipDeployProviderL0Tests.testForDeployWebAppStepForFolder_ZipDeployProvider();
    }

    public static async testForPreDeploymentSteps_ZipDeployProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            var windowsWebAppZipDeployProvider : WindowsWebAppZipDeployProvider  = new WindowsWebAppZipDeployProvider(taskParameters);
            await windowsWebAppZipDeployProvider.PreDeploymentStep();
            tl.setResult(tl.TaskResult.Succeeded, 'PreDeployment steps for zip deploy should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps for zip deploy failed with error');
        }
    }

    public static async testForPreDeploymentStepsWithSlotEnabled_ZipDeployProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.DeployToSlotOrASEFlag = true;
            taskParameters.ResourceGroupName = "MOCK_RESOURCE_GROUP_NAME";
            var windowsWebAppZipDeployProvider : WindowsWebAppZipDeployProvider  = new WindowsWebAppZipDeployProvider(taskParameters);
            await windowsWebAppZipDeployProvider.PreDeploymentStep();
            tl.setResult(tl.TaskResult.Succeeded, 'PreDeployment steps for zip deploy with slot enabled should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps for zip deploy with slot enabled failed with error');
        }
    }

    public static async testForUpdateDeploymentStatus_ZipDeployProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.ScriptType = "Run Script";
            var windowsWebAppZipDeployProvider : WindowsWebAppZipDeployProvider  = new WindowsWebAppZipDeployProvider(taskParameters);
            await windowsWebAppZipDeployProvider.PreDeploymentStep();
            await windowsWebAppZipDeployProvider.UpdateDeploymentStatus(true);
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'UpdateDeploymentStatus for zip deploy steps should succeeded but failed with error');
        }
    }

    public static async testForDeployWebAppStep_ZipDeployProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.Package.getPackageType = () :PackageType => {return PackageType.zip};
            taskParameters.Package.getPath = () :string => { return "webAppPkg.zip" };
            var windowsWebAppZipDeployProvider : WindowsWebAppZipDeployProvider  = new WindowsWebAppZipDeployProvider(taskParameters);
            await windowsWebAppZipDeployProvider.PreDeploymentStep();
            await windowsWebAppZipDeployProvider.DeployWebAppStep();
            tl.setResult(tl.TaskResult.Succeeded, 'DeployWebAppStep for zip deploy steps with zip package succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'DeployWebAppStep for zip deploy steps with zip package should succeeded but failed with error');
        }
    }

    public static async testForDeployWebAppStepForFolder_ZipDeployProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.Package.getPackageType = () :PackageType => {return PackageType.folder};
            taskParameters.Package.getPath = () :string => { return "webAppPkg" };
            var windowsWebAppZipDeployProvider : WindowsWebAppZipDeployProvider  = new WindowsWebAppZipDeployProvider(taskParameters);
            await windowsWebAppZipDeployProvider.PreDeploymentStep();
            await windowsWebAppZipDeployProvider.DeployWebAppStep();
            tl.setResult(tl.TaskResult.Succeeded, 'DeployWebAppStep for zip deploy steps with folder package succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'DeployWebAppStep for zip deploy steps with folder package should succeeded but failed with error');
        }
    }

}

WindowsWebAppZipDeployProviderL0Tests.startWindowsWebAppZipDeployProviderL0Tests();