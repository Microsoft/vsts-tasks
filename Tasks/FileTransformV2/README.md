# File transform

## Overview

Use this task to apply file transformations and variable substitutions on configuration and parameters files. For details of how translations are processed, see [File transforms and variable substitution reference](https://docs.microsoft.com/en-us/azure/devops/pipelines/tasks/transforms-variable-substitution?view=azure-devops).

The new File Transform Task version fails when no substitution has been applied (i.e. the changes were already present in the package).

## File transformations

* At present file transformations are supported for only XML files.

* To apply XML transformation to configuration files (*.config) you must specify a newline-separated list of transformation file rules using the syntax:

  `-transform <path to the transform file> -xml <path to the source file> -result <path to the result file>`

* File transformations are useful in many scenarios, particularly when you are deploying to an App service and want to add, remove or modify configurations for different environments (such as Dev, Test, or Prod) by following the standard Web.config Transformation Syntax.

* You can also use this functionality to transform other files, including Console or Windows service application configuration files (for example, FabrikamService.exe.config).

* Config file transformations are run before variable substitutions.

## Variable substitution

* At present only XML and JSON file formats are supported for variable substitution.

* Tokens defined in the target configuration files are updated and then replaced with variable values.

* Variable substitutions are run after config file transformations.

* Variable substitution is applied for only the JSON keys predefined in the object hierarchy. It does not create new keys.

*  Only custom variables defined in build/release pipelines are used in substitution. Default/system defined pipeline variables are excluded.

*  If same variables are defined in the release pipeline and in the stage, then the stage variables will supersede the release pipeline variables.

*  Predefined or build Variables are skipped during variable substitution. Hence, variables having prefix among ['agent.', 'azure_http_user_agent', 'build.', 'common.', 'release.', 'system.', 'tf_'] are ignored during variable substitution.

### Examples

If you need XML transformation to run on all the configuration files named with pattern .Production.config, the transformation rule should be specified as:

`-transform **\*.Production.config -xml **\*.config`

If you have a configuration file named based on the stage name in your pipeline, you can use:

`-transform **\*.$(Release.EnvironmentName).config -xml **\*.config`

To substitute JSON variables that are nested or hierarchical, specify them using JSONPath expressions. For example, to replace the value of ConnectionString in the sample below, you must define a variable as Data.DefaultConnection.ConnectionString in the build or release pipeline (or in a stage within the release pipeline).

```
{
  "Data": {
    "DefaultConnection": {
      "ConnectionString": "Server=(localdb)\SQLEXPRESS;Database=MyDB;Trusted_Connection=True"
    }
  }
}
```

### YAML snippet

```
# File transform
# Replace tokens with variable values in XML or JSON configuration files
- task: FileTransform@2
  inputs:
    #folderPath: '$(System.DefaultWorkingDirectory)/**/*.zip' 
    #enableXmlTransform: # Optional
    #xmlTransformationRules: '-transform **\*.Release.config -xml **\*.config-transform **\*.$(Release.EnvironmentName).config -xml **\*.config' # Optional
    #fileType: # Optional. Options: xml, json
    #xmlTargetFiles: # Optional
    #jsonTargetFiles: # Optional
```

### Arguments

Package or folder ->  folderPath	File path to the package or a folder. Variables ( Build | Release ), wildcards are supported. For example, `$     (System.DefaultWorkingDirectory)/*/.zip`. For zipped folders, the contents are extracted to the TEMP location, transformations executed, and the results zipped in   original artifact location.

XML transformation
enableXmlTransform ->	Enable this option to apply XML transformations based on the rules specified below. Config transforms run prior to any variable substitution. XML transformations are supported only for the Windows platform.

Transformation rules
xmlTransformationRules ->	Provide a newline-separated list of transformation file rules using the syntax
`-transform <path to="" the transform file> -xml <path to the source configuration file> -result <path to the result file>`
The result file path is optional and, if not specified, the source configuration file will be replaced with the transformed result file.

File format
fileType ->	Specify the file format on which substitution is to be performed. Variable substitution runs after any configuration transforms. For XML, Variables defined in the build or release pipelines will be matched against the token ('key' or 'name') entries in the appSettings, applicationSettings, and connectionStrings sections of any config file and parameters.xml file.

Target files
targetFiles	-> Provide a newline-separated list of files for variable substitution. Files names must be specified relative to the root folder.

* **File transformation and variable substitution:**  Refer to following links:
  * [XML transformation](https://docs.microsoft.com/en-us/vsts/build-release/tasks/transforms-variable-substitution?view=vsts#xml-transformation)
  * [XML variable substitution](https://docs.microsoft.com/en-us/vsts/build-release/tasks/transforms-variable-substitution?view=vsts#xml-variable-substitution)
  * [JSON variable substitution](https://docs.microsoft.com/en-us/vsts/build-release/tasks/transforms-variable-substitution?view=vsts#json-variable-substitution)