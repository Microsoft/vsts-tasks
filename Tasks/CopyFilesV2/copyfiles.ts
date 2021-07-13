import fs = require('fs');
import path = require('path');
import tl = require('azure-pipelines-task-lib/task');

/**
 * Input task data - including some processed inputs
 * This data is consistent between retries
 */
interface ITaskInputData {
    contents: string[];
    cleanTargetFolder: boolean;
    overWrite: boolean;
    flattenFolders: boolean;
    preserveTimestamp: boolean;
    ignoreMakeDirErrors: boolean;
    retryCount: number;
}

/**
 * Shows timestamp change operation results
 * @param fileStats file stats
 * @param err error - null if there is no error
 */
function displayTimestampChangeResults(
    fileStats: tl.FsStats,
    err: NodeJS.ErrnoException
) {
    if (err) {
        console.warn(`Problem applying the timestamp: ${err}`);
    } else {
        console.log(`Timestamp preserved successfully - access time: ${fileStats.atime}, modified time: ${fileStats.mtime}`)
    }
}

/**
 * Creates the full path with folders in between. Will throw an error if it fails
 * If ignoreErrors is true - ignores the errors.
 * @param targetFolder target folder. For more details see https://github.com/Microsoft/azure-pipelines-task-lib/blob/master/node/docs/azure-pipelines-task-lib.md#taskmkdirP
 * @param ignoreErrors ignore errors during creation of target folder.
 */
function makeDirP(targetFolder: string, ignoreErrors: boolean): void {
    try {
        tl.mkdirP(targetFolder);
    } catch (err) {
        if (ignoreErrors) {
            console.log(`Unable to create target folder (${targetFolder}): ${err}. Ignoring this as error since 'ignoreErrors' is true.`);
        } else {
            throw err;
        }
    }
}

/**
 * Main Copy files task logic
 * @param retryCount count of retries for copying operation
 */
function main(inputsData: ITaskInputData) {
    const {
        contents,
        cleanTargetFolder,
        overWrite,
        flattenFolders,
        preserveTimestamp,
        ignoreMakeDirErrors,
        retryCount,
    } = inputsData;

    let sourceFolder: string = tl.getPathInput('SourceFolder', true, true);
    const targetFolder: string = tl.getPathInput('TargetFolder', true);

    sourceFolder = path.normalize(sourceFolder);

    let allPaths: string[] = tl.find(sourceFolder, findOptions);
    let sourceFolderPattern = sourceFolder.replace('[', '[[]'); // directories can have [] in them, and they have special meanings as a pattern, so escape them
    const matchedPaths: string[] = tl.match(allPaths, contents, sourceFolderPattern); // default match options
    const matchedFiles: string[] = matchedPaths.filter((itemPath: string) => !tl.stats(itemPath).isDirectory()); // filter-out directories

    // copy the files to the target folder
    console.log(tl.loc('FoundNFiles', matchedFiles.length));

    if (matchedFiles.length > 0) {
        // clean target folder if required
        if (cleanTargetFolder) {
            console.log(tl.loc('CleaningTargetFolder', targetFolder));

            // stat the targetFolder path
            let targetFolderStats: tl.FsStats;
            try {
                targetFolderStats = tl.stats(targetFolder);
            }
            catch (err) {
                if (err.code != 'ENOENT') {
                    throw err;
                }
            }

            if (targetFolderStats) {
                if (targetFolderStats.isDirectory()) {
                    // delete the child items
                    fs.readdirSync(targetFolder)
                        .forEach((item: string) => {
                            let itemPath = path.join(targetFolder, item);
                            tl.rmRF(itemPath);
                        });
                }
                else {
                    // targetFolder is not a directory. delete it.
                    tl.rmRF(targetFolder);
                }
            }
        }

        // make sure the target folder exists
        makeDirP(targetFolder, ignoreMakeDirErrors);
        let createdFolders: { [folder: string]: boolean } = {};
        matchedFiles.forEach((file: string) => {
            let relativePath;
            if (flattenFolders) {
                relativePath = path.basename(file);
            } else {
                relativePath = file.substring(sourceFolder.length);

                // trim leading path separator
                // note, assumes normalized above
                if (relativePath.startsWith(path.sep)) {
                    relativePath = relativePath.substr(1);
                }
            }

            let targetPath = path.join(targetFolder, relativePath);
            let targetDir = path.dirname(targetPath);

            if (!createdFolders[targetDir]) {
                makeDirP(targetDir, ignoreMakeDirErrors);
                createdFolders[targetDir] = true;
            }

            // stat the target
            let targetStats: tl.FsStats;
            if (!cleanTargetFolder) { // optimization - no need to check if relative target exists when CleanTargetFolder=true
                try {
                    targetStats = tl.stats(targetPath);
                }
                catch (err) {
                    if (err.code != 'ENOENT') {
                        throw err;
                    }
                }
            }

            // validate the target is not a directory
            if (targetStats && targetStats.isDirectory()) {
                throw new Error(tl.loc('TargetIsDir', file, targetPath));
            }

            if (!overWrite) {
                if (targetStats) { // exists, skip
                    console.log(tl.loc('FileAlreadyExistAt', file, targetPath));
                }
                else { // copy
                    console.log(tl.loc('CopyingTo', file, targetPath));
                    tl.cp(file, targetPath, undefined, undefined, retryCount);
                    if (preserveTimestamp) {
                        try {
                            const fileStats = tl.stats(file);
                            fs.utimes(targetPath, fileStats.atime, fileStats.mtime, (err) => {
                                displayTimestampChangeResults(fileStats, err);
                            });
                        }
                        catch (err) {
                            console.warn(`Problem preserving the timestamp: ${err}`)
                        }
                    }
                }
            }
            else {
                console.log(tl.loc('CopyingTo', file, targetPath));
                if (process.platform == 'win32' && targetStats && (targetStats.mode & 146) != 146) {
                    // The readonly attribute can be interpreted by performing a bitwise-AND operation on
                    // "fs.Stats.mode" and the integer 146. The integer 146 represents "-w--w--w-" or (128 + 16 + 2),
                    // see following chart:
                    //     R   W  X  R  W X R W X
                    //   256 128 64 32 16 8 4 2 1
                    //
                    // "fs.Stats.mode" on Windows is based on whether the readonly attribute is set.
                    // If the readonly attribute is set, then the mode is set to "r--r--r--".
                    // If the readonly attribute is not set, then the mode is set to "rw-rw-rw-".
                    //
                    // Note, additional bits may also be set (e.g. if directory). Therefore, a bitwise
                    // comparison is appropriate.
                    //
                    // For additional information, refer to the fs source code and ctrl+f "st_mode":
                    //   https://github.com/nodejs/node/blob/v5.x/deps/uv/src/win/fs.c#L1064
                    tl.debug(`removing readonly attribute on '${targetPath}'`);
                    fs.chmodSync(targetPath, targetStats.mode | 146);
                }

                tl.cp(file, targetPath, "-f", undefined, retryCount);
                if (preserveTimestamp) {
                    try {
                        const fileStats: tl.FsStats = tl.stats(file);
                        fs.utimes(targetPath, fileStats.atime, fileStats.mtime, (err) => {
                            displayTimestampChangeResults(fileStats, err);
                        });
                    }
                    catch (err) {
                        console.warn(`Problem preserving the timestamp: ${err}`)
                    }
                }
            }
        });
    }
}
/**
 * Executes task logic with specifies amount of retries
 * @param retryCount count of retries for copying operation
 */
function runWithRetries(taskInputData: ITaskInputData) {
    while (taskInputData.retryCount >= 0) {
        try {
            main(taskInputData);
            break;
        } catch (e) {
            let errorMessage = `Error while task execution: ${e}.`;
            if (taskInputData.retryCount) {
                errorMessage += ` Remaining attempts: ${taskInputData.retryCount}`;
                console.log(errorMessage);
            } else {
                tl.setResult(tl.TaskResult.Failed, e);
            }
        }

        --taskInputData.retryCount;
    }
}

function readInputsData(): ITaskInputData {
    const taskInputsData: ITaskInputData = {
        contents: tl.getDelimitedInput('Contents', '\n', true),
        cleanTargetFolder: tl.getBoolInput('CleanTargetFolder', false),
        overWrite: tl.getBoolInput('OverWrite', false),
        flattenFolders: tl.getBoolInput('flattenFolders', false),
        preserveTimestamp: tl.getBoolInput('preserveTimestamp', false),
        ignoreMakeDirErrors: tl.getBoolInput('ignoreMakeDirErrors', false),
        retryCount: parseInt(tl.getInput('retryCount')),
    };

    if (isNaN(taskInputsData.retryCount) || taskInputsData.retryCount < 0) {
        taskInputsData.retryCount = 0;
    }

    return taskInputsData;
}

// we allow broken symlinks - since there could be broken symlinks found in source folder, but filtered by contents pattern
const findOptions: tl.FindOptions = {
    allowBrokenSymbolicLinks: true,
    followSpecifiedSymbolicLink: true,
    followSymbolicLinks: true
};

tl.setResourcePath(path.join(__dirname, 'task.json'));

const taskInputData: ITaskInputData = readInputsData();

runWithRetries(taskInputData);