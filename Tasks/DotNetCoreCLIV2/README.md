#  .NET Core : Build, test and publish using dotnet core command-line.

## Overview

The .NET Core task is used to Build, test and publish using dotnet core command-line.

## Contact Information

Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

## Pre-requisites for the task

The only prerequisite for the task is that .NET Core must be installed on Azure Pipelines agent machine. In case you want an exact version of .NET Core on the agent then you can use the [.NET Core Tool installer task](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/DotNetCoreInstallerV0)

### Parameters of the task

* **Command\*:** The task can be used to run any [dotnet core command](https://docs.microsoft.com/en-us/dotnet/core/tools/?tabs=netcore2x).

* **Projects\*:** Depending on the version of .NET Core, the task can work with either project.json or a csproj file. You can pass a relative path of the .csproj file(s) from repo root. Wildcards can be used too. For example, **/*.csproj for all .csproj files in all the sub folders.

* **Arguments\:** Pass arguments to the selected dotnet core command. For example, build configuration, output folder, runtime. The arguments depend on the command selected.

Options specific to **dotnet publish** command
* **Publish Web Projects\*:** If true, the task will try to find the web projects in the repository and run the publish command on them. Web projects are identified by presence of either a web.config file or wwwroot folder in the directory.
* **Zip Published Projects\*:** If true, folder created by the publish command will be zipped.
* **Add project name to publish path\*:** If true, folders created by the publish command will have project file name prefixed to their folder names when output path is specified explicitly in arguments. This is useful if you want to publish multiple projects to the same folder.

Options specific to **dotnet nuget push** command
* **Path to NuGet package(s) to publish\*:** The pattern to match or path to nupkg files to be uploaded. Multiple patterns can be separated by a semicolon, and you can make a pattern negative by prefixing it with '-:'. Example: **\*.nupkg;-:**\*.Tests.nupkg
* **Target feed location\*:** You can choose from a feed in your Azure Pipelines account or an external NuGet server.
* **Target feed\*:** Select a feed hosted in this account. You must have Azure Artifacts installed and licensed to select a feed here.

Options specific to **dotnet pack** command
* **Path to csproj or nuspec file(s) to pack\*:** Pattern to search for csproj or nuspec files to pack. You can separate multiple patterns with a semicolon, and you can make a pattern negative by prefixing it with '!'. Example: **\*.csproj;!**\*.Tests.csproj
* **Configuration to Package\*:** When using a csproj file this specifies the configuration to package.
* **Package Folder\*:** Folder where packages will be created. If empty, packages will be created alongside the csproj file.
* **Do not build\*:** Don't build the project before packing. Corresponds to the --no-build command line parameter.
* **Include Symbols\*:** Additionally creates symbol NuGet packages. Corresponds to the --include-symbols command line parameter.
* **Include Source\*:** Includes source code in the package. Corresponds to the --include-source command line parameter.
* **Automatic package versioning\*:** Cannot be used with include referenced projects. If you choose 'Use the date and time', this will generate a SemVer -compliant version formatted as X.Y.Z-ci-datetime where you choose X, Y, and Z.
If you choose 'Use an environment variable', you must select an environment variable and ensure it contains the version number you want to use.
If you choose 'Use the build number', this will use the build number to version your package. Note: Under Options set the build number format to be '$(BuildDefinitionName)_$(Year:yyyy).$(Month).$(DayOfMonth)$(Rev:.r)
* **Additional build properties\*:** Specifies a list of token = value pairs, separated by semicolons, where each occurrence of $token$ in the .nuspec file will be replaced with the given value. Values can be strings in quotation marks.
* **Verbosity\*:** Specifies the amount of detail displayed in the output.

Options specific to **dotnet restore** command
* **Feeds to use\*:** You can either select a feed from Azure Artifacts and/or NuGet.org here, or commit a nuget.config file to your source code repository and set its path here.
* **Use packages from this Azure Artifacts/TFS feed\*:** Include the selected feed in the generated NuGet.config. You must have Azure Artifacts installed and licensed to select a feed here.
* **Use packages from NuGet.org\*:** Include NuGet.org in the generated NuGet.config.
* **Disable local cache\*:** Prevents NuGet from using packages from local machine caches.
* **Destination directory\*:** Specifies the folder in which packages are installed. If no folder is specified, packages are restored into the default NuGet package cache.
* **verbosity\*:** Specifies the amount of detail displayed in the output.

Options specific to **dotnet test** command
* **Publish test results\*:** Enabling this option will generate a test results TRX file in $(Agent.TempDirectory) and results will be published to the server. This option appends --logger trx --results-directory $(Agent.TempDirectory) to the command line arguments.
