$azureSqlServerName = "d2eu50p1fw"
$invalidAzureSqlServerName = "invalidServerName"
$databaseName = "testDb"
$serverUserName = "dummyUser"
$serverPassword = "dummyPassword"
$startIP="167.220.236.2"
$endIP="167.220.236.2"
$outOfRangeIPAddress = "167.220.236.256"

$invalidfirewallRuleName = "invalidFirewallRule"
$certificateFirewallRuleName= "certificateFirewallRuleName"
$credentialsFirewallRuleName = "credentialsFirewallRuleName"
$spnFirewallRuleName = "spnFirewallRuleName"

$certEndpoint=@{}
$usernameEndpoint=@{}
$spnEndpoint=@{}

$certAuth=@{}
$usernameAuth=@{}
$spnAuth=@{}

$certAuth.Scheme='Certificate'
$certEndpoint.Auth =$certAuth

$usernameAuth.Scheme='UserNamePassword'
$usernameEndpoint.Auth =$usernameAuth

$spnEndpoint.Scheme='ServicePrincipal'
$spnEndpoint.Auth =$spnEndpoint

$ipDetectionMethod = "IPAddressRange";

#### Main File Mock Constants ####

$validInputConnectedServiceName = "validConnectedServiceName"
$dacpacFile = "C:\Test\Test.ps1"
$serverName = "a0nuel7r2k.database.windows.net"
$serverFriendlyName = "a0nuel7r2k"
$databaseName = "TestDatabase"
$sqlUsername = "TestUser"
$sqlUsernameWithServerName = "TestUser@a0nuel7r2k.database.windows.net"
$sqlUsernameWithAtSymbol = "TestUser@123"
$sqlPassword = "TestPassword"
$publishProfile = "C:\Test\publish.xml"
$ipDetectionMethodAuto = "AutoDetect"
$ipDetectionMethodRange = "IPAddressRange"
$deleteFirewallRuleTrue = $true
$deleteFirewallRuleFalse = $false
$startIPAddress = "10.10.10.10"
$endIPAddress = "10.10.10.11"

$autoIp = "10.10.10.10"
$sqlPackageArguments = "Test Arguments"
