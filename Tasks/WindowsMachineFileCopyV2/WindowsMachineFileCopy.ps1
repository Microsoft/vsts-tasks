[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation

# Get inputs for the task
$machineNames = Get-VstsInput -Name MachineNames -Require
$adminUserName = Get-VstsInput -Name AdminUserName -Require
$adminPassword = Get-VstsInput -Name AdminPassword -Require
$sourcePath = Get-VstsInput -Name SourcePath -Require
$targetPath = Get-VstsInput -Name TargetPath -Require
$additionalArguments = Get-VstsInput -Name AdditionalArguments
$cleanTargetBeforeCopy = Get-VstsInput -Name CleanTargetBeforeCopy
$copyFilesInParallel = Get-VstsInput -Name CopyFilesInParallel

# Import the loc strings.
Import-VstsLocStrings -LiteralPath $PSScriptRoot/Task.json

. $PSScriptRoot/RoboCopyJob.ps1
. $PSScriptRoot/Utility.ps1

try 
{
    $sourcePath = $sourcePath.Trim('"')
    $targetPath = $targetPath.Trim('"')

    # Normalize admin username
    if($adminUserName -and (-not $adminUserName.StartsWith(".\")) -and ($adminUserName.IndexOf("\") -eq -1) -and ($adminUserName.IndexOf("@") -eq -1))
    {
        $adminUserName = ".\" + $adminUserName 
    }

    $envOperationStatus = 'Passed'

    $uncSourcePath = (New-Object System.Uri -ArgumentList $sourcePath).Host
    $uncTargetPath = (New-Object System.Uri -ArgumentList $targetPath).Host

    # Compare source and target unc root to determine if they're based on the same host.
    # If so, assume we're copying on the same host and disable local-path validation at this point.
    if( $uncSourcePath -and $uncTargetPath -and ($uncSourcePath -eq $uncTargetPath))
    {
        Validate-Remote-Path $sourcePath $machineNames
        Validate-Remote-Path $targetPath $machineNames
    }
    else 
    {
        Validate-Local-Path $sourcePath
        Validate-Remote-Path $targetPath $machineNames
    }

    $machines = $machineNames.split(',') | ForEach-Object { if ($_ -and $_.trim()) { $_.trim() } }

    $secureAdminPassword = ConvertTo-SecureString $adminPassword -AsPlainText -Force
    $machineCredential = New-Object System.Net.NetworkCredential ($adminUserName, $secureAdminPassword)

    if ($machines.Count -eq 0)
    {
        throw (Get-VstsLocString -Key "WFC_NoMachineExistsUnderEnvironment0ForDeployment" -ArgumentList $machineNames)
    }

    if($copyFilesInParallel -eq $false -or  ( $machines.Count -eq 1 ))
    {
        foreach($machine in $machines)
        {

            Write-Output (Get-VstsLocString -Key "WFC_CopyStartedFor0" -ArgumentList $machine)

            Invoke-Command -ScriptBlock $CopyJob -ArgumentList $machine, $sourcePath, $targetPath, $machineCredential, $cleanTargetBeforeCopy, $additionalArguments, $PSScriptRoot
        } 
    }
    else
    {
        [hashtable]$Jobs = @{} 

        foreach($machine in $machines)
        {

            Write-Output (Get-VstsLocString -Key "WFC_CopyStartedFor0" -ArgumentList $machine)

            $job = Start-Job -ScriptBlock $CopyJob -ArgumentList $machine, $sourcePath, $targetPath, $machineCredential, $cleanTargetBeforeCopy, $additionalArguments, $PSScriptRoot

            $Jobs.Add($job.Id, $machine)
        }        

        While ($Jobs.Count -gt 0)
        {
            Start-Sleep 10 
            foreach($job in Get-Job)
            {
                if($Jobs.ContainsKey($job.Id) -and $job.State -ne "Running")
                {
                    Receive-Job -Id $job.Id
                    Remove-Job $Job                 
                    $Jobs.Remove($job.Id)
                } 
            }
        }
    }

}
catch
{
    Write-Verbose $_.Exception.ToString() -Verbose
    throw
}
finally
{
    Trace-VstsLeavingInvocation $MyInvocation
}