import tl = require('azure-pipelines-task-lib/task');
import fs = require('fs');
import path = require('path');
import { Kudu } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-app-service-kudu';
import { AzureAppServiceUtility } from './AzureAppServiceUtility';
import { TaskParameters } from './TaskParameters';
import { sleepFor } from 'azure-pipelines-tasks-azure-arm-rest-v2/webClient';

var msDeploy = require('azure-pipelines-tasks-webdeployment-common/deployusingmsdeploy.js');

export async function DeployWar(webPackage, taskParams: TaskParameters, msDeployPublishingProfile, kuduService: Kudu, appServiceUtility: AzureAppServiceUtility): Promise<void> {
    // get list of files before deploying to the web app.
    await appServiceUtility.pingApplication();
    var listOfFilesBeforeDeployment: any = await kuduService.listDir('/site/wwwroot/webapps/');
    tl.debug("Listing file structure of webapps folder before deployment starts => " + JSON.stringify(listOfFilesBeforeDeployment));

    // Strip package path and only keep the package name.
    var warFileName = path.basename(webPackage).split('.war')[0];

    // Find if directory with same name as war file, existed before deployment
    var directoryWithSameNameBeforeDeployment;
    if (listOfFilesBeforeDeployment) {
        listOfFilesBeforeDeployment.some(item => {
            if (item.name == warFileName && item.mime == "inode/directory") {
                directoryWithSameNameBeforeDeployment = item;
                return true;
            }
            return false;
        });
    }

    var retryCount = 3;
    while (retryCount > 0) {
        await msDeploy.DeployUsingMSDeploy(webPackage, taskParams.WebAppName, msDeployPublishingProfile, taskParams.RemoveAdditionalFilesFlag,
            taskParams.ExcludeFilesFromAppDataFlag, taskParams.TakeAppOfflineFlag, taskParams.VirtualApplication, taskParams.SetParametersFile,
            taskParams.AdditionalArguments, false, taskParams.UseWebDeploy);

        // verify if the war file has expanded
        // if not expanded, deploy using msdeploy once more, to make it work.
        var hasWarExpandedSuccessfully: boolean = await HasWarExpandedSuccessfully(kuduService, directoryWithSameNameBeforeDeployment, warFileName, appServiceUtility);
        if (!hasWarExpandedSuccessfully) {
            console.log(tl.loc("WarDeploymentRetry"));
            // If the war file is exactly same, MSDeploy doesn't update the war file in webapp.
            // So by changing ModifiedTime, we ensure it will be updated.
            var currentTime = new Date(Date.now());
            var modifiedTime = new Date(Date.now());
            fs.utimesSync(webPackage, currentTime, modifiedTime);
        }
        else {
            break;
        }

        retryCount--;
    }
}

export async function HasWarExpandedSuccessfully(kuduService: Kudu, directoryWithSameNameBeforeDeployment: any, warFileName: string, appServiceUtility: AzureAppServiceUtility): Promise<boolean> {
    // Waiting for war to expand
    await sleepFor(10);

    // do a get call on the target web app.
    await appServiceUtility.pingApplication();
    var filesAfterDeployment: any = await kuduService.listDir('/site/wwwroot/webapps/');
    tl.debug("Listing file structure of webapps folder after deployment has completed => " + JSON.stringify(filesAfterDeployment));

    // Verify if the content of that war file has successfully expanded. This is can be concluded if
    // directory with same name as war file exists after deployment and if it existed before deployment, then the directory should contain content of new war file
    // which can be concluded if the modified time of the directory has changed. We have however observerd some minor milliseconds change in the modified time even when deployment is not successfull, only for the first time. Hence we are introducing a check that the time change should be more than 0.5 second or 500 milliseconds.
    return filesAfterDeployment.some(item => { return item.name == warFileName && item.mime == "inode/directory" && (!directoryWithSameNameBeforeDeployment || (item.mtime != directoryWithSameNameBeforeDeployment.mtime && (new Date(item.mtime).getTime() - new Date(directoryWithSameNameBeforeDeployment.mtime).getTime() > 500))) });
}