import tl = require('azure-pipelines-task-lib/task');
import { TaskParameters } from './TaskParameters';
import fs = require('fs');
import * as Constant from './Constants';
import path = require('path');
import Q = require('q');

var packageUtility = require('azure-pipelines-tasks-webdeployment-common/packageUtility.js');
var parseString = require('xml2js').parseString;
const ERROR_FILE_NAME = "error.txt";

export interface PublishingProfile{
    PublishUrl:string;
    UserName: string;
    UserPWD: string;
    WebAppName: string;
    TakeAppOfflineFlag: boolean;
    RemoveAdditionalFilesFlag: boolean;
}

export class PublishProfileUtility {

    private _publishProfileJs: any = null;
    private _publishProfilePath: string;

    constructor(publishProfilePath: string) {
        this._publishProfilePath = publishProfilePath;
    }

    public async GetTaskParametersFromPublishProfileFile(taskParams: TaskParameters): Promise<PublishingProfile> {
        try {
            if(this._publishProfileJs === null) {
                this._publishProfileJs = await this.GetPublishProfileJsonFromFile();
            }
        } catch(error) {
            throw new Error(error);
        }
        var msDeployPublishingProfile: PublishingProfile = {
            WebAppName: this._publishProfileJs.DeployIisAppPath[0],
            TakeAppOfflineFlag: this._publishProfileJs.hasOwnProperty(Constant.PublishProfileXml.EnableMSDeployAppOffline) ?
                this._publishProfileJs.EnableMSDeployAppOffline[0] : false,
            RemoveAdditionalFilesFlag: this._publishProfileJs.hasOwnProperty(Constant.PublishProfileXml.SkipExtraFilesOnServer) ?
                this._publishProfileJs.SkipExtraFilesOnServer[0] : false,
            PublishUrl: this._publishProfileJs.MSDeployServiceURL[0],
            UserName: this._publishProfileJs.UserName[0],
            UserPWD: taskParams.PublishProfilePassword
        }
        return msDeployPublishingProfile;
    }

    public async GetPropertyValuefromPublishProfile(propertyKey: string): Promise<any> {
        try {
            if(this._publishProfileJs === null) {
                this._publishProfileJs = await this.GetPublishProfileJsonFromFile();
            }
        } catch(error) {
            throw new Error(error);
        }
        return new Promise ((response, reject) => {
            this._publishProfileJs.hasOwnProperty(propertyKey) ?
                response(this._publishProfileJs[propertyKey][0]) : reject(tl.loc('PropertyDoesntExistPublishProfile', propertyKey)); 
            });
    }

    private async GetPublishProfileJsonFromFile(): Promise<any> {
        return new Promise((response, reject) => {
            var pubxmlFile = packageUtility.PackageUtility.getPackagePath(this._publishProfilePath);
            var publishProfileXML = fs.readFileSync(pubxmlFile);
            parseString(publishProfileXML, (error, result) => {
                if(!!error) {
                    reject(tl.loc('XmlParsingFailed', error));
                }
                var propertyGroup = result && result.Project && result.Project.PropertyGroup ? result.Project.PropertyGroup : null;
                if(propertyGroup) {
                    for (var index in propertyGroup) {
                        if (propertyGroup[index] && propertyGroup[index].WebPublishMethod[0] === Constant.PublishProfileXml.MSDeploy) {
                            if(!propertyGroup[index].hasOwnProperty(Constant.PublishProfileXml.MSDeployServiceURL) 
                                || !propertyGroup[index].hasOwnProperty(Constant.PublishProfileXml.DeployIisAppPath) 
                                || !propertyGroup[index].hasOwnProperty(Constant.PublishProfileXml.UserName)) {
                                reject(tl.loc('InvalidPublishProfile'));
                            }
                            tl.debug("Publish Profile: " + JSON.stringify(propertyGroup[index]));
                            response(propertyGroup[index]);
                        }
                    }
                }
                reject(tl.loc('ErrorNoSuchDeployingMethodExists'));
            });
        });
    }
    
    public async RunCmd(cmdTool: string, cmdArgs: string) {
        var deferred = Q.defer();
        var cmdError = null;
        var errorFile = path.join(tl.getVariable('System.DefaultWorkingDirectory'), ERROR_FILE_NAME);
        var errObj = fs.createWriteStream(errorFile);
        errObj.on('finish', () => {
            if(cmdError) {
                deferred.reject(cmdError);
            } else {
                deferred.resolve();
            }
        });

        try {
           await tl.exec(cmdTool, cmdArgs, <any>{
               errStream: errObj,
			   outStream: process.stdout,
			   failOnStdErr: true,
               windowsVerbatimArguments: true
             });
        } catch (error) {
            cmdError = error;
        } finally {
            errObj.end();
        }

        return deferred.promise;
    }
}
