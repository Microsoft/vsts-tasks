import { IWebAppDeploymentProvider } from "./IWebAppDeploymentProvider";
import { TaskParameters } from "../operations/TaskParameters";
import { PublishProfileUtility, PublishingProfile } from '../operations/PublishProfileUtility';
import { FileTransformsUtility } from '../operations/FileTransformsUtility';
import { AzureAppServiceUtility } from '../operations/AzureAppServiceUtility';
import * as Constant from '../operations/Constants';
import tl = require('azure-pipelines-task-lib/task');
import fs = require('fs');
import path = require('path');

var packageUtility = require('azure-pipelines-tasks-webdeployment-common/packageUtility.js');
var deployUtility = require('azure-pipelines-tasks-webdeployment-common/utility.js');
var msDeployUtility = require('azure-pipelines-tasks-webdeployment-common/msdeployutility.js');

const DEFAULT_RETRY_COUNT = 3;

export class PublishProfileWebAppDeploymentProvider implements IWebAppDeploymentProvider{
    private taskParams: TaskParameters;
    private publishProfileUtility: PublishProfileUtility;
    private origWebPackage: string;
    private modWebPackage: string;
    private bakWebPackage: string;
    private origEnvPath: string;

    constructor(taskParams: TaskParameters) {
        this.taskParams = taskParams;
    }

    public async PreDeploymentStep() {
        this.publishProfileUtility = new PublishProfileUtility(this.taskParams.PublishProfilePath);
        try {
            var siteUrl = await this.publishProfileUtility.GetPropertyValuefromPublishProfile(Constant.PublishProfileXml.SiteUrlToLaunchAfterPublish);
            await AzureAppServiceUtility.pingApplication(siteUrl);
            tl.setVariable('AppServiceApplicationUrl', siteUrl);
        }
        catch (error){
           tl.debug('Unable to ping webapp, Error: ' + error);
        }
    }

    public async DeployWebAppStep() {
        if(!tl.osType().match(/^Win/)){
            throw Error(tl.loc("PublishusingwebdeployoptionsaresupportedonlywhenusingWindowsagent"));
        }

        tl.debug("Performing the deployment of webapp using publish profile.");

        var applyFileTransformFlag = this.taskParams.JSONFiles.length != 0 || this.taskParams.XmlTransformation || this.taskParams.XmlVariableSubstitution;
        if(applyFileTransformFlag) {
            await this.ApplyFileTransformation();
        }

        var msDeployPublishingProfile: PublishingProfile = await this.publishProfileUtility.GetTaskParametersFromPublishProfileFile(this.taskParams);
        var deployCmdFilePath = this.GetDeployCmdFilePath();

        await this.SetMsdeployEnvPath();
        var cmdArgs:string = this.GetDeployScriptCmdArgs(msDeployPublishingProfile);

        var retryCountParam = tl.getVariable("appservice.msdeployretrycount");
        var retryCount = (retryCountParam && !(isNaN(Number(retryCountParam)))) ? Number(retryCountParam): DEFAULT_RETRY_COUNT; 
        
        try {
            while(true) {
                try {
                    retryCount -= 1;
                    await this.publishProfileUtility.RunCmd(deployCmdFilePath, cmdArgs);
                    break;
                }
                catch (error) {
                    if(retryCount == 0) {
                        throw error;
                    }
                    console.log(error);
                    console.log(tl.loc('RetryToDeploy'));
                }
            }
            console.log(tl.loc('PackageDeploymentSuccess'));
        }
        catch (error) {
            tl.error(tl.loc('PackageDeploymentFailed'));
            tl.debug(JSON.stringify(error));
            msDeployUtility.redirectMSDeployErrorToConsole();
            throw Error(error.message);
        }
        finally {
            this.ResetMsdeployEnvPath();
            if(applyFileTransformFlag) {
                this.ResetFileTransformation();
            }
        }
    }

    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean){ }

    private async SetMsdeployEnvPath() {
        var msDeployPath = await msDeployUtility.getMSDeployFullPath();
        var msDeployDirectory = msDeployPath.slice(0, msDeployPath.lastIndexOf('\\') + 1);
        this.origEnvPath = process.env.PATH;
        process.env.PATH = msDeployDirectory + ";" + process.env.PATH ;
    }

    private async ResetMsdeployEnvPath() {
        process.env.PATH = this.origEnvPath;
    }

    private GetDeployCmdFilePath(): string {
        var webPackagePath = this.taskParams.Package.getPath();
        var packageDir = path.dirname(webPackagePath);
        return packageUtility.PackageUtility.getPackagePath(packageDir + "\\*.deploy.cmd");
    }

    private GetDeployScriptCmdArgs(msDeployPublishingProfile:any): string {
        var deployCmdArgs: string = " /Y /A:basic \"/U:" + msDeployPublishingProfile.UserName + "\" \"\\\"/P:" + msDeployPublishingProfile.UserPWD 
            + "\\\"\" \"\\\"/M:" + "https://" + msDeployPublishingProfile.PublishUrl + "/msdeploy.axd?site=" + msDeployPublishingProfile.WebAppName + "\\\"\"";

        if(msDeployPublishingProfile.TakeAppOfflineFlag) {
            deployCmdArgs += ' -enableRule:AppOffline';
        }

        if(msDeployPublishingProfile.RemoveAdditionalFilesFlag) {
            deployCmdArgs += " -enableRule:DoNotDeleteRule";
        }

        if(this.taskParams.AdditionalArguments) {
            deployCmdArgs += " " + this.taskParams.AdditionalArguments;
        }

        return deployCmdArgs;
    }

    private async ApplyFileTransformation() {
        this.origWebPackage = packageUtility.PackageUtility.getPackagePath(this.taskParams.Package);
        this.modWebPackage = await FileTransformsUtility.applyTransformations(this.origWebPackage, this.taskParams);
        this.bakWebPackage = this.origWebPackage + ".bak";
        fs.renameSync(this.origWebPackage, this.bakWebPackage);
        fs.renameSync(this.modWebPackage, this.origWebPackage);
    }

    private ResetFileTransformation() {
        tl.rmRF(this.origWebPackage);
        fs.renameSync(this.bakWebPackage, this.origWebPackage);
    }
}
