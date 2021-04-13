import tl = require('azure-pipelines-task-lib');
import { DeploymentFactory } from '../deploymentProvider/DeploymentFactory';
import { WindowsWebAppWebDeployProvider } from '../deploymentProvider/WindowsWebAppWebDeployProvider'
import { IWebAppDeploymentProvider } from '../deploymentProvider/IWebAppDeploymentProvider';
import { TaskParametersUtility, TaskParameters, DeploymentType } from '../operations/TaskParameters';
import { stringify } from 'querystring';
import { PackageType } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
import { getMockEndpoint } from '../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests/mock_utils';
import { mockAzureARMPreDeploymentSteps, mockZipDeploySettings }  from "./mock_utils";

getMockEndpoint();
mockAzureARMPreDeploymentSteps();
mockZipDeploySettings();

export class WindowsWebAppWebDeployProviderL0Tests  {

    public static async startWindowsWebAppWebDeployProviderL0Tests() {
        await WindowsWebAppWebDeployProviderL0Tests.testForPreDeploymentSteps_WebDeployProvider();
        await WindowsWebAppWebDeployProviderL0Tests.testForPreDeploymentStepsWithSlotEnabled_WebDeployProvider();
        await WindowsWebAppWebDeployProviderL0Tests.testForUpdateDeploymentStatus_WebDeployProvider();
        await WindowsWebAppWebDeployProviderL0Tests.testForDeployWebAppStep_WebDeployProvider();
        await WindowsWebAppWebDeployProviderL0Tests.testForDeployWebAppStepForVirtualApplication_WebDeployProvider();
    }

    public static async testForPreDeploymentSteps_WebDeployProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            var windowsWebAppWebDeployProvider : WindowsWebAppWebDeployProvider  = new WindowsWebAppWebDeployProvider(taskParameters);
            await windowsWebAppWebDeployProvider.PreDeploymentStep();
            tl.setResult(tl.TaskResult.Succeeded, 'PreDeployment steps for web deploy should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps for web deploy failed with error');
        }
    }

    public static async testForPreDeploymentStepsWithSlotEnabled_WebDeployProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.DeployToSlotOrASEFlag = true;
            taskParameters.ResourceGroupName = "MOCK_RESOURCE_GROUP_NAME";
            var windowsWebAppWebDeployProvider : WindowsWebAppWebDeployProvider  = new WindowsWebAppWebDeployProvider(taskParameters);
            await windowsWebAppWebDeployProvider.PreDeploymentStep();
            tl.setResult(tl.TaskResult.Succeeded, 'PreDeployment steps for web deploy with slot enabled should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps for web deploy with slot enabled failed with error');
        }
    }

    public static async testForUpdateDeploymentStatus_WebDeployProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.ScriptType = "Run Script";
            var windowsWebAppWebDeployProvider : WindowsWebAppWebDeployProvider  = new WindowsWebAppWebDeployProvider(taskParameters);
            await windowsWebAppWebDeployProvider.PreDeploymentStep();
            await windowsWebAppWebDeployProvider.UpdateDeploymentStatus(true);
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'UpdateDeploymentStatus for web deploy steps should succeeded but failed with error');
        }
    }

    public static async testForDeployWebAppStep_WebDeployProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.Package.getPackageType = () :PackageType => {return PackageType.zip};
            taskParameters.Package.getPath = () :string => { return "webAppPkg.zip" };
            var windowsWebAppWebDeployProvider : WindowsWebAppWebDeployProvider  = new WindowsWebAppWebDeployProvider(taskParameters);
            await windowsWebAppWebDeployProvider.PreDeploymentStep();
            await windowsWebAppWebDeployProvider.DeployWebAppStep();
            tl.setResult(tl.TaskResult.Succeeded, 'DeployWebAppStep for web deploy steps with zip package succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'DeployWebAppStep for web deploy steps with zip package should succeeded but failed with error');
        }
    }

    public static async testForDeployWebAppStepForVirtualApplication_WebDeployProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.Package.getPackageType = () :PackageType => {return PackageType.zip};
            taskParameters.Package.getPath = () :string => { return "webAppPkg.zip" };
            taskParameters.VirtualApplication = "VirtualApplication";
            var windowsWebAppWebDeployProvider : WindowsWebAppWebDeployProvider  = new WindowsWebAppWebDeployProvider(taskParameters);
            await windowsWebAppWebDeployProvider.PreDeploymentStep();
            await windowsWebAppWebDeployProvider.DeployWebAppStep();
            tl.setResult(tl.TaskResult.Succeeded, 'DeployWebAppStep for web deploy steps with virtual application with zip package succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'DeployWebAppStep for web deploy steps with virtual application with zip package should succeeded but failed with error');
        }
    }

}

WindowsWebAppWebDeployProviderL0Tests.startWindowsWebAppWebDeployProviderL0Tests();