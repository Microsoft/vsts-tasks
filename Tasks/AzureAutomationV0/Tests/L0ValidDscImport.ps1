[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

Register-Mock Get-VstsInput { "ConnectedServiceNameARM" } -ParametersEvaluator { $Name -eq "ConnectedServiceName" }
Register-Mock Get-VstsInput { "SurabhiSonali" } -ParametersEvaluator { $Name -eq "ResourceGroupName" }
Register-Mock Get-VstsInput { "SurabhiTrial" } -ParametersEvaluator { $Name -eq "AutomationAccountName" }
Register-Mock Get-VstsInput { "SurabhiTrial" } -ParametersEvaluator { $Name -eq "AutomationAccountName" }
Register-Mock Get-VstsInput { "$(System.DefaultWorkingDirectory)/MyFirstProject/drop/testconfiguration.ps1" } -ParametersEvaluator { $Name -eq "DscConfigurationFile" }
Register-Mock Initialize-Azure

Register-Mock Get-Endpoint { return "ConnectedServiceNameARM" }
Register-Mock Import-AzureRmAutomationDscConfiguration { }

& "$PSScriptRoot\..\DeployToAzureAutomation.ps1"

Assert-WasCalled Import-AzureRmAutomationDscConfiguration -Times 1
