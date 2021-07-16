function ThrowError
{
    param([string]$errorMessage)
  
        throw "$errorMessage"
}

function Validate-Null(
    [string]$value,
    [string]$variableName
    )
{
    $value = $value.Trim()
    if(-not $value)
    {
        ThrowError -errorMessage (Get-VstsLocString -Key "WFC_ParameterCannotBeNullorEmpty" -ArgumentList $variableName)
    }
}

function Validate-Local-Path(
    [string]$value
    )
{
    Validate-Null -value $value -variableName "sourcePath"

    if(-not (Test-Path -LiteralPath $value))
    {
        ThrowError -errorMessage (Get-VstsLocString -Key "WFC_SourcePathDoesNotExist" -ArgumentList $value)
    }
}

function Validate-Remote-Path(
    [string]$value,
    [string]$environmentName
    )
{
    Validate-Null -value $value -variableName "targetPath"

    if($environmentName -and $value.StartsWith("`$env:"))
    {
        ThrowError -errorMessage (Get-VstsLocString -Key "WFC_RemoteDestinationPathCannotContainEnvironmentVariables" -ArgumentList $value)
    }
}
# $sourcePath, $targetPath, $credential, $cleanTargetBeforeCopy, $additionalArguments
# $adminUserName, $adminPassword
function Copy-OnLocalMachine(
    [string] $sourcePath,
    [string] $targetPath,
    [string] $adminUserName,
    [string] $adminPassword,
    [string] $cleanTargetBeforeCopy,
    [string] $additionalArguments
    )
{
    $credential = New-Object 'System.Net.NetworkCredential' -ArgumentList $adminUserName, $adminPassword
    Invoke-Command -ScriptBlock $CopyJob -ArgumentList "", $sourcePath, $targetPath, $credential, $cleanTargetBeforeCopy, $additionalArguments
}

function Try-CleanupPSDrive (
	[string] $path
	)
{
	try {
		Write-Verbose "[command] cmd.exe /c net use /delete `"$path`" `"2>NUL`""
		cmd.exe /c net use /delete "$path" "2>NUL"
	}
	catch {
		#Ignore the error if any
		Write-Verbose "Unable to remove path: $path. Ignoring error message: $($_.Exception.Message)"
	}
}