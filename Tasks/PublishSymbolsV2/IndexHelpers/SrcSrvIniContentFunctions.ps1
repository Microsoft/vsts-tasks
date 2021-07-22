function New-SrcSrvIniContent {
    [CmdletBinding()]
    param($Provider, $SourceFilePaths)

    Trace-VstsEnteringInvocation $MyInvocation -Parameter @( )
    try {
        switch ($Provider.Name) {
            'TfsGit' {
                $srcSrvIniContent = New-TfsGitSrcSrvIniContent -Provider $Provider -SourceFilePaths $SourceFilePaths
                break
            }
            'TfsVersionControl' {
                $srcSrvIniContent = New-TfvcSrcSrvIniContent -Provider $Provider -SourceFilePaths $SourceFilePaths
                break
            }
            default {
                throw 'Not supported.' # Execution should never reach here.
            }
        }

        # For consistency with previous implementation, append a blank line so that the content
        # gets written with a trailing new-line.
        [string[]]$srcSrvIniContent = @($srcSrvIniContent) + ''
        [string]::Join([System.Environment]::NewLine, $srcSrvIniContent)
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function New-TfsGitSrcSrvIniContent {
    [CmdletBinding()]
    param(
        [ValidateNotNull()]
        $Provider,
        
        [ValidateNotNullOrEmpty()]
        [string[]]$SourceFilePaths)

    Trace-VstsEnteringInvocation $MyInvocation -Parameter @( )
    try {
        # For more information, see:
        # https://msdn.microsoft.com/en-us/library/windows/hardware/ff558876(v=vs.85).aspx
        # https://msdn.microsoft.com/en-us/library/windows/desktop/ms680641(v=vs.85).aspx
        # http://www.codeproject.com/Articles/115125/Source-Indexing-and-Symbol-Servers-A-Guide-to-Easi
        'SRCSRV: ini ------------------------------------------------'
        'VERSION=3'
        'INDEXVERSION=2'
        'VERCTRL=Team Foundation Server'
        [string]::Format(
            [System.Globalization.CultureInfo]::InvariantCulture,
            'DATETIME={0:ddd MMM dd HH:mm:ss yyyy}',
            (Get-Date))
        'INDEXER=TFSTB'
        'SRCSRV: variables ------------------------------------------'
        # Assigning values to variables in the variables section - e.g. the variable
        # TFS_COLLECTION - allows for the variable to be overridden at debugging time.
        # For example, if the source code moves to a different collection URL altogether,
        # then at debugging time the TFS_COLLECTION variable can be overridden.
        #
        # Use the short commit hash in the target file path to alleviate max path issues.
        "TFS_EXTRACT_TARGET=%targ%\%var5%\%fnvar%(%var6%)%fnbksl%(%var7%)"
        # The "commitId" arg requires the full commit ID.
        #
        # The /applyfilters switch indicates whether to convert LF to CRLF. The source file hashes are
        # embedded in the PDB files and the debugger will reject the source file as a match if the
        # downloaded file's hash doesn't match the hash embedded in the PDB file. We make the assumption
        # the PDB was built from a source file with CRLFs. In some edge case were this is not true, the
        # variable TFS_APPLY_FILTERS can be overridden at debugging time.
        "TFS_EXTRACT_CMD=tf.exe git view /collection:%fnvar%(%var2%) /teamproject:""%fnvar%(%var3%)"" /repository:""%fnvar%(%var4%)"" /commitId:%fnvar%(%var5%) /path:""%var7%"" /output:%SRCSRVTRG% %fnvar%(%var8%)"
        "TFS_COLLECTION=$($provider.CollectionUrl)"
        "TFS_TEAM_PROJECT=$($provider.TeamProjectId)"
        "TFS_REPO=$($provider.RepoId)"
        "TFS_COMMIT=$($provider.CommitId)"
        "TFS_SHORT_COMMIT=$($provider.CommitId.Substring(0, 8))" # Take the first 8 chars only.
        "TFS_APPLY_FILTERS=/applyfilters"
        'SRCSRVVERCTRL=git'
        'SRCSRVERRDESC=access'
        'SRCSRVERRVAR=var2'
        'SRCSRVTRG=%TFS_EXTRACT_TARGET%'
        'SRCSRVCMD=%TFS_EXTRACT_CMD%'
        'SRCSRV: source files ---------------------------------------'
        # Make the sources root path end with a trailing slash.
        $sourcesRootPath = $provider.SourcesRootPath.TrimEnd('\')
        $sourcesRootPath = "$sourcesRootPath\"
        $isMultiRepoCheckout = !(Test-Path "${sourcesRootPath}.git")
        foreach ($sourceFilePath in $SourceFilePaths) {
            [string]$relativeSourceFilePath = $sourceFilePath.Substring($sourcesRootPath.Length)
            if ($isMultiRepoCheckout) {
                $i = $relativeSourceFilePath.IndexOf('\')
                if ($i -gt 0) {
                    $repoName = $relativeSourceFilePath.Substring(0, $i)
                    if (Test-Path "${sourcesRootPath}$repoName\.git") {
                        $relativeSourceFilePath = $relativeSourceFilePath.Substring($i + 1)
                    }
                }
            }
            $relativeSourceFilePath = $relativeSourceFilePath.Replace('\', '/')
            $relativeSourceFilePath = "/$relativeSourceFilePath"
            "$sourceFilePath*TFS_COLLECTION*TFS_TEAM_PROJECT*TFS_REPO*TFS_COMMIT*TFS_SHORT_COMMIT*$relativeSourceFilePath*TFS_APPLY_FILTERS"
        }

        'SRCSRV: end ------------------------------------------------'
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function New-TfvcSrcSrvIniContent {
    [CmdletBinding()]
    param(
        [ValidateNotNull()]
        $Provider,
        
        [ValidateNotNullOrEmpty()]
        [string[]]$SourceFilePaths)

    Trace-VstsEnteringInvocation $MyInvocation -Parameter @( )
    try {
        'SRCSRV: ini ------------------------------------------------'
        'VERSION=3'
        'INDEXVERSION=2'
        'VERCTRL=Team Foundation Server'
        [string]::Format(
            [System.Globalization.CultureInfo]::InvariantCulture,
            'DATETIME={0:ddd MMM dd HH:mm:ss yyyy}',
            (Get-Date))
        'INDEXER=TFSTB'
        'SRCSRV: variables ------------------------------------------'
        'TFS_EXTRACT_CMD=tf.exe view /version:%var4% /noprompt "$%var3%" /server:%fnvar%(%var2%) /output:%SRCSRVTRG%'
        'TFS_EXTRACT_TARGET=%targ%\%var2%%fnbksl%(%var3%)\%var4%\%fnfile%(%var5%)'
        'SRCSRVVERCTRL=tfs'
        'SRCSRVERRDESC=access'
        'SRCSRVERRVAR=var2'
        "VSTFSSERVER=$($provider.PublicCollectionUrl)"
        'SRCSRVTRG=%TFS_EXTRACT_TARGET%'
        'SRCSRVCMD=%TFS_EXTRACT_CMD%'
        'SRCSRV: source files ---------------------------------------'
        $itemSpecs = foreach ($localPath in $SourceFilePaths) { New-ItemSpec -LocalPath $localPath }
        # The type returned by GetLocalVersions(...) is LocalVersion[][].
        $localVersions = $provider.Workspace.GetLocalVersions(
            $itemSpecs, # itemSpecs
            $false); # sortData
        foreach ($localVersion in $localVersions) {
            if (!$localVersion) {
                continue
            }

            [string]$localPath = $localVersion[0].Item
            [string]$serverPath = $provider.Workspace.GetServerItemForLocalItem($localPath).Substring(1) # Everything but the '$'.
            [int]$version = $localVersion[0].Version
            [string]$fileName = Split-Path -Leaf -Path $localPath
            "$localPath*VSTFSSERVER*$serverPath*$version*$fileName"
        }
    
        'SRCSRV: end ------------------------------------------------'
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

########################################
# Wrapper functions.
########################################
function New-ItemSpec {
    [CmdletBinding()]
    param(
        [ValidateNotNullOrEmpty()]
        [Parameter(Mandatory = $true)]
        [string]$LocalPath)

    New-Object -TypeName 'Microsoft.TeamFoundation.VersionControl.Client.ItemSpec' -ArgumentList $LocalPath, 'None'
}
