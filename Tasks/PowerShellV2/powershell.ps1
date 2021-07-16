[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
try {
    Import-VstsLocStrings "$PSScriptRoot\task.json"

    # Get inputs.
    $input_errorActionPreference = Get-VstsInput -Name 'errorActionPreference' -Default 'Stop'
    switch ($input_errorActionPreference.ToUpperInvariant()) {
        'STOP' { }
        'CONTINUE' { }
        'SILENTLYCONTINUE' { }
        default {
            Write-Error (Get-VstsLocString -Key 'PS_InvalidErrorActionPreference' -ArgumentList $input_errorActionPreference)
        }
    }
    $input_showWarnings = Get-VstsInput -Name 'showWarnings' -AsBool
    $input_failOnStderr = Get-VstsInput -Name 'failOnStderr' -AsBool
    $input_ignoreLASTEXITCODE = Get-VstsInput -Name 'ignoreLASTEXITCODE' -AsBool
    $input_pwsh = Get-VstsInput -Name 'pwsh' -AsBool
    $input_workingDirectory = Get-VstsInput -Name 'workingDirectory' -Require
    Assert-VstsPath -LiteralPath $input_workingDirectory -PathType 'Container'
    $input_targetType = Get-VstsInput -Name 'targetType'
    if ("$input_targetType".ToUpperInvariant() -eq "FILEPATH") {
        $input_filePath = Get-VstsInput -Name 'filePath' -Require
        try {
            Assert-VstsPath -LiteralPath $input_filePath -PathType Leaf
        }
        catch {
            Write-Error (Get-VstsLocString -Key 'PS_InvalidFilePath' -ArgumentList $input_filePath)
        }

        if (!$input_filePath.ToUpperInvariant().EndsWith('.PS1')) {
            Write-Error (Get-VstsLocString -Key 'PS_InvalidFilePath' -ArgumentList $input_filePath)
        }

        $input_arguments = Get-VstsInput -Name 'arguments'
    }
    elseif("$input_targetType".ToUpperInvariant() -eq "INLINE") {
        $input_script = Get-VstsInput -Name 'script'
    }
    else {
        Write-Error (Get-VstsLocString -Key 'PS_InvalidTargetType' -ArgumentList $input_targetType)
    }
    $input_runScriptInSeparateScope = Get-VstsInput -Name 'runScriptInSeparateScope' -AsBool

    # Generate the script contents.
    Write-Host (Get-VstsLocString -Key 'GeneratingScript')
    $contents = @()
    $contents += "`$ErrorActionPreference = '$input_errorActionPreference'"
    # Change default error view to normal view. We need this for error handling since we pipe stdout and stderr to the same stream
    # and we rely on PowerShell piping back NormalView error records (required because PowerShell Core changed the default to ConciseView)
    $contents += "`$ErrorView = 'NormalView'"
    if ("$input_targetType".ToUpperInvariant() -eq 'FILEPATH') {
        $contents += ". '$("$input_filePath".Replace("'", "''"))' $input_arguments".Trim()
        Write-Host (Get-VstsLocString -Key 'PS_FormattedCommand' -ArgumentList ($contents[-1]))
    }
    else {
        $contents += "$input_script".Replace("`r`n", "`n").Replace("`n", "`r`n")
    }

    if (!$input_ignoreLASTEXITCODE) {
        $contents += 'if (!(Test-Path -LiteralPath variable:\LASTEXITCODE)) {'
        $contents += '    Write-Host ''##vso[task.debug]$LASTEXITCODE is not set.'''
        $contents += '} else {'
        $contents += '    Write-Host (''##vso[task.debug]$LASTEXITCODE: {0}'' -f $LASTEXITCODE)'
        $contents += '    exit $LASTEXITCODE'
        $contents += '}'
    }

    $joinedContents = [System.String]::Join(
        ([System.Environment]::NewLine),
        $contents);
    if ($input_showWarnings) {
        $joinedContents = '
            $warnings = New-Object System.Collections.ObjectModel.ObservableCollection[System.Management.Automation.WarningRecord];
            Register-ObjectEvent -InputObject $warnings -EventName CollectionChanged -Action {
                if($Event.SourceEventArgs.Action -like "Add"){
                    $Event.SourceEventArgs.NewItems | ForEach-Object {
                        Write-Host "##vso[task.logissue type=warning;]$_";
                    }
                }
            };
            Invoke-Command {' + $joinedContents + '} -WarningVariable +warnings';
    }

    # Write the script to disk.
    Assert-VstsAgent -Minimum '2.115.0'
    $tempDirectory = Get-VstsTaskVariable -Name 'agent.tempDirectory' -Require
    Assert-VstsPath -LiteralPath $tempDirectory -PathType 'Container'
    $filePath = [System.IO.Path]::Combine($tempDirectory, "$([System.Guid]::NewGuid()).ps1")
    $null = [System.IO.File]::WriteAllText(
        $filePath,
        $joinedContents,
        ([System.Text.Encoding]::UTF8))

    # Prepare the external command values.
    #
    # Note, use "-Command" instead of "-File". On PowerShell v4 and V3 when using "-File", terminating
    # errors do not cause a non-zero exit code.
    if ($input_pwsh) {
        $powershellPath = Get-Command -Name pwsh.exe -CommandType Application | Select-Object -First 1 -ExpandProperty Path
    }
    else {
        $powershellPath = Get-Command -Name powershell.exe -CommandType Application | Select-Object -First 1 -ExpandProperty Path
    }
    $executionOperator;
    if ($input_runScriptInSeparateScope) {
        $executionOperator = '&'; 
    } else {
        $executionOperator = '.';
    }
    Assert-VstsPath -LiteralPath $powershellPath -PathType 'Leaf'
    $arguments = "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command `"$executionOperator '$($filePath.Replace("'", "''"))'`""
    $splat = @{
        'FileName'         = $powershellPath
        'Arguments'        = $arguments
        'WorkingDirectory' = $input_workingDirectory
    }

    # Switch to "Continue".
    $global:ErrorActionPreference = 'Continue'
    $failed = $false

    # Run the script.
    Write-Host '========================== Starting Command Output ==========================='
    if (!$input_failOnStderr) {
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
            }
            else {
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

    # Fail on $LASTEXITCODE
    if (!(Test-Path -LiteralPath 'variable:\LASTEXITCODE')) {
        $failed = $true
        Write-Verbose "Unable to determine exit code"
        Write-VstsTaskError -Message (Get-VstsLocString -Key 'PS_UnableToDetermineExitCode')
    }
    else {
        if ($LASTEXITCODE -ne 0) {
            $failed = $true
            Write-VstsTaskError -Message (Get-VstsLocString -Key 'PS_ExitCode' -ArgumentList $LASTEXITCODE)
        }
    }

    # Fail if any errors.
    if ($failed) {
        Write-VstsSetResult -Result 'Failed' -Message "Error detected" -DoNotThrow
    }
}
finally {
    Trace-VstsLeavingInvocation $MyInvocation
}
