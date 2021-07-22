[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\Select-VSVersion.ps1
$preferredVersions = '', 'latest'
$knownVersions = '10.0', '11.0', '12.0', '14.0', '15.0', '16.0', '17.0' # Registered in ascending order to validate latest is searched first.
foreach ($preferredVersion in $preferredVersions) {
    Unregister-Mock Get-VSPath
    foreach ($knownVersion in $knownVersions) {
        Register-Mock Get-VSPath { "Some location" } -- -Version $knownVersion

        # Act.
        $actual = Select-VSVersion -PreferredVersion $preferredVersion

        # Assert.
        Assert-AreEqual $knownVersion $actual
    }
}
