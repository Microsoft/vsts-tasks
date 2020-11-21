import * as taskLib from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as toolRunner from 'azure-pipelines-task-lib/toolrunner';
import * as restm from 'typed-rest-client/RestClient';
import * as os from 'os';
import * as path from 'path';

let osPlat: string = os.platform();
let osArch: string = getArch();

async function run() {
    try {
        let versionSpec = taskLib.getInput('versionSpec', true);
        let checkLatest: boolean = taskLib.getBoolInput('checkLatest', false);
        await getNode(versionSpec, checkLatest);
    }
    catch (error) {
        taskLib.setResult(taskLib.TaskResult.Failed, error.message);
    }
}

//
// Node versions interface
// see https://nodejs.org/dist/index.json
//
interface INodeVersion {
    version: string,
    files: string[],
    semanticVersion: string
}

//
// Basic pattern:
//      if !checkLatest
//          toolPath = check cache
//      if !toolPath
//          if version is a range
//              match = query nodejs.org
//              if !match
//                  fail
//              toolPath = check cache
//          if !toolPath
//              download, extract, and cache
//              toolPath = cacheDir
//      PATH = cacheDir + PATH
//
async function getNode(versionSpec: string, checkLatest: boolean) {
    if (toolLib.isExplicitVersion(versionSpec)) {
        checkLatest = false; // check latest doesn't make sense when explicit version
    }

    // check cache
    let toolPath: string;
    if (!checkLatest) {
        toolPath = toolLib.findLocalTool('node', versionSpec, osArch);
    }

    if (!toolPath) {
        let version: string;
        if (toolLib.isExplicitVersion(versionSpec)) {
            // version to download
            version = versionSpec;
        }
        else {
            // query nodejs.org for a matching version
            version = await queryLatestMatch(versionSpec);
            if (!version) {
                throw new Error(`Unable to find Node version '${versionSpec}' for platform ${osPlat} and architecture ${osArch}.`);
            }

            // check cache
            toolPath = toolLib.findLocalTool('node', version, osArch)
        }

        if (!toolPath) {
            // download, extract, cache
            toolPath = await acquireNode(version);
        }
    }

    //
    // a tool installer initimately knows details about the layout of that tool
    // for example, node binary is in the bin folder after the extract on Mac/Linux.
    // layouts could change by version, by platform etc... but that's the tool installers job
    //
    if (osPlat != 'win32') {
        toolPath = path.join(toolPath, 'bin');
    }

    //
    // prepend the tools path. instructs the agent to prepend for future tasks
    //
    toolLib.prependPath(toolPath);
}

async function queryLatestMatch(versionSpec: string): Promise<string> {
    // node offers a json list of versions
    let dataFileName: string;
    switch (osPlat) {
        case "linux": dataFileName = "linux-" + osArch; break;
        case "darwin": dataFileName = "osx-" + osArch + '-tar'; break;
        case "win32": dataFileName = "win-" + osArch + '-exe'; break;
        default: throw new Error(`Unexpected OS '${osPlat}'`);
    }

    let versions: string[] = [];
    let dataUrl = "https://nodejs.org/dist/index.json";
    let rest: restm.RestClient = new restm.RestClient('vsts-node-tool');
    let nodeVersions: INodeVersion[] = (await rest.get<INodeVersion[]>(dataUrl)).result;
    nodeVersions.forEach((nodeVersion:INodeVersion) => {
        // ensure this version supports your os and platform
        if (nodeVersion.files.indexOf(dataFileName) >= 0) {
            // versions in the file are prefixed with 'v', which is not valid SemVer
            // remove 'v' so that toolLib.evaluateVersions behaves properly
            nodeVersion.semanticVersion = toolLib.cleanVersion(nodeVersion.version);
            versions.push(nodeVersion.semanticVersion);
        }
    });

    // get the latest version that matches the version spec
    let latestVersion: string = toolLib.evaluateVersions(versions, versionSpec);
    return nodeVersions.find(v => v.semanticVersion === latestVersion).version;
}

async function acquireNode(version: string): Promise<string> {
    //
    // Download - a tool installer intimately knows how to get the tool (and construct urls)
    //
    version = toolLib.cleanVersion(version);
    let fileName: string = osPlat == 'win32'? 'node-v' + version + '-win-' + osArch :
                                                'node-v' + version + '-' + osPlat + '-' + osArch;  
    let urlFileName: string = osPlat == 'win32'? fileName + '.7z':
                                                    fileName + '.tar.gz';  

    let downloadUrl = 'https://nodejs.org/dist/v' + version + '/' + urlFileName;

    let downloadPath: string;

    try 
    {
        downloadPath = await toolLib.downloadTool(downloadUrl);
    } 
    catch (err)
    {
        if (err['httpStatusCode'] && 
            err['httpStatusCode'] == 404)
        {
            return await acquireNodeFromFallbackLocation(version);
        }

        throw err;
    }
    
    //
    // Extract
    //
    let extPath: string;
    if (osPlat == 'win32') {
        taskLib.assertAgent('2.115.0');
        extPath = taskLib.getVariable('Agent.TempDirectory');
        if (!extPath) {
            throw new Error('Expected Agent.TempDirectory to be set');
        }

        let _7zPath = path.join(__dirname, '7zr.exe');
        extPath = await toolLib.extract7z(downloadPath, extPath, _7zPath);
    }
    else {
        extPath = await toolLib.extractTar(downloadPath);
    }

    //
    // Install into the local tool cache - node extracts with a root folder that matches the fileName downloaded
    //
    let toolRoot = path.join(extPath, fileName);
    return await toolLib.cacheDir(toolRoot, 'node', version, osArch);
}

// For non LTS versions of Node, the files we need (for Windows) are sometimes located
// in a different folder than they normally are for other versions.
// Normally the format is similar to: https://nodejs.org/dist/v5.10.1/node-v5.10.1-win-x64.7z
// In this case, there will be two files located at:
//      /dist/v5.10.1/win-x64/node.exe
//      /dist/v5.10.1/win-x64/node.lib
// If this is not the structure, there may also be two files located at:
//      /dist/v0.12.18/node.exe
//      /dist/v0.12.18/node.lib
// This method attempts to download and cache the resources from these alternative locations.
// Note also that the files are normally zipped but in this case they are just an exe
// and lib file in a folder, not zipped.
async function acquireNodeFromFallbackLocation(version: string): Promise<string> {
    // Create temporary folder to download in to
    let tempDownloadFolder: string = 'temp_' + Math.floor(Math.random() * 2000000000);
    let tempDir: string = path.join(taskLib.getVariable('agent.tempDirectory'), tempDownloadFolder);
    taskLib.mkdirP(tempDir);
    let exeUrl: string;
    let libUrl: string;
    try {
        exeUrl = `https://nodejs.org/dist/v${version}/win-${osArch}/node.exe`;
        libUrl = `https://nodejs.org/dist/v${version}/win-${osArch}/node.lib`;

        await toolLib.downloadTool(exeUrl, path.join(tempDir, "node.exe"));
        await toolLib.downloadTool(libUrl, path.join(tempDir, "node.lib"));
    }
    catch (err) {
        if (err['httpStatusCode'] && 
            err['httpStatusCode'] == 404)
        {
            exeUrl = `https://nodejs.org/dist/v${version}/node.exe`;
            libUrl = `https://nodejs.org/dist/v${version}/node.lib`;

            await toolLib.downloadTool(exeUrl, path.join(tempDir, "node.exe"));
            await toolLib.downloadTool(libUrl, path.join(tempDir, "node.lib"));
        }
        else {
            throw err;
        }
    }
    return await toolLib.cacheDir(tempDir, 'node', version, osArch);
}

function getArch(): string {
    let force32bit: boolean = taskLib.getBoolInput('force32bit', false);
    let arch: string = os.arch();
    if (arch === 'ia32' || force32bit) {
        arch = 'x86';
    }
    if (arch === 'arm') {
        const result: toolRunner.IExecSyncResult = taskLib.execSync('bash', ['uname', '-m']);
        arch = result.stdout.toString().trim();
    }
    return arch;
}

run();
