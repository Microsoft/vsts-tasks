// parse command line options
var minimist = require('minimist');
var mopts = {
    string: [
        'node',
        'runner',
        'server',
        'suite',
        'task',
        'version'
    ]
};
var options = minimist(process.argv, mopts);

// remove well-known parameters from argv before loading make,
// otherwise each arg will be interpreted as a make target
process.argv = options._;

// modules
var make = require('shelljs/make');
var fs = require('fs');
var os = require('os');
var path = require('path');
var semver = require('semver');
var util = require('./make-util');
var admzip = require('adm-zip');

// util functions
var cd = util.cd;
var cp = util.cp;
var mkdir = util.mkdir;
var rm = util.rm;
var test = util.test;
var run = util.run;
var banner = util.banner;
var rp = util.rp;
var fail = util.fail;
var ensureExists = util.ensureExists;
var pathExists = util.pathExists;
var buildNodeTask = util.buildNodeTask;
var addPath = util.addPath;
var copyTaskResources = util.copyTaskResources;
var matchFind = util.matchFind;
var matchCopy = util.matchCopy;
var ensureTool = util.ensureTool;
var assert = util.assert;
var getExternals = util.getExternals;
var createResjson = util.createResjson;
var createTaskLocJson = util.createTaskLocJson;
var validateTask = util.validateTask;
var fileToJson = util.fileToJson;
var createYamlSnippetFile = util.createYamlSnippetFile;
var createMarkdownDocFile = util.createMarkdownDocFile;
var getTaskNodeVersion = util.getTaskNodeVersion;

// global paths
var buildPath = path.join(__dirname, '_build', 'Tasks');
var buildTestsPath = path.join(__dirname, '_build', 'Tests');
var commonPath = path.join(__dirname, '_build', 'Tasks', 'Common');
var packagePath = path.join(__dirname, '_package');
var legacyTestPath = path.join(__dirname, '_test', 'Tests-Legacy');
var legacyTestTasksPath = path.join(__dirname, '_test', 'Tasks');

// node min version
var minNodeVer = '6.10.3';
if (semver.lt(process.versions.node, minNodeVer)) {
    fail('requires node >= ' + minNodeVer + '.  installed: ' + process.versions.node);
}

// Node 14 is supported by the build system, but not currently by the agent. Block it for now
var supportedNodeTargets = ["Node", "Node10"/*, "Node14"*/];

// add node modules .bin to the path so we can dictate version of tsc etc...
var binPath = path.join(__dirname, 'node_modules', '.bin');
if (!test('-d', binPath)) {
    fail('node modules bin not found.  ensure npm install has been run.');
}
addPath(binPath);

// resolve list of tasks
var taskList;
if (options.task) {
    // find using --task parameter
    taskList = matchFind(options.task, path.join(__dirname, 'Tasks'), { noRecurse: true, matchBase: true })
        .map(function (item) {
            return path.basename(item);
        });
    if (!taskList.length) {
        fail('Unable to find any tasks matching pattern ' + options.task);
    }
}
else {
    // load the default list
    taskList = fileToJson(path.join(__dirname, 'make-options.json')).tasks;
}

// set the runner options. should either be empty or a comma delimited list of test runners.
// for example: ts OR ts,ps
//
// note, currently the ts runner igores this setting and will always run.
process.env['TASK_TEST_RUNNER'] = options.runner || '';

target.clean = function () {
    rm('-Rf', path.join(__dirname, '_build'));
    mkdir('-p', buildPath);
    rm('-Rf', path.join(__dirname, '_test'));
};

//
// Generate documentation (currently only YAML snippets)
// ex: node make.js gendocs
// ex: node make.js gendocs --task ShellScript
//
target.gendocs = function() {
    var docsDir = path.join(__dirname, '_gendocs');
    rm('-Rf', docsDir);
    mkdir('-p', docsDir);
    console.log();
    console.log('> generating docs');

    taskList.forEach(function(taskName) {
        var taskPath = path.join(__dirname, 'Tasks', taskName);
        ensureExists(taskPath);

        // load the task.json
        var taskJsonPath = path.join(taskPath, 'task.json');
        if (test('-f', taskJsonPath)) {
            var taskDef = fileToJson(taskJsonPath);
            validateTask(taskDef);

            // create YAML snippet Markdown
            var yamlOutputFilename = taskName + '.md';
            createYamlSnippetFile(taskDef, docsDir, yamlOutputFilename);

            // create Markdown documentation file
            var mdDocOutputFilename = taskName + '.md';
            createMarkdownDocFile(taskDef, taskJsonPath, docsDir, mdDocOutputFilename);
        }
    });

    banner('Generating docs successful', true);
}

//
// ex: node make.js build
// ex: node make.js build --task ShellScript
//
target.build = function() {
    target.clean();

    ensureTool('tsc', '--version', 'Version 2.3.4');
    ensureTool('npm', '--version', function (output) {
        if (semver.lt(output, '5.6.0')) {
            fail('Expected 5.6.0 or higher. To fix, run: npm install -g npm');
        }
    });

    taskList.forEach(function(taskName) {
        banner('Building: ' + taskName);
        var taskPath = path.join(__dirname, 'Tasks', taskName);
        ensureExists(taskPath);

        // load the task.json
        var outDir;
        var shouldBuildNode = test('-f', path.join(taskPath, 'tsconfig.json'));
        var taskJsonPath = path.join(taskPath, 'task.json');
        if (test('-f', taskJsonPath)) {
            var taskDef = fileToJson(taskJsonPath);
            validateTask(taskDef);

            // fixup the outDir (required for relative pathing in legacy L0 tests)
            outDir = path.join(buildPath, taskName);

            // create loc files
            createTaskLocJson(taskPath);
            createResjson(taskDef, taskPath);

            // determine the type of task
            shouldBuildNode = shouldBuildNode || supportedNodeTargets.some(node => taskDef.execution.hasOwnProperty(node));
        }
        else {
            outDir = path.join(buildPath, path.basename(taskPath));
        }

        mkdir('-p', outDir);

        // get externals
        var taskMakePath = path.join(taskPath, 'make.json');
        var taskMake = test('-f', taskMakePath) ? fileToJson(taskMakePath) : {};
        if (taskMake.hasOwnProperty('externals')) {
            console.log('');
            console.log('> getting task externals');
            getExternals(taskMake.externals, outDir);
        }

        //--------------------------------
        // Common: build, copy, install
        //--------------------------------
        var commonPacks = [];
        if (taskMake.hasOwnProperty('common')) {
            var common = taskMake['common'];

            common.forEach(function(mod) {
                var modPath = path.join(taskPath, mod['module']);
                var modName = path.basename(modPath);
                var modOutDir = path.join(commonPath, modName);

                if (!test('-d', modOutDir)) {
                    banner('Building module ' + modPath, true);

                    mkdir('-p', modOutDir);

                    // create loc files
                    var modJsonPath = path.join(modPath, 'module.json');
                    if (test('-f', modJsonPath)) {
                        createResjson(fileToJson(modJsonPath), modPath);
                    }

                    // npm install and compile
                    if ((mod.type === 'node' && mod.compile == true) || test('-f', path.join(modPath, 'tsconfig.json'))) {
                        buildNodeTask(modPath, modOutDir);
                    }

                    // copy default resources and any additional resources defined in the module's make.json
                    console.log();
                    console.log('> copying module resources');
                    var modMakePath = path.join(modPath, 'make.json');
                    var modMake = test('-f', modMakePath) ? fileToJson(modMakePath) : {};
                    copyTaskResources(modMake, modPath, modOutDir);

                    // get externals
                    if (modMake.hasOwnProperty('externals')) {
                        console.log('');
                        console.log('> getting module externals');
                        getExternals(modMake.externals, modOutDir);
                    }

                    if (mod.type === 'node' && mod.compile == true || test('-f', path.join(modPath, 'package.json'))) {
                        var commonPack = util.getCommonPackInfo(modOutDir);

                        // assert the pack file does not already exist (name should be unique)
                        if (test('-f', commonPack.packFilePath)) {
                            fail(`Pack file already exists: ${commonPack.packFilePath}`);
                        }

                        // pack the Node module. a pack file is required for dedupe.
                        // installing from a folder creates a symlink, and does not dedupe.
                        cd(path.dirname(modOutDir));
                        run(`npm pack ./${path.basename(modOutDir)}`);
                    }
                }

                // store the npm pack file info
                if (mod.type === 'node' && mod.compile == true) {
                    commonPacks.push(util.getCommonPackInfo(modOutDir));
                }
                // copy ps module resources to the task output dir
                else if (mod.type === 'ps') {
                    console.log();
                    console.log('> copying ps module to task');
                    var dest;
                    if (mod.hasOwnProperty('dest')) {
                        dest = path.join(outDir, mod.dest, modName);
                    }
                    else {
                        dest = path.join(outDir, 'ps_modules', modName);
                    }

                    matchCopy('!Tests', modOutDir, dest, { noRecurse: true, matchBase: true });
                }
            });

            // npm install the common modules to the task dir
            if (commonPacks.length) {
                cd(taskPath);
                var installPaths = commonPacks.map(function (commonPack) {
                    return `file:${path.relative(taskPath, commonPack.packFilePath)}`;
                });
                run(`npm install --save-exact ${installPaths.join(' ')}`);
            }
        }

        // build Node task
        if (shouldBuildNode) {
            buildNodeTask(taskPath, outDir);
        }

        // remove the hashes for the common packages, they change every build
        if (commonPacks.length) {
            var lockFilePath = path.join(taskPath, 'package-lock.json');
            if (!test('-f', lockFilePath)) {
                lockFilePath = path.join(taskPath, 'npm-shrinkwrap.json');
            }
            var packageLock = fileToJson(lockFilePath);
            Object.keys(packageLock.dependencies).forEach(function (dependencyName) {
                commonPacks.forEach(function (commonPack) {
                    if (dependencyName == commonPack.packageName) {
                        delete packageLock.dependencies[dependencyName].integrity;
                    }
                });
            });
            fs.writeFileSync(lockFilePath, JSON.stringify(packageLock, null, '  '));
        }

        // copy default resources and any additional resources defined in the task's make.json
        console.log();
        console.log('> copying task resources');
        copyTaskResources(taskMake, taskPath, outDir);
    });

    banner('Build successful', true);
}

//
// will run tests for the scope of tasks being built
// npm test
// node make.js test
// node make.js test --task ShellScript --suite L0
//
target.test = function() {
    ensureTool('tsc', '--version', 'Version 2.3.4');
    ensureTool('mocha', '--version', '2.3.3');

    // build the general tests and ps test infra
    rm('-Rf', buildTestsPath);
    mkdir('-p', path.join(buildTestsPath));
    cd(path.join(__dirname, 'Tests'));
    run(`tsc --rootDir ${path.join(__dirname, 'Tests')} --outDir ${buildTestsPath}`);
    console.log();
    console.log('> copying ps test lib resources');
    mkdir('-p', path.join(buildTestsPath, 'lib'));
    matchCopy(path.join('**', '@(*.ps1|*.psm1)'), path.join(__dirname, 'Tests', 'lib'), path.join(buildTestsPath, 'lib'));

    var suiteType = options.suite || 'L0';
    function runTaskTests(taskName) {
        banner('Testing: ' + taskName);
        // find the tests
        var nodeVersion = options.node || getTaskNodeVersion(buildPath, taskName) + "";
        var pattern1 = path.join(buildPath, taskName, 'Tests', suiteType + '.js');
        var pattern2 = path.join(buildPath, 'Common', taskName, 'Tests', suiteType + '.js');

        var testsSpec = [];

        if (fs.existsSync(pattern1)) {
            testsSpec.push(pattern1);
        }
        if (fs.existsSync(pattern2)) {
            testsSpec.push(pattern2);
        }

        if (testsSpec.length == 0) {
            console.warn(`Unable to find tests using the following patterns: ${JSON.stringify([pattern1, pattern2])}`);
            return;
        }

        // setup the version of node to run the tests
        util.installNode(nodeVersion);

        run('mocha ' + testsSpec.join(' ') /*+ ' --reporter mocha-junit-reporter --reporter-options mochaFile=../testresults/test-results.xml'*/, /*inheritStreams:*/true);
    }

    if (options.task) {
        runTaskTests(options.task);
    } else {
        // Run tests for each task that exists
        taskList.forEach(function(taskName) {
            var taskPath = path.join(buildPath, taskName);
            if (fs.existsSync(taskPath)) {
                runTaskTests(taskName);
            }
        });

        banner('Running common library tests');
        var commonLibPattern = path.join(buildPath, 'Common', '*', 'Tests', suiteType + '.js');
        var specs = [];
        if (matchFind(commonLibPattern, buildPath).length > 0) {
            specs.push(commonLibPattern);
        }
        if (specs.length > 0) {
            // setup the version of node to run the tests
            util.installNode(options.node);
            run('mocha ' + specs.join(' ') /*+ ' --reporter mocha-junit-reporter --reporter-options mochaFile=../testresults/test-results.xml'*/, /*inheritStreams:*/true);
        } else {
            console.warn("No common library tests found");
        }
    }

    // Run common tests
    banner('Running common tests');
    var commonPattern = path.join(buildTestsPath, suiteType + '.js');
    var specs = matchFind(commonPattern, buildTestsPath, { noRecurse: true });
    if (specs.length > 0) {
        // setup the version of node to run the tests
        util.installNode(options.node);
        run('mocha ' + specs.join(' ') /*+ ' --reporter mocha-junit-reporter --reporter-options mochaFile=../testresults/test-results.xml'*/, /*inheritStreams:*/true);
    } else {
        console.warn("No common tests found");
    }
}

//
// node make.js testLegacy
// node make.js testLegacy --suite L0/XCode
//

target.testLegacy = function() {
    ensureTool('tsc', '--version', 'Version 2.3.4');
    ensureTool('mocha', '--version', '2.3.3');

    if (options.suite) {
        fail('The "suite" parameter has been deprecated. Use the "task" parameter instead.');
    }

    // clean
    console.log('removing _test');
    rm('-Rf', path.join(__dirname, '_test'));

    // copy the L0 source files for each task; copy the layout for each task
    console.log();
    console.log('> copying tasks');
    taskList.forEach(function (taskName) {
        var testCopySource = path.join(__dirname, 'Tests-Legacy', 'L0', taskName);
        // copy the L0 source files if exist
        if (test('-e', testCopySource)) {
            console.log('copying ' + taskName);
            var testCopyDest = path.join(legacyTestPath, 'L0', taskName);
            matchCopy('*', testCopySource, testCopyDest, { noRecurse: true, matchBase: true });

            // copy the task layout
            var taskCopySource = path.join(buildPath, taskName);
            var taskCopyDest = path.join(legacyTestTasksPath, taskName);
            matchCopy('*', taskCopySource, taskCopyDest, { noRecurse: true, matchBase: true });
        }

        // copy each common-module L0 source files if exist
        var taskMakePath = path.join(__dirname, 'Tasks', taskName, 'make.json');
        var taskMake = test('-f', taskMakePath) ? fileToJson(taskMakePath) : {};
        if (taskMake.hasOwnProperty('common')) {
            var common = taskMake['common'];
            common.forEach(function(mod) {
                // copy the common-module L0 source files if exist and not already copied
                var modName = path.basename(mod['module']);
                console.log('copying ' + modName);
                var modTestCopySource = path.join(__dirname, 'Tests-Legacy', 'L0', `Common-${modName}`);
                var modTestCopyDest = path.join(legacyTestPath, 'L0', `Common-${modName}`);
                if (test('-e', modTestCopySource) && !test('-e', modTestCopyDest)) {
                    matchCopy('*', modTestCopySource, modTestCopyDest, { noRecurse: true, matchBase: true });
                }
                var modCopySource = path.join(commonPath, modName);
                var modCopyDest = path.join(legacyTestTasksPath, 'Common', modName);
                if (test('-e', modCopySource) && !test('-e', modCopyDest)) {
                    // copy the common module layout
                    matchCopy('*', modCopySource, modCopyDest, { noRecurse: true, matchBase: true });
                }
            });
        }
    });

    // short-circuit if no tests
    if (!test('-e', legacyTestPath)) {
        banner('no legacy tests found', true);
        return;
    }

    // copy the legacy test infra
    console.log();
    console.log('> copying legacy test infra');
    matchCopy('@(definitions|lib|tsconfig.json)', path.join(__dirname, 'Tests-Legacy'), legacyTestPath, { noRecurse: true, matchBase: true });

    // copy the lib tests when running all legacy tests
    if (!options.task) {
        matchCopy('*', path.join(__dirname, 'Tests-Legacy', 'L0', 'lib'), path.join(legacyTestPath, 'L0', 'lib'), { noRecurse: true, matchBase: true });
    }

    // compile legacy L0 and lib
    var testSource = path.join(__dirname, 'Tests-Legacy');
    cd(legacyTestPath);
    run('tsc --rootDir ' + legacyTestPath);

    // create a test temp dir - used by the task runner to copy each task to an isolated dir
    var tempDir = path.join(legacyTestPath, 'Temp');
    process.env['TASK_TEST_TEMP'] = tempDir;
    mkdir('-p', tempDir);

    // suite paths
    var testsSpec = matchFind(path.join('**', '_suite.js'), path.join(legacyTestPath, 'L0'));
    if (!testsSpec.length) {
        fail(`Unable to find tests using the pattern: ${path.join('**', '_suite.js')}`);
    }

    // setup the version of node to run the tests
    util.installNode(options.node);

    // mocha doesn't always return a non-zero exit code on test failure. when only
    // a single suite fails during a run that contains multiple suites, mocha does
    // not appear to always return non-zero. as a workaround, the following code
    // creates a wrapper suite with an "after" hook. in the after hook, the state
    // of the runnable context is analyzed to determine whether any tests failed.
    // if any tests failed, log a ##vso command to fail the build.
    var testsSpecPath = ''
    var testsSpecPath = path.join(legacyTestPath, 'testsSpec.js');
    var contents = 'var __suite_to_run;' + os.EOL;
    contents += 'describe(\'Legacy L0\', function (__outer_done) {' + os.EOL;
    contents += '    after(function (done) {' + os.EOL;
    contents += '        var failedCount = 0;' + os.EOL;
    contents += '        var suites = [ this._runnable.parent ];' + os.EOL;
    contents += '        while (suites.length) {' + os.EOL;
    contents += '            var s = suites.pop();' + os.EOL;
    contents += '            suites = suites.concat(s.suites); // push nested suites' + os.EOL;
    contents += '            failedCount += s.tests.filter(function (test) { return test.state != "passed" }).length;' + os.EOL;
    contents += '        }' + os.EOL;
    contents += '' + os.EOL;
    contents += '        if (failedCount && process.env.TF_BUILD) {' + os.EOL;
    contents += '            console.log("##vso[task.logissue type=error]" + failedCount + " test(s) failed");' + os.EOL;
    contents += '            console.log("##vso[task.complete result=Failed]" + failedCount + " test(s) failed");' + os.EOL;
    contents += '        }' + os.EOL;
    contents += '' + os.EOL;
    contents += '        done();' + os.EOL;
    contents += '    });' + os.EOL;
    testsSpec.forEach(function (itemPath) {
        contents += `    __suite_to_run = require(${JSON.stringify(itemPath)});` + os.EOL;
    });
    contents += '});' + os.EOL;
    fs.writeFileSync(testsSpecPath, contents);
    run('mocha ' + testsSpecPath /*+ ' --reporter mocha-junit-reporter --reporter-options mochaFile=../testresults/test-legacy-results.xml' */, /*inheritStreams:*/true);
}

//
// node make.js package
// This will take the built tasks and create the files we need to publish them.
//
target.package = function() {
    banner('Starting package process...')

    // START LOCAL CONFIG
    // console.log('> Cleaning packge path');
    // rm('-Rf', packagePath);
    // TODO: Only need this when we run locally
    //var layoutPath = util.createNonAggregatedZip(buildPath, packagePath);
    // END LOCAL CONFIG
    // Note: The local section above is needed when running layout locally due to discrepancies between local build and
    //       slicing in CI. This will get cleaned up after we fully roll out and go to build only changed.

    var layoutPath = path.join(packagePath, 'milestone-layout');
    util.createNugetPackagePerTask(packagePath, layoutPath);
}

// used by CI that does official publish
target.publish = function() {
    var server = options.server;
    assert(server, 'server');

    // if task specified, skip
    if (options.task) {
        banner('Task parameter specified. Skipping publish.');
        return;
    }

    // get the branch/commit info
    var refs = util.getRefs();

    // test whether to publish the non-aggregated tasks zip
    // skip if not the tip of a release branch
    var release = refs.head.release;
    var commit = refs.head.commit;
    if (!release ||
        !refs.releases[release] ||
        commit != refs.releases[release].commit) {

        // warn not publishing the non-aggregated
        console.log(`##vso[task.logissue type=warning]Skipping publish for non-aggregated tasks zip. HEAD is not the tip of a release branch.`);
    }
    else {
        // store the non-aggregated tasks zip
        var nonAggregatedZipPath = path.join(packagePath, 'non-aggregated-tasks.zip');
        util.storeNonAggregatedZip(nonAggregatedZipPath, release, commit);
    }

    // resolve the nupkg path
    var nupkgFile;
    var nupkgDir = path.join(packagePath, 'pack-target');
    if (!test('-d', nupkgDir)) {
        fail('nupkg directory does not exist');
    }

    var fileNames = fs.readdirSync(nupkgDir);
    if (fileNames.length != 1) {
        fail('Expected exactly one file under ' + nupkgDir);
    }

    nupkgFile = path.join(nupkgDir, fileNames[0]);

    // publish the package
    ensureTool('nuget3.exe');
    run(`nuget3.exe push ${nupkgFile} -Source ${server} -apikey Skyrise`);
}


var agentPluginTaskNames = ['Cache', 'CacheBeta', 'DownloadPipelineArtifact', 'PublishPipelineArtifact'];
// used to bump the patch version in task.json files
target.bump = function() {
    verifyAllAgentPluginTasksAreInSkipList();

    taskList.forEach(function (taskName) {
        // load files
        var taskJsonPath = path.join(__dirname, 'Tasks', taskName, 'task.json');
        var taskJson = JSON.parse(fs.readFileSync(taskJsonPath));

        var taskLocJsonPath = path.join(__dirname, 'Tasks', taskName, 'task.loc.json');
        var taskLocJson = JSON.parse(fs.readFileSync(taskLocJsonPath));

        // skip agent plugin tasks
        if(agentPluginTaskNames.indexOf(taskJson.name) > -1) {
            return;
        }

        if (typeof taskJson.version.Patch != 'number') {
            fail(`Error processing '${taskName}'. version.Patch should be a number.`);
        }

        taskJson.version.Patch = taskJson.version.Patch + 1;
        taskLocJson.version.Patch = taskLocJson.version.Patch + 1;

        fs.writeFileSync(taskJsonPath, JSON.stringify(taskJson, null, 4));
        fs.writeFileSync(taskLocJsonPath, JSON.stringify(taskLocJson, null, 2));

        // Check that task.loc and task.loc.json versions match
        if ((taskJson.version.Major !== taskLocJson.version.Major) ||
            (taskJson.version.Minor !== taskLocJson.version.Minor) ||
            (taskJson.version.Patch !== taskLocJson.version.Patch)) {
            console.log(`versions dont match for task '${taskName}', task json: ${JSON.stringify(taskJson.version)} task loc json: ${JSON.stringify(taskLocJson.version)}`);
        }
    });
}

target.getCommonDeps = function() {
    var first = true;
    var totalReferencesToCommonPackages = 0;
    var commonCounts = {};
    taskList.forEach(function (taskName) {
        var commonDependencies = [];
        var packageJsonPath = path.join(__dirname, 'Tasks', taskName, 'package.json');

        if (fs.existsSync(packageJsonPath)) {
            var packageJson = JSON.parse(fs.readFileSync(packageJsonPath));

            if (first)
            {
                Object.values(packageJson.dependencies).forEach(function (v) {
                    if (v.indexOf('Tasks/Common') !== -1)
                    {
                        var depName = v
                            .replace('file:../../_build/Tasks/Common/', '')
                            .replace('-0.1.0.tgz', '')
                            .replace('-1.0.0.tgz', '')
                            .replace('-1.0.1.tgz', '')
                            .replace('-1.0.2.tgz', '')
                            .replace('-1.1.0.tgz', '')
                            .replace('-2.0.0.tgz', '')

                        commonDependencies.push(depName);

                        totalReferencesToCommonPackages++;

                        if (commonCounts[depName]) {
                            commonCounts[depName]++;
                        }
                        else {
                            commonCounts[depName] = 1;
                        }
                    }
                });
            }
        }

        if (commonDependencies.length > 0)
        {
            console.log('----- ' + taskName + ' (' + commonDependencies.length + ') -----');

            commonDependencies.forEach(function (dep) {
                console.log(dep);
            });
        }
    });

    console.log('');
    console.log('##### ##### ##### #####');
    console.log('totalReferencesToCommonPackages: ' + totalReferencesToCommonPackages);
    console.log('');

    Object.keys(commonCounts).forEach(function (k) {
        console.log(k + ': ' + commonCounts[k]);
    });
}

function verifyAllAgentPluginTasksAreInSkipList() {
    var missingTaskNames = [];

    taskList.forEach(function (taskName) {
        // load files
        var taskJsonPath = path.join(__dirname, 'Tasks', taskName, 'task.json');
        var taskJson = JSON.parse(fs.readFileSync(taskJsonPath));

        if (taskJson.execution && taskJson.execution.AgentPlugin) {
            if (agentPluginTaskNames.indexOf(taskJson.name) === -1 && missingTaskNames.indexOf(taskJson.name) === -1) {
                missingTaskNames.push(taskJson.name);
            }
        }
    });

    if (missingTaskNames.length > 0) {
        fail('The following tasks must be added to agentPluginTaskNames: ' + JSON.stringify(missingTaskNames));
    }
}

// Generate sprintly zip
// This methods generate a zip file that contains the tip of all task major versions for the last sprint
// Use:
//   node make.js gensprintlyzip --sprint=m153 --outputdir=E:\testing\ --depxmlpath=C:\Users\stfrance\Desktop\tempdeps.xml
//
// Result:
//   azure-pipelines.firstpartytasks.m153.zip
//
// The generated zip can be uploaded to an account using tfx cli and it will install all of the tasks contained in the zip.
// The zip should be uploaded to the azure-pipelines-tasks repository
//
// Process:
//
//  We create a workspace folder to do all of our work in. This is created in the output directory. output-dir/workspace-GUID
//  Inside here, we first create a package file based on the packages we want to download.
//  Then nuget restore, then get zips, then create zip.
target.gensprintlyzip = function() {
    var sprint = options.sprint;
    var outputDirectory = options.outputdir;
    var dependenciesXmlFilePath = options.depxmlpath;
    var taskFeedUrl = 'https://mseng.pkgs.visualstudio.com/_packaging/Codex-Deps/nuget/v3/index.json';

    console.log('# Creating sprintly zip.');

    console.log('\n# Loading tasks from dependencies file.');
    var dependencies = fs.readFileSync(dependenciesXmlFilePath, 'utf8');

    var dependenciesArr = dependencies.split('\n');
    console.log(`Found ${dependenciesArr.length} dependencies.`);

    var taskDependencies = [];
    var taskStringArr = [];

    dependenciesArr.forEach(function (currentDep) {
        if (currentDep.indexOf('Mseng.MS.TF.DistributedTask.Tasks.') === -1) {
            return;
        }

        taskStringArr.push(currentDep);

        var depDetails = currentDep.split("\"");
        var name = depDetails[1];
        var version = depDetails[3];

        taskDependencies.push({ 'name': name, 'version': version });
    });

    console.log(`Found ${taskDependencies.length} task dependencies.`);

    console.log('\n# Downloading task nuget packages.');

    var tempWorkspaceDirectory = `${outputDirectory}\\workspace-${Math.floor(Math.random() * 1000000000)}`;
    console.log(`Creating temporary workspace directory ${tempWorkspaceDirectory}`);

    fs.mkdirSync(tempWorkspaceDirectory);

    console.log('Writing packages.config file');

    var packagesConfigPath = `${tempWorkspaceDirectory}\\packages.config`;
    var packagesConfigContent = '<?xml version="1.0" encoding="utf-8"?>\n';
    packagesConfigContent += '<packages>\n';

    taskStringArr.forEach(function (taskString) {
        packagesConfigContent += taskString;
    });

    packagesConfigContent += '</packages>';

    fs.writeFileSync(packagesConfigPath, packagesConfigContent);
    console.log(`Completed writing packages.config file. ${packagesConfigPath}`);

    console.log('\n# Restoring NuGet packages.');
    run(`nuget restore ${tempWorkspaceDirectory} -source "${taskFeedUrl}" -packagesdirectory ${tempWorkspaceDirectory}\\packages`);
    console.log('Restoring NuGet packages complete.');

    console.log(`\n# Creating sprintly zip.`);

    var sprintlyZipContentsPath = `${tempWorkspaceDirectory}\\sprintly-zip`;
    fs.mkdirSync(sprintlyZipContentsPath);

    console.log('Sprintly zip folder created.');

    console.log('Copying task zip files to sprintly zip folder.');
    taskDependencies.forEach(function (taskDependency) {
        var nameAndVersion = `${taskDependency.name}.${taskDependency.version}`;
        var src = `${tempWorkspaceDirectory}\\packages\\${nameAndVersion}\\content\\task.zip`; // workspace-735475103\packages\Mseng.MS.TF.DistributedTask.Tasks.AndroidBuildV1.1.0.16\content\task.zip
        var dest = `${sprintlyZipContentsPath}\\${nameAndVersion}.zip`; // workspace-735475103\sprintly-zip\

        fs.copyFileSync(src, dest);
    });
    console.log('Copying task zip files to sprintly zip folder complete.');

    console.log('Creating sprintly zip file from folder.');

    var sprintlyZipPath = `${outputDirectory}azure-pipelines.firstpartytasks.${sprint}.zip`;

    var zip = new admzip();
    zip.addLocalFolder(sprintlyZipContentsPath);
	zip.writeZip(sprintlyZipPath);

    console.log('Creating sprintly zip file from folder complete.');

    console.log('\n# Cleaning up folders');
    console.log(`Deleting temporary workspace directory ${tempWorkspaceDirectory}`);
    rm('-Rf', tempWorkspaceDirectory);

    console.log('\n# Completed creating sprintly zip.');
}
