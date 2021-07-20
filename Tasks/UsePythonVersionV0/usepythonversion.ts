import * as os from 'os';
import * as path from 'path';

import * as semver from 'semver';

import * as task from 'azure-pipelines-task-lib/task';
import * as tool from 'azure-pipelines-tool-lib/tool';

import { Platform } from './taskutil';
import * as toolUtil  from './toolutil';
import { desugarDevVersion, pythonVersionToSemantic, isExactVersion } from './versionspec';

interface TaskParameters {
    versionSpec: string,
    suppressExactVersionWarning: boolean,
    addToPath: boolean,
    architecture: string
}

// Python has "scripts" or "bin" directories where command-line tools that come with packages are installed.
// This is where pip is, along with anything that pip installs.
// There is a seperate directory for `pip install --user`.
//
// For reference, these directories are as follows:
//   macOS / Linux:
//      <sys.prefix>/bin (by default /usr/local/bin, but not on hosted agents -- see the `else`)
//      (--user) ~/.local/bin
//   Windows:
//      <Python installation dir>\Scripts
//      (--user) %APPDATA%\Python\PythonXY\Scripts
// See https://docs.python.org/3/library/sysconfig.html

function binDir(installDir: string, platform: Platform): string {
    if (platform === Platform.Windows) {
        return path.join(installDir, 'Scripts');
    } else {
        return path.join(installDir, 'bin');
    }
}

function pypyNotFoundError(versionSpec: '2' | '3.6') {
    throw new Error([
        task.loc('PyPyNotFound', versionSpec),
        // 'Python' is intentional here
        task.loc('ToolNotFoundMicrosoftHosted', 'Python', 'https://aka.ms/hosted-agent-software'),
        task.loc('ToolNotFoundSelfHosted', 'Python', 'https://go.microsoft.com/fwlink/?linkid=871498')
    ].join(os.EOL));
}

// Note on the tool cache layout for PyPy:
// PyPy has its own versioning scheme that doesn't follow the Python versioning scheme.
// A particular version of PyPy may contain one or more versions of the Python interpreter.
// For example, PyPy 7.0 contains Python 2.7, 3.5, and 3.6-alpha.
// We only care about the Python version, so we don't use the PyPy version for the tool cache.

function usePyPy(versionSpec: '2' | '3.6', parameters: TaskParameters, platform: Platform): void {
    const findPyPy = tool.findLocalTool.bind(undefined, 'PyPy', versionSpec);
    let installDir: string | null = findPyPy(parameters.architecture);

    if (!installDir && platform === Platform.Windows) {
        // PyPy only precompiles binaries for x86, but the architecture parameter defaults to x64.
        // On Hosted VS2017, we only install an x86 version.
        // Fall back to x86.
        installDir = findPyPy('x86');
    }

    if (!installDir) {
        // PyPy not installed in $(Agent.ToolsDirectory)
        throw pypyNotFoundError(versionSpec);
    }

    const _binDir = path.join(installDir, 'bin');

    // On Linux and macOS, the Python interpreter is in 'bin'.
    // On Windows, it is in the installation root.
    const pythonLocation = platform === Platform.Windows ? installDir : _binDir;
    task.setVariable('pythonLocation', pythonLocation);

    if (parameters.addToPath) {
        toolUtil.prependPathSafe(installDir);
        toolUtil.prependPathSafe(_binDir);
        // Starting from PyPy 7.3.1, the folder that is used for pip and anything that pip installs should be "Scripts" on Windows.
        if (platform === Platform.Windows) {
            toolUtil.prependPathSafe(path.join(installDir, 'Scripts'));
        }
    }
}

async function useCpythonVersion(parameters: Readonly<TaskParameters>, platform: Platform): Promise<void> {
    const desugaredVersionSpec = desugarDevVersion(parameters.versionSpec);
    const semanticVersionSpec = pythonVersionToSemantic(desugaredVersionSpec);
    task.debug(`Semantic version spec of ${parameters.versionSpec} is ${semanticVersionSpec}`);

    if (!parameters.suppressExactVersionWarning && isExactVersion(semanticVersionSpec)) {
        task.warning(task.loc('ExactVersionNotRecommended'));
    }

    const installDir: string | null = tool.findLocalTool('Python', semanticVersionSpec, parameters.architecture);
    if (!installDir) {
        // Fail and list available versions
        const x86Versions = tool.findLocalToolVersions('Python', 'x86')
            .map(s => `${s} (x86)`)
            .join(os.EOL);

        const x64Versions = tool.findLocalToolVersions('Python', 'x64')
            .map(s => `${s} (x64)`)
            .join(os.EOL);

        throw new Error([
            task.loc('VersionNotFound', parameters.versionSpec, parameters.architecture),
            task.loc('ListAvailableVersions', task.getVariable('Agent.ToolsDirectory')),
            x86Versions,
            x64Versions,
            task.loc('ToolNotFoundMicrosoftHosted', 'Python', 'https://aka.ms/hosted-agent-software'),
            task.loc('ToolNotFoundSelfHosted', 'Python', 'https://go.microsoft.com/fwlink/?linkid=871498')
        ].join(os.EOL));
    }

    task.setVariable('pythonLocation', installDir);
    if (parameters.addToPath) {
        toolUtil.prependPathSafe(installDir);
        toolUtil.prependPathSafe(binDir(installDir, platform))

        if (platform === Platform.Windows) {
            // Add --user directory
            // `installDir` from tool cache should look like $AGENT_TOOLSDIRECTORY/Python/<semantic version>/x64/
            // So if `findLocalTool` succeeded above, we must have a conformant `installDir`
            const version = path.basename(path.dirname(installDir));
            const major = semver.major(version);
            const minor = semver.minor(version);

            const userScriptsDir = path.join(process.env['APPDATA'] as string, 'Python', `Python${major}${minor}`, 'Scripts');
            toolUtil.prependPathSafe(userScriptsDir);
        }
        // On Linux and macOS, pip will create the --user directory and add it to PATH as needed.
    }
}

export async function usePythonVersion(parameters: Readonly<TaskParameters>, platform: Platform): Promise<void> {
    switch (parameters.versionSpec.toUpperCase()) {
        case 'PYPY2':
            return usePyPy('2', parameters, platform);
        case 'PYPY3':
            // keep pypy3 pointing to 3.6 for backward compatibility
            return usePyPy('3.6', parameters, platform);
        default:
            return await useCpythonVersion(parameters, platform);
    }
}
