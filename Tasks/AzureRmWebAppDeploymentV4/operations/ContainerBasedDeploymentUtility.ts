import tl = require('azure-pipelines-task-lib/task');
import url = require('url');
import util = require('util');
import { AzureAppService } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-app-service';
import { TaskParameters } from './TaskParameters';
import { parse }  from 'azure-pipelines-tasks-webdeployment-common/ParameterParserUtility';
import { AzureAppServiceUtility } from './AzureAppServiceUtility';

enum registryTypes {
    "AzureContainerRegistry",
    "Registry", // TODO: Rename it to DockerHub while supporting all the registry types. Also add all these registry types in Task.json in ImageSource pick list.
    "PrivateRegistry"
}

export class ContainerBasedDeploymentUtility {
    private _appService: AzureAppService;
    private _appServiceUtility: AzureAppServiceUtility;

    constructor(appService: AzureAppService) {
        this._appService = appService;
        this._appServiceUtility = new AzureAppServiceUtility(appService);
    }

    public async deployWebAppImage(taskParameters: TaskParameters): Promise<void> {
        let imageName: string = this._getDockerHubImageName();
        tl.debug("Deploying an image " + imageName + " to the webapp " + this._appService.getName());

        tl.debug("Updating the webapp configuration.");
        await this._updateConfigurationDetails(taskParameters, imageName);

        tl.debug('Updating web app settings');
        await this._updateApplicationSettings(taskParameters, imageName);   
    }

    private async _updateApplicationSettings(taskParameters: TaskParameters, imageName: string): Promise<void> {
        var appSettingsParameters = taskParameters.AppSettings;
        appSettingsParameters = appSettingsParameters ? appSettingsParameters.trim() : "";
        appSettingsParameters =  await this._getContainerRegistrySettings(imageName, null) + ' ' + appSettingsParameters;
        var appSettingsNewProperties = parse(appSettingsParameters);
        await this._appServiceUtility.updateAndMonitorAppSettings(appSettingsNewProperties);
    }

    private async _updateConfigurationDetails(taskParameters: TaskParameters, imageName: string): Promise<void> {
        var startupCommand: string = taskParameters.StartupCommand;
        var configSettingsParameters = taskParameters.ConfigurationSettings;
        var appSettingsNewProperties = !!configSettingsParameters ? parse(configSettingsParameters.trim()): { };
        if(!!startupCommand) {
            appSettingsNewProperties.appCommandLine = {
                'value': startupCommand
            }
        }

        appSettingsNewProperties.linuxFxVersion = {
            'value': "DOCKER|" + imageName
        }
        tl.debug(`CONATINER UPDATE CONFIG VALUES : ${appSettingsNewProperties}`);
        await this._appServiceUtility.updateConfigurationSettings(appSettingsNewProperties);
    }

    private getDockerHubImageName(): string {
        var namespace = tl.getInput('DockerNamespace', true);
        var image = tl.getInput('DockerRepository', true);
        var tag = tl.getInput('DockerImageTag', false);
    
        return this._constructImageName(namespace, image, tag);
    }

    private _getAzureContainerImageName(): string {
        var registry = tl.getInput('AzureContainerRegistryLoginServer', true) + ".azurecr.io";
        var image = tl.getInput('AzureContainerRegistryImage', true);
        var tag = tl.getInput('AzureContainerRegistryTag', false);
    
        return this._constructImageName(registry, image, tag);
    }

    private _getDockerHubImageName(): string {
        var namespace = tl.getInput('DockerNamespace', true);
        var image = tl.getInput('DockerRepository', true);
        var tag = tl.getInput('DockerImageTag', false);
    
        return this._constructImageName(namespace, image, tag);
    }

    private _constructImageName(namespace, repository, tag): string {
        var imageName = null;
        /*
            Special Case : If release definition is not linked to build artifacts
            then $(Build.BuildId) variable don't expand in release. So clearing state
            of dockerImageTag if $(Build.BuildId) not expanded in value of dockerImageTag.
        */
        if(tag && (tag.trim() == "$(Build.BuildId)")) {
            tag = null;
        }
    
        if(tag) {
            imageName = namespace.toLowerCase() + "/" + repository.toLowerCase() + ":" + tag;
        } else {
            imageName = namespace.toLowerCase() + "/" + repository.toLowerCase();
        }
    
        return imageName.replace(/ /g,"");
    }

    private _getPrivateRegistryImageName(): string {
        var registryConnectedServiceName = tl.getInput('RegistryConnectedServiceName', true);
        var loginServer = tl.getEndpointAuthorizationParameter(registryConnectedServiceName, 'url', true);
    
        var registry = url.parse(loginServer).hostname;
        var image = tl.getInput('PrivateRegistryImage', true);
        var tag = tl.getInput('PrivateRegistryTag', false);
    
        return this._constructImageName(registry, image, tag);
    }

    private _updateWebAppSettings(appSettingsParameters, webAppSettings): void {
        // In case of public repo, clear the connection details of a registry
        var dockerRespositoryAccess = tl.getInput('DockerRepositoryAccess', true);
        
        // Uncomment the below lines while supprting all registry types.
        // if(dockerRespositoryAccess === "public")
        // {
        //     deleteRegistryConnectionSettings(webAppSettings);
        // }
        
        var parsedAppSettings = parse(appSettingsParameters);
        for (var settingName in parsedAppSettings) {
            var setting = settingName.trim();
            var settingVal = parsedAppSettings[settingName].value;
            settingVal = settingVal ? settingVal.trim() : "";
    
            if(setting) {
                webAppSettings["properties"][setting] = settingVal;
            }
        }
    }

    private _getImageName(): string {
        var registryType = tl.getInput('ImageSource', true);
        var imageName = null;
    
        switch(registryType) {        
            case registryTypes[registryTypes.AzureContainerRegistry]:
                imageName = this._getAzureContainerImageName();
                break;
    
            case registryTypes[registryTypes.Registry]:
                imageName = this._getDockerHubImageName();
                break;
    
            case registryTypes[registryTypes.PrivateRegistry]:
                imageName = this._getPrivateRegistryImageName();
                break;
        }
    
        return imageName;
    }

    private async _getContainerRegistrySettings(imageName, endPoint): Promise<string> {
        var containerRegistryType: string = 'Registry';
        var containerRegistrySettings: string = "-DOCKER_CUSTOM_IMAGE_NAME " + imageName;
        var containerRegistryAuthParamsFormatString: string = "-DOCKER_REGISTRY_SERVER_URL %s -DOCKER_REGISTRY_SERVER_USERNAME %s -DOCKER_REGISTRY_SERVER_PASSWORD %s";
    
        switch(containerRegistryType) {
            case registryTypes[registryTypes.AzureContainerRegistry]:
                containerRegistrySettings = await this._getAzureContainerRegistrySettings(endPoint, containerRegistrySettings, containerRegistryAuthParamsFormatString);
                break;
    
            case registryTypes[registryTypes.Registry]:
                var dockerRespositoryAccess = tl.getInput('DockerRepositoryAccess', false);
                if(dockerRespositoryAccess === "private")
                {
                    containerRegistrySettings = this._getDockerPrivateRegistrySettings(containerRegistrySettings, containerRegistryAuthParamsFormatString);
                }
                break;
    
            case registryTypes[registryTypes.PrivateRegistry]:
                containerRegistrySettings = this._getDockerPrivateRegistrySettings(containerRegistrySettings, containerRegistryAuthParamsFormatString);
                break;           
        }    
    
        return containerRegistrySettings;
    }

    private async _getAzureContainerRegistrySettings(endPoint, containerRegistrySettings, containerRegistryAuthParamsFormatString): Promise<string> {    
        var registryServerName = tl.getInput('AzureContainerRegistryLoginServer', true);
        var registryUrl = "https://" + registryServerName + ".azurecr.io";    
        tl.debug("Azure Container Registry Url: " + registryUrl);
    
        var registryName = tl.getInput('AzureContainerRegistry', true);
        var resourceGroupName = '';// await azureRESTUtility.getResourceGroupName(endPoint, registryName, "Microsoft.ContainerRegistry/registries");
        tl.debug("Resource group name of a registry: " + resourceGroupName);
    
        var creds = null //await azureRESTUtility.getAzureContainerRegistryCredentials(endPoint, registryName, resourceGroupName);
        tl.debug("Successfully retrieved the registry credentials");
    
        var username = creds.username;
        var password = creds["passwords"][0].value;
    
        return containerRegistrySettings + " " + util.format(containerRegistryAuthParamsFormatString, registryUrl, username, password);
    }
    
    private _getDockerPrivateRegistrySettings(containerRegistrySettings, containerRegistryAuthParamsFormatString): string {
        var registryConnectedServiceName = tl.getInput('RegistryConnectedServiceName', true);    
        var username = tl.getEndpointAuthorizationParameter(registryConnectedServiceName, 'username', true);
        var password = tl.getEndpointAuthorizationParameter(registryConnectedServiceName, 'password', true);    
        var registryUrl = tl.getEndpointAuthorizationParameter(registryConnectedServiceName, 'registry', true);
    
        tl.debug("Docker or Private Container Registry Url: " + registryUrl);
    
        return containerRegistrySettings + " " + util.format(containerRegistryAuthParamsFormatString, registryUrl, username, password);
    }

    private _deleteRegistryConnectionSettings(webAppSettings): void {
        delete webAppSettings["properties"]["DOCKER_REGISTRY_SERVER_URL"];
        delete webAppSettings["properties"]["DOCKER_REGISTRY_SERVER_USERNAME"];
        delete webAppSettings["properties"]["DOCKER_REGISTRY_SERVER_PASSWORD"];
    }
}