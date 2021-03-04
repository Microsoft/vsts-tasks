
import tl = require('azure-pipelines-task-lib/task');
import jsonPath = require('JSONPath');
import webClient = require('azure-pipelines-tasks-azure-arm-rest-v2/webClient');
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
import { ServiceClient } from 'azure-pipelines-tasks-azure-arm-rest-v2/AzureServiceClient';
import { ToError } from 'azure-pipelines-tasks-azure-arm-rest-v2/AzureServiceClientBase';
import { AzureStorage } from './azure-storage';

export const SourceType = {
    JAR: "Jar",
    SOURCE_DIRECTORY: "Source",
    DOT_NET_CORE_ZIP: "NetCoreZip"
}


class UploadTarget {
    private _sasUrl: string;
    private _relativePath: string;

    constructor(sasUrl: string, relativePath: string) {
        this._sasUrl = sasUrl;
        this._relativePath = relativePath;
    }


    public get sasUrl(): string {
        return this._sasUrl;
    }


    public get relativePath(): string {
        return this._relativePath;
    }
}

const ASYNC_OPERATION_HEADER = 'azure-asyncoperation';

export class AzureSpringCloud {

    private _resourceId: string;
    private _client: ServiceClient;


    constructor(endpoint: AzureEndpoint, resourceId: string) {
        this._client = new ServiceClient(endpoint.applicationTokenCredentials, endpoint.subscriptionID, 30);
        this._resourceId = resourceId;
    }

    /* Parses the environment variable string in the form "-key value"
     */
    public static parseEnvironmentVariables(environmentVariables?: string): object {
        if (!environmentVariables) {
            return {};
        }

        var result = {};

        var insideQuotes = false;
        var curKey = '';
        var curValue = '';
        var readingKey = true;
        for (var i = 0; i < environmentVariables.length; ++i) {
            if (readingKey) {
                switch (environmentVariables[i]) {
                    case '-':
                        if (i > 0 && environmentVariables[i - 1] != ' ') {
                            curKey += environmentVariables[i];
                        }
                        break;
                    case ' ':
                        if (i > 0 && environmentVariables[i - 1] != ' ') {
                            readingKey = false;
                        }
                        break;
                    default:
                        curKey += environmentVariables[i];
                }
            } else { //Reading the value
                if (!insideQuotes) {
                    switch (environmentVariables[i]) {
                        case ' ':
                            if (i > 0 && environmentVariables[i - 1] != ' ') {
                                result[curKey] = curValue;
                                readingKey = true;
                                curKey = '';
                                curValue = '';
                            }
                            break;
                        case '"':
                            insideQuotes = true;
                            break;
                        default: curValue += environmentVariables[i];
                    }
                } else { //If we're inside quotation marks
                    if (environmentVariables[i] == '"') {
                        insideQuotes = false;
                    } else {
                        curValue += environmentVariables[i];
                    }
                }
            }
        }

        if (curKey && curValue) {
            result[curKey] = curValue;
        }

        return result;
    }

    /**
     * Deploys a Jar to a deployment
     * @param artifactToUpload 
     * @param appName 
     * @param deploymentName 
     * @param createDeployment If true, a new deployment will be created or the prior one will be completely overriden. If false, only the changes to the prior deployment will be applied.
     * @param jvmOptions 
     * @param environmentVariables 
     */
    public async deploy(artifactToUpload: string, sourceType: string, appName: string, deploymentName: string, createDeployment: boolean,
        runtime?: string, jvmOptions?: string, environmentVariables?:
            string, version?: string): Promise<void> {
        //Get deployment URL
        tl.debug('Starting deployment.');
        const deploymentTarget = await this.getUploadTarget(appName);
        await AzureStorage.uploadFileToSasUrl(deploymentTarget.sasUrl, artifactToUpload);
        await this.updateApp(appName, deploymentTarget.relativePath, sourceType, deploymentName, createDeployment, runtime, jvmOptions, environmentVariables, version);
    }

    public async setActiveDeployment(appName: string, deploymentName: string) {
        console.log(`Setting active deployment on app ${appName} to ${deploymentName}`);
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PATCH';
        httpRequest.uri = this._client.getRequestUri(`${this._resourceId}/apps/{appName}`, {
            '{appName}': appName,
            '{deploymentName}': deploymentName
        }, null, '2019-05-01-preview');
        console.log('Request URI: ' + httpRequest.uri);
        httpRequest.body = JSON.stringify(
            {
                properties: {
                    activeDeploymentName: deploymentName
                }
            }
        );

        var response = await this._client.beginRequest(httpRequest);

        console.log('Response:');
        console.log(response.body);

        if (response.statusCode != 200) {
            console.error('Error code: ' + response.statusCode);
            console.error(response.statusMessage);
            throw new Error(response.statusCode + ":" + response.statusMessage);
        }
    }


    protected async getAllDeploymentInfo(appName: String): Promise<Object> {
        tl.debug(`Finding deployments for app ${appName}`)
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this._client.getRequestUri(`${this._resourceId}/apps/{appName}/deployments`, {
            '{appName}': appName
        }, null, '2020-07-01');
        tl.debug('Deployment Info Request URI:' + httpRequest.uri);
        try {
            var response = await this._client.beginRequest(httpRequest);
            if (response.statusCode == 404) {
                tl.debug('404 when querying deployment names');
                throw 'No deployments exist';
            } if (response.statusCode != 200) {
                tl.error("Unable to get deployment information. Error " + response.statusCode);
                console.error(response.statusMessage);
                throw ToError(response);
            } else {
                tl.debug('Found deployments.');
                return response.body;
            }
        } catch (error) {
            tl.error('Error retrieving deployment list: ' + error);
            throw (error);
        }
    }

    /**
     * Returns the currently inactive deployment, or null if none exists.
     * @param appName 
     */
    public async getInactiveDeploymentName(appName: string): Promise<string> {
        var allDeploymentsData = await this.getAllDeploymentInfo(appName);
        var inactiveDeploymentName = jsonPath.eval(allDeploymentsData, '$.value[?(@.properties.active == false)].name')[0];
        console.debug(`Inactive deployment name: ${inactiveDeploymentName}`);
        return inactiveDeploymentName;
    }

    /**
     * Returns all deployment names for an app.
     * @param appName 
     */
    public async getAllDeploymentNames(appName: string): Promise<string[]> {
        var allDeploymentsData = await this.getAllDeploymentInfo(appName);
        var deploymentNames = jsonPath.eval(allDeploymentsData, '$.value..name')
        tl.debug('Found deployment names: ' + deploymentNames);
        return deploymentNames;
    }

    protected async getUploadTarget(appName: string): Promise<UploadTarget> {
        tl.debug('Obtaining upload target.');
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.uri = this._client.getRequestUri(`${this._resourceId}/apps/{appName}/getResourceUploadUrl`, {
            '{appName}': appName
        }, null, '2019-05-01-preview');
        tl.debug('Request URI:' + httpRequest.uri);
        var response = await this._client.beginRequest(httpRequest);

        if (response.statusCode != 200) {
            console.error('Error code: ' + response.statusCode);
            console.error(response.statusMessage);
            throw ToError(response);
        }
        return new UploadTarget(response.body.uploadUrl, response.body.relativePath);
    }



    /**
     * Creates/Updates deployment settings.
     * @param appName 
     * @param resourcePath 
     * @param deploymentName 
     * @param createDeployment 
     * @param jvmOptions 
     * @param environmentVariables 
     */
    private async updateApp(appName: string, resourcePath: string, sourceType: string, deploymentName: string, createDeployment: boolean, 
        runtime?: string, jvmOptions?: string, environmentVariables?: string, version?: string) {
        console.log(`${createDeployment ? 'Creating' : 'Updating'} ${appName}, deployment ${deploymentName}...`);

        //Apply deployment settings and environment variables
        tl.debug('Setting runtime: ' + runtime);

        //Populate optional deployment settings
        var deploymentSettings = {};

        if (runtime) {
            deploymentSettings['runtimeVersion'] = runtime;
        }
        if (jvmOptions) {
            tl.debug("JVM Options modified.");
            deploymentSettings['jvmOptions'] = jvmOptions;
        }
        if (environmentVariables) {
            tl.debug("Environment variables modified.");
            deploymentSettings['environmentVariables'] = AzureSpringCloud.parseEnvironmentVariables(environmentVariables);
        }

        //Populate source settings
        var sourceSettings = {
            relativePath: resourcePath,
            type: sourceType
        };

        if (version) {
            sourceSettings['version'] = version;
        }

        //Build update request body
        var requestBody = JSON.stringify({
            properties: {
                source: sourceSettings,
                deploymentSettings: deploymentSettings
            }
        });

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = createDeployment ? 'PUT' : 'PATCH';
        httpRequest.uri = this._client.getRequestUri(`${this._resourceId}/apps/{appName}/deployments/{deploymentName}`, {
            '{appName}': appName,
            '{deploymentName}': deploymentName
        }, null, '2020-07-01');
        tl.debug('Request URI:' + httpRequest.uri);
        tl.debug('Request body: ' + requestBody);
        httpRequest.body = requestBody;

        // Send the request
        var response = await this._client.beginRequest(httpRequest);
        console.log(response.body);
        var expectedStatusCode = createDeployment ? 201 : 202;
        if (response.statusCode != expectedStatusCode) {
            console.error('Error code: ' + response.statusCode);
            console.error(response.statusMessage);
            throw ToError(response);
        } else {
            tl.debug('App update initiated.')
            //If the operation is asynchronous, block pending its conclusion.
            var operationStatusUrl = response.headers[ASYNC_OPERATION_HEADER];
            if (operationStatusUrl) {
                tl.debug('Awaiting operation completion.');
                this.awaitOperationCompletion(operationStatusUrl);
            } else {
                tl.debug('Received async status code with no async operation. Headers: ');
                tl.debug(JSON.stringify(response.headers));
            }
        }
    }

    /**
     * Awaits the completeion of an operation marked by a return of status code 200 from the status URL.
     * @param operationStatusUrl The status URL of the Azure operation
     */
    async awaitOperationCompletion(operationStatusUrl: string) {
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        tl.debug('Checking operation status at ' + operationStatusUrl);
        httpRequest.uri = operationStatusUrl;

        var statusCode = 202;
        var message = '';

        //A potentially infinite loop, but tasks can have timeouts.
        while (statusCode == 202) {
            //Sleep for a 1.5 seconds
            await new Promise(r => setTimeout(r, 1500));
            //Get status
            var response = await this._client.beginRequest(httpRequest);
            statusCode = response.statusCode;
            message = response.statusMessage;
            tl.debug(`${statusCode}: ${message}`);
        }


        switch (statusCode) {
            case 202: {
                tl.error('Operation timed out.');
                break;
            }
            case 200: {
                console.log('Operation completed');
                break;
            } default: {
                throw `Operation failed: (${statusCode}) ${message}`
            }
        }

    }

    /**
     * Deletes a deployment of the app.
     * @param appName 
     * @param deploymentName 
     */
    public async deleteDeployment(appName: string, deploymentName: string) {
        console.log(`Deleting deployment ${deploymentName} from app ${appName}`);
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'DELETE';
        httpRequest.uri = this._client.getRequestUri(`${this._resourceId}/apps/{appName}/deployments/{deploymentName}`, {
            '{appName}': appName,
            '{deploymentName}': deploymentName
        }, null, '2020-07-01');
        var response = await this._client.beginRequest(httpRequest);
        if (response.statusCode != 200) {
            console.error('Unable to delete deployment. Error code: ' + response.statusCode);
            console.error(response.statusMessage);
            throw ('Unable to delete deployment');
        }
    }

    /**
     * Retrieves the private test endpoint(s) for the deployment.
     * Returns null if private endpoint is disabled.
     */
    public async getTestEndpoint(appName: string, deploymentName: string): Promise<string> {
        tl.debug(`Retrieving private endpoint for deployment ${deploymentName} from app ${appName}`);
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.uri = this._client.getRequestUri(`${this._resourceId}/listTestKeys`, {}, null, '2020-07-01');
        try {
            var response: webClient.WebResponse = await this._client.beginRequest(httpRequest);
            if (!response.body.enabled) {
                tl.warning('Private test endpoint is not enabled.');
                return null;
            } else {
                tl.debug('Private endpoint returned.');
                return `${response.body.primaryTestEndpoint}/${appName}/${deploymentName}`
            }
        } catch (error) {
            tl.error('Unable to retrieve test endpoint keys.');
            throw (error);
        }
    }


}
