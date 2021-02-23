import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");

import env = require("./Environment");
import deployAzureRG = require("../models/DeployAzureRG");
import armResource = require("azure-arm-rest/azure-arm-resource");
import winRM = require("./WinRMExtensionHelper");
import dgExtensionHelper = require("./DeploymentGroupExtensionHelper");
import { PowerShellParameters, NameValuePair } from "./ParameterParser";
import utils = require("./Utils");
import fileEncoding = require('./FileEncoding');
import { ParametersFileObject, TemplateObject, ParameterValue } from "../models/Types";
import httpInterfaces = require("typed-rest-client/Interfaces");

var hm = require("typed-rest-client/HttpClient");
var uuid = require("uuid");

let proxyUrl: string = tl.getVariable("agent.proxyurl");
var requestOptions: httpInterfaces.IRequestOptions = proxyUrl ? {
    proxy: {
        proxyUrl: proxyUrl,
        proxyUsername: tl.getVariable("agent.proxyusername"),
        proxyPassword: tl.getVariable("agent.proxypassword"),
        proxyBypassHosts: tl.getVariable("agent.proxybypasslist") ? JSON.parse(tl.getVariable("agent.proxybypasslist")) : null
    }
} : {};

let ignoreSslErrors: string = tl.getVariable("VSTS_ARM_REST_IGNORE_SSL_ERRORS");
requestOptions.ignoreSslError = ignoreSslErrors && ignoreSslErrors.toLowerCase() == "true";

let httpClient = new hm.HttpClient(tl.getVariable("AZURE_HTTP_USER_AGENT"), null, requestOptions);

function stripJsonComments(content) {
    if (!content || (content.indexOf("//") < 0 && content.indexOf("/*") < 0)) {
        return content;
    }

    var currentChar;
    var nextChar;
    var insideQuotes = false;
    var contentWithoutComments = '';
    var insideComment = 0;
    var singlelineComment = 1;
    var multilineComment = 2;

    for (var i = 0; i < content.length; i++) {
        currentChar = content[i];
        nextChar = i + 1 < content.length ? content[i + 1] : "";

        if (insideComment) {
            var update = false;
            if (insideComment == singlelineComment && (currentChar + nextChar === '\r\n' || currentChar === '\n')) {
                i--;
                insideComment = 0;
                continue;
            }

            if (insideComment == multilineComment && currentChar + nextChar === '*/') {
                i++;
                insideComment = 0;
                continue;
            }

        } else {
            if (insideQuotes && currentChar == "\\") {
                contentWithoutComments += currentChar + nextChar;
                i++; // Skipping checks for next char if escaped
                continue;
            }
            else {
                if (currentChar == '"') {
                    insideQuotes = !insideQuotes;
                }

                if (!insideQuotes) {
                    if (currentChar + nextChar === '//') {
                        insideComment = singlelineComment;
                        i++;
                    }

                    if (currentChar + nextChar === '/*') {
                        insideComment = multilineComment;
                        i++;
                    }
                }
            }
        }

        if (!insideComment) {
            contentWithoutComments += content[i];
        }
    }

    return contentWithoutComments;
}

function formatNumber(num: number): string {
    return ("0" + num).slice(-2);
}

class Deployment {
    public properties: Object;

    constructor(properties: Object) {
        this.properties = properties;
    }
    public updateCommonProperties(mode: string) {
        this.properties["mode"] = mode;
    }
}

export class ResourceGroup {

    private taskParameters: deployAzureRG.AzureRGTaskParameters;
    private winRMExtensionHelper: winRM.WinRMExtensionHelper;
    private deploymentGroupExtensionHelper: dgExtensionHelper.DeploymentGroupExtensionHelper;
    private environmentHelper: env.EnvironmentHelper;

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this.taskParameters = taskParameters;
        this.winRMExtensionHelper = new winRM.WinRMExtensionHelper(this.taskParameters);
        this.deploymentGroupExtensionHelper = new dgExtensionHelper.DeploymentGroupExtensionHelper(this.taskParameters);
        this.environmentHelper = new env.EnvironmentHelper(this.taskParameters);
    }

    public async createOrUpdateResourceGroup(): Promise<void> {
        var armClient = new armResource.ResourceManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        await this.createResourceGroupIfRequired(armClient);
        await this.createTemplateDeployment(armClient);
        await this.enableDeploymentPrerequestiesIfRequired(armClient);
        await this.registerEnvironmentIfRequired(armClient);
    }

    public deleteResourceGroup(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            var extDelPromise = this.deploymentGroupExtensionHelper.deleteExtensionFromResourceGroup();
            var deleteRG = (val) => {
                var armClient = new armResource.ResourceManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
                console.log(tl.loc("DeletingResourceGroup", this.taskParameters.resourceGroupName));
                armClient.resourceGroups.deleteMethod(this.taskParameters.resourceGroupName, (error, result, request, response) => {
                    if (error) {
                        return reject(tl.loc("CouldNotDeletedResourceGroup", this.taskParameters.resourceGroupName, utils.getError(error)));
                    }
                    console.log(tl.loc("DeletedResourceGroup", this.taskParameters.resourceGroupName));
                    resolve();
                });
            }
            extDelPromise.then(deleteRG, deleteRG);
        });
    }

    public async selectResourceGroup(): Promise<void> {
        if (!utils.isNonEmpty(this.taskParameters.outputVariable) &&
            (this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqNone ||
                this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqWinRM)) {
            throw tl.loc("OutputVariableShouldNotBeEmpty");
        }

        var armClient = new armResource.ResourceManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        await this.enableDeploymentPrerequestiesIfRequired(armClient);
        await this.registerEnvironmentIfRequired(armClient);
    }

    private writeDeploymentErrors(error): void {
        console.log(tl.loc("ErrorsInYourDeployment", error.code));
        if (error.message) {
            tl.error(error.message);
            if (error.details) {
                tl.error(tl.loc("Details"));
                for (var i = 0; i < error.details.length; i++) {
                    var errorMessage = util.format("%s: %s %s", error.details[i].code, error.details[i].message, error.details[i].details);
                    tl.error(errorMessage);
                }
            }
        } else {
            tl.error(error);
        }
    }

    private async registerEnvironmentIfRequired(armClient: armResource.ResourceManagementClient) {
        if (utils.isNonEmpty(this.taskParameters.outputVariable) &&
            (this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqWinRM ||
                this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqNone)) {
            await this.environmentHelper.RegisterEnvironment();
        }

    }

    private async enableDeploymentPrerequestiesIfRequired(armClient) {
        if (this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqWinRM) {
            await this.winRMExtensionHelper.ConfigureWinRMExtension();
        }
        else if (this.taskParameters.enableDeploymentPrerequisites == this.enablePrereqDG) {
            await this.deploymentGroupExtensionHelper.addExtensionOnResourceGroup();
        }
    }

    private async createResourceGroupIfRequired(armClient: armResource.ResourceManagementClient) {
        var exists = await this.checkResourceGroupExistence(armClient)
        if (!exists) {
            await this.createResourceGroup(armClient);
        }
    }

    private checkResourceGroupExistence(armClient: armResource.ResourceManagementClient): Promise<boolean> {
        console.log(tl.loc("CheckResourceGroupExistence", this.taskParameters.resourceGroupName));
        return new Promise<boolean>((resolve, reject) => {
            armClient.resourceGroups.checkExistence(this.taskParameters.resourceGroupName, (error, exists, request, response) => {
                if (error) {
                    return reject(tl.loc("ResourceGroupStatusFetchFailed", utils.getError(error)));
                }
                console.log(tl.loc("ResourceGroupStatus", exists));
                resolve(exists);
            });
        });
    }

    private createDeploymentName(): string {
        var name: string;
        if (this.taskParameters.templateLocation == "Linked artifact") {
            name = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory"), this.taskParameters.csmFile)[0];
        } else {
            name = this.taskParameters.csmFileLink;
        }
        name = path.basename(name).split(".")[0].replace(" ", "");
        name = name.substr(0, 40);
        var timestamp = new Date(Date.now());
        var uniqueId = uuid().substr(0, 4);
        var suffix = util.format("%s%s%s-%s%s%s-%s", timestamp.getFullYear(),
            formatNumber(timestamp.getMonth()),
            formatNumber(timestamp.getDate()),
            formatNumber(timestamp.getHours()),
            formatNumber(timestamp.getMinutes()),
            formatNumber(timestamp.getSeconds()),
            uniqueId);
        var deploymentName = util.format("%s-%s", name, suffix);
        if (deploymentName.match(/^[-\w\._\(\)]+$/) === null) {
            deploymentName = util.format("deployment-%s", suffix);
        }
        return deploymentName;
    }

    private castToType(value: string, type: string): any {
        switch (type.toLowerCase()) {
            case "int":
            case "object":
            case "secureobject":
            case "array":
            case "bool":
                return JSON.parse(value);
            case "string":
            case "securestring":
                return JSON.parse(`"` + value + `"`); // Adding trailing quotes for JSON parser to detect string
            default:
                // Sending as string
                break;
        }
        return value;
    }

    private updateOverrideParameters(template: TemplateObject, parameters: Map<string, ParameterValue>): Map<string, ParameterValue> {
        tl.debug("Overriding Parameters..");

        var overrideParameters: NameValuePair[] = PowerShellParameters.parse(this.taskParameters.overrideParameters, true, "\\");
        for (var overrideParameter of overrideParameters) {
            tl.debug("Overriding key: " + overrideParameter.name);
            try {
                overrideParameter.value = this.castToType(overrideParameter.value, template.parameters[overrideParameter.name].type);
            } catch (error) {
                console.log(tl.loc("ErrorWhileParsingParameter", overrideParameter.name, error.toString()));
            }
            parameters[overrideParameter.name] = {
                value: overrideParameter.value
            } as ParameterValue;
        }
        return parameters;
    }

    private createResourceGroup(armClient: armResource.ResourceManagementClient): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            console.log(tl.loc("CreatingNewRG", this.taskParameters.resourceGroupName));
            armClient.resourceGroups.createOrUpdate(this.taskParameters.resourceGroupName, { "name": this.taskParameters.resourceGroupName, "location": this.taskParameters.location }, (error, result, request, response) => {
                if (error) {
                    return reject(tl.loc("ResourceGroupCreationFailed", utils.getError(error)));
                }
                console.log(tl.loc("CreatedRG"));
                resolve();
            });
        });
    }

    private downloadFile(url): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            httpClient.get(url, {}).then(async (response) => {
                if (response.message.statusCode == 200) {
                    let contents: string = "";
                    try {
                        contents = await response.readBody();
                        contents = contents.replace(/^\uFEFF/, ''); // Remove UTF-8 BOM if present.
                    } catch (error) {
                        reject(tl.loc("UnableToReadResponseBody", error));
                    }
                    resolve(contents);
                } else {
                    var errorMessage = response.message.statusCode.toString() + ": " + response.message.statusMessage;
                    return reject(tl.loc("FileFetchFailed", url, errorMessage));
                }
            }, (error) => {
                return reject(tl.loc("FileFetchFailed", url, error));
            });
        });
    }

    private getDeploymentDataForLinkedArtifact(): Deployment {
        var template: TemplateObject;
        var fileMatches = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory"), this.taskParameters.csmFile);
        if (fileMatches.length > 1) {
            throw new Error(tl.loc("TemplateFilePatternMatchingMoreThanOneFile", fileMatches));
        }
        if (fileMatches.length < 1) {
            throw new Error(tl.loc("TemplateFilePatternMatchingNoFile"));
        }
        var csmFilePath = fileMatches[0];
        if (!fs.lstatSync(csmFilePath).isDirectory()) {
            tl.debug("Loading CSM Template File.. " + csmFilePath);
            try {
                template = JSON.parse(stripJsonComments(fileEncoding.readFileContentsAsText(csmFilePath)));
            }
            catch (error) {
                throw new Error(tl.loc("TemplateParsingFailed", csmFilePath, utils.getError(error.message)));
            }
            tl.debug("Loaded CSM File");
        } else {
            throw new Error(tl.loc("CsmFilePatternMatchesADirectoryInsteadOfAFile", csmFilePath));
        }

        var parameters: Map<string, ParameterValue> = {} as Map<string, ParameterValue>;
        if (utils.isNonEmpty(this.taskParameters.csmParametersFile)) {
            var fileMatches = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory"), this.taskParameters.csmParametersFile);
            if (fileMatches.length > 1) {
                throw new Error(tl.loc("TemplateParameterFilePatternMatchingMoreThanOneFile", fileMatches));
            }
            if (fileMatches.length < 1) {
                throw new Error(tl.loc("TemplateParameterFilePatternMatchingNoFile"));
            }
            var csmParametersFilePath = fileMatches[0];
            if (!fs.lstatSync(csmParametersFilePath).isDirectory()) {
                tl.debug("Loading Parameters File.. " + csmParametersFilePath);
                try {
                    var parameterFile = JSON.parse(stripJsonComments(fileEncoding.readFileContentsAsText(csmParametersFilePath)));
                    tl.debug("Loaded Parameters File");
                    parameters = parameterFile["parameters"] as Map<string, ParameterValue>;
                } catch (error) {
                    throw new Error(tl.loc("ParametersFileParsingFailed", csmParametersFilePath, utils.getError(error.message)));
                }
            } else {
                if (tl.filePathSupplied("csmParametersFile")) {
                    throw new Error(tl.loc("ParametersPatternMatchesADirectoryInsteadOfAFile", csmParametersFilePath));
                }
            }
        }

        if (utils.isNonEmpty(this.taskParameters.overrideParameters)) {
            parameters = this.updateOverrideParameters(template, parameters);
        }

        parameters = this.sanitizeParameters(parameters);

        var deployment = new Deployment({
            template: template,
            parameters: parameters
        });
        deployment.updateCommonProperties(this.taskParameters.deploymentMode);
        return deployment;
    }

    private sanitizeParameters(parameters: Map<string, ParameterValue>): Map<string, ParameterValue> {
        var result: Map<string, ParameterValue> = {} as Map<string, ParameterValue>;
        for (var key in parameters) {
            if (!!parameters[key]) {
                if (parameters[key].hasOwnProperty("value")) {
                    result[key] = {
                        value: parameters[key].value
                    } as ParameterValue;
                } else if (parameters[key].hasOwnProperty("reference")) {
                    result[key] = {
                        reference: parameters[key].reference
                    } as ParameterValue;
                }
            }
        }

        return result;
    }

    private async getDeploymentObjectForPublicURL(): Promise<Deployment> {
        var properties = {};
        properties["templateLink"] = {
            uri: this.taskParameters.csmFileLink
        };
        var parameters: Map<string, ParameterValue> = {} as Map<string, ParameterValue>;
        var deployment = new Deployment(properties);

        if (utils.isNonEmpty(this.taskParameters.csmParametersFileLink)) {
            if (utils.isNonEmpty(this.taskParameters.overrideParameters)) {
                var contents = await this.downloadFile(this.taskParameters.csmParametersFileLink);
                parameters = JSON.parse(stripJsonComments(contents)).parameters;
            }
            else {
                deployment.properties["parametersLink"] = {
                    uri: this.taskParameters.csmParametersFileLink
                };
            }
        }

        if (utils.isNonEmpty(this.taskParameters.overrideParameters)) {
            tl.debug("Downloading CSM Template File.. " + this.taskParameters.csmFileLink);
            var templateFile = await this.downloadFile(this.taskParameters.csmFileLink);
            var template;
            try {
                var template = JSON.parse(stripJsonComments(templateFile));
                tl.debug("Loaded CSM File");
            }
            catch (error) {
                throw new Error(tl.loc("TemplateParsingFailed", utils.getError(error.message)));
            }
            parameters = this.updateOverrideParameters(template, parameters);
            parameters = this.sanitizeParameters(parameters);
            deployment.properties["parameters"] = parameters;
        }

        deployment.updateCommonProperties(this.taskParameters.deploymentMode);
        return deployment;
    }

    private validateDeployment(armClient: armResource.ResourceManagementClient, deployment: Deployment): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            console.log(tl.loc("StartingValidation"));
            deployment.properties["mode"] = "Incremental";
            armClient.deployments.validate(this.taskParameters.resourceGroupName, this.createDeploymentName(), deployment, (error, result, request, response) => {
                if (error) {
                    return reject(tl.loc("CreateTemplateDeploymentValidationFailed", utils.getError(error)));
                }
                if (result.error) {
                    this.writeDeploymentErrors(result.error);
                    return reject(tl.loc("CreateTemplateDeploymentFailed"));
                } else {
                    console.log(tl.loc("ValidDeployment"));
                    resolve();
                }
            });
        });
    }

    private async performAzureDeployment(armClient: armResource.ResourceManagementClient, deployment: Deployment): Promise<void> {
        if (deployment.properties["mode"] === "Validation") {
            return this.validateDeployment(armClient, deployment);
        } else {
            console.log(tl.loc("StartingDeployment"));
            return new Promise<void>((resolve, reject) => {
                armClient.deployments.createOrUpdate(this.taskParameters.resourceGroupName, this.createDeploymentName(), deployment, (error, result, request, response) => {
                    if (error) {
                        this.writeDeploymentErrors(error);
                        return reject(tl.loc("CreateTemplateDeploymentFailed"));
                    }
                    if (result && result["properties"] && result["properties"]["outputs"] && utils.isNonEmpty(this.taskParameters.deploymentOutputs)) {
                        tl.setVariable(this.taskParameters.deploymentOutputs, JSON.stringify(result["properties"]["outputs"]));
                        console.log(tl.loc("AddedOutputVariable", this.taskParameters.deploymentOutputs));
                    }

                    console.log(tl.loc("CreateTemplateDeploymentSucceeded"));
                    resolve();
                });
            });
        }
    }

    private async createTemplateDeployment(armClient: armResource.ResourceManagementClient) {
        console.log(tl.loc("CreatingTemplateDeployment"));
        var deployment: Deployment;
        if (this.taskParameters.templateLocation === "Linked artifact") {
            deployment = this.getDeploymentDataForLinkedArtifact();
        } else if (this.taskParameters.templateLocation === "URL of the file") {
            deployment = await this.getDeploymentObjectForPublicURL();
        } else {
            throw new Error(tl.loc("InvalidTemplateLocation"));
        }
        await this.performAzureDeployment(armClient, deployment);
    }

    private enablePrereqDG = "ConfigureVMWithDGAgent";
    private enablePrereqWinRM = "ConfigureVMwithWinRM";
    private enablePrereqNone = "None";
}
