#  Azure App Service Deployment: ARM 

## Overview

The Azure Function on container Deployment task is used to update [Functions](https://docs.microsoft.com/en-us/azure/azure-functions/) to Azure. The task works on cross platform Azure Pipelines agents running Windows, Linux or Mac and uses the underlying deployment technologies of Containers.

The task works for [ASP.NET](https://www.visualstudio.com/en-us/docs/release/examples/azure/azure-web-apps-from-build-and-release-hubs), [ASP.NET Core](https://www.visualstudio.com/en-us/docs/release/examples/azure/aspnet-core10-azure-web-apps), PHP, Java, Python, Go and [Node.js](https://www.visualstudio.com/en-us/docs/release/examples/nodejs/node-to-azure-webapps) based web applications.

## Contact Information

Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

## Pre-requisites for the task

The following pre-requisites need to be setup in the target machine(s) for the task to work properly.

##### Azure Function on Container

The task is used to deploy a Web  project to an existing Azure Web App. The Web App should exist prior to running the task. The Web App can be created from the [Azure portal]

The task can also be used to deploy [Azure Functions](https://azure.microsoft.com/en-in/services/functions/) (Containers).

##### Azure Subscription

To deploy to Azure, an Azure subscription has to be linked to Team Foundation Server or to Azure Pipelines using the Services tab in the Account Administration section. Add the Azure subscription to use in the Build or Release Management definition by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab.

Create the [ARM](https://azure.microsoft.com/en-in/documentation/articles/resource-group-overview/) service endpoint, use **'Azure Resource Manager'** endpoint type, for more details follow the steps listed in the link [here](https://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409).

The task does not work with the Azure Classic service endpoint and it will not list these connections in the parameters in the task.

## Deployment

### Container Registry
Works on a Windows as well as Linux automation agent when the target is a Web App for Containers. The task updates the Azure Web App for Containers by setting the right Container registry, repository, image name and tag information. You can also use the task to pass a startup command for the container image.

### Parameters of the task
The task is used to deploy a Web  project to an existing Azure Web App or Function. The mandatory fields are highlighted with a *.

* **Azure Subscription\*:** Select the AzureRM Subscription. If none exists, then click on the **Manage** link, to navigate to the Services tab in the Administrators panel. In the tab click on **New Service Endpoint** and select **Azure Resource Manager** from the dropdown.

* **App Service Name\*:** Select the name of an existing Azure App Service. Enter the name of the Web App if it was provisioned dynamically using the [Azure PowerShell task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/AzurePowerShell) and [AzureRM PowerShell scripts](https://msdn.microsoft.com/en-us/library/mt619237.aspx).

* **Deploy to Slot:** Select the option to deploy to an existing slot other than the Production slot. Do not select this option if the Web project is being deployed to the Production slot. The Web App itself is the Production slot.

* **Resource Group:** Select the Azure Resource Group that contains the Azure App Service specified above. Enter the name of the Azure Resource Group if has been dynamically provisioned using [Azure Resource Group Deployment task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/DeployAzureResourceGroup) or [Azure PowerShell task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/AzurePowerShell). This is a required parameter if the option to Deploy to Slot has been selected.

* **Slot:** Select the Slot to deploy the Web project to. Enter the name of the Slot if has been dynamically provisioned using [Azure Resource Group Deployment task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/DeployAzureResourceGroup) or [Azure PowerShell task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/AzurePowerShell). This is a required parameter if the option to Deploy to Slot has been selected.

For Web **Web App for Containers** you need to provide the following details:
* *Image Name:*
A globally unique top-level domain name for your specific registry or namespace. A fully qualified image name will be of the format: '<registry or namespace>/<repository>:<tag>'. For example, 'myregistry.azurecr.io/nginx:latest'.
  
* *Startup command:*
Start up command for the container.

* *Application and Configuration Settings*

**App settings**: [App settings](https://docs.microsoft.com/en-us/azure/app-service/web-sites-configure#app-settings) contains name/value pairs that your web app will load on start up. Edit web app application settings by following the syntax '-key value'. Value containing spaces should be enclosed in double quotes.
>Example : -Port 5000 -RequestTimeout 5000 
>-WEBSITE_TIME_ZONE "Eastern Standard Time"

**Configuration settings**:
Edit web app [configuration settings](https://docs.microsoft.com/en-us/azure/app-service/web-sites-configure) following the syntax -key value. Value containing spaces should be enclosed in double quotes.
>Example : -phpVersion 5.6 -linuxFxVersion: node|6.11

### Output Variables

* **Web App Hosted URL:** Provide a name, like FabrikamWebAppURL for the variable for the Azure App Service Hosted URL. The variable can be used as $(variableName), like $(FabrikamWebAppURL) to refer to the Hosted URL of the Azure App Service in subsequent tasks like in the [Run Functional Tests task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/RunDistributedTests) or the [Visual Studio Test task](https://github.com/Microsoft/vsts-tasks/tree/master/Tasks/VsTest).


### FAQ
* To ignore SSL error set a Variable of name VSTS_ARM_REST_IGNORE_SSL_ERRORS with value : true in the release definition.
* The task works with the [Azure Resource Manager APIs](https://msdn.microsoft.com/en-us/library/azure/dn790568.aspx) only.
