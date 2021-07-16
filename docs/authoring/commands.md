## Logging Commands:

The general format for a logging command is:

    ##vso[area.action property1=value;property2=value;...]message

To invoke a logging command, simply emit the command via standard output. For example, from a PowerShell task:

    Write-Host "##vso[task.setvariable variable=testvar;]testvalue"

#### Task Logging Commands:

<table>
    <thead>
        <tr>
            <th>Syntax</th>
            <th>Property Name</th>
            <th>Usage</th>
            <th>Minimum Agent Version</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>
                <p align="left">
                    <code>##vso[task.logissue]error/warning message</code>
                </p>
            </td>
            <td>
                <p align="left">
                    <code>type</code>=error or warning (Required) <br>
                    <code>sourcepath</code>=source file location <br>
                    <code>linenumber</code>=line number <br>
                    <code>columnnumber</code>=column number <br>
                    <code>code</code>=error or warning code <br>
                </p>
            </td>
            <td>
                <p align="left">
                    Log error or warning issue to timeline record of current task.<br>
                    <b>Example:</b> <br>
                    <code>##vso[task.logissue type=error;sourcepath=consoleapp/main.cs;linenumber=1;columnnumber=1;code=100;]this is an error</code>
                </p>
            </td>
            <td>
            </td>
        </tr>
        <tr>
            <td>
                <p align="left">
                    <code>##vso[task.setprogress]current operation</code>
                </p>
            </td>
            <td>
                <p align="left">
                    <code>value</code>=percentage of completion
                </p>
            </td>
            <td>
                <p align="left">
                    Set progress and current operation for current task.<br>
                    <b>Example:</b> <br>
                    <code>##vso[task.setprogress value=75;]Upload Log</code>
                </p>
            </td>
            <td>
            </td>
        </tr>
        <tr>
            <td>
                <p align="left">
                    <code>##vso[task.complete]current operation</code>
                </p>
            </td>
            <td>
                <p align="left">
                    <code>result</code>=<code>Succeeded</code>|<code>SucceededWithIssues</code>|<code>Failed</code>
                </p>
            </td>
            <td>
                <p align="left">
                    Finish timeline record for current task, set task result and current operation. When result not provided, set result to succeeded.<br>
                    <b>Example:</b> <br>
                    <code>##vso[task.complete result=Succeeded;]DONE</code>
                </p>
            </td>
            <td>
                1.95
            </td>
        </tr>
        <tr>
            <td>
                <p align="left">
                    <code>##vso[task.logdetail]current operation</code>
                </p>
            </td>
            <td>
                <p align="left">
                    <code>id</code>=Timeline record Guid (Required)<br>
                    <code>parentid</code>=Parent timeline record Guid <br>
                    <code>type</code>=Record type (Required for first time, can't overwrite)<br>
                    <code>name</code>=Record name (Required for first time, can't overwrite)<br>
                    <code>order</code>=order of timeline record (Required for first time, can't overwrite)<br>
                    <code>starttime</code>=Datetime <br>
                    <code>finishtime</code>=Datetime <br>
                    <code>progress</code>=percentage of completion <br>
                    <code>state</code>=<code>Unknown</code>|<code>Initialized</code>|<code>InProgress</code>|<code>Completed</code> <br>
                    <code>result</code>=<code>Succeeded</code>|<code>SucceededWithIssues</code>|<code>Failed</code><br>
                </p>
            </td>
            <td>
                <p align="left">
                    Create and update detail timeline records. <br>
                    The first time a <code>##vso[task.logdetail]</code> message is seen for a given task, a detailed timeline is created for that task. <br>
                    Nested timeline records are created and updated based on id and parentid. <br>
                    The task author needs to remember which Guid they used for each timeline record. The logging system tracks the Guid for each timeline record that has been created, so any new Guid results in a new timeline record. <br>
                    <b>Examples:</b> <br>
                    Create new root timeline record: <code>##vso[task.logdetail id=new guid;name=project1;type=build;order=1]create new timeline record</code><br>
                    Create new nested timeline record: <code>##vso[task.logdetail id=new guid;parentid=exist timeline record guid;name=project1;type=build;order=1]create new nested timeline record</code><br>
                    Update exist timeline record: <code>##vso[task.logdetail id=existing timeline record guid;progress=15;state=InProgress;]update timeline record</code>
                </p>
            </td>
            <td>
            </td>
        </tr>
        <tr>
            <td>
                <p align="left">
                    <code>##vso[task.setvariable]value</code>
                </p>
            </td>
            <td>
                <p align="left">
                    <code>variable</code>=variable name (Required) <br>
                </p>
                 <p align="left">
                    <code>issecret</code>=<code>true</code> (Optional) <br>
                </p>
            </td>
            <td>
                <p align="left">
                    Sets a variable in the variable service of taskcontext. The first task can set a variable, and following tasks in the same phase are able to use the variable. The variable is exposed to the following tasks as an environment variable. When <code>issecret</code> is set to <code>true</code>, the value of the variable will be saved as secret and masked out from log. Secret variables are not passed into tasks as environment variables and must be passed as inputs. You can use URL-encoding for special characters not possible to set otherwise. These are:<br><code>%3B</code> for <code>;</code> (semicolon)<br><code>%0D</code> for <code>\r</code> (carriage return)<br><code>%0A</code> for <code>\n</code> (new-line)<br><code>%5D</code> for <code>]</code> (square bracket closed)<br>
                    <b>Examples:</b> <br>
                    <code>##vso[task.setvariable variable=testvar]testvalue</code><br>
                    <code>##vso[task.setvariable variable=testvar;issecret=true]testvalue</code><br>
                </p>
            </td>
            <td>
            </td>
        </tr>
         <tr>
            <td>
                <p align="left">
                    <code>##vso[task.setendpoint]value</code>
                </p>
            </td>
            <td>
                <p align="left">
                    <code>id</code>=endpoint id (Required) <br>
                </p>
                <p align="left">
                    <code>field</code>=field type authParameter|dataParameter|url (Required) <br>
                </p>
                <p align="left">
                    <code>key</code>=key (Required. Except for field=url) <br>
                </p>
                  <p align="left">
                    <code>value</code>=value for key or url(Required) <br>
                </p>
            </td>
            <td>
                <p align="left">
                    Set an endpoint field with given value. Value updated will be retained in the endpoint for the subsequent tasks that execute within the same job.<br>
                    <b>Examples:</b> <br>
                    <code>##vso[task.setendpoint id=000-0000-0000;field=authParameter;key=AccessToken]testvalue</code><br>
                    <code>##vso[task.setendpoint id=000-0000-0000;field=dataParameter;key=userVariable]testvalue</code><br>
                </p>
            </td>
            <td>
            </td>
        </tr>
        <tr>
            <td>
                <p align="left">
                    <code>##vso[task.addattachment]value</code>
                </p>
            </td>
            <td>
                <p align="left">
                    <code>type</code>=attachment type (Required) <br>
                    <code>name</code>=attachment name (Required) <br>
                </p>
            </td>
            <td>
                <p align="left">
                    Upload and attach attachment to current timeline record. These files are not available for download with logs. These can only be referred to by extensions using the type or name values. <br>
                    <b>Example:</b> <br>
                    <code>##vso[task.addattachment type=myattachmenttype;name=myattachmentname;]c:\myattachment.txt</code><br>
                </p>
            </td>
            <td>
            </td>
        </tr>
        <tr>
            <td>
                <p align="left">
                    <code>##vso[task.uploadsummary]local file path</code>
                </p>
            </td>
            <td>
                <p align="left">
                </p>
            </td>
            <td>
                <p align="left">
                    Upload and attach summary markdown to current timeline record. This summary shall be added to the build/release summary and not available for download with logs.<br>
                    <b>Examples:</b> <br>
                    <code>##vso[task.uploadsummary]c:\testsummary.md</code> <br>
                    It is a short hand form for the command <br>
                    <code>##vso[task.addattachment type=Distributedtask.Core.Summary;name=testsummaryname;]c:\testsummary.md</code><br>
                </p>
            </td>
            <td>
               0.5.6
            </td>
        </tr>
        <tr>
            <td>
                <p align="left">
                    <code>##vso[task.uploadfile]local file path</code>
                </p>
            </td>
            <td>
                <p align="left">
                </p>
            </td>
            <td>
                <p align="left">
                    Upload user interested file as additional log information to the current timeline record. The file shall be available for download along with task logs.<br>
                    <b>Example:</b> <br>
                    <code>##vso[task.uploadfile]c:\additionalfile.log</code>
                </p>
            </td>
            <td>
                <p align="left">
                    1.101
                </p>
            </td>
        </tr>
        <tr>
            <td>
                <p align="left">
                    <code>##vso[task.prependpath]local directory path</code>
                </p>
            </td>
            <td>
                <p align="left">
                </p>
            </td>
            <td>
                <p align="left">
                    Instruction for the agent to update the PATH environment variable. The specified directory is prepended
                    to the PATH. The updated environment variable will be reflected in subsequent tasks.<br>
                    <b>Example:</b> <br>
                    <code>##vso[task.prependpath]c:\my\directory\path</code>
                </p>
            </td>
            <td>
                <p align="left">
                    2.115.0
                </p>
            </td>
        </tr>
    </tbody>
</table>


#### Artifact Logging Commands:
<table>
    <thead>
        <tr>
            <th>Syntax</th>
            <th>Property Name</th>
            <th>Usage</th>
            <th>Minimum Agent Version</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>
                <p align="left">
                    <code>##vso[artifact.associate]artifact location</code>
                </p>
            </td>
            <td>
                <p align="left">
                    <code>artifactname</code>=artifact name (Required) <br>
                    <code>type</code>=<code>container</code>|<code>filepath</code>|<code>versioncontrol</code>|<code>gitref</code>|<code>tfvclabel</code>, artifact type (Required)<br>
                </p>
            </td>
            <td>
                <p align="left">
                    Create an artifact link, artifact location is required to be a file container path, VC path or UNC share path. <br>
                    <b>Examples:</b> <br>
                    <code>##vso[artifact.associate artifacttype=container;artifactname=MyServerDrop]#/1/build</code> <br>
                    <code>##vso[artifact.associate artifacttype=filepath;artifactname=MyFileShareDrop]\\MyShare\MyDropLocation</code> <br>
                    <code>##vso[artifact.associate artifacttype=versioncontrol;artifactname=MyTfvcPath]$/MyTeamProj/MyFolder</code> <br>
                    <code>##vso[artifact.associate artifacttype=gitref;artifactname=MyTag]refs/tags/MyGitTag</code> <br>
                    <code>##vso[artifact.associate artifacttype=tfvclabel;artifactname=MyTag]MyTfvcLabel</code> <br>
                </p>
            </td>
            <td>
            </td>
        </tr>
        <tr>
            <td>
                <p align="left">
                    <code>##vso[artifact.upload]local file path</code>
                </p>
            </td>
            <td>
                <p align="left">
                    <code>containerfolder</code>=folder that the file will upload to, folder will be created if needed.<br>
                    <code>artifactname</code>=artifact name. (Required)<br>
                </p>
            </td>
            <td>
                <p align="left">
                    Upload local file into a file container folder, create artifact if <code>artifactname</code> provided.<br>
                    Note: If you want to use these artifacts within a Stage, the <code>containerfolder</code> and <code>artifactname</code> must be the same.<br>
                    <b>Example:</b> <br>
                    <code>##vso[artifact.upload containerfolder=testresult;artifactname=uploadedresult;]c:\testresult.trx</code><br>
                </p>
            </td>
            <td>
            </td>
    </tbody>
</table>


#### Build Logging Commands:
<table>
    <thead>
        <tr>
            <th>Syntax</th>
            <th>Property Name</th>
            <th>Usage</th>
            <th>Minimum Agent Version</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>
                <p align="left">
                    <code>##vso[build.uploadlog]local file path</code>
                </p>
            </td>
            <td>
                <p align="left">
                </p>
            </td>
            <td>
                <p align="left">
                    Upload user interested log to build’s container “<code>logs\tool</code>” folder.<br>
                    <b>Example:</b> <br>
                    <code>##vso[build.uploadlog]c:\msbuild.log</code>
                </p>
            </td>
            <td>
            </td>
        </tr>
        <tr>
            <td>
                <p align="left">
                    <code>##vso[build.updatebuildnumber]build number</code>
                </p>
            </td>
            <td>
                <p align="left">
                </p>
            </td>
            <td>
                <p align="left">
                    Update build number for current build.<br>
                    <b>Example:</b> <br>
                    <code>##vso[build.updatebuildnumber]my-new-build-number</code>
                </p>
            </td>
            <td>
                1.88
            </td>
        </tr>
        <tr>
            <td>
                <p align="left">
                    <code>##vso[build.addbuildtag]build tag</code>
                </p>
            </td>
            <td>
                <p align="left">
                </p>
            </td>
            <td>
                <p align="left">
                    Add a tag for current build.<br>
                    <b>Example:</b> <br>
                    <code>##vso[build.addbuildtag]Tag_UnitTestPassed</code>
                </p>
            </td>
            <td>
                1.95
            </td>
        </tr>
    </tbody>
</table>


#### Release Logging Commands:
<table>
    <thead>
        <tr>
            <th>Syntax</th>
            <th>Property Name</th>
            <th>Usage</th>
            <th>Minimum Agent Version</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>
                <p align="left">
                    <code>##vso[release.updatereleasename]release name</code>
                </p>
            </td>
            <td>
                <p align="left">
                </p>
            </td>
            <td>
                <p align="left">
                    Update release name for current release.<br>
                    <b>Example:</b> <br>
                    <code>##vso[release.updatereleasename]my-new-release-name</code><br>
                    This command is not supported in Azure DevOps Server (TFS) 2019 and below.
                </p>
            </td>
            <td>
                2.132
            </td>
        </tr>
    </tbody>
</table>
