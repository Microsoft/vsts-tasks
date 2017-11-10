import tl = require('vsts-task-lib/task');
const readline = require('readline');
const fs = require('fs');

import { ToolRunner } from 'vsts-task-lib/toolrunner';

// These fallback paths are checked if a XCODE_N_DEVELOPER_DIR environment variable is not found.
// Using the environment variable for resolution is preferable to these hardcoded paths.
const fallbackDeveloperDirs = {
    "8": "/Applications/Xcode_8.3.3.app/Contents/Developer",
    "9": "/Applications/Xcode_9.app/Contents/Developer"
};

export function setTaskState(variableName: string, variableValue: string) {
    if (agentSupportsTaskState()) {
        tl.setTaskVariable(variableName, variableValue);
    }
}

export function getTaskState(variableName: string) {
    if (agentSupportsTaskState()) {
        return tl.getTaskVariable(variableName);
    }
}

export function findDeveloperDir(xcodeVersion: string): string {
    tl.debug(tl.loc('LocateXcodeBasedOnVersion', xcodeVersion));

    // xcodeVersion should be in the form of "8" or "9".
    // envName for version 9.*.* would be "XCODE_9_DEVELOPER_DIR"
    let envName = `XCODE_${xcodeVersion}_DEVELOPER_DIR`;
    let discoveredDeveloperDir = tl.getVariable(envName);
    if (!discoveredDeveloperDir) {
        discoveredDeveloperDir = fallbackDeveloperDirs[xcodeVersion];

        if (discoveredDeveloperDir && !tl.exist(discoveredDeveloperDir)) {
            tl.debug(`Ignoring fallback developer path. ${discoveredDeveloperDir} doesn't exist.`);
            discoveredDeveloperDir = undefined;
        }

        if (!discoveredDeveloperDir) {
            throw new Error(tl.loc('FailedToLocateSpecifiedXcode', xcodeVersion, envName));
        }
    }

    return discoveredDeveloperDir;
}

export function buildDestinationArgs(platform: string, devices: string[], targetingSimulators: boolean): string[] {
    let destinations: string[] = [];

    devices.forEach((device: string) => {
        device = device.trim();

        let destination;
        if (device) {
            if (targetingSimulators) {
                destination = `platform=${platform} Simulator`;
            }
            else {
                destination = `platform=${platform}`;
            }

            let matches = device.match(/([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})/);
            if (matches) {
                destination += `,id=${matches[0]}`;
            }
            else {
                // First check for both name and OS version number being supplied. Examples: "iPhone 6s (9.3)" or "iPhone X (latest)".
                // We could skip this regex for real devices, but it is probably better to warn the user than to have them wonder why
                // we're not parsing the OS version.
                matches = device.match(/(.*)\(([0-9.]+|latest)\)/);
                if (matches) {
                    if (!targetingSimulators) {
                        tl.warning(tl.loc('OSSpecifierNotSupported'));
                    }
                    destination += `,name=${matches[1].trim()}`;
                    destination += `,OS=${matches[2]}`;
                }
                else {
                    destination += `,name=${device}`;
                }
            }
        }

        if (destination) {
            tl.debug(`Constructed destination: ${destination}`);
            destinations.push(destination);
        }
    });

    return destinations;
}

/**
 * Queries the schemes in a workspace.
 * @param xcbuild xcodebuild path
 * @param workspace workspace path
 *
 * Testing shows Xcode 9 returns shared schemes only (a good thing).
 */
export async function getWorkspaceSchemes(xcbuild: string, workspace: string) : Promise<string[]> {
    let xcv: ToolRunner = tl.tool(xcbuild);
    xcv.arg(['-workspace', workspace]);
    xcv.arg('-list');

    let schemes: string[] = [];
    let inSchemesSection = false;

    let output = '';
    xcv.on('stdout', (data) => {
        output = output + data.toString();
    });
    await xcv.exec();

    output.split('\n').forEach((line: string) => {
        tl.debug(`Line: ${line}`);

        line = line.trim();

        if (inSchemesSection) {
            if (line !== '') {
                tl.debug(`Scheme: ${line}`);
                schemes.push(line);
            }
            else {
                inSchemesSection = false;
            }
        }
        else if (line === 'Schemes:') {
            inSchemesSection = true;
        }
    });

    return schemes;
}

/**
 * Returns the first provisioning/signing style found in workspace's project files: "auto", "manual" or undefined if not found.
 */
export async function getProvisioningStyle(workspace: string) : Promise<string> {
    let provisioningStyle: string;

    if (workspace) {
        let pbxProjectPath = getPbxProjectPath(workspace);
        tl.debug(`pbxProjectPath is ${pbxProjectPath}`);

        if (pbxProjectPath) {
            provisioningStyle = await getProvisioningStyleFromPbxProject(pbxProjectPath);
            tl.debug(`pbxProjectPath provisioning style: ${provisioningStyle}`);
        }
    }

    return provisioningStyle;
}

function getPbxProjectPath(workspace: string) {
    if (workspace && workspace.trim().toLowerCase().endsWith('.xcworkspace')) {
        let pbxProjectPath: string = workspace.trim().toLowerCase().replace('.xcworkspace', '.pbxproj');

        if (pathExistsAsFile(pbxProjectPath)) {
            return pbxProjectPath;
        }
        else {
            tl.debug("Corresponding pbxProject file doesn't exist: " + pbxProjectPath);
        }
    }
}

function getProvisioningStyleFromPbxProject(pbxProjectPath) : Promise<string> {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input: fs.createReadStream(pbxProjectPath)
        });
        let firstProvisioningStyleFound = false;
        let linesExamined = 0;
        rl.on('line', (line) => {
            if (!firstProvisioningStyleFound) {
                linesExamined++;
                let trimmedLine = line.trim();
                if (trimmedLine === 'ProvisioningStyle = Automatic;') {
                    tl.debug(`first provisioning style line: ${line}`);
                    firstProvisioningStyleFound = true;
                    resolve("auto");
                }
                else if (trimmedLine === 'ProvisioningStyle = Manual;') {
                    tl.debug(`first provisioning style line: ${line}`);
                    firstProvisioningStyleFound = true;
                    resolve("manual");
                }
            }
        }).on('close', () => {
            if (!firstProvisioningStyleFound) {
                tl.debug(`close event occurred before a provisioning style was found in the pbxProject file. Lines examined: ${linesExamined}`);
                resolve(undefined);
            }
        });
    });
}

export function pathExistsAsFile(path: string) {
    try {
        return tl.stats(path).isFile();
    }
    catch (error) {
        return false;
    }
}

function agentSupportsTaskState() {
    let agentSupportsTaskState = true;
    try {
        tl.assertAgent('2.115.0');
    } catch (e) {
        agentSupportsTaskState = false;
    }
    return agentSupportsTaskState;
}
