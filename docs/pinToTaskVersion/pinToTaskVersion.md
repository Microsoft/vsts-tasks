# Pin to a Task Version

By default, our in the box tasks (those in this repo) automatically slide on minor and patch updates. Sometimes this behavior is undesirable (e.g. for Security/Compliance reasons).

To avoid this behavior, we allow you to install a specific version of a task that you can pin to. Simply follow these steps.

1. If you are not the TFS team project collection administrator, make sure that you have been added as an agent pool administrator at `All Pools` level. For more information, see [Agent pools](https://msdn.microsoft.com/library/vs/alm/build/agents/admin#agent-pools).

2. Clone this repo and checkout the branch containing the version you want.

3. On one of your TFS Application Tiers, open a PowerShell console, and then change the current location to the root of this repo.

4. To verify that your execution policy allows for the execution of installation scripts, run the following command line:

```powershell
Set-ExecutionPolicy Unrestricted -Scope Process -Force
```

5. From a TFS Application Tier, run the installation script against your TFS collection, as follows:

```powershell
$taskDir = _build\Tasks\BashV3 # Replace BashV3 with the name of the task you would like to install.
.\docs\pinToTaskVersion\New-TaskInstallScript.ps1 -CollectionUrl http://myserver:8080/tfs/DefaultCollection -taskDir $taskDir
```
