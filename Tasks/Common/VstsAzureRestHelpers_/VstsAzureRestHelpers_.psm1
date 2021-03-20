# Private module-scope variables.
$script:jsonContentType = "application/json;charset=utf-8"
$script:formContentType = "application/x-www-form-urlencoded;charset=utf-8"
$script:defaultAuthUri = "https://login.microsoftonline.com/"
$script:defaultEnvironmentAuthUri = "https://login.windows.net/"
$script:certificateAccessToken = $null

# Connection Types
$certificateConnection = 'Certificate'
$usernameConnection = 'UserNamePassword'
$spnConnection = 'ServicePrincipal'
$MsiConnection = 'ManagedServiceIdentity'

# Well-Known ClientId
$azurePsClientId = "1950a258-227b-4e31-a9cf-717495945fc2"

# API-Version(s)
$apiVersion = "2014-04-01"
$azureStackapiVersion = "2015-06-15"

# Constants
$azureStack = "AzureStack"

# Override the DebugPreference.
if ($global:DebugPreference -eq 'Continue') {
    Write-Verbose '$OVERRIDING $global:DebugPreference from ''Continue'' to ''SilentlyContinue''.'
    $global:DebugPreference = 'SilentlyContinue'
}

# Import the loc strings.
Import-VstsLocStrings -LiteralPath $PSScriptRoot/module.json

Import-Module $PSScriptRoot/../TlsHelper_
Add-Tls12InSession

function Get-AzureUri {
    param([object] [Parameter(Mandatory = $true)] $endpoint)

    $url = $endpoint.url
    if ($url -ne $null -and $url[-1] -eq '/') {
        return $url.Substring(0, $url.Length - 1)
    }
    return $url
}

function Get-AzureActiverDirectoryResourceId {
    param([object] [Parameter(Mandatory = $true)] $endpoint)
    $activeDirectoryResourceid = $null;
   
    if (($endpoint.Data.Environment) -and ($endpoint.Data.Environment -eq $azureStack)) {
        if (!$endpoint.Data.ActiveDirectoryServiceEndpointResourceId) {
            $endpoint = Add-AzureStackDependencyData -Endpoint $endpoint
        }
        $activeDirectoryResourceid = $endpoint.Data.ActiveDirectoryServiceEndpointResourceId
    }
    else {
        $activeDirectoryResourceid = $endpoint.url
        if ($activeDirectoryResourceid -ne $null -and $activeDirectoryResourceid[-1] -ne '/') {
            $activeDirectoryResourceid = $activeDirectoryResourceid + "/"
        }
    }

    return $activeDirectoryResourceid
}

# Check if Azure connection type is classic or not.
function IsLegacyAzureConnection {
    param([Parameter(Mandatory = $true)] $connectionType)

    Write-Verbose "Connection type used is $connectionType"
    if ($connectionType -eq $certificateConnection -or $connectionType -eq $usernameConnection) {
        return $true
    }
    else {
        return $false
    }
}

# Check if Azure connection is RM type or not.
function IsAzureRmConnection {
    param([Parameter(Mandatory = $true)] $connectionType)

    Write-Verbose "Connection type used is $connectionType"
    if (($connectionType -eq $spnConnection) -or ($connectionType -eq $MsiConnection)) {
        return $true
    }
    else {
        return $false
    }
}

# Get connection Type
function Get-ConnectionType {
    param([Object] [Parameter(Mandatory = $true)] $serviceEndpoint)

    $connectionType = $serviceEndpoint.Auth.Scheme

    Write-Verbose "Connection type used is $connectionType"
    return $connectionType
}

# Get the Bearer Access Token from the Endpoint
function Get-UsernamePasswordAccessToken {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)] $endpoint)

    # Well known Client-Id
    $password = $endpoint.Auth.Parameters.Password
    $username = $endpoint.Auth.Parameters.UserName
    $authUrl = $script:defaultAuthUri
    if ($endpoint.Data.activeDirectoryAuthority) {
        $authUrl = $endpoint.Data.activeDirectoryAuthority
    }

    $authUri = "$authUrl/common/oauth2/token"
    $body = @{
        resource = $script:azureUri
        client_id = $azurePsClientId
        grant_type = 'password'
        username = $username
        password = $password
    }

    # Call Rest API to fetch AccessToken
    Write-Verbose "Fetching Access Token"

    try {
        $accessToken = Invoke-RestMethod -Uri $authUri -Method POST -Body $body -ContentType $script:formContentType
        return $accessToken
    }
    catch {
        throw (Get-VstsLocString -Key AZ_UserAccessTokenFetchFailure)
    }
}

function Get-EnvironmentAuthUrl {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)] $endpoint)

    if ($endpoint.Data.environmentAuthorityUrl) {
        $envAuthUrl = $endpoint.Data.environmentAuthorityUrl
    }
    else {
        if (($endpoint.Data.Environment) -and ($endpoint.Data.Environment -eq $azureStack)) {
            $endpoint = Add-AzureStackDependencyData -Endpoint $endpoint
            $envAuthUrl = $endpoint.Data.environmentAuthorityUrl
        } 
        else {
            $envAuthUrl = $script:defaultEnvironmentAuthUri
        }
    }

    return $envAuthUrl
}

<#
    Adds Azure Stack environment to use with AzureRM command-lets when targeting Azure Stack
#>
function Add-AzureStackDependencyData {
    param (
        [Parameter(mandatory = $true, HelpMessage = "The Admin ARM endpoint of the Azure Stack Environment")]
        $endpoint
    )

    $EndpointURI = $endpoint.Url.TrimEnd("/")

    $Domain = ""
    try {
        $uriendpoint = [System.Uri] $EndpointURI
        $i = $EndpointURI.IndexOf('.')
        $Domain = ($EndpointURI.Remove(0, $i + 1)).TrimEnd('/')
    }
    catch {
        Write-Error "The specified Azure Resource Manager endpoint is invalid"
    }

    $ResourceManagerEndpoint = $EndpointURI
    $stackdomain = $Domain
    $AzureKeyVaultDnsSuffix = "vault.$($stackdomain)".ToLowerInvariant()
    $AzureKeyVaultServiceEndpointResourceId = $("https://vault.$stackdomain".ToLowerInvariant())
    $StorageEndpointSuffix = ($stackdomain).ToLowerInvariant()
    
    $azureStackEndpointUri = $EndpointURI.ToString().TrimEnd('/') + "/metadata/endpoints?api-version=2015-01-01"

    Write-Verbose "Retrieving endpoints from the $ResourceManagerEndpoint"
    $endpointData = Invoke-RestMethod -Uri $azureStackEndpointUri -Method Get -ErrorAction Stop
    
    if ($endpointData) {
        $graphEndpoint = $endpointData.graphEndpoint
        $galleryEndpoint = $endpointData.galleryEndpoint
        $authenticationData = $endpointData.authentication;
        if ($authenticationData) {
            $loginEndpoint = $authenticationData.loginEndpoint
            if ($loginEndpoint) {
                $activeDirectoryEndpoint = $loginEndpoint.TrimEnd('/') + "/"
            }

            $audiences = $authenticationData.audiences
            if ($audiences.Count -gt 0) {
                $activeDirectoryServiceEndpointResourceId = $audiences[0]
            }
        }

        if ($Endpoint.Data -ne $null) {
            if (-not (Has-ObjectProperty $Endpoint.Data "galleryUrl")) {
                $Endpoint.Data | Add-Member "galleryUrl" $null
            }

            if (-not (Has-ObjectProperty $Endpoint.Data "resourceManagerUrl")) {
                $Endpoint.Data | Add-Member "resourceManagerUrl" $null
            }

            if (-not (Has-ObjectProperty $Endpoint.Data "activeDirectoryAuthority")) {
                $Endpoint.Data | Add-Member "activeDirectoryAuthority" $null
            }

            if (-not (Has-ObjectProperty $Endpoint.Data "environmentAuthorityUrl")) {
                $Endpoint.Data | Add-Member "environmentAuthorityUrl" $null
            }

            if (-not (Has-ObjectProperty $Endpoint.Data "graphUrl")) {
                $Endpoint.Data | Add-Member "graphUrl" $null
            }

            if (-not (Has-ObjectProperty $Endpoint.Data "activeDirectoryServiceEndpointResourceId")) {
                $Endpoint.Data | Add-Member "activeDirectoryServiceEndpointResourceId" $null
            }

            if (-not (Has-ObjectProperty $Endpoint.Data "AzureKeyVaultDnsSuffix")) {
                $Endpoint.Data | Add-Member "AzureKeyVaultDnsSuffix" $null
            }

            $Endpoint.Data.galleryUrl = $galleryEndpoint
            $Endpoint.Data.resourceManagerUrl = $ResourceManagerEndpoint
            $Endpoint.Data.activeDirectoryAuthority = $activeDirectoryEndpoint
            $Endpoint.Data.environmentAuthorityUrl = $activeDirectoryEndpoint
            $Endpoint.Data.graphUrl = $graphEndpoint
            $Endpoint.Data.activeDirectoryServiceEndpointResourceId = $activeDirectoryServiceEndpointResourceId
            $Endpoint.Data.AzureKeyVaultDnsSuffix = $AzureKeyVaultDnsSuffix
        }
    } 
    else {
        throw "Unable to fetch Azure Stack Dependency Data."
    }
    return $Endpoint
}

function Has-ObjectProperty {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)] $object,
        [Parameter(Mandatory = $true)] $propertyName) 

    if (Get-Member -inputobject $object -name $propertyName -Membertype Properties) {
        return $true
    }
    else {
        return $false
    }
}

function Get-AzureRMAccessToken {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $endpoint,
        [parameter(Mandatory = $false)] $overrideResourceType = $null
    ) 

    if ($endpoint.Auth.Scheme -eq $MsiConnection ) {
        Get-MsiAccessToken -endpoint $endpoint -retryCount 0 -timeToWait 0 -overrideResourceType $overrideResourceType
    }
    else {
        if ($Endpoint.Auth.Parameters.AuthenticationType -eq 'SPNCertificate') {
            Get-SpnAccessTokenUsingCertificate -endpoint $endpoint -overrideResourceType $overrideResourceType
        }
        else {
            Get-SpnAccessToken -endpoint $endpoint -overrideResourceType $overrideResourceType
        }
    }   
}

# Get the Bearer Access Token from the Endpoint
function Get-SpnAccessToken {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $endpoint,
        [parameter(Mandatory = $false)] $overrideResourceType
    )

    $principalId = $endpoint.Auth.Parameters.ServicePrincipalId
    $tenantId = $endpoint.Auth.Parameters.TenantId
    $principalKey = $endpoint.Auth.Parameters.ServicePrincipalKey

    $envAuthUrl = Get-EnvironmentAuthUrl -endpoint $endpoint
    if ($overrideResourceType) {
        $azureActiveDirectoryResourceId = $overrideResourceType
    }
    else {
        $azureActiveDirectoryResourceId = Get-AzureActiverDirectoryResourceId -endpoint $endpoint
    }

    # Prepare contents for POST
    $method = "POST"
    $authUri = "$envAuthUrl" + "$tenantId/oauth2/token"
    $body = @{
        resource = $azureActiveDirectoryResourceId
        client_id = $principalId
        grant_type = 'client_credentials'
        client_secret = $principalKey
    }

    # Call Rest API to fetch AccessToken
    Write-Verbose "Fetching Access Token"
    
    try {
        $accessToken = Invoke-RestMethod -Uri $authUri -Method $method -Body $body -ContentType $script:formContentType
        return $accessToken
    }
    catch {
        $exceptionMessage = $_.Exception.Message.ToString()
        $parsedException = Parse-Exception($_.Exception)
        if ($parsedException) {
            $exceptionMessage = $parsedException
        }
        Write-Verbose "ExceptionMessage: $exceptionMessage (in function: Get-SpnAccessToken)"
        throw (Get-VstsLocString -Key AZ_SpnAccessTokenFetchFailure -ArgumentList $tenantId)
    }
}

# Get the Bearer Access Token from the Endpoint
function Get-MsiAccessToken {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $endpoint,
        [Parameter(Mandatory = $true)] $retryCount,
        [Parameter(Mandatory = $true)] $timeToWait,
        [Parameter(Mandatory = $false)] $overrideResourceType
    )

    $msiClientId = "";
    if ($endpoint.Data.msiClientId) {
        $msiClientId = "&client_id=" + $endpoint.Data.msiClientId;
    }
    $tenantId = $endpoint.Auth.Parameters.TenantId

    $endPointUrl = $endpoint.Url
    if ($overrideResourceType) {
        $endPointUrl = $overrideResourceType
    }

    # Prepare contents for GET
    $method = "GET"
    $apiVersion = "2018-02-01";
    $authUri = "http://169.254.169.254/metadata/identity/oauth2/token?api-version=" + $apiVersion + "&resource=" + $endPointUrl + $msiClientId;
    
    # Call Rest API to fetch AccessToken
    Write-Verbose "Fetching Access Token For MSI"
    
    try {
        $retryLimit = 5;
        $response = Invoke-WebRequest -Uri $authUri -Method $method -Headers @{Metadata = "true" } -UseBasicParsing

        # Action on the based of response 
        if (($response.StatusCode -eq 429) -or ($response.StatusCode -eq 500)) {
            if ($retryCount -lt $retryLimit) {
                $retryCount += 1
                $waitedTime = 2000 + $timeToWait * 2
                Start-Sleep -m $waitedTime
                Get-MsiAccessToken -endpoint $endpoint -retryCount $retryCount -waitedTime $waitedTime -overrideEndPointUrl $overrideEndPointUrl
            }
            else {
                throw (Get-VstsLocString -Key AZ_MsiAccessTokenFetchFailure -ArgumentList $response.StatusCode, $response.StatusDescription)
            }
        }
        elseif ($response.StatusCode -eq 200) {
            $accessToken = $response.Content | ConvertFrom-Json
            return $accessToken
        }
        else {
            throw (Get-VstsLocString -Key AZ_MsiAccessNotConfiguredProperlyFailure -ArgumentList $response.StatusCode, $response.StatusDescription)
        }
        
    }
    catch {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Verbose "ExceptionMessage: $exceptionMessage (in function: Get-MsiAccessToken)"
        if ($exceptionMessage -match "400") {
            throw (Get-VstsLocString -Key AZ_MsiAccessNotConfiguredProperlyFailure -ArgumentList $response.StatusCode, $response.StatusDescription)
        }
        else {
            throw $_.Exception
        }
    }
}

function Get-SpnAccessTokenUsingCertificate {
    param(
        [Parameter(Mandatory = $true)] $endpoint,
        [Parameter(Mandatory = $false)] $overrideResourceType
    )

    if ($script:certificateAccessToken -and $script:certificateAccessToken.expires_on) {
        # there exists a token cache
        $currentTime = [System.DateTime]::UtcNow
        $tokenExpiryTime = $script:certificateAccessToken.expires_on.UtcDateTime
        $timeDifference = $tokenExpiryTime - $currentTime

        if ($timeDifference.Minutes -gt 5) {
            Write-Verbose "Returning access token from cache."
            return $script:certificateAccessToken
        }
    }

    Write-Verbose "Fetching access token using client certificate."
    
    # load the ADAL library 
    Add-Type -Path $PSScriptRoot\Microsoft.IdentityModel.Clients.ActiveDirectory.dll

    $pemFileContent = $endpoint.Auth.Parameters.ServicePrincipalCertificate
    $pfxFilePath, $pfxFilePassword = ConvertTo-Pfx -pemFileContent $pemFileContent
    
    $clientCertificate = Get-PfxCertificate -pfxFilePath $pfxFilePath -pfxFilePassword $pfxFilePassword

    $servicePrincipalId = $endpoint.Auth.Parameters.ServicePrincipalId
    $tenantId = $endpoint.Auth.Parameters.TenantId
    $envAuthUrl = $script:defaultEnvironmentAuthUri
    if ($endpoint.Data.environmentAuthorityUrl) {
        $envAuthUrl = $endpoint.Data.environmentAuthorityUrl
    }

    $envAuthUrl = Get-EnvironmentAuthUrl -endpoint $endpoint
    if($overrideResourceType){
        $azureActiveDirectoryResourceId = $overrideResourceType
    } else {
        $azureActiveDirectoryResourceId = Get-AzureActiverDirectoryResourceId -endpoint $endpoint
    }
    $authorityUrl = $envAuthUrl

    $isADFSEnabled = $false
    if ($endpoint.Data.EnableAdfsAuthentication -eq "true") {
        $isADFSEnabled = $true
    }

    if (-not $isADFSEnabled) {
        $authorityUrl = "$envAuthUrl$tenantId"
    }

    try {
        $clientAssertionCertificate = New-Object Microsoft.IdentityModel.Clients.ActiveDirectory.ClientAssertionCertificate -ArgumentList $servicePrincipalId, $clientCertificate

        $validateAuthority = -not $isADFSEnabled
        $authenticationContext = New-Object Microsoft.IdentityModel.Clients.ActiveDirectory.AuthenticationContext -ArgumentList $authorityUrl, $validateAuthority
        $tokenResult = $authenticationContext.AcquireTokenAsync($azureActiveDirectoryResourceId, $clientAssertionCertificate).ConfigureAwait($false).GetAwaiter().GetResult()
    }
    catch {
        $script:certificateAccessToken = $null
        throw (Get-VstsLocString -Key "AZ_SPNCertificateAccessTokenFetchFailure" -ArgumentList $servicePrincipalId, $_)
    }

    if ($tokenResult) {
        Write-Verbose "Successfully fetched access token using client certificate."
        $script:certificateAccessToken = @{
            token_type = $tokenResult.AccessTokenType;
            access_token = $tokenResult.AccessToken;
            expires_on = $tokenResult.ExpiresOn;
        }

        return $script:certificateAccessToken
    }
    else {
        $script:certificateAccessToken = $null
        throw (Get-VstsLocString -Key "AZ_SPNCertificateAccessTokenFetchFailureTokenNull" -ArgumentList $servicePrincipalId)
    }
}

function Get-PfxCertificate {
    param(
        [string][Parameter(Mandatory = $true)] $pfxFilePath, 
        [string][Parameter(Mandatory = $true)] $pfxFilePassword
    )

    $clientCertificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2
    $clientCertificate.Import($pfxFilePath, $pfxFilePassword, [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::PersistKeySet)

    return $clientCertificate
}

# Get the certificate from the Endpoint.
function Get-Certificate {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)] $endpoint)

    $bytes = [System.Convert]::FromBase64String($endpoint.Auth.Parameters.Certificate)
    $certificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2
    $certificate.Import($bytes)

    return $certificate
}

function Get-AzStorageKeys {
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $storageAccountName,
        [Object] [Parameter(Mandatory = $true)] $endpoint)
    
    try {
        $subscriptionId = $endpoint.Data.SubscriptionId.ToLower()
        $azureUri = Get-AzureUri $endpoint

        $uri = "$azureUri/$subscriptionId/services/storageservices/$storageAccountName/keys"
        $headers = @{"x-ms-version" = "2016-03-01" }
        $method = "GET"

        $certificate = Get-Certificate $endpoint

        $storageKeys = Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Certificate $certificate
        return $storageKeys.StorageService.StorageServiceKeys
    }
    catch {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Verbose "Exception : $exceptionMessage" 
        $parsedException = Parse-Exception($_.Exception)
        if ($parsedException) {
            $exceptionMessage = $parsedException
        }
        Write-Error "ExceptionMessage: $exceptionMessage (in function: Get-AzStorageKeys)"
        throw
    }
}

function Get-AzRMStorageKeys {
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $resourceGroupName,
        [String] [Parameter(Mandatory = $true)] $storageAccountName,
        [Object] [Parameter(Mandatory = $true)] $endpoint)

    try {
        $accessToken = Get-AzureRMAccessToken $endpoint

        $resourceGroupDetails = Get-AzRmResourceGroup $resourceGroupName $endpoint
        $resourceGroupId = $resourceGroupDetails.id

        $method = "POST"
        $uri = "$($endpoint.Url)$resourceGroupId/providers/Microsoft.Storage/storageAccounts/$storageAccountName/listKeys" + '?api-version=2015-06-15'

        $headers = @{"Authorization" = ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token) }

        $storageKeys = Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
        return $storageKeys
    }
    catch {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Verbose "Exception : $exceptionMessage" 
        $parsedException = Parse-Exception($_.Exception)
        if ($parsedException) {
            $exceptionMessage = $parsedException
        }
        Write-Error "ExceptionMessage: $exceptionMessage (in function: Get-AzRMStorageKeys)"
        throw
    }
}

function Get-AzRmVmCustomScriptExtension {
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $resourceGroupName,
        [String] [Parameter(Mandatory = $true)] $vmName,
        [String] [Parameter(Mandatory = $true)] $Name,
        [Object] [Parameter(Mandatory = $true)] $endpoint)

    try {
        $accessToken = Get-AzureRMAccessToken $endpoint
        $resourceGroupDetails = Get-AzRmResourceGroup $resourceGroupName $endpoint
        $resourceGroupId = $resourceGroupDetails.id

        if (($endpoint.Data.Environment) -and ($endpoint.Data.Environment -eq $azureStack)) {
            $vmExtensionApiVersion = '2015-06-15'
        }
        else {
            $vmExtensionApiVersion = '2016-03-30'
        }

        $method = "GET"
        $uri = "$($endpoint.Url)$resourceGroupId/providers/Microsoft.Compute/virtualMachines/$vmName/extensions/$Name" + '?api-version=' + $vmExtensionApiVersion

        $headers = @{"accept-language" = "en-US" }
        $headers.Add("Authorization", ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token))

        $customScriptExt = Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
        return $customScriptExt.properties
    }
    catch {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Verbose "Exception : $exceptionMessage" 
        $parsedException = Parse-Exception($_.Exception)
        if ($parsedException) {
            $exceptionMessage = $parsedException
        }
        Write-Error "ExceptionMessage: $exceptionMessage (in function: Get-AzRmVmCustomScriptExtension)"
        throw
    }
}

function Remove-AzRmVmCustomScriptExtension {
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $resourceGroupName,
        [String] [Parameter(Mandatory = $true)] $vmName,
        [String] [Parameter(Mandatory = $true)] $Name,
        [Object] [Parameter(Mandatory = $true)] $endpoint)

    try {
        $accessToken = Get-AzureRMAccessToken $endpoint
        $resourceGroupDetails = Get-AzRmResourceGroup $resourceGroupName $endpoint
        $resourceGroupId = $resourceGroupDetails.id

        $method = "DELETE"
        $uri = "$($endpoint.Url)$resourceGroupId/providers/Microsoft.Compute/virtualMachines/$vmName/extensions/$Name" + '?api-version=2016-03-30'

        $headers = @{"accept-language" = "en-US" }
        $headers.Add("Authorization", ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token))

        $response = Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
        return $response
    }
    catch {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Verbose "Exception : $exceptionMessage" 
        $parsedException = Parse-Exception($_.Exception)
        if ($parsedException) {
            $exceptionMessage = $parsedException
        }
        Write-Error "ExceptionMessage: $exceptionMessage (in function: Remove-AzRmVmCustomScriptExtension)"
        throw
    }
}

function Get-AzStorageAccount {
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $storageAccountName,
        [Object] [Parameter(Mandatory = $true)] $endpoint)

    try {
        $subscriptionId = $endpoint.Data.SubscriptionId.ToLower()
        $azureUri = Get-AzureUri $endpoint

        $uri = "$azureUri/$subscriptionId/services/storageservices/$storageAccountName"
        $headers = @{"x-ms-version" = "2016-03-01" }
        $method = "GET"

        $certificate = Get-Certificate $endpoint

        $storageAccount = Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Certificate $certificate
        return $storageAccount.StorageService.StorageServiceProperties
    }
    catch {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Verbose "Exception : $exceptionMessage" 
        $parsedException = Parse-Exception($_.Exception)
        if ($parsedException) {
            $exceptionMessage = $parsedException
        }
        Write-Error "ExceptionMessage: $exceptionMessage (in function: Get-AzStorageAccount)"
        throw
    }
}

function Get-AzRmStorageAccount {
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $resourceGroupName,
        [String] [Parameter(Mandatory = $true)] $storageAccountName,
        [Object] [Parameter(Mandatory = $true)] $endpoint)

    try {
        $accessToken = Get-AzureRMAccessToken $endpoint
        $resourceGroupDetails = Get-AzRmResourceGroup $resourceGroupName $endpoint
        $resourceGroupId = $resourceGroupDetails.id

        $method = "GET"
        $uri = "$($endpoint.Url)$resourceGroupId/providers/Microsoft.Storage/storageAccounts/$storageAccountName" + '?api-version=2016-01-01'

        $headers = @{"Authorization" = ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token) }

        $storageAccountUnformatted = Invoke-RestMethod -Uri $uri -Method $method -Headers $headers

        Write-Verbose "Constructing the storage account object"
        
        $storageAccount = New-Object -TypeName PSObject
        $storageAccount | Add-Member -type NoteProperty -name id -value $storageAccountUnformatted.id
        $storageAccount | Add-Member -type NoteProperty -name kind -value $storageAccountUnformatted.kind
        $storageAccount | Add-Member -type NoteProperty -name location -value $storageAccountUnformatted.location
        $storageAccount | Add-Member -type NoteProperty -name StorageAccountName -value $storageAccountUnformatted.name
        $storageAccount | Add-Member -type NoteProperty -name tags -value $storageAccountUnformatted.tags
        $storageAccount | Add-Member -type NoteProperty -name sku -value $storageAccountUnformatted.sku
        $storageAccount | Add-Member -type NoteProperty -name creationTime -value $storageAccountUnformatted.properties.creationTime
        $storageAccount | Add-Member -type NoteProperty -name primaryLocation -value $storageAccountUnformatted.properties.primaryLocation
        $storageAccount | Add-Member -type NoteProperty -name provisioningState -value $storageAccountUnformatted.properties.provisioningState
        $storageAccount | Add-Member -type NoteProperty -name statusOfPrimary -value $storageAccountUnformatted.properties.statusOfPrimary
        $storageAccount | Add-Member -type NoteProperty -name primaryEndpoints -value $storageAccountUnformatted.properties.primaryEndpoints

        return $storageAccount
    }
    catch {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Verbose "Exception : $exceptionMessage" 
        $parsedException = Parse-Exception($_.Exception)
        if ($parsedException) {
            $exceptionMessage = $parsedException
        }
        Write-Error "ExceptionMessage: $exceptionMessage (in function: Get-AzRmStorageAccount)"
        throw
    }
}

function Get-AzRmResourceGroup {
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $resourceGroupName,
        [Object] [Parameter(Mandatory = $true)] $endpoint)

    try {
        $accessToken = Get-AzureRMAccessToken $endpoint
        $subscriptionId = $endpoint.Data.SubscriptionId.ToLower()

        $method = "GET"
        $uri = "$($endpoint.Url)/subscriptions/$subscriptionId/resourceGroups/$resourceGroupName" + '?api-version=2016-02-01'

        $headers = @{"Authorization" = ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token) }

        $resourceGroup = Invoke-RestMethod -Uri $uri -Method $method -Headers $headers
        return $resourceGroup
    }
    catch {
        $exceptionMessage = $_.Exception.Message.ToString()
        Write-Verbose "Exception : $exceptionMessage" 
        $parsedException = Parse-Exception($_.Exception)
        if ($parsedException) {
            $exceptionMessage = $parsedException
        }
        Write-Error "ExceptionMessage: $exceptionMessage (in function: Get-AzRmResourceGroup)"
        throw
    }
}

# Get the Azure Resource Id
function Get-AzureSqlDatabaseServerResourceId {
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $serverName,
        [Object] [Parameter(Mandatory = $true)] $endpoint,
        [Object] [Parameter(Mandatory = $true)] $accessToken)

    $apiVersion = "2019-06-01-preview"
    $serverType = "Microsoft.Sql/servers"
    $subscriptionId = $endpoint.Data.SubscriptionId.ToLower()

    Write-Verbose "[Azure Rest Call] Get Azure Sql Servers"
    $method = "GET"
    $uri = "$($endpoint.Url)/subscriptions/$subscriptionId/providers/Microsoft.Sql/servers?api-version=$apiVersion"
    $headers = @{Authorization = ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token) }

    do {
        Write-Verbose "Fetching Resources from $uri"
        $ResourceDetails = Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -ContentType $script:jsonContentType
        foreach ($resourceDetail in $ResourceDetails.Value) {
            if ($resourceDetail.name -eq $serverName) {
                return $resourceDetail.id
            }
        }
        $uri = $ResourceDetails.nextLink
    } until([string]::IsNullOrEmpty($ResourceDetails.nextLink))

    throw (Get-VstsLocString -Key AZ_NoValidResourceIdFound -ArgumentList $serverName, $serverType, $subscriptionId)
}

function Add-LegacyAzureSqlServerFirewall {
    [CmdletBinding()]
    param([Object] [Parameter(Mandatory = $true)] $endpoint,
        [String] [Parameter(Mandatory = $true)] $startIPAddress,
        [String] [Parameter(Mandatory = $true)] $endIPAddress,
        [String] [Parameter(Mandatory = $true)] $serverName,
        [String] [Parameter(Mandatory = $true)] $firewallRuleName)

    $subscriptionId = $endpoint.Data.SubscriptionId.ToLower()
    $azureUri = Get-AzureUri $endpoint

    $uri = "$azureUri/$subscriptionId/services/sqlservers/servers/$serverName/firewallrules"
    $method = "POST"

    $body = @{
        Name = $firewallRuleName
        StartIPAddress = $startIPAddress
        EndIPAddress = $endIPAddress
    }

    $body = $body | ConvertTo-JSON
    $headers = @{"x-ms-version" = $apiVersion }

    # Get Certificate or bearer token and call Rest API
    if ($endpoint.Auth.Scheme -eq $certificateConnection) {
        $certificate = Get-Certificate $endpoint
        Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Body $body -Certificate $certificate -ContentType $script:jsonContentType
    }
    else {
        $accessToken = Get-UsernamePasswordAccessToken $endpoint
        $headers.Add("Authorization", ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token))

        Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -Body $body -ContentType $script:jsonContentType
    }
}

function Add-AzureRmSqlServerFirewall {
    [CmdletBinding()]
    param([Object] [Parameter(Mandatory = $true)] $endpoint,
        [String] [Parameter(Mandatory = $true)] $startIPAddress,
        [String] [Parameter(Mandatory = $true)] $endIPAddress,
        [String] [Parameter(Mandatory = $true)] $serverName,
        [String] [Parameter(Mandatory = $true)] $firewallRuleName)

    $accessToken = Get-AzureRMAccessToken $endpoint
    # get azure sql server resource Id
    $azureResourceId = Get-AzureSqlDatabaseServerResourceId -endpoint $endpoint -serverName $serverName -accessToken $accessToken

    $uri = "$($endpoint.Url)/$azureResourceId/firewallRules/$firewallRuleName\?api-version=$apiVersion"
    $body = "{
            'properties' : {
            'startIpAddress':'$startIPAddress',
            'endIpAddress':'$endIPAddress'
            }
        }"

    $headers = @{Authorization = ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token) }

    Invoke-RestMethod -Uri $uri -Method PUT -Headers $headers -Body $body -ContentType $script:jsonContentType
}

function Remove-LegacyAzureSqlServerFirewall {
    [CmdletBinding()]
    param([Object] [Parameter(Mandatory = $true)] $endpoint,
        [String] [Parameter(Mandatory = $true)] $serverName,
        [String] [Parameter(Mandatory = $true)] $firewallRuleName)

    $subscriptionId = $endpoint.Data.SubscriptionId.ToLower()
    $azureUri = Get-AzureUri $endpoint
    $uri = "$azureUri/$subscriptionId/services/sqlservers/servers/$serverName/firewallrules/$firewallRuleName"

    $headers = @{"x-ms-version" = $apiVersion }

    # Get Certificate or PS Credential & Call Invoke
    if ($endpoint.Auth.Scheme -eq $certificateConnection) {
        $certificate = Get-Certificate $endpoint
        Invoke-RestMethod -Uri $uri -Method Delete -Headers $headers -Certificate $certificate
    }
    else {
        $accessToken = Get-UsernamePasswordAccessToken $endpoint
        $headers.Add("Authorization", ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token))

        Invoke-RestMethod -Uri $uri -Method Delete -Headers $headers
    }
}

function Remove-AzureRmSqlServerFirewall {
    [CmdletBinding()]
    param([Object] [Parameter(Mandatory = $true)] $endpoint,
        [String] [Parameter(Mandatory = $true)] $serverName,
        [String] [Parameter(Mandatory = $true)] $firewallRuleName)

    $accessToken = Get-AzureRMAccessToken $endpoint

    # Fetch Azure SQL server resource Id
    $azureResourceId = Get-AzureSqlDatabaseServerResourceId -endpoint $endpoint -serverName $serverName -accessToken $accessToken

    $uri = "$($endpoint.Url)/$azureResourceId/firewallRules/$firewallRuleName\?api-version=$apiVersion"
    $headers = @{Authorization = ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token) }

    Invoke-RestMethod -Uri $uri -Method Delete -Headers $headers

}

function Add-AzureSqlDatabaseServerFirewallRule {
    [CmdletBinding()]
    param([Object] [Parameter(Mandatory = $true)] $endpoint,
        [String] [Parameter(Mandatory = $true)] $startIPAddress,
        [String] [Parameter(Mandatory = $true)] $endIPAddress,
        [String] [Parameter(Mandatory = $true)] $serverName,
        [String] [Parameter(Mandatory = $true)] $firewallRuleName)
    
    Trace-VstsEnteringInvocation $MyInvocation

    try {
        Write-Verbose "Creating firewall rule $firewallRuleName"

        $connectionType = Get-ConnectionType -serviceEndpoint $endpoint

        if (IsLegacyAzureConnection $connectionType) {
            Add-LegacyAzureSqlServerFirewall -endpoint $endpoint -serverName $serverName -startIPAddress $startIPAddress -endIPAddress $endIPAddress -firewallRuleName $firewallRuleName
        }
        elseif (IsAzureRmConnection $connectionType) {

            Add-AzureRmSqlServerFirewall -endpoint $endpoint -serverName $serverName -startIPAddress $startIPAddress -endIPAddress $endIPAddress -firewallRuleName $firewallRuleName
        }
        else {
            throw (Get-VstsLocString -Key AZ_UnsupportedAuthScheme0 -ArgumentList $connectionType)
        }

        Write-Verbose "Firewall rule $firewallRuleName created"
    }
    catch {
        $parsedException = Parse-Exception($_.Exception)
        if ($parsedException) {
            throw  $parsedException
        }
        throw $_.Exception.ToString()
    }
}

function Remove-AzureSqlDatabaseServerFirewallRule {
    [CmdletBinding()]
    param([Object] [Parameter(Mandatory = $true)] $endpoint,
        [String] [Parameter(Mandatory = $true)] $serverName,
        [String] [Parameter(Mandatory = $true)] $firewallRuleName)

    Trace-VstsEnteringInvocation $MyInvocation

    try {
        Write-Verbose "Removing firewall rule $firewallRuleName on azure database server: $serverName"

        $connectionType = Get-ConnectionType -serviceEndpoint $endpoint

        if (IsLegacyAzureConnection $connectionType) {
            Remove-LegacyAzureSqlServerFirewall -endpoint $endpoint -serverName $serverName -firewallRuleName $firewallRuleName
        }
        elseif (IsAzureRmConnection $connectionType) {
            Remove-AzureRmSqlServerFirewall -endpoint $endpoint -serverName $serverName -firewallRuleName $firewallRuleName
        }
        else {
            throw (Get-VstsLocString -Key AZ_UnsupportedAuthScheme0 -ArgumentList $connectionType)
        }

        Write-Verbose "Removed firewall rule $firewallRuleName on azure database server: $serverName"
    }
    catch {
        $parsedException = Parse-Exception($_.Exception)
        if ($parsedException) {
            throw  $parsedException
        }
        throw $_.Exception.ToString()
    }
}

function Parse-Exception($exception) {
    if ($exception) {
        try {
            Write-Verbose "Exception message - $($exception.ToString())"
            $response = $exception.Response
            if ($response) {
                $responseStream = $response.GetResponseStream()
                $streamReader = New-Object System.IO.StreamReader($responseStream)
                $streamReader.BaseStream.Position = 0
                $streamReader.DiscardBufferedData()
                $responseBody = $streamReader.ReadToEnd()
                $streamReader.Close()
                Write-Verbose "Exception message extracted from response $responseBody"
                $exceptionMessage = "";
                try {
                    if ($responseBody) {
                        $exceptionJson = $responseBody | ConvertFrom-Json

                        $exceptionError = $exceptionJson.error
                        if ($exceptionError) {
                            $exceptionMessage = $exceptionError.Message
                            $exceptionCode = $exceptionError.code
                        }
                        else {
                            $exceptionMessage = $exceptionJson.Message
                            $exceptionCode = $exceptionJson.code
                        }

                        if ($exceptionCode) {
                            Write-VstsTaskError -ErrCode $exceptionCode
                        }
                    }
                }
                catch {
                    $exceptionMessage = $responseBody
                }
                if ($response.statusCode -eq 404 -or (-not $exceptionMessage)) {
                    $exceptionMessage += " Please verify request URL : $($response.ResponseUri)" 
                }
                return $exceptionMessage
            }
        } 
        catch {
            Write-verbose "Unable to parse exception: " + $_.Exception.ToString()
        }
    }
    return $null
}

function Get-AzureNetworkInterfaceDetails {
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $resourceGroupName,
        [Object] [Parameter(Mandatory = $true)] $endpoint)

    $accessToken = Get-AzureRMAccessToken $endpoint
    $subscriptionId = $endpoint.Data.SubscriptionId.ToLower()

    Write-Verbose "[Azure Rest Call] Get Network Interface Details"
    
    $method = "GET"
    $uri = "$($endpoint.Url)/subscriptions/$subscriptionId/resourceGroups/$resourceGroupName/providers/Microsoft.Network/networkInterfaces?api-version=$azureStackapiVersion"
    $headers = @{Authorization = ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token) }

    $networkInterfaceDetails = Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -ContentType $script:jsonContentType
    
    if (-not $networkInterfaceDetails) {
        throw (Get-VstsLocString -Key AZ_UnableToFetchNetworkInterfacesDetails)
    }

    if ($networkInterfaceDetails.value) {
        return $networkInterfaceDetails.value | ForEach-Object { Add-PropertiesToRoot -rootObject $_ }
    }
    
    return $networkInterfaceDetails.value
}

function Get-AzurePublicIpAddressDetails {
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $resourceGroupName,
        [Object] [Parameter(Mandatory = $true)] $endpoint)

    $accessToken = Get-AzureRMAccessToken $endpoint
    $subscriptionId = $endpoint.Data.SubscriptionId.ToLower()

    Write-Verbose "[Azure Rest Call] Get Public IP Addresses Details"

    $method = "GET"
    $uri = "$($endpoint.Url)/subscriptions/$subscriptionId/resourceGroups/$resourceGroupName/providers/Microsoft.Network/publicIPAddresses?api-version=$azureStackapiVersion"
    $headers = @{Authorization = ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token) }

    $publicIPAddressesDetails = Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -ContentType $script:jsonContentType

    if (-not $publicIPAddressesDetails) {
        throw (Get-VstsLocString -Key AZ_UnableToFetchPublicIPAddressesDetails)
    }

    if ($publicIPAddressesDetails.value) {
        return $publicIPAddressesDetails.value | ForEach-Object { Add-PropertiesToRoot -rootObject $_ }
    }

    return $publicIPAddressesDetails.value
}

function Get-AzureLoadBalancersDetails {
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $resourceGroupName,
        [Object] [Parameter(Mandatory = $true)] $endpoint)

    $accessToken = Get-AzureRMAccessToken $endpoint
    $subscriptionId = $endpoint.Data.SubscriptionId.ToLower()

    Write-Verbose "[Azure Rest Call] Get Load Balancers details"

    $method = "GET"
    $uri = "$($endpoint.Url)/subscriptions/$subscriptionId/resourceGroups/$resourceGroupName/providers/Microsoft.Network/loadBalancers?api-version=$azureStackapiVersion"
    $headers = @{Authorization = ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token) }

    $loadBalancersDetails = Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -ContentType $script:jsonContentType

    if (-not $loadBalancersDetails) {
        throw (Get-VstsLocString -Key AZ_UnableToFetchLoadbalancerDetails)
    }

    if ($loadBalancersDetails.value) {
        return $loadBalancersDetails.value | ForEach-Object { Add-PropertiesToRoot -rootObject $_ }
    }

    return $loadBalancersDetails.value
}

function Get-AzureLoadBalancerDetails {
    [CmdletBinding()]
    param([String] [Parameter(Mandatory = $true)] $resourceGroupName,
        [String] [Parameter(Mandatory = $true)] $name,
        [Object] [Parameter(Mandatory = $true)] $endpoint)

    $accessToken = Get-AzureRMAccessToken $endpoint
    $subscriptionId = $endpoint.Data.SubscriptionId.ToLower()
    
    Write-Verbose "[Azure Rest Call] Get Load balancer details with name : $name"

    $method = "GET"
    $uri = "$($endpoint.Url)/subscriptions/$subscriptionId/resourceGroups/$resourceGroupName/providers/Microsoft.Network/loadBalancers/" + $name + "?api-version=$azureStackapiVersion"
    $headers = @{Authorization = ("{0} {1}" -f $accessToken.token_type, $accessToken.access_token) }

    $loadBalancerDetails = Invoke-RestMethod -Uri $uri -Method $method -Headers $headers -ContentType $script:jsonContentType
    
    if ($loadBalancerDetails) {
        return $loadBalancersDetails | ForEach-Object { Add-PropertiesToRoot -rootObject $_ }
    }
    
    return $loadBalancerDetails
}

function Get-AzureRMLoadBalancerFrontendIpConfigDetails {
    [CmdletBinding()]
    param([Object] [Parameter(Mandatory = $true)] $loadBalancer)

    $frontendIPConfigurations = $loadBalancer.frontendIPConfigurations

    if ($frontendIPConfigurations) {
        return Add-PropertiesToRoot -rootObject $frontendIPConfigurations
    }

    return $frontendIPConfigurations
}

function Get-AzureRMLoadBalancerInboundNatRuleConfigDetails {
    [CmdletBinding()]
    param([Object] [Parameter(Mandatory = $true)] $loadBalancer)

    $inboundNatRules = $loadBalancer.inboundNatRules
    
    if ($inboundNatRules) {
        return Add-PropertiesToRoot -rootObject $inboundNatRules
    }

    return $inboundNatRules
}

function Add-PropertiesToRoot {
    [CmdletBinding()]
    param([Object] [Parameter(Mandatory = $true)] $rootObject)

    if ($rootObject -and $rootObject.properties) {
        $rootObject.properties.psObject.Properties | ForEach-Object { $rootObject | Add-Member -MemberType $_.MemberType -Name $_.Name -Value $_.Value -Force }
        $rootObject.psObject.properties.remove("properties");
    }

    return $rootObject
}

function ConvertTo-Pfx {
    param(
        [String][Parameter(Mandatory = $true)] $pemFileContent
    )

    if ($ENV:Agent_TempDirectory) {
        $pemFilePath = "$ENV:Agent_TempDirectory\clientcertificate.pem"
        $pfxFilePath = "$ENV:Agent_TempDirectory\clientcertificate.pfx"
        $pfxPasswordFilePath = "$ENV:Agent_TempDirectory\clientcertificatepassword.txt"
    }
    else {
        $pemFilePath = "$ENV:System_DefaultWorkingDirectory\clientcertificate.pem"
        $pfxFilePath = "$ENV:System_DefaultWorkingDirectory\clientcertificate.pfx"
        $pfxPasswordFilePath = "$ENV:System_DefaultWorkingDirectory\clientcertificatepassword.txt"    
    }

    # save the PEM certificate to a PEM file
    Set-Content -Path $pemFilePath -Value $pemFileContent

    # use openssl to convert the PEM file to a PFX file
    $pfxFilePassword = [System.Guid]::NewGuid().ToString()
    Set-Content -Path $pfxPasswordFilePath -Value $pfxFilePassword -NoNewline

    $openSSLExePath = "$PSScriptRoot\openssl\openssl.exe"
    $openSSLArgs = "pkcs12 -export -in $pemFilePath -out $pfxFilePath -password file:`"$pfxPasswordFilePath`""
     
    Invoke-VstsTool -FileName $openSSLExePath -Arguments $openSSLArgs -RequireExitCodeZero

    return $pfxFilePath, $pfxFilePassword
}

# Export only the public function.
Export-ModuleMember -Function Add-AzureSqlDatabaseServerFirewallRule
Export-ModuleMember -Function Remove-AzureSqlDatabaseServerFirewallRule
Export-ModuleMember -Function Get-AzStorageKeys
Export-ModuleMember -Function Get-AzRMStorageKeys
Export-ModuleMember -Function Get-AzRmVmCustomScriptExtension
Export-ModuleMember -Function Remove-AzRmVmCustomScriptExtension
Export-ModuleMember -Function Get-AzStorageAccount
Export-ModuleMember -Function Get-AzRmStorageAccount
Export-ModuleMember -Function Get-AzRmResourceGroup
Export-ModuleMember -Function Get-AzureNetworkInterfaceDetails
Export-ModuleMember -Function Get-AzurePublicIpAddressDetails
Export-ModuleMember -Function Get-AzureLoadBalancersDetails
Export-ModuleMember -Function Get-AzureLoadBalancerDetails
Export-ModuleMember -Function Get-AzureRMLoadBalancerFrontendIpConfigDetails
Export-ModuleMember -Function Get-AzureRMLoadBalancerInboundNatRuleConfigDetails
Export-ModuleMember -Function Get-AzureRMAccessToken
