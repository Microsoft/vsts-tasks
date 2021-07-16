# Azure CLI

## Overview
This task supports running [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/overview) commands on Cross platform agents running Windows, Linux or Mac.

### What's new in Version 2.0
- Supports running PowerShell and PowerShell Core script.
- PowerShell Core script works with Xplat agents  (Windows, Linux or OSX), make sure the agent has PowerShell version 6 or more.
- Powershell script works only with Windows agent, make sure the agent has PowerShell version 5 or below.

## Contact Information
Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

## Pre-requisites for the task
The following pre-requisites need to be setup in the target machine(s) for the task to work properly.

#### **Azure Subscription**
To deploy to Azure, an Azure subscription has to be linked to Team Foundation Server or to Azure Pipelines using the Services tab in the settings section. Add the Azure subscription to use in the Build or Release Management definition by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab.
- For Azure Classic resources use 'Azure' endpoint type with Certificate or Credentials based authentication. If you are using credentials based auth, ensure that the credentials are for a [**work account**](https://azure.microsoft.com/en-in/pricing/member-offers/msdn-benefits-details/work-accounts-faq/) because Microsoft accounts like [**joe@live.com**](https://github.com/Microsoft/azure-pipelines-tasks/blob/master/Tasks/DeployAzureResourceGroup) or [**joe@hotmail.com**](https://github.com/Microsoft/azure-pipelines-tasks/blob/master/Tasks/DeployAzureResourceGroup) are not supported.
- For [ARM](https://azure.microsoft.com/en-in/documentation/articles/resource-group-overview/), use 'Azure Resource Manager' endpoint type, for more details follow the steps listed in the link [here](https://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409).

#### **Azure CLI**
The task needs the Azure CLI version to be installed on the automation agent, and the details are available [here](https://azure.microsoft.com/en-us/documentation/articles/xplat-cli-install/).
If an agent is already running on the machine on which the Azure CLI is installed, ensure to restart the agent to ensure all the relevant environment variables are updated.

## Parameters of the task
The task is used to run Azure CLI commands on Cross platform agents running Windows, Linux or Mac . The mandatory fields are highlighted with a *.

* **Azure Connection Type**\*: Specify Azure endpoint type, for Azure Classic resources use 'Azure' endpoint, for Azure ARM resources use 'Azure Resource Manager' endpoint. This parameter is shown only when the selected task version is 0.* as Azure CLI task v1.0 supports only Azure Resource Manager (ARM) subscriptions

* **Azure Subscription**\*: Select the Azure Subscription where the Azure CLI commands have to be executed. If none exists, then click on the **Manage** link, to navigate to the Services tab in the Administrators panel. In the tab click on **New Service Endpoint** and select **Azure Resource Manager** from the dropdown.

* **Script Type**\*: Select the type of script to be executed on the agent. Task supports four types: Batch (batch) / Shell (bash) / PowerShell (ps) / PowerShell Core scripts (pscore), default selection being empty. Select Shell/PowerShell Core script when running on Linux agent or Batch/PowerShell/PowerShell Core script when running on Windows agent. PowerShell Core script can run on cross-platform agents (Linux, macOS, or Windows) 

* **Script Location**\*: Select the mode of providing the script. Task supports two modes: one as a Script Path to a linked artifact and another as an inline script, default selection being the "Script Path"

* **Script Path**\*: When using Windows based agent, specify the path to the .bat , .cmd , .ps1 script whereas when using Linux based agent, specify the path to the .sh , .ps1 script you want to run. The path must be a fully qualified path or a valid path relative to the default working directory. Note: You must also specify the respective script type in above field.

* **Inline Script**\*: Specify the script inline here. When using Windows based agent use batch or PowerShell or PowerShell Core scripting whereas use shell or PowerShell Core scripting when using Linux based agents. Note: You must also specify the respective script type in above field.

* **Script Arguments**: Specify arguments to pass to the script.

* **Working folder**: Specify the working directory in which you want to run the script. If you leave it empty, the working directory is the folder where the script is located.

* **Fail on standard error**: Select this check box if you want the build to fail if errors are written to the StandardError stream.

* **Access service principal details in script**: Select this check box if you want to add service principal id , service principal key and tenantId of the Azure endpoint to the script's execution environment. You can use variables: `servicePrincipalId`, `servicePrincipalKey` and `tenantId` in your script. This is honored only when the Azure endpoint has Service Principal authentication scheme. \
\
Syntax to access environment variables based on script type.\
*Powershell script:* `$env:servicePrincipalId`\
*Batch script:* `%servicePrincipalId%` \
*Shell script:* `$servicePrincipalId`
