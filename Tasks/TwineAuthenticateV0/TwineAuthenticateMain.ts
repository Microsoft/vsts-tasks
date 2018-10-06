import * as fs from "fs";
import * as ini from "ini";
import * as os from "os";
import * as path from "path";
import * as util from "util";
import * as telemetry from "utility-common/telemetry";
import * as tl from "vsts-task-lib";
import * as auth from "./Authentication";
import * as utils from "./Utilities";

 // tslint:disable-next-line:max-classes-per-file
export class Repository
{
    public repository: string;
    public username: string;
    public password: string;

    constructor(repository: string, username: string, password: string)
     {
        this.repository = repository;
        this.username = username;
        this.password = password;
    }
}

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, "task.json"));
    try {
        // Local feeds
        const internalFeeds = await auth.getInternalAuthInfoArray("feedList");

        // external service endpoints
        const externalEndpoints = await auth.getExternalAuthInfoArray("externalSources");

        // combination of both internal and external
        const newEndpointsToAdd = internalFeeds.concat(externalEndpoints);

        let pypircPath = utils.getPypircPath();

        // Case when there are multiple twine auth tasks in a build
        if (tl.exist(pypircPath)) {
            // merge two tasks
            tl.debug(tl.loc("Info_StartParsingExistingPypircFile", pypircPath));
            let fileContent = ini.parse(fs.readFileSync(pypircPath, "utf-8"));

            // Adding new endpoints to already existing .pypirc file.
            for (const entry of newEndpointsToAdd){
                if (entry.packageSource.feedName in fileContent){
                    // Don't fail if new feed is from same collection
                    if (entry.packageSource.isInternalSource){
                        tl.warning(tl.loc("Warning_DuplicateEntryForInternalFeed",
                        entry.packageSource.feedName));
                        continue;
                    }
                    else{
                        // Hard fail if there is a name collision from service endpoint
                        throw new Error(tl.loc("Error_DuplicateEntryForExternalFeed",
                        entry.packageSource.feedName));
                    }
                }

                fileContent[entry.packageSource.feedName] = new Repository(
                    entry.packageSource.feedUri,
                    entry.username,
                    entry.password);
                fileContent["distutils"]["index-servers"] += " " + entry.packageSource.feedName;
            }

            let encodedStr = ini.encode(fileContent);
            fs.writeFileSync(pypircPath, encodedStr);
        }
        else {
            // create new
            fs.writeFileSync(pypircPath, formPypircFormatFromData(newEndpointsToAdd));
            tl.setVariable("PYPIRC_PATH", pypircPath, false);
            tl.debug(tl.loc("VariableSetForPypirc", pypircPath));
        }

        // Configuring the pypirc file
        console.log(tl.loc("Info_SuccessAddingAuth", internalFeeds.length, externalEndpoints.length));
    }
    catch (error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("FailedToAddAuthentication"));
        return;
    } finally{
        _logTwineAuthStartupVariables();
    }
}
 // Telemetry
function _logTwineAuthStartupVariables() {
    try {
        const twineAuthenticateTelemetry = {
            "buildProperties": tl.getInput("buildProperties"),
            "basePath": tl.getInput("basePath"),
            "System.TeamFoundationCollectionUri": tl.getVariable("System.TeamFoundationCollectionUri"),
            "solution": tl.getInput("solution"),
            };
        telemetry.emitTelemetry("Packaging", "TwineAuthenticate", twineAuthenticateTelemetry);
    } catch (err) {
        tl.debug(`Unable to log Twine Authenticate task init telemetry. Err:( ${err} )`);
    }
}

// only used for new file writes.
function formPypircFormatFromData(authInfo: auth.AuthInfo[]): string{
    let ent : {} = {};

    let header = util.format("[distutils]%sindex-servers=", os.EOL);

    for(let entry of authInfo) {
        if (entry.packageSource.feedName in ent){
            throw new Error(tl.loc("Error_DuplicateEntryForExternalFeed",
                    entry.packageSource.feedName));
        }
        header += util.format("%s ", entry.packageSource.feedName);
        ent[entry.packageSource.feedName] = new Repository(entry.packageSource.feedUri, entry.username, entry.password);
    }
    let encodedStr = ini.encode(ent);

    header = header + os.EOL + encodedStr;
    return header;
}

main();
