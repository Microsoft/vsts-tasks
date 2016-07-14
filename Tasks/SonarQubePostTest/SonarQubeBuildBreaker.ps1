#
# Top-level orchestrating logic
# 
function BreakBuildOnQualityGateFailure
{    
    $breakBuild = GetTaskContextVariable "MSBuild.SonarQube.Internal.BreakBuild"
    $breakBuildEnabled = [System.Convert]::ToBoolean($breakBuild)

    if ($breakBuildEnabled)
    {
        if (IsPrBuild)
        {
            Write-Host "Ignoring the setting of breaking the build on quality gate failure because the build was triggered by a pull request."
            return;
        }
        
        WaitForAnalysisToFinish
        $qualityGateStatus = GetOrFetchQualityGateStatus
        FailBuildOnQualityGateStatus $qualityGateStatus
    }
    else
    {
        Write-Host "The build was not set to fail if the associated quality gate fails."
    }
}

#
# Fails the build when the quality gate is set to Error. Possible quality gate results: OK, WARN, ERROR, NONE
#
function FailBuildOnQualityGateStatus
{
    param ([string]$qualityGateStatus)

    if ($qualityGateStatus -eq "error")
    {        
        $dashboardUrl = GetTaskContextVariable "MSBuild.SonarQube.ProjectUri"
        
        Write-VstsTaskError "The SonarQube quality gate associated with this build has failed. For more details see $dashboardUrl"
        Write-VstsSetResult -Result Failed
        
    }
    else
    {
        Write-Host "The SonarQube quality gate associated with this build has passed (status $qualityGateStatus)"
    }
}
