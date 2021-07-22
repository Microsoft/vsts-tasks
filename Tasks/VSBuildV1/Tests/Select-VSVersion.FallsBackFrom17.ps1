[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Select-VSVersion.ps1
Register-Mock Write-Warning
Register-Mock Get-VSPath { "Some resolved location" } -- -Version '16.0'

# Act.
$actual = Select-VSVersion -PreferredVersion '17.0'

# Assert.
Assert-WasCalled Write-Warning
Assert-WasCalled Get-VSPath -Times 2
Assert-AreEqual -Expected '16.0' -Actual $actual
