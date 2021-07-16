Trace-VstsEnteringInvocation $MyInvocation
Import-VstsLocStrings "$PSScriptRoot\Task.json"

# Get inputs.
$scriptType = Get-VstsInput -Name ScriptType -Require
$scriptPath = Get-VstsInput -Name ScriptPath
$scriptInline = Get-VstsInput -Name Inline
$scriptArguments = Get-VstsInput -Name ScriptArguments
$__vsts_input_errorActionPreference = Get-VstsInput -Name errorActionPreference
$__vsts_input_failOnStandardError = Get-VstsInput -Name FailOnStandardError -AsBool
$targetAzurePs = Get-VstsInput -Name TargetAzurePs
$customTargetAzurePs = Get-VstsInput -Name CustomTargetAzurePs
$input_pwsh = Get-VstsInput -Name pwsh -AsBool
$input_workingDirectory = Get-VstsInput -Name workingDirectory -Require
$restrictContext = Get-VstsInput -Name RestrictContextToCurrentTask -AsBool

Write-Host "## Validating Inputs"
# Validate the script path and args do not contains new-lines. Otherwise, it will
# break invoking the script via Invoke-Expression.
if ($scriptType -eq "FilePath") {
    if ($scriptPath -match '[\r\n]' -or [string]::IsNullOrWhitespace($scriptPath)) {
        throw (Get-VstsLocString -Key InvalidScriptPath0 -ArgumentList $scriptPath)
    }
}

# Convert all places where there are new line feed characters to allow for multi-lined argument list
#   in the formart that powershell does support
$scriptArguments = $scriptArguments -replace '`[\r\n]+',''

if ($scriptArguments -match '[\r\n]') {
    throw (Get-VstsLocString -Key InvalidScriptArguments0 -ArgumentList $scriptArguments)
}

# string constants
$otherVersion = "OtherVersion"
$latestVersion = "LatestVersion"

if ($targetAzurePs -eq $otherVersion) {
    if ($customTargetAzurePs -eq $null) {
        throw (Get-VstsLocString -Key InvalidAzurePsVersion $customTargetAzurePs)
    } else {
        $targetAzurePs = $customTargetAzurePs.Trim()
    }
}

$pattern = "^[0-9]+\.[0-9]+\.[0-9]+$"
$regex = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList $pattern

if ($targetAzurePs -eq $latestVersion) {
    $targetAzurePs = ""
} elseif (-not($regex.IsMatch($targetAzurePs))) {
    throw (Get-VstsLocString -Key InvalidAzurePsVersion -ArgumentList $targetAzurePs)
}
Write-Host "## Validating Inputs Complete" 

. $PSScriptRoot\TryMakingModuleAvailable.ps1 -targetVersion "$targetAzurePs" -platform Windows

Write-Host "## Initializing Az module"
. "$PSScriptRoot\Utility.ps1"

$serviceName = Get-VstsInput -Name ConnectedServiceNameARM -Require
$endpoint = Get-VstsEndpoint -Name $serviceName -Require
CleanUp-PSModulePathForHostedAgent
Update-PSModulePathForHostedAgent -targetAzurePs $targetAzurePs

# troubleshoot link
$troubleshoot = "https://aka.ms/azurepowershelltroubleshooting"
try 
{
    # Initialize Azure.
    Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
    Initialize-AzModule -Endpoint $endpoint -azVersion $targetAzurePs
    Write-Host "## Az module initialization Complete"
    $success = $true
}
finally {
    if (!$success) {
        Write-VstsTaskError "Initializing Az module failed: For troubleshooting, refer: $troubleshoot"
    }
}

Write-Host "## Beginning Script Execution"
try {
    if ($input_pwsh)
    {
            # Generate the script contents.
        Write-Host (Get-VstsLocString -Key 'GeneratingScript')
        $UpdatePSModulePathArgument = $null;
        if ($targetAzurePs)
        {
            $UpdatePSModulePathArgument = "-targetAzurePs $targetAzurePs"
        }

        $contents = @()
        $contents += "`$ErrorActionPreference = '$__vsts_input_errorActionPreference'"
        if ($env:system_debug -eq "true") {
            $contents += "`$VerbosePreference = 'continue'"
        }

        $contents += ". $PSScriptRoot\UpdatePSModulePath.ps1 $UpdatePSModulePathArgument"
        if ($scriptType -eq "InlineScript") {
            $contents += "$scriptInline".Replace("`r`n", "`n").Replace("`n", "`r`n")
        } else {
            $contents += ". '$("$scriptPath".Replace("'", "''"))' $scriptArguments".Trim()
        }

        # Write the script to disk.
        $__vstsAzPSScriptPath = [System.IO.Path]::Combine($env:Agent_TempDirectory, ([guid]::NewGuid().ToString() + ".ps1"));
        $joinedContents = [System.String]::Join(
            ([System.Environment]::NewLine),
            $contents)
        $null = [System.IO.File]::WriteAllText(
            $__vstsAzPSScriptPath,
            $joinedContents,
            ([System.Text.Encoding]::UTF8))

        # Prepare the external command values.
        #
        # Note, use "-Command" instead of "-File". On PowerShell v4 and V3 when using "-File", terminating
        # errors do not cause a non-zero exit code.
        if ($input_pwsh) {
            $powershellPath = Get-Command -Name pwsh.exe -CommandType Application | Select-Object -First 1 -ExpandProperty Path
        } else {
            $powershellPath = Get-Command -Name powershell.exe -CommandType Application | Select-Object -First 1 -ExpandProperty Path
        }
        Assert-VstsPath -LiteralPath $powershellPath -PathType 'Leaf'
        $arguments = "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command `". '$($__vstsAzPSScriptPath.Replace("'", "''"))'`""
        $splat = @{
            'FileName' = $powershellPath
            'Arguments' = $arguments
            'WorkingDirectory' = $input_workingDirectory
        }

        # Switch to "Continue".
        $global:ErrorActionPreference = 'Continue'
        $failed = $false

        # Run the script.
        Write-Host '========================== Starting Command Output ==========================='
        if (!$__vsts_input_failOnStandardError) {
            Invoke-VstsTool @splat
        }
        else {
            $inError = $false
            $errorLines = New-Object System.Text.StringBuilder
            Invoke-VstsTool @splat 2>&1 |
                ForEach-Object {
                    if ($_ -is [System.Management.Automation.ErrorRecord]) {
                        # Buffer the error lines.
                        $failed = $true
                        $inError = $true
                        $null = $errorLines.AppendLine("$($_.Exception.Message)")

                        # Write to verbose to mitigate if the process hangs.
                        Write-Verbose "STDERR: $($_.Exception.Message)"
                    } else {
                        # Flush the error buffer.
                        if ($inError) {
                            $inError = $false
                            $message = $errorLines.ToString().Trim()
                            $null = $errorLines.Clear()
                            if ($message) {
                                Write-VstsTaskError -Message $message
                            }
                        }

                        Write-Host "$_"
                    }
                }

            # Flush the error buffer one last time.
            if ($inError) {
                $inError = $false
                $message = $errorLines.ToString().Trim()
                $null = $errorLines.Clear()
                if ($message) {
                    Write-VstsTaskError -Message $message
                }
            }
        }

        # Fail if any errors.
        if ($failed) {
            Write-VstsSetResult -Result 'Failed' -Message "Error detected" -DoNotThrow
        } 
    }
    else
    {
                # Trace the expression as it will be invoked.
        $__vstsAzPSInlineScriptPath = $null
        If ($scriptType -eq "InlineScript") {
            $scriptArguments = $null
            $__vstsAzPSInlineScriptPath = [System.IO.Path]::Combine($env:Agent_TempDirectory, ([guid]::NewGuid().ToString() + ".ps1"));
            ($scriptInline | Out-File $__vstsAzPSInlineScriptPath)
            $scriptPath = $__vstsAzPSInlineScriptPath
        }

        $scriptCommand = "& '$($scriptPath.Replace("'", "''"))' $scriptArguments"
        Remove-Variable -Name scriptType
        Remove-Variable -Name scriptPath
        Remove-Variable -Name scriptInline
        Remove-Variable -Name scriptArguments

        # Remove all commands imported from VstsTaskSdk, other than Out-Default.
        # Remove all commands imported from VstsAzureHelpers_.
        Get-ChildItem -LiteralPath function: |
            Where-Object {
                ($_.ModuleName -eq 'VstsTaskSdk' -and $_.Name -ne 'Out-Default') -or
                ($_.Name -eq 'Invoke-VstsTaskScript') -or
                ($_.ModuleName -eq 'VstsAzureHelpers_' )
            } |
            Remove-Item

        # For compatibility with the legacy handler implementation, set the error action
        # preference to continue. An implication of changing the preference to Continue,
        # is that Invoke-VstsTaskScript will no longer handle setting the result to failed.
        $global:ErrorActionPreference = 'Continue'

        # Undocumented VstsTaskSdk variable so Verbose/Debug isn't converted to ##vso[task.debug].
        # Otherwise any content the ad-hoc script writes to the verbose pipeline gets dropped by
        # the agent when System.Debug is not set.
        $global:__vstsNoOverrideVerbose = $true

        # Run the user's script. Redirect the error pipeline to the output pipeline to enable
        # a couple goals due to compatibility with the legacy handler implementation:
        # 1) STDERR from external commands needs to be converted into error records. Piping
        #    the redirected error output to an intermediate command before it is piped to
        #    Out-Default will implicitly perform the conversion.
        # 2) The task result needs to be set to failed if an error record is encountered.
        #    As mentioned above, the requirement to handle this is an implication of changing
        #    the error action preference.
        ([scriptblock]::Create($scriptCommand)) | 
            ForEach-Object {
                Remove-Variable -Name scriptCommand
                Write-Host "##[command]$_"
                . $_ 2>&1
            } | 
            ForEach-Object {
                if($_ -is [System.Management.Automation.ErrorRecord]) {
                    if($_.FullyQualifiedErrorId -eq "NativeCommandError" -or $_.FullyQualifiedErrorId -eq "NativeCommandErrorMessage") {
                        ,$_
                        if($__vsts_input_failOnStandardError -eq $true) {
                            "##vso[task.complete result=Failed]"
                        }
                    }
                    else {
                        if($__vsts_input_errorActionPreference -eq "continue") {
                            ,$_
                            if($__vsts_input_failOnStandardError -eq $true) {
                                "##vso[task.complete result=Failed]"
                            }
                        }
                        elseif($__vsts_input_errorActionPreference -eq "stop") {
                            throw $_
                        }
                    }
                } else {
                    ,$_
                }
            }
    }
 
}
finally {
    if ($__vstsAzPSInlineScriptPath -and (Test-Path -LiteralPath $__vstsAzPSInlineScriptPath) ) {
        Remove-Item -LiteralPath $__vstsAzPSInlineScriptPath -ErrorAction 'SilentlyContinue'
    }

    Import-Module $PSScriptRoot\ps_modules\VstsAzureHelpers_
    Remove-EndpointSecrets
    Disconnect-AzureAndClearContext -restrictContext $restrictContext -ErrorAction SilentlyContinue
}
Write-Host "## Script Execution Complete"
