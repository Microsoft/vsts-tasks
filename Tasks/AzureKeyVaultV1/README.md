

# Azure Key Vault Task

### Overview

This task is used for downloading secrets (such as authentication keys, storage account keys, data encryption keys, .PFX files, and passwords) from a given [Azure key vault](https://docs.microsoft.com/en-us/rest/api/keyvault/about-keys--secrets-and-certificates?redirectedfrom=MSDN#key-vault-secrets-1) instance. This can be used to fetch the latest values of all/subset of secrets from the vault and set them as task variables which can be consumed in the following tasks. Task is node based and works with Xplat agents  (Windows, Linux or OSX).

## Contact Information

Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

## Pre-requisites for the task

The following pre-requisites need to be setup for the task to work properly.

#### Azure Subscription

To deploy to Azure, an Azure subscription has to be linked to Team Foundation Server or to Azure Pipelines using the Services tab in the Account Administration section. Add the Azure subscription to use in the Build or Release Management definition by opening the Account Administration screen (gear icon on the top-right of the screen) and then click on the Services Tab. Create a service endpoint of 'Azure Resource Manager' type. For more troubleshooting guidance around endpoint creation, refer [this](https://www.visualstudio.com/en-us/docs/build/actions/azure-rm-endpoint).

For Azure MSDN accounts, one can either use a [Service Principal](https://go.microsoft.com/fwlink/?LinkID=623000&clcid=0x409) or a work account. It's easy to create a work account as shown below:

1. Create an user in the Azure Active Directory from the [portal](https://msdn.microsoft.com/en-us/library/azure/hh967632.aspx) (this is the old Azure portal). After adding the account, the following two things need to be done to use the organization in Azure Pipelines:
  - Add the Active Directory account to the co-administrators in the subscription. Go to the Settings and then click on administrators and add the account as a co-admin like, [testuser@joehotmail.onmicrosoft.com](mailto:testuser@joehotmail.onmicrosoft.com)
  - Login to the portal with this Active Directory account wiz. [testuser@joehotmail.onmicrosoft.com](mailto:testuser@joehotmail.onmicrosoft.com), and change the password. Initially a temporary password is created and that needs to be changed at the first login.
2. Add that user and password in the service connections in Azure Pipelines and deployments will work with that account.

#### Pre-existing Azure Key Vault with secrets

This task supports fetching latest values of the secrets which are already added to a pre-existing key vault instance. If there is no pre-existing Key vault, you can create a key vault in the the [Azure portal](https://ms.portal.azure.com/#create/Microsoft.KeyVault) or use [Azure PowerShell](https://docs.microsoft.com/en-us/azure/key-vault/key-vault-get-started#a-idvaultacreate-a-key-vault) or use [Azure CLI](https://docs.microsoft.com/en-us/azure/key-vault/key-vault-manage-with-cli2#create-a-key-vault).

To add secrets to the keyvault, use PowerShell cmdlet [Set-AzureKeyVaultSecret](https://docs.microsoft.com/en-us/powershell/module/azurerm.keyvault/set-azurekeyvaultsecret?view=azurermps-4.0.0): If the secret does not exist, this cmdlet creates it. If the secret already exists, this cmdlet creates a new version of that secret.

Or use Azure CLI : To add a secret, which is a password named SQLPassword and that has the value of Pa$$w0rd to Azure Key Vault, type the following:

```
az keyvault secret set --vault-name 'ContosoKeyVault' --name 'SQLPassword' --value 'Pa$$w0rd'
```

### Parameters of the task:

The parameters of the task are described below. The parameters listed with a \* are required parameters for the task:

 * **Azure Subscription**\*: Select the service endpoint for the Azure Subscription where the Azure Key vault instance is created. To configure new service endpoint, select the Azure subscription from the list and click 'Authorize'. If your subscription is not listed or if you want to use an existing Service Principal, you can setup an Azure service connection using 'Manage' link.

Ensure the Azure endpoint has at least Get and List permissions for Secrets on the vault. You can set these permissions in the Azure portal: Open the Settings blade for the vault, choose Access policies, then Add new. In the Add access policy blade, choose Select principal and select the service principal for your client account. In the Add access policy blade, choose `Secret permissions` and ensure that Get and List are checked (ticked). Choose OK to save the changes.

 * **Key Vault**\*: Select the name of the Key vault from which the secrets need to be downloaded.

 * **Secrets filter**\*: Provide a comma separated list of secret names or use the default value `*` to download all secrets from the selected key vault. This can be used to fetch the latest values of all/subset of secrets from the vault and set them as task variables which can be consumed in the following tasks.

For example, if there is a secret name: connectionString, a task variable `$(connectionString)` is created with the latest fetched value of the respective secret from Azure key vault. And this secret variable would be available to be consumed in subsequent tasks.

Certificates are also fetched from the vault as secrets. In this case, the task variable would contain the content of the PFX in base64 string format. To convert the string into a PFX file from the task variable, the following sample PowerShell code can be used (after passing the certificate variable as a parameter to the script):

```powershell
    # Task parameters: $(PfxSecret)
    param ($pfxSecretStringValue)
    $kvSecretBytes = [System.Convert]::FromBase64String($pfxSecretStringValue)
    $certCollection = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2Collection
    $certCollection.Import($kvSecretBytes, $null, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable)
```

Here's an example of how you can import the certificate into a local store:

```powershell
    $CertStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("My","LocalMachine")
    $CertStore.Open("ReadWrite")
    $CertStore.AddRange($certCollection)
    $CertStore.Close()
```

Alternatively, if the certificate file needs to be stored as a PFX file on the hard disk then it is good practice to encrypt it with a password:

```powershell
    # Get the file created
    $password = <password>
    $protectedCertificateBytes = $certCollection.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pkcs12, $password)
    $pfxPath = [Environment]::GetFolderPath("Desktop") + "\MyCert.pfx"
    [System.IO.File]::WriteAllBytes($pfxPath, $protectedCertificateBytes)
```

More help can be found [here](https://blogs.technet.microsoft.com/kv/2016/09/26/get-started-with-azure-key-vault-certificates).
