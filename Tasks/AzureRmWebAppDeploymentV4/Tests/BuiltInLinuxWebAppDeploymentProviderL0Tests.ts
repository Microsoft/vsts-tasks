import tl = require('azure-pipelines-task-lib');
import { DeploymentFactory } from '../deploymentProvider/DeploymentFactory';
import { BuiltInLinuxWebAppDeploymentProvider } from '../deploymentProvider/BuiltInLinuxWebAppDeploymentProvider'
import { IWebAppDeploymentProvider } from '../deploymentProvider/IWebAppDeploymentProvider';
import { TaskParametersUtility, TaskParameters, DeploymentType } from '../operations/TaskParameters';
import { stringify } from 'querystring';
import { PackageType } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
import { getMockEndpoint } from '../node_modules/azure-pipelines-tasks-azure-arm-rest-v2/Tests/mock_utils';
import { mockAzureARMPreDeploymentSteps, mockLinuxAppSettings }  from "./mock_utils";

getMockEndpoint();
mockAzureARMPreDeploymentSteps();
mockLinuxAppSettings();

export class BuiltInLinuxWebAppDeploymentProviderL0Tests  {

    public static async startBuiltInLinuxWebAppDeploymentProviderL0Tests() {
        await BuiltInLinuxWebAppDeploymentProviderL0Tests.testForPreDeploymentSteps_BuiltInLinuxWebApp();
        await BuiltInLinuxWebAppDeploymentProviderL0Tests.testForPreDeploymentStepsWithSlotEnabled_BuiltInLinuxWebApp();
        await BuiltInLinuxWebAppDeploymentProviderL0Tests.testForUpdateDeploymentStatus_BuiltInLinuxWebApp();
        await BuiltInLinuxWebAppDeploymentProviderL0Tests.testForDeployWebAppStep_BuiltInLinuxWebApp_ZipPackage();
        await BuiltInLinuxWebAppDeploymentProviderL0Tests.testForDeployWebAppStep_BuiltInLinuxWebApp_FolderPackage();
        await BuiltInLinuxWebAppDeploymentProviderL0Tests.testForDeployWebAppStep_BuiltInLinuxWebApp_WarPackage();
        await BuiltInLinuxWebAppDeploymentProviderL0Tests.testForDeployWebAppStep_BuiltInLinuxWebApp_JarPackage();
    }

    public static async testForPreDeploymentSteps_BuiltInLinuxWebApp() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            var builtInLinuxWebAppDeploymentProvider : BuiltInLinuxWebAppDeploymentProvider  = new BuiltInLinuxWebAppDeploymentProvider(taskParameters);
            await builtInLinuxWebAppDeploymentProvider.PreDeploymentStep();
            tl.setResult(tl.TaskResult.Succeeded, 'PreDeployment steps for built in linux web app should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps for built in linux web app failed with error');
        }
    }

    public static async testForPreDeploymentStepsWithSlotEnabled_BuiltInLinuxWebApp() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.DeployToSlotOrASEFlag = true;
            taskParameters.ResourceGroupName = "MOCK_RESOURCE_GROUP_NAME";
            var builtInLinuxWebAppDeploymentProvider : BuiltInLinuxWebAppDeploymentProvider  = new BuiltInLinuxWebAppDeploymentProvider(taskParameters);
            await builtInLinuxWebAppDeploymentProvider.PreDeploymentStep();
            tl.setResult(tl.TaskResult.Succeeded, 'PreDeployment steps for built in linux web app with slot enabled should succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PreDeployment steps for built in linux web app with slot enabled failed with error');
        }
    }

    public static async testForUpdateDeploymentStatus_BuiltInLinuxWebApp() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            var builtInLinuxWebAppDeploymentProvider : BuiltInLinuxWebAppDeploymentProvider  = new BuiltInLinuxWebAppDeploymentProvider(taskParameters);
            await builtInLinuxWebAppDeploymentProvider.PreDeploymentStep();
            await builtInLinuxWebAppDeploymentProvider.UpdateDeploymentStatus(true);
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'UpdateDeploymentStatus for built in linux web app steps should succeeded but failed with error');
        }
    }

    public static async testForDeployWebAppStep_BuiltInLinuxWebApp_ZipPackage() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            var builtInLinuxWebAppDeploymentProvider : BuiltInLinuxWebAppDeploymentProvider  = new BuiltInLinuxWebAppDeploymentProvider(taskParameters);
            await builtInLinuxWebAppDeploymentProvider.PreDeploymentStep();
            await builtInLinuxWebAppDeploymentProvider.DeployWebAppStep();
            tl.setResult(tl.TaskResult.Succeeded, 'DeployWebAppStep for built in linux web app steps with zip package succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'DeployWebAppStep for built in linux web app steps with zip package should succeeded but failed with error');
        }
    }

    public static async testForDeployWebAppStep_BuiltInLinuxWebApp_FolderPackage() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.Package.getPackageType = () :PackageType => {return PackageType.folder};
            taskParameters.Package.getPath = () :string => { return "webAppPkg" };
            var builtInLinuxWebAppDeploymentProvider : BuiltInLinuxWebAppDeploymentProvider  = new BuiltInLinuxWebAppDeploymentProvider(taskParameters);
            await builtInLinuxWebAppDeploymentProvider.PreDeploymentStep();
            await builtInLinuxWebAppDeploymentProvider.DeployWebAppStep();
            tl.setResult(tl.TaskResult.Succeeded, 'DeployWebAppStep for built in linux web app steps with folder package succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'DeployWebAppStep for built in linux web app steps with folder package should succeeded but failed with error');
        }
    }

    public static async testForDeployWebAppStep_BuiltInLinuxWebApp_WarPackage() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.Package.getPackageType = () :PackageType => {return PackageType.war};
            taskParameters.Package.getPath = () :string => { return "webAppPkg.war" };
            var builtInLinuxWebAppDeploymentProvider : BuiltInLinuxWebAppDeploymentProvider  = new BuiltInLinuxWebAppDeploymentProvider(taskParameters);
            await builtInLinuxWebAppDeploymentProvider.PreDeploymentStep();
            await builtInLinuxWebAppDeploymentProvider.DeployWebAppStep();
            tl.setResult(tl.TaskResult.Succeeded, 'DeployWebAppStep for built in linux web app steps with war package succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'DeployWebAppStep for built in linux web app steps with war package should succeeded but failed with error');
        }
    }

    public static async testForDeployWebAppStep_BuiltInLinuxWebApp_JarPackage() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.Package.getPackageType = () :PackageType => {return PackageType.jar};
            taskParameters.Package.getPath = () :string => { return "webAppPkg.jar" };
            var builtInLinuxWebAppDeploymentProvider : BuiltInLinuxWebAppDeploymentProvider  = new BuiltInLinuxWebAppDeploymentProvider(taskParameters);
            await builtInLinuxWebAppDeploymentProvider.PreDeploymentStep();
            await builtInLinuxWebAppDeploymentProvider.DeployWebAppStep();
            tl.setResult(tl.TaskResult.Succeeded, 'DeployWebAppStep for built in linux web app steps with jar package succeeded');
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'DeployWebAppStep for built in linux web app steps with jar package should succeeded but failed with error');
        }
    }

}

BuiltInLinuxWebAppDeploymentProviderL0Tests.startBuiltInLinuxWebAppDeploymentProviderL0Tests();
