import * as path from 'path';
import * as task from 'azure-pipelines-task-lib/task';
import * as telemetry from 'azure-pipelines-tasks-utility-common/telemetry'
import { getPlatform } from './taskutil';
import { usePythonVersion } from './usepythonversion';

(async () => {
    try {
        task.setResourcePath(path.join(__dirname, 'task.json'));
        const versionSpec = task.getInput('versionSpec', true);
        const suppressExactVersionWarning = task.getBoolInput('suppressExactVersionWarning', false);
        const addToPath = task.getBoolInput('addToPath', true);
        const architecture = task.getInput('architecture', true);
        await usePythonVersion({
            versionSpec,
            suppressExactVersionWarning,
            addToPath,
            architecture
        },
        getPlatform());
        task.setResult(task.TaskResult.Succeeded, "");
        telemetry.emitTelemetry('TaskHub', 'UsePythonVersionV0', {
            versionSpec,
            suppressExactVersionWarning,
            addToPath,
            architecture
        });
    } catch (error) {
        task.setResult(task.TaskResult.Failed, error.message);
    }
})();
