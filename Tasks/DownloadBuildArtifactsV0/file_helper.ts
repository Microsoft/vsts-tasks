import { Stats, statSync as getFile, readdirSync } from 'fs';
import * as path from 'path';

import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-task-lib/toolrunner';

import * as models from 'artifact-engine/Models';

/**
 * Get size of file on local storage
 * @param  {string} path - path to the file in local storage
 * @throws Exception if path to the file is empty
 * @returns Size of the file in bytes
 */
export function getFileSizeInBytes(path: string): number {
    let fileSize: number = 0;

    if (path) {
        // TODO: Add support of BigInt after migration on Node10
        const file: Stats = getFile(path);
        fileSize = file.size;
    } else {
        throw 'Path to the file is empty';
    }

    return fileSize;
}

/**
 * Looks through all downloaded files. Any files with .tar extension will get extracted to `downloadPath` and removed afterward.
 *
 * @param tickets array of artifact download tickets
 * @param downloadPath where the extracted files will be put
 * @returns void
 */
export function extractTarsIfPresent(tickets: models.ArtifactDownloadTicket[][], downloadPath: string): void {
    const flatTickets: models.ArtifactDownloadTicket[] = [].concat(...tickets);
    const tarArchivesPaths = [] as string[];

    flatTickets.forEach((ticket: models.ArtifactDownloadTicket) => {
        if (
            ticket.artifactItem.itemType === models.ItemType.File
            && ticket.artifactItem.path.endsWith('.tar')
        ) {
            tarArchivesPaths.push(path.join(downloadPath, ticket.artifactItem.path));
        }
    });

    tl.debug(`Found ${tarArchivesPaths.length} tar archives:\n${tarArchivesPaths.join('\n')}`);

    if (tarArchivesPaths.length === 0) {
        tl.warning(tl.loc('NoTarsFound'));
    } else {
        extractTars(tarArchivesPaths, downloadPath);
    }
}

const extractedTarsTempDir = 'extracted_tars';

/**
 * Calls extractTar function for each tar file path. Puts extracted files to temp directory ($(Agent.TempDirectory)/`extractedTarsTempDir`).
 * After all tars have been extracted, moves all files from `extractedTarsTempDir` to `downloadPath`
 *
 * @param tarArchivesPaths array of paths to tar archives
 * @param destination where the extracted files will be put
 * @returns void
 */
 function extractTars(tarArchivesPaths: string[], destination: string): void {
    const extractedTarsPath: string = path.join(tl.getVariable('Agent.TempDirectory'), extractedTarsTempDir);

    tarArchivesPaths.forEach((tarArchivePath: string) => {
        const tarArchiveFileName: string = path.basename(tarArchivePath);
        const artifactName: string = tarArchiveFileName.slice(0, tarArchiveFileName.length - '.tar'.length);

        const extractedFilesDir: string = path.join(extractedTarsPath, artifactName);

        extractTar(tarArchivePath, extractedFilesDir);

        // Remove tar archive after extracting
        tl.rmRF(tarArchivePath);
    });

    // Copy extracted files to the download directory
    tl.cp(`${extractedTarsPath}/.`, destination, '-r');
}

/**
 * Extracts plain (not compressed) tar archive using this command: tar xf `tarArchivePath` --directory `extractedFilesDir`
 * Throws if the operation fails.
 *
 * @param tarArchivesPath path to the tar archive
 * @param extractedFilesDir where the extracted files will be put
 * @returns void
 */
function extractTar(tarArchivePath: string, extractedFilesDir: string): void {
    const tar: tr.ToolRunner = tl.tool(tl.which('tar', true));
    tl.mkdirP(extractedFilesDir);
    tar.arg(['xf', tarArchivePath, '--directory', extractedFilesDir]);
    const tarExecResult: tr.IExecSyncResult = tar.execSync();

    if (tarExecResult.error || tarExecResult.code !== 0) {
        throw new Error(`Couldn't extract artifact files from a tar archive: ${tarExecResult.error}`);
    }
}

/**
 * Removes content from specified folder path
 * @param  {string} folderToClean - path to the folder to clean up content
 * @throws File system exeptions
 * @returns void
 */
export function cleanUpFolder(folderToClean: string): void {
    console.log(tl.loc('CleaningDestinationFolder', folderToClean));

    // stat the specified folder path
    let destinationFolderStats: tl.FsStats;
    try {
        destinationFolderStats = tl.stats(folderToClean);
    } catch (err) {
        if (err.code != 'ENOENT') {
            throw err;
        } else {
            tl.warning(tl.loc('NoFolderToClean'));
        }
    }

    if (destinationFolderStats) {
        if (destinationFolderStats.isDirectory()) {
            // delete the child items
            readdirSync(folderToClean)
                .forEach((item: string) => {
                    let itemPath = path.join(folderToClean, item);
                    tl.rmRF(itemPath);
                });
        } else {
            // specified folder is not a directory. delete it.
            tl.rmRF(folderToClean);
        }
    }
}
