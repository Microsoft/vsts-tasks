import tl = require('azure-pipelines-task-lib/task');
import * as Constant from '../operations/Constants'
import { Package, PackageType } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
var webCommonUtility = require('azure-pipelines-tasks-webdeployment-common/utility.js');

export enum DeploymentType {
    webDeploy,
    zipDeploy,
    runFromZip,
    warDeploy
}

export class TaskParametersUtility {
    public static getParameters(): TaskParameters {
        var taskParameters: TaskParameters = {
            ConnectionType: tl.getInput('ConnectionType', true),
            WebAppKind: tl.getInput('WebAppKind', false),
            DeployToSlotOrASEFlag: tl.getBoolInput('DeployToSlotOrASEFlag', false),
            GenerateWebConfig: tl.getBoolInput('GenerateWebConfig', false),
            WebConfigParameters: tl.getInput('WebConfigParameters', false),
            XmlTransformation: tl.getBoolInput('XmlTransformation', false),
            JSONFiles: tl.getDelimitedInput('JSONFiles', '\n', false),
            XmlVariableSubstitution: tl.getBoolInput('XmlVariableSubstitution', false),
            TakeAppOfflineFlag: tl.getBoolInput('TakeAppOfflineFlag', false),
            RenameFilesFlag: tl.getBoolInput('RenameFilesFlag', false),
            AdditionalArguments: tl.getInput('AdditionalArguments', false),
            ScriptType: tl.getInput('ScriptType', false),
            InlineScript: tl.getInput('InlineScript', false),
            ScriptPath : tl.getPathInput('ScriptPath', false),
            DockerNamespace: tl.getInput('DockerNamespace', false),
            AppSettings: tl.getInput('AppSettings', false),
            StartupCommand: tl.getInput('StartupCommand', false),
            ConfigurationSettings: tl.getInput('ConfigurationSettings', false)
        }
        
        if(taskParameters.ConnectionType === Constant.ConnectionType.PublishProfile) {
            this._initializeDefaultParametersForPublishProfile(taskParameters);
            return taskParameters;
        }

        taskParameters.connectedServiceName = tl.getInput('ConnectedServiceName', true);
        taskParameters.WebAppName = tl.getInput('WebAppName', true);
        taskParameters.isFunctionApp = taskParameters.WebAppKind.indexOf("function") != -1;
        taskParameters.isLinuxApp = taskParameters.WebAppKind && (taskParameters.WebAppKind.indexOf("Linux") !=-1 || taskParameters.WebAppKind.indexOf("Container") != -1);
        taskParameters.isBuiltinLinuxWebApp = taskParameters.WebAppKind.indexOf('Linux') != -1;
        taskParameters.isContainerWebApp =taskParameters.WebAppKind.indexOf('Container') != -1;
        taskParameters.ResourceGroupName = taskParameters.DeployToSlotOrASEFlag ? tl.getInput('ResourceGroupName', false) : null;
        taskParameters.SlotName = taskParameters.DeployToSlotOrASEFlag ? tl.getInput('SlotName', false) : null;

        var endpointTelemetry = '{"endpointId":"' + taskParameters.connectedServiceName + '"}';
        console.log("##vso[telemetry.publish area=TaskEndpointId;feature=AzureRmWebAppDeployment]" + endpointTelemetry);

        if(!taskParameters.isContainerWebApp){            
            taskParameters.Package = new Package(tl.getPathInput('Package', true));
            tl.debug("intially web config parameters :" + taskParameters.WebConfigParameters);
            if(taskParameters.Package.getPackageType() === PackageType.jar && (!taskParameters.isLinuxApp)) {
                if(!taskParameters.WebConfigParameters) {
                    taskParameters.WebConfigParameters = "-appType java_springboot";
                }
                if(taskParameters.WebConfigParameters.indexOf("-appType java_springboot") < 0) {
                    taskParameters.WebConfigParameters += " -appType java_springboot";
                }
                if(taskParameters.WebConfigParameters.indexOf("-JAR_PATH D:\\home\\site\\wwwroot\\*.jar") >= 0) {
                    var jarPath = webCommonUtility.getFileNameFromPath(taskParameters.Package.getPath());
                    taskParameters.WebConfigParameters = taskParameters.WebConfigParameters.replace("D:\\home\\site\\wwwroot\\*.jar", jarPath);
                } else if(taskParameters.WebConfigParameters.indexOf("-JAR_PATH ") < 0) {
                    var jarPath = webCommonUtility.getFileNameFromPath(taskParameters.Package.getPath());
                    taskParameters.WebConfigParameters += " -JAR_PATH " + jarPath;
                }
                if(taskParameters.WebConfigParameters.indexOf("-Dserver.port=%HTTP_PLATFORM_PORT%") > 0) {
                    taskParameters.WebConfigParameters = taskParameters.WebConfigParameters.replace("-Dserver.port=%HTTP_PLATFORM_PORT%", "");  
                }
                tl.debug("web config parameters :" + taskParameters.WebConfigParameters);
            }
        }
          
        taskParameters.UseWebDeploy = !taskParameters.isLinuxApp ? tl.getBoolInput('UseWebDeploy', false) : false;

        if(taskParameters.isLinuxApp && taskParameters.isBuiltinLinuxWebApp) {
            if(taskParameters.isFunctionApp) {
                taskParameters.RuntimeStack = tl.getInput('RuntimeStackFunction', false);
            }
            else {
                taskParameters.RuntimeStack = tl.getInput('RuntimeStack', false);
            }
            taskParameters.TakeAppOfflineFlag = false;
        }
        if (!taskParameters.isFunctionApp && !taskParameters.isLinuxApp) {
            taskParameters.VirtualApplication = tl.getInput('VirtualApplication', false);
            taskParameters.VirtualApplication = taskParameters.VirtualApplication && taskParameters.VirtualApplication.startsWith('/') 
                ? taskParameters.VirtualApplication.substr(1) : taskParameters.VirtualApplication;
        }

        if(taskParameters.UseWebDeploy) {
            taskParameters.DeploymentType = this.getDeploymentType(tl.getInput('DeploymentType', false));
            if(taskParameters.DeploymentType == DeploymentType.webDeploy) {                
                taskParameters.RemoveAdditionalFilesFlag = tl.getBoolInput('RemoveAdditionalFilesFlag', false);
                taskParameters.SetParametersFile = tl.getPathInput('SetParametersFile', false);
                taskParameters.ExcludeFilesFromAppDataFlag = tl.getBoolInput('ExcludeFilesFromAppDataFlag', false)
                taskParameters.AdditionalArguments = tl.getInput('AdditionalArguments', false) || '';
            }
        }
        else {
            // Retry Attempt is passed by default
            taskParameters.AdditionalArguments = '-retryAttempts:6 -retryInterval:10000';
        }
        if (taskParameters.DeploymentType === DeploymentType.runFromZip) {
            taskParameters.TakeAppOfflineFlag = false;
        }

        if(taskParameters.isLinuxApp && taskParameters.ScriptType) {
            this.UpdateLinuxAppTypeScriptParameters(taskParameters);
        }

        return taskParameters;
    }

    private static _initializeDefaultParametersForPublishProfile(taskParameters: TaskParameters): void {
        taskParameters.PublishProfilePath = tl.getInput('PublishProfilePath', true);
        taskParameters.PublishProfilePassword = tl.getInput('PublishProfilePassword', true);
        taskParameters.Package = new Package(tl.getPathInput('Package', true));
        taskParameters.AdditionalArguments = "-retryAttempts:6 -retryInterval:10000";
    }

    private static UpdateLinuxAppTypeScriptParameters(taskParameters: TaskParameters) {
        let retryTimeoutValue = tl.getVariable('appservicedeploy.retrytimeout');
        let timeoutAppSettings = retryTimeoutValue ? Number(retryTimeoutValue) * 60 : 1800;

        tl.debug(`setting app setting SCM_COMMAND_IDLE_TIMEOUT to ${timeoutAppSettings}`);
        if(taskParameters.AppSettings) {
            taskParameters.AppSettings = `-SCM_COMMAND_IDLE_TIMEOUT ${timeoutAppSettings} ` + taskParameters.AppSettings;
        }
        else {
            taskParameters.AppSettings = `-SCM_COMMAND_IDLE_TIMEOUT ${timeoutAppSettings}`;
        }
    }
    
    private static getDeploymentType(type): DeploymentType {
        switch(type) {
            case "webDeploy": return DeploymentType.webDeploy;
            case "zipDeploy": return DeploymentType.zipDeploy;
            case "runFromZip": return DeploymentType.runFromZip;
            case "warDeploy": return DeploymentType.warDeploy;
        }
    }
}

export interface TaskParameters {
    ConnectionType: string;
    connectedServiceName?: string;
    PublishProfilePath?: string;
    PublishProfilePassword?: string;
    WebAppName?: string;
    WebAppKind?: string;
    DeployToSlotOrASEFlag?: boolean;
    ResourceGroupName?: string;
    SlotName?: string;
    VirtualApplication?: string;
    Package?: Package;
    GenerateWebConfig?: boolean;
    WebConfigParameters?: string;
    XmlTransformation?: boolean;
    JSONFiles?: string[];
    XmlVariableSubstitution?: boolean;
    UseWebDeploy?: boolean;
    DeploymentType?: DeploymentType;
    RemoveAdditionalFilesFlag?: boolean;
    SetParametersFile?: string;
    ExcludeFilesFromAppDataFlag?: boolean;
    TakeAppOfflineFlag?: boolean;
    RenameFilesFlag?: boolean;
    AdditionalArguments?: string;
    ScriptType?: string;
    InlineScript?: string;
    ScriptPath ?: string;
    DockerNamespace?: string;
    AppSettings?: string;
    StartupCommand?: string;
    RuntimeStack?: string;
    ConfigurationSettings?: string;
    /** Additional parameters */
    isLinuxApp?: boolean;
    isBuiltinLinuxWebApp?: boolean;
    isContainerWebApp?: boolean;
    isFunctionApp?: boolean;
}
