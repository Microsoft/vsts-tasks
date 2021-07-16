# Azure Resource Group Deployment Task

### Overview

This task is used to create or update a resource group in Azure using the [Azure Resource Manager templates](https://azure.microsoft.com/en-in/documentation/articles/resource-group-template-deploy/). The task is also used to start, stop, restart and delete virtual machines in a Resource Group, or to delete a resource group, including all the resources within the resource group.

### What's new in Version 2.0
 - Works with Xplat agents  (Windows, Linux or OSX)
 - Supports Template JSONs located at any publicly accessible http/https URLs. To use a file stored in a private storage account, retrieve and include the shared access signature (SAS) token in the URL of the template. Example: `<blob_storage_url>/template.json?<SAStoken>`. To upload a parameters file to a storage account and generate a SAS token, you could use [Azure file copy task](https://aka.ms/azurefilecopyreadme) or follow the steps using [PowerShell](https://go.microsoft.com/fwlink/?linkid=838080) or [Azure CLI](https://go.microsoft.com/fwlink/?linkid=836911)
 - Supports viewing/editing template parameters in a grid by clicking on “…” next to Override template parameters textbox. This feature requires that CORS rules are enabled at the source. If templates are in Azure storage blob, refer to [this](https://docs.microsoft.com/en-us/rest/api/storageservices/fileservices/Cross-Origin-Resource-Sharing--CORS--Support-for-the-Azure-Storage-Services?redirectedfrom=MSDN#understanding-cors-requests) to enable CORS.
 - NAT rule mapping for VMs that are backed by an Load balancer
 - "Resource group" field is now renamed as "VM details for  WinRM" and is included into the section "Advanced deployment options for virtual machines".
 - "Enable prerequisites" dropdown now includes the option to configure [deployment group](https://www.visualstudio.com/en-us/docs/build/concepts/definitions/release/deployment-groups/) agents on to each of the virtual machines provisioned in the resource group.
 - Limitations:
  - No support for Classic subscriptions. Only [ARM](https://azure.microsoft.com/en-in/documentation/articles/resource-group-overview/) subscriptions are supported.
  - No support for PowerShell syntax as the task is now node.js based. Ensure the case sensitivity of the parameter names match, when you override the template parameters. Also, remove the PowerShell cmdlets like "ConvertTo-SecureString" when you migrate from version 1.0 to version 2.0.


### Contact Information
Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.


### Prerequisite for the task

#### Azure Subscription

To deploy to Azure, an Azure subscription has to be linked to Team Foundation Server or to Azure Pipelines using the Services tab in the Account Administration section. Add the Azure subscription to use in the Build or Release Management definition by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab. Create a service endpoint of 'Azure Resource Manager' type. For more troubleshooting guidance around endpoint creation, refer [this](https://www.visualstudio.com/en-us/docs/build/actions/azure-rm-endpoint).

For Azure MSDN accounts, one can either use a [Service Principal](https://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409) or a work account. It's easy to create a work account as shown below:

1. Create an user in the Azure Active Directory from the [portal](https://msdn.microsoft.com/en-us/library/azure/hh967632.aspx) (this is the old Azure portal). After adding the account, the following two things need to be done to use the organization in Azure Pipelines:
  - Add the Active Directory account to the co-administrators in the subscription. Go to the Settings and then click on administrators and add the account as a co-admin like, [testuser@joehotmail.onmicrosoft.com](mailto:testuser@joehotmail.onmicrosoft.com)
  - Login to the portal with this Active Directory account wiz. [testuser@joehotmail.onmicrosoft.com](mailto:testuser@joehotmail.onmicrosoft.com), and change the password. Initially a temporary password is created and that needs to be changed at the first login.
2. Add that user and password in the service connections in Azure Pipelines and deployments will work with that account.

#### Azure PowerShell

The task needs the Azure PowerShell version to be installed on the automation agent, and that can be done easily using the [Azure PowerShell Installer v1.0.2](https://github.com/Azure/azure-powershell/releases/tag/v1.0.2-December2015). Refer to "Supported Azure and AzureRM module versions" section below for recommended versions.

### Parameters of the task:

The parameters of the task are described in details, including examples, to show how to input the parameters. The parameters listed with a \* are required parameters for the task:

 * **Azure Subscription**\*: Select the service connection for the Azure Subscription where the Resource Group will be created/updated, or where the resource group is located for starting/stopping/restarting/deleting virtual machines in it, or for deleting the resource group. To configure new service connection, select the Azure subscription from the list and click 'Authorize'. If your subscription is not listed or if you want to use an existing Service Principal, you can setup an Azure service connection using 'Manage' link.
 
 * **Action**\*: Select the action to be performed on the resource group. Following actions are available:
    - Create or Update Resource Group: creates a new resource group or to update an existing one (using [Azure Resource Manager templates](https://azure.microsoft.com/en-in/documentation/articles/resource-group-template-deploy/)).
    - Select Resource Group: reads the Resource Group information from Azure and creates an Output Variable with the VMs in the Resource Group. Read more about Deployment Outputs [here](#deployment-outputs).
    - Start, Stop, Deallocate, Restart, Delete Virtual Machines
    - Delete Resource Group

 * **Resource Group**\*: Enter the name of the resource group. If this is an existing resource group, and the selected action is to create or update the resource group, then the task will update the resource group with the resources specified in the Azure template. If no Resource Group with the name exists in the subscription, then a new one will be created.
 
 * **Location**\*: The location where the resource group will be created. If an existing resource group is updated, then this parameter will be ignored.

The following parameters are shown when the selected action is to create or update a resource group:

 * **Template location**: The location of the Template & the Parameters JSON files. Select "Linked Artifact" if the files are part of the linked code/build artifacts. Select "URL of the file" if the JSON files are located at any publicly accessible http/https URLs. To use a file stored in a private storage account, retrieve and include the shared access signature (SAS) token in the URL of the template. Example: <blob_storage_url>/template.json?<SAStoken>. To upload a parameters file to a storage account and generate a SAS token, you could use [Azure file copy task](https://aka.ms/azurefilecopyreadme) or follow the steps using [PowerShell](https://go.microsoft.com/fwlink/?linkid=838080) or [Azure CLI](https://go.microsoft.com/fwlink/?linkid=836911).
 
 * **Template and its Parameters**: The templates and the templates parameters file are the Azure templates available at [GitHub](https://github.com/Azure/azure-quickstart-templates) or in the [Azure gallery](https://azure.microsoft.com/en-in/documentation/articles/powershell-azure-resource-manager/). To get started immediately use [this](https://aka.ms/sampletemplate) template that is available on GitHub. 
	- These files can be either be located at any publicly accessible http/https URLs or be in a checked in the Version Control or they can be part of the build itself. If the files are part of the Build, use the pre-defined [system variables](https://msdn.microsoft.com/Library/vs/alm/Build/scripts/variables) provided by the Build to specify their location. The variables to use are $(Build.Repository.LocalPath), if the templates are checked-in but are not built, or $(Agent.BuildDirectory), if the templates are built as part of the solution. Be sure to specify the full path like $(Build.Repository.LocalPath)\Azure Templates\AzureRGDeploy.json. Wildcards like \*\*\\\*.json or \*\*\\*.param.json are also supported and there needs to be only one file that matches the search pattern at the location. If more than one file matches the search pattern, then the task will error out.

 **NOTE**: Follow the Azure Naming guidelines while specifying parameters, few important one mentioned in below table_

|         Kind         | Length | Casing           | Valid Chars                                                                           | Globally Unique |
|:--------------------:|--------|------------------|---------------------------------------------------------------------------------------|:---------------:|
| Storage Account      | 3-24   | lowercase        | alphanumeric                                                                          | Yes             |
| Azure Resource Group | 2-64   | case-insensitive | alphanumeric periods, underscores, hyphens and parenthesis and cannot end in a period | No              |
| Azure KeyVault       | 3-24   | case-insensitive | alphanumeric                                                                          | Yes             |
| Azure DNS Name       | 3-63   | lowercase        | alphanumeric and hyphens                                                              | Yes             |

 * **Override Template Parameters**: The Override template parameters is used to override the parameters, like `-storageAcctName azurerg -Username $(vmusername) -azureKeyVaultName $(fabrikamFibre)`. To avoid storing "secureString" parameters in plain text, it is recommended that you use secret variables, for example `$(variableName)`. By clicking on “…” next to Override template parameters textbox, template parameters can be viewed/overridden in a grid.  This feature requires that CORS rules are enabled at the source. If templates are in Azure storage blob, refer to [this](https://docs.microsoft.com/en-us/rest/api/storageservices/fileservices/Cross-Origin-Resource-Sharing--CORS--Support-for-the-Azure-Storage-Services?redirectedfrom=MSDN#understanding-cors-requests) to enable CORS.
 
 * **Deployment Mode**: This specifies the [deployment mode](https://azure.microsoft.com/en-us/documentation/articles/resource-group-template-deploy) in which the Azure resources specified in the template have to be deployed. Incremental mode handles deployments as incremental updates to the resource group . It leaves unchanged resources that exist in the resource group but are not specified in the template. Complete mode deletes resources that are not in your template. [Validate mode](https://msdn.microsoft.com/en-us/library/azure/dn790547.aspx) enables you to find syntactical problems with the template before creating actual resources. By default, incremental mode is used. 
 
 ### Deployment Outputs:
  Outputs created by Azure Resource Manager template deployment. It can be used in the subsequent tasks (like Powershell and Azure CLI) for further processing.

 **How to use Deployment output**
  The deployment output can be parsed to JSON object using "ConvertFrom-Json" Powershell cmdlet in Powershell/Azure Powershell task and then that object can be used in same task or subsequent tasks.

  Example:
  ```
  $var=ConvertFrom-Json '$(storageAccountName)'
  $value=$var.storageAccountName.value
  Write-Host "##vso[task.setvariable variable=storageAccount;]$value"
  ```

  On linux agent, same technique can be used to create a JSON object. However, if you want to avoid Powershell task, you can use a script similar to below which converts the Outputs to valid JSON by adding double quotes.

  ```
  var=`echo "$(storageAccountName)" | \
  sed -e 's/ //g' | \
  sed -e 's/}/"\n}/g' | \
  sed -e 's/{/{\n"/g' | \
  sed -e 's/:/":"/g'  | \
  sed -e 's/,/",\n"/g' | \
  sed -e 's/"}/}/g' | \
  sed -e 's/}"/}/g'  | \
  sed -e 's/"{/{/g'  | \
  sed -e 's/\[/\[\n"/g' | \
  sed -e 's/]/"\n]/g' | \
  sed -e 's/"\[/\[/g' | \
  sed -e 's/]"/]/g'`
  sa_name=`echo $var | jq -r .storageAccountName.value`
  echo $sa_name
  ```

 ### Advanced deployment options for virtual machines:
 
 These options would be applicable only when the Resource group contains virtual machines.
 
 * **Enable prerequisites**: Selecting WinRM option configures Windows Remote Management (WinRM) listener over HTTPS protocol on port 5986, using a self-signed certificate. This configuration is required for performing deployment operation on Azure machines. If the target Virtual Machines are backed by a Load balancer, ensure Inbound NAT rules are configured for target port (5986). Choosing Deployment group option would configure Deployment group agent on each of the virtual machines.
 
  * **VM details for WinRM**: Provide a name for the variable for the resource group. The variable can be used as $(variableName) to refer to the resource group in subsequent tasks like in the PowerShell on Target Machines task for deploying applications. Valid only when the selected action is Create, Update or Select, and required when an existing resource group is selected. Also this field is visible only when "Enable Prerequisites" dropdown option is not Deployment Group. 
  
   Limitation: VM details produced during execution will only contain the VM hostname(s) and (public) ports, if any. Credentials to connect to the VM host(s) are to be provided explicitly in the subsequent tasks.

  * **TFS/Azure Pipelines endpoint**\*: Agent registration with Deployment group requires access to your Visual Studio project.​ Click "Add" to create an endpoint using personal access token (PAT) with scope restricted to "Deployment Group" and a default expiration time of 90 days. ​Click "Manage" to update endpoint details.​
  
  * **Team project**\*: Specify the Team Project which has the Deployment Group defined in it​.
  
  * **Deployment Group**: Specify an existing Deployment Group against which the Agent(s) will be registered.
  
  * **Copy Azure VM tags to agents**: Choose if the tags configured on the Azure VM need to be copied to the corresponding Deployment Group agent. ​By default all Azure tags will be copied following the format “Key: Value”. Example: An Azure Tag “Role : Web” would be copied  as-is to the Agent machine. For more information on how tag Azure resources refer to [link](https://docs.microsoft.com/en-us/azure/azure-resource-manager/resource-group-using-tags​)
  

### Pre-existing Deployment Group

When "Enable Prerequisites" dropdown option is "Configure with Deployment Group agent", this task downloads the agent installer on each of the machines and register them with an existing Deployment group. If there is no pre-existing Deployment group, you can create one in the Deployment groups hub.

Carry out the following steps to create a Deployment group:
1. Open your Azure Pipelines account in your web browser
2. Open the Deployment groups tab of the Build & Release hub and choose +Deployment group to create a new group
3. Enter a name for the group in the Details tab and then choose "Create"


### Setting up a virtual machine for WinRM HTTPS using Azure Templates:

Tasks like Azure File Copy, PowerShell on Target Machines, Visual Studio Test Agent Deployment run on the automation agent machine and copy files or deploy apps to Azure VMs using the WinRM HTTPS protocol. For these tasks to work properly, the WinRM HTTPS port (default port is 5986) needs to be opened and configured properly on the virtual machines. Opening the ports and configuring them with the certificates is done using the Azure templates. The [sample template](https://aka.ms/sampletemplate) uploaded on GitHub shows how to enable the WinRM HTTPS protocol on Azure virtual machines and map them to a Public IP using the Azure resource providers' wiz. Network Interfaces, Load Balancers and Virtual Machines. In addition, it also shows how to specify the Azure Key Vault and its secret, and to download and install the certificate on the virtual machine.

### Supported Azure and AzureRM module versions:
|  Azure Pipelines/TFS Release  |  Recommended Azure Version  |  Other Supported Versions |
|:------------------:|:---------------------------:|:-------------------------:|
|  Azure Pipelines              |  [v1.3.2](https://github.com/Azure/azure-powershell/releases/tag/v1.3.2-April2016)  |  [v0.9.8](https://github.com/Azure/azure-powershell/releases/tag/v0.9.8-September2015)  |
|  TFS 2015 Update 3  | [v1.3.2](https://github.com/Azure/azure-powershell/releases/tag/v1.3.2-April2016)  |  [v0.9.8](https://github.com/Azure/azure-powershell/releases/tag/v0.9.8-September2015)  |
|  TFS 2015 Update 2  | [v1.0.2](https://github.com/Azure/azure-powershell/releases/tag/v1.0.2-December2015)  |  [v0.9.8](https://github.com/Azure/azure-powershell/releases/tag/v0.9.8-September2015)  |
|  TFS 2015 Update 1  | [v0.9.8](https://github.com/Azure/azure-powershell/releases/tag/v0.9.8-September2015)  |  |
|  TFS 2015 RTM       | [v0.9.8](https://github.com/Azure/azure-powershell/releases/tag/v0.9.8-September2015)  |  |

### Limitations:

- Does not support multiline strings in arm template/parameter json file.
