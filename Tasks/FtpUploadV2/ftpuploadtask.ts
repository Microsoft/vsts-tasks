import * as tl from "azure-pipelines-task-lib/task";
import * as ftp from "basic-ftp";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as url from "url";
import { MatchOptions } from "azure-pipelines-task-lib/task";

interface FtpOptions {
    // url
    serverEndpointUrl: url.Url;

    // credentials
    username: string;
    password: string;

    // other standard options
    rootFolder: string;
    filePatterns: string[];
    remotePath: string;

    // advanced options
    clean: boolean;
    cleanContents: boolean;
    preservePaths: boolean;
    trustSSL: boolean;
    enableUtf8: boolean;
    customCmds: string[];
}

class ProgressTracker {
    progressFilesUploaded: number = 0;
    progressDirectoriesProcessed: number = 0;

    constructor(private ftpOptions: FtpOptions, private fileCount: number) {
        this.ftpOptions = ftpOptions;
        this.fileCount = fileCount;
    }

    directoryProcessed(name: string): void {
        this.progressDirectoriesProcessed++;
        this.printProgress(
            "remote directory successfully created/verified: " + name
        );
    }

    fileUploaded(file: string, remoteFile: string): void {
        this.progressFilesUploaded++;
        this.printProgress("successfully uploaded: " + file + " to: " + remoteFile);
    }

    printProgress(message: string): void {
        const total: number =
            this.progressFilesUploaded + this.progressDirectoriesProcessed;
        const remaining: number = this.fileCount - total;
        console.log(
            "files uploaded: " + this.progressFilesUploaded +
            ", directories processed: " + this.progressDirectoriesProcessed +
            ", total: " + total +
            ", remaining: " + remaining +
            ", " + message
        );
    }

    getSuccessStatusMessage(): string {
        return (
            os.EOL + "host: " + this.ftpOptions.serverEndpointUrl.host +
            os.EOL + "path: " + this.ftpOptions.remotePath +
            os.EOL + "files uploaded: " + this.progressFilesUploaded +
            os.EOL + "directories processed: " + this.progressDirectoriesProcessed
        );
    }

    getFailureStatusMessage(): string {
        const total: number =
            this.progressFilesUploaded + this.progressDirectoriesProcessed;
            const remaining: number = this.fileCount - total;
        return (
            this.getSuccessStatusMessage() + os.EOL + "unprocessed files & directories: " + remaining
        );
    }
}

function findFiles(ftpOptions: FtpOptions): string[] {
    tl.debug("Searching for files to upload");

    try {
        const rootFolderStats = tl.stats(ftpOptions.rootFolder);
        if (rootFolderStats.isFile()) {
            const file = ftpOptions.rootFolder;
            tl.debug(file + " is a file. Ignoring all file patterns");
            return [file];
        }

        const allFiles = tl.find(ftpOptions.rootFolder);

        // filePatterns is a multiline input containing glob patterns
        tl.debug(
            "searching for files using: " +
            ftpOptions.filePatterns.length +
            " filePatterns: " +
            ftpOptions.filePatterns
        );

        // minimatch options
        const matchOptions = { matchBase: true, dot: true } as MatchOptions;


        tl.debug("Candidates found for match: " + allFiles.length);
        for (let i = 0; i < allFiles.length; i++) {
            tl.debug("file: " + allFiles[i]);
        }
        //uses match from task library to find all applicable files
        let results = tl.match(allFiles, ftpOptions.filePatterns, ftpOptions.rootFolder, matchOptions);
        tl.debug("Files found: " + results);
        return results;

    }
    catch (err) {
        tl.error(err);
        tl.setResult(tl.TaskResult.Failed, tl.loc("UploadFailed"));
    }

    return [];
}

function getFtpOptions(): FtpOptions {
    let serverEndpointUrl: url.UrlWithStringQuery;
    let username: string;
    let password: string;

    if (tl.getInput("credsType") === "serviceEndpoint") {
        // server endpoint
        const serverEndpoint: string = tl.getInput("serverEndpoint", true);
        serverEndpointUrl = url.parse(
            tl.getEndpointUrl(serverEndpoint, false)
        );

        const serverEndpointAuth: tl.EndpointAuthorization = tl.getEndpointAuthorization(
            serverEndpoint,
            false
        );
        username = serverEndpointAuth["parameters"]["username"];
        password = serverEndpointAuth["parameters"]["password"];
    } else {
        // user entered credentials directly
        serverEndpointUrl = url.parse(tl.getInput("serverUrl", true));
        username = tl.getInput("username", true);
        password = tl.getInput("password", true);
    }

    return {
        serverEndpointUrl: serverEndpointUrl,
        username: username,
        password: password,

        // other standard options
        rootFolder: tl.getPathInput("rootFolder", true),
        filePatterns: tl.getDelimitedInput("filePatterns", "\n", true),
        remotePath: tl.getInput("remotePath", true).trim().replace(/\\/gi, "/"), // use forward slashes always

        // advanced options
        clean: tl.getBoolInput("clean", true),
        cleanContents: tl.getBoolInput("cleanContents", false),
        preservePaths: tl.getBoolInput("preservePaths", true),
        trustSSL: tl.getBoolInput("trustSSL", true),
        enableUtf8: tl.getBoolInput("enableUtf8", false),
        customCmds: tl.getDelimitedInput("customCmds", "\n", false)
    };
}

function getAccessOption(options: FtpOptions): ftp.AccessOptions {
    const protocol = options.serverEndpointUrl.protocol;
    const secure: boolean = protocol != undefined ? protocol.toLowerCase() === "ftps:" : false;
    const secureOptions: any = { rejectUnauthorized: !options.trustSSL };

    const hostName: string = options.serverEndpointUrl.hostname!;
    const portStr: string = options.serverEndpointUrl.port!;
    let port: number = 21;
    if (portStr) {
        // port not explicitly specified, use default
        port = parseInt(portStr);
    }

    console.log(tl.loc("ConnectPort", hostName, port));

    return {
        host: hostName,
        port: port,
        user: options.username,
        password: options.password,
        secure: secure,
        secureOptions: secureOptions
    };
}

async function getFtpClient(options: FtpOptions): Promise<ftp.Client> {
    const ftpClient = new ftp.Client();
    ftpClient.ftp.log = tl.debug;
    const accessOptions = getAccessOption(options);
    const response = await ftpClient.access(accessOptions);
    tl.debug("ftp client greeting");
    console.log(tl.loc("FTPConnected", response.message));

    ftpClient.trackProgress(info => {
        console.log(
            `File: ${info.name} Type: ${info.type} Transferred: ${info.bytes}`
        );
    });

    // Run custom commands upon connection
    if (options.enableUtf8) {
        await ftpClient.send("OPTS UTF8 ON");
    }
    
    if (options.customCmds) {
        for (const cmd of options.customCmds) {
            await ftpClient.send(cmd);
        }
    }

    return ftpClient;
}

async function run() {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    const tries = 3;
    let ftpOptions: FtpOptions;
    try {
        ftpOptions = getFtpOptions();
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('InvalidFTPOptions', err));
        return;
    }

    if (!ftpOptions.serverEndpointUrl.protocol) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("FTPNoProtocolSpecified"));
    }
    if (!ftpOptions.serverEndpointUrl.hostname) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("FTPNoHostSpecified"));
    }

    const files: string[] = findFiles(ftpOptions);
    const tracker = new ProgressTracker(ftpOptions, files.length);
    if (files.length === 0) {
        tl.warning(tl.loc("NoFilesFound"));
        return;
    }
   
    let ftpClient: ftp.Client;
    try {
        ftpClient = await getFtpClient(ftpOptions);
    } catch (err) {
        tl.error(err);
        tl.setResult(tl.TaskResult.Failed, tl.loc("UploadFailed"));
        return;
    }

    let sleep = (milliseconds: number) => {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    let retryWithNewClient = async (task: () => {}, retry: number) => {
        let e = null;
        while (retry > 0) {
            try {
                await task();
                return;
            } catch (err) {
                e = err;
                tl.warning(err);
                ftpClient.close();

                await sleep(1000);
                ftpClient = await getFtpClient(ftpOptions);

                retry--;
            }
        }

        if (e) {
            throw e;
        }
    };

    try {
        // clean option all assumes the folder exists as it tries to cd into it
        await retryWithNewClient(async () => {
            await ftpClient.ensureDir(ftpOptions.remotePath);
        }, tries);
        if (ftpOptions.clean) {
            console.log(tl.loc("CleanRemoteDir", ftpOptions.remotePath));
            await retryWithNewClient(async () => {
                await ftpClient.removeDir(ftpOptions.remotePath);
            }, tries);
        } else if (ftpOptions.cleanContents) {
            console.log(tl.loc("CleanRemoteDirContents", ftpOptions.remotePath));
            await retryWithNewClient(async () => {
                await ftpClient.cd(ftpOptions.remotePath);
                await ftpClient.clearWorkingDir();
            }, tries);
        }

        // remotely, ensure we are in remote path
        await retryWithNewClient(async () => {
            await ftpClient.ensureDir(ftpOptions.remotePath);
        }, tries);

        for (const file of files) {
            tl.debug("file: " + file);
            let remoteFile: string = ftpOptions.preservePaths
                ? path.join(
                    ftpOptions.remotePath,
                    file.substring(ftpOptions.rootFolder.length)
                )
                : path.join(ftpOptions.remotePath, path.basename(file));

            remoteFile = remoteFile.replace(/\\/gi, "/"); // always use forward slashes
            tl.debug("remoteFile: " + remoteFile);

            let stats = tl.stats(file);
            if (stats.isDirectory()) {
                await retryWithNewClient(async () => {
                    await ftpClient.ensureDir(remoteFile);
                }, tries);
                tracker.directoryProcessed(remoteFile);
            } else if (stats.isFile()) {
                // upload files
                await retryWithNewClient(async () => {
                    await ftpClient.upload(fs.createReadStream(file), remoteFile);
                }, tries);
                tracker.fileUploaded(file, remoteFile);
            }
        }

        console.log(tl.loc("UploadSucceedMsg", tracker.getSuccessStatusMessage()));
    } catch (err) {
        tl.error(err);
        console.log(tracker.getFailureStatusMessage());
        tl.setResult(tl.TaskResult.Failed, tl.loc("UploadFailed"));
    } finally {
        console.log(tl.loc("DisconnectHost", ftpOptions.serverEndpointUrl.host));
        ftpClient.trackProgress(() => { });
        ftpClient.close();
    }
}

run();

