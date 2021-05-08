import * as tl from 'azure-pipelines-task-lib/task';
import * as telemetry from 'azure-pipelines-tasks-utility-common/telemetry';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
    try {
        const dropValidatorArgs = ['BuildDropPath', 'ManifestPath', 'OutputPath', 'Verbosity', 'ConfigFilePath', 'RootPathFilter'];
        let dropValidator = await getDropValidator();

        dropValidatorArgs.forEach(arg => {
            const inputArgValue = tl.getInput(arg);
            dropValidator = dropValidator.argIf(inputArgValue != null, '-' + arg).argIf(inputArgValue != null, inputArgValue);
        });

        const result = await dropValidator.exec();

        if (result === 0) {
            tl.setResult(tl.TaskResult.Succeeded,  tl.loc('TaskSucceeded'));
        } else {
            tl.setResult(tl.TaskResult.Failed, tl.loc('TaskFailed'));
        }

    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    } finally {
        logTelemetry();
    }
}

async function getDropValidator() {
    const dropToolDownloadCommand = 'tool update Microsoft.DropValidator';
    const addSourceCommand = '--add-source ./local_nuget_fallback';
    const dotnetPath = tl.which('dotnet', true);

    try {
        // Get dotnet tool
        tl.debug(path.join('__dirname', 'local_nuget_fallback'));
        await createLocalToolManifest(dotnetPath);

        const dotnet = tl.tool(dotnetPath);
        // Install or update the dropvalidator tool.
        dotnet.line(dropToolDownloadCommand);
        const result = await dotnet.exec();
        tl.debug('Result from installing DropValidator tool from external source: ' + result);

        if (result === 0) {
            const dropValidatorPath = tl.which('dropvalidator', true);
            return tl.tool(dropValidatorPath);
        }

        throw new Error('Unable to install DropValidator tool from remote source');
    } catch (err) {
        tl.warning(tl.loc('Warn_InstallingToolFromLocalRepo', err));

        try {
            // External tool install failed, try installing tool from local repostiory
            const dotnet = tl.tool(dotnetPath);
            dotnet.line(dropToolDownloadCommand + ' ' + addSourceCommand);

            const result = await dotnet.exec();
            tl.debug('Result from installing DropValidator tool from local source: ' + result);

            if (result === 0) {
                const dropValidatorPath = tl.which('dropvalidator', true);
                return tl.tool(dropValidatorPath);
            }

            throw new Error('Unable to install DropValidator tool from remote or local source');
        } catch (err) {
            tl.error(tl.loc('Error_ToolInstallFailed', err));
            throw err;
        }
    }
}

async function createLocalToolManifest(dotnetToolPath: string) {
    const toolManifestCommand = 'new tool-manifest';
    const dotnet = tl.tool(dotnetToolPath);

    dotnet.line(toolManifestCommand);
    const result = await dotnet.exec();

    tl.debug('Create new tool-manifest result: ' + result);

    if (result !== 0) {
        throw new Error(tl.loc('Error_UnableToCreateLocalToolManifest'));
    }
}

function logTelemetry() {
    try {
        const output = fs.readFileSync(tl.getInput('OutputPath', true), 'UTF-8');
        const validatorSummary = JSON.parse(output).Summary;
        telemetry.emitTelemetry('Packaging', 'DropValidatorV0', validatorSummary);
    } catch (err) {
        tl.debug(tl.loc('Debug_FailedTelemetry', err));
    }
}
run();