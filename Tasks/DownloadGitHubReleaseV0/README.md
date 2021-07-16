# Download GitHub Release

## Overview

The [Download GitHub Release task](https://aka.ms/AA3x715) can be used to download assets from your GitHub releases as part of your CI/CD pipeline. This task works on cross platform Azure Pipeline agents running Windows, Linux or Mac and uses GitHub APIs to access GitHub releases.

## Contact Information

Please report a problem at [Developer Community Forum](https://developercommunity.visualstudio.com/spaces/21/index.html) if you are facing problems in making this task work. You can also share feedback about the task, like, what more functionality should be added to the task, what other tasks you would like to have, at the same place.

## Pre-requisites for the task

The following pre-requisites are required for the task to work properly:

#### GitHub Service Connection

In order to perform operations on the GitHub repository, the task needs a GitHub service connection with adequate permission. If it does not exist already, you can [create a GitHub service connection](https://aka.ms/AA3am5s) in your azure pipelines project. Once the service connection is created, all you need is the name of the service connection in this task.

## Parameters of the task

* **Service Connection:** This is the name of GitHub service connection which will be used to connect to target GitHub account. You can use an existing GitHub service connection or create a new one. Note that the service connection should use OAuth or PAT for authentication.

* **GitHub Repository:** This is the name of the GitHub repository where the GitHub releases are to be downloaded from. E.g. `microsoft/vscode`.

* **Default Release version type:** The version of the GitHub Release from which the assets are downloaded. The version type can be 'Latest Release', 'Specific Version' or 'Specific Tag'.

    * Release: This options shows up if 'Specific Version' or 'Specific Tag' is selected as Default Release version type. Based on the version type selected, Release name or the Tag needs to be provided.

* **Item pattern:** Minimatch pattern to filter files to be downloaded from the available release assets. To download all files within release use **.

* **Destination directory:** Path on the agent machine where the release assets will be downloaded. 
