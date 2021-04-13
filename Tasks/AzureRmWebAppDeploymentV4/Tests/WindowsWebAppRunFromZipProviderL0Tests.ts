import tl = require('azure-pipelines-task-lib');
import { DeploymentFactory } from '../deploymentProvider/DeploymentFactory';
import { WindowsWebAppRunFromZipProvider } from '../deploymentProvider/WindowsWebAppRunFromZipProvider'
import { IWebAppDeploymentProvider } from '../deploymentProvider/IWebAppDeploymentProvider';
import { TaskParametersUtility, TaskParameters, DeploymentType } from '../operations/TaskParameters';
import { stringify } from 'querystring';
import { PackageType } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
import { getMockEndpoint } from '../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests/mock_utils';
import { mockAzureARMPreDeploymentSteps, mockRunFromZipSettings }  from "./mock_utils";

getMockEndpoint();
mockAzureARMPreDeploymentSteps();
mockRunFromZipSettings();

export class WindowsWebAppRunFromZipProviderL0Tests  {

    public static async startWindowsWebAppRunFromZipProviderL0Tests() {
        await WindowsWebAppRunFromZipProviderL0Tests.testForPreDeploymentSteps_RunFromZipProvider();
        await WindowsWebAppRunFromZipProviderL0Tests.testForPreDeploymentStepsWithSlotEnabled_RunFromZipProvider();
        await WindowsWebAppRunFromZipProviderL0Tests.testForUpdateDeploymentStatus_RunFromZipProvider();
        await WindowsWebAppRunFromZipProviderL0Tests.testForDeployWebAppStep_RunFromZipProvider();
        await WindowsWebAppRunFromZipProviderL0Tests.testForDeployWebAppStepForFolder_RunFromZipProvider();
    }

    public static async testForPreDeploymentSteps_RunFromZipProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            var windowsWebAppRunFromZipProvider : WindowsWebAppRunFromZipProvider  = new WindowsWebAppRunFromZipProvider(taskParameters);
            await windowsWebAppRunFromZipProvider.PreDeploymentStep();
            tl.setResult(tl.TaskResult.Succeeded, 'PreDeployment steps for run from zip should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps for built in run from zip failed with error');
        }
    }

    public static async testForPreDeploymentStepsWithSlotEnabled_RunFromZipProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.DeployToSlotOrASEFlag = true;
            taskParameters.ResourceGroupName = "MOCK_RESOURCE_GROUP_NAME";
            var windowsWebAppRunFromZipProvider : WindowsWebAppRunFromZipProvider  = new WindowsWebAppRunFromZipProvider(taskParameters);
            await windowsWebAppRunFromZipProvider.PreDeploymentStep();
            tl.setResult(tl.TaskResult.Succeeded, 'PreDeployment steps for run from zip with slot enabled should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps for run from zip with slot enabled failed with error');
        }
    }

    public static async testForUpdateDeploymentStatus_RunFromZipProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.ScriptType = "Run Script";
            var windowsWebAppRunFromZipProvider : WindowsWebAppRunFromZipProvider  = new WindowsWebAppRunFromZipProvider(taskParameters);
            await windowsWebAppRunFromZipProvider.PreDeploymentStep();
            await windowsWebAppRunFromZipProvider.UpdateDeploymentStatus(true);
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'UpdateDeploymentStatus for run from zip steps should succeeded but failed with error');
        }
    }

    public static async testForDeployWebAppStep_RunFromZipProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.Package.getPackageType = () :PackageType => {return PackageType.zip};
            taskParameters.Package.getPath = () :string => { return "webAppPkg.zip" };
            var windowsWebAppRunFromZipProvider : WindowsWebAppRunFromZipProvider  = new WindowsWebAppRunFromZipProvider(taskParameters);
            await windowsWebAppRunFromZipProvider.PreDeploymentStep();
            await windowsWebAppRunFromZipProvider.DeployWebAppStep();
            tl.setResult(tl.TaskResult.Succeeded, 'DeployWebAppStep for run from zip steps with zip package succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'DeployWebAppStep for run from zip steps with zip package should succeeded but failed with error');
        }
    }

    public static async testForDeployWebAppStepForFolder_RunFromZipProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.Package.getPackageType = () :PackageType => {return PackageType.folder};
            taskParameters.Package.getPath = () :string => { return "webAppPkg" };
            var windowsWebAppRunFromZipProvider : WindowsWebAppRunFromZipProvider  = new WindowsWebAppRunFromZipProvider(taskParameters);
            await windowsWebAppRunFromZipProvider.PreDeploymentStep();
            await windowsWebAppRunFromZipProvider.DeployWebAppStep();
            tl.setResult(tl.TaskResult.Succeeded, 'DeployWebAppStep for run from zip steps with folder package succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'DeployWebAppStep for run from zip steps with folder package should succeeded but failed with error');
        }
    }

}

WindowsWebAppRunFromZipProviderL0Tests.startWindowsWebAppRunFromZipProviderL0Tests();