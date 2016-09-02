[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot/../../lib/Initialize-Test.ps1
$module = Microsoft.PowerShell.Core\Import-Module $PSScriptRoot/../../../Tasks/AzurePowerShell/ps_modules/VstsAzureHelpers_ -PassThru
$variableSets = @(
    # Combinations for only one preference matched:
    @{
        ClassicModulePathResult = $true
        ClassicSdkPathResult = $null
        RMModulePathResult = $false
        RMSdkPathResult = $false
    }
    @{
        ClassicModulePathResult = $false
        ClassicSdkPathResult = $true
        RMModulePathResult = $false
        RMSdkPathResult = $false
    }
    @{
        ClassicModulePathResult = $false
        ClassicSdkPathResult = $false
        RMModulePathResult = $true
        RMSdkPathResult = $null
    }
    @{
        ClassicModulePathResult = $false
        ClassicSdkPathResult = $false
        RMModulePathResult = $false
        RMSdkPathResult = $true
    }
    # Combinations for both preferences matched:
    @{
        ClassicModulePathResult = $true
        ClassicSdkPathResult = $null
        RMModulePathResult = $true
        RMSdkPathResult = $null
    }
    @{
        ClassicModulePathResult = $true
        ClassicSdkPathResult = $null
        RMModulePathResult = $false
        RMSdkPathResult = $true
    }
    @{
        ClassicModulePathResult = $false
        ClassicSdkPathResult = $true
        RMModulePathResult = $true
        RMSdkPathResult = $null
    }
    @{
        ClassicModulePathResult = $false
        ClassicSdkPathResult = $true
        RMModulePathResult = $false
        RMSdkPathResult = $true
    }
)
foreach ($variableSet in $variableSets) {
    Write-Verbose ('-' * 80)
    Unregister-Mock Import-FromModulePath
    Unregister-Mock Import-FromSdkPath
    Register-Mock Import-FromModulePath
    Register-Mock Import-FromSdkPath
    if ($variableSet.RMModulePathResult -ne $null) {
        Register-Mock Import-FromModulePath { $variableSet.RMModulePathResult } -- -Classic: $false
    }

    if ($variableSet.RMSdkPathResult -ne $null) {
        Register-Mock Import-FromSdkPath { $variableSet.RMSdkPathResult } -- -Classic: $false
    }

    if ($variableSet.ClassicModulePathResult -ne $null) {
        Register-Mock Import-FromModulePath { $variableSet.ClassicModulePathResult } -- -Classic: $true
    }

    if ($variableSet.ClassicSdkPathResult -ne $null) {
        Register-Mock Import-FromSdkPath { $variableSet.ClassicSdkPathResult } -- -Classic: $true
    }

    # Act.
    & $module Import-AzureModule -PreferredModule 'Azure', 'AzureRM'

    # Assert.
    Assert-WasCalled Import-FromModulePath -Times $(if ($variableSet.RMModulePathResult -eq $null) { 0 } else { 1 }) -- -Classic: $false
    Assert-WasCalled Import-FromSdkPath -Times $(if ($variableSet.RMSdkPathResult -eq $null) { 0 } else { 1 }) -- -Classic: $false
    Assert-WasCalled Import-FromModulePath -Times $(if ($variableSet.ClassicModulePathResult -eq $null) { 0 } else { 1 }) -- -Classic: $true
    Assert-WasCalled Import-FromSdkPath -Times $(if ($variableSet.ClassicSdkPathResult -eq $null) { 0 } else { 1 }) -- -Classic: $true
}
