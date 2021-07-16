#  Use .NET V2 Task

## Overview

The Use .NET Core task acquires a specific version of [.NET Core](https://docs.microsoft.com/en-us/dotnet/core/tools/?tabs=netcore2x) from internet or the tools cache and adds it to the PATH of the Azure Pipelines Agent (hosted or private). Use this task to change the version of .NET Core used in subsequent tasks like [.NET Core cli task](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/DotNetCoreCLIV2).
Adding this task before the [.NET Core cli task](https://github.com/Microsoft/azure-pipelines-tasks/tree/master/Tasks/DotNetCoreCLIV2) in a build definition ensures that the version would be available at the time of building, testing and publishing your app.

The tool installer approach also allows you to decouple from the agent update cycles. If the .NET Core version you are looking for is missing from the Azure Pipelines agent (Hosted or Private), then you can use this task to get the right version installed on the agent.

### Whats New
- Support for installing multiple versions side by side.

- Support for patterns in version to fetch latest in minor/major version. Example you can now specify 2.2.x to get the latest patch.

- Perfrom Multi-level lookup. This input is only applicable to Windows based agents. It configures the .Net Core's host process behviour for looking for a suitable shared framework on the machine. You can read more about it **[HERE](https://github.com/dotnet/core-setup/blob/master/Documentation/design-docs/multilevel-sharedfx-lookup.md)**

- Installs NuGet version 4.4.1 and sets up proxy configuration if present in NuGet config.

## Contact Information

Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work.  You can also share feedback about the task like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

### Parameters of the task

* **Package to install\*:** You can choose to install either runtime or SDK.

* **Use global json**: This checkbox indicates that all versions from all `global.json` files will be used to install the sdk versions. You can set the search root path with `Working Directory`.

* **Working Directory**: This path can only be set if the option `Use global json` is selected. Specify path from where global.json files should be searched when using `Use global json`. If empty, `system.DefaultWorkingDirectory` will be considered as the root path.

* **Version\*:** Specify version of .NET Core SDK or runtime to install. It also allows you to always get the latest version in a minor or major version. See below for examples
Examples:
  - To install 2.2.104 SDK, use 2.2.104
  - To install 2.2.1 runtime, use 2.2.1
  - To install 3.0.100-preview3-010431 sdk, use 3.0.100-preview3-010431
  - To install latest patch version of 2.1 sdk, use 2.1.x
  - To install latest minor version of 2. sdk, use 2.x<br/>For getting more details about exact version, refer [this link](https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/releases-index.json).

* **Compatible Visual Studio Version**: Specify a compatible Visual Studio version. If a version is specified, then only those versions of .Net Core SDK/runtime will be considered for installation which are compatible with this Visual Studio version. Specify complete Visual Studio version containing major version, minor version and patch number. e.g. 16.6.4. Compatibility of Visual Studio is checked by looking at vs-version property specified in the release manifest from the releases.json files. The link to releases.json of that major.minor version can be found in [**releases-index file.**](https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/releases-index.json)

* **Include Preview Versions**: Select if you want preview versions to be included while searching for latest versions, such as while searching 2.2.x. This setting is ignored if you specify an exact version, such as: 3.0.100-preview3-010431


* **Path To Install .Net Core**: Specify where .Net Core SDK/Runtime should be installed. In case there was already a different version on the specified path, that earlier version wont be deleted.


* **Perform Multi Level Lookup**: This input is only applicable to Windows based agents. This configures the behavior of .Net host process for looking up a suitable shared framework.
  * *unchecked*: Only versions present in  the folder specified in this task would be looked by the host process.
  * *checked*: The host will attempt to look in pre-defined global locations using multi-level lookup.

    The default global locations are:
    - **For Windows**:
    <br/>C:\\Program Files\\dotnet (64-bit processes)
    <br/>C:\\Program Files (x86)\\dotnet (32-bit process)

    You can read more about it [**HERE**](https://github.com/dotnet/core-setup/blob/master/Documentation/design-docs/multilevel-sharedfx-lookup.md).<br/>
