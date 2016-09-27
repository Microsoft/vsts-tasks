import path = require('path');
import tl = require('vsts-task-lib/task');
import sign = require('ios-signing-common/ios-signing-common');

import {ToolRunner} from 'vsts-task-lib/toolrunner';

async function run() {
    try {
        tl.setResourcePath(path.join( __dirname, 'task.json'));

        //--------------------------------------------------------
        // Tooling
        //--------------------------------------------------------
        tl.setEnvVar('DEVELOPER_DIR', tl.getInput('xcodeDeveloperDir', false));

        var useXctool : boolean = tl.getBoolInput('useXctool', false);
        var tool : string = useXctool ? tl.which('xctool', true) : tl.which('xcodebuild', true);
        tl.debug('Tool selected: '+ tool);

        //--------------------------------------------------------
        // Paths
        //--------------------------------------------------------
        var workingDir : string = tl.getPathInput('cwd');
        tl.cd(workingDir);

        var outPath : string = tl.resolve(workingDir, tl.getInput('outputPattern', true)); //use posix implementation to resolve paths to prevent unit test failures on Windows
        tl.mkdirP(outPath);

        //--------------------------------------------------------
        // Xcode args
        //--------------------------------------------------------
        var ws : string = tl.getPathInput('xcWorkspacePath', false, false);
        if(tl.filePathSupplied('xcWorkspacePath')) {
            var workspaceMatches = tl.glob(ws);
            tl.debug("Found " + workspaceMatches.length + ' workspaces matching.');

            if (workspaceMatches.length > 0) {
                ws = workspaceMatches[0];
                if (workspaceMatches.length > 1) {
                    tl.warning(tl.loc('MultipleWorkspacesFound', ws));
                }
            }
            else {
                throw tl.loc('WorkspaceDoesNotExist');
            }
        }

        var sdk : string = tl.getInput('sdk', false);
        var configuration : string  = tl.getInput('configuration', false);
        var scheme : string = tl.getInput('scheme', false);
        var useXcpretty : boolean = tl.getBoolInput('useXcpretty', false);
        var xctoolReporter : string = tl.getInput('xctoolReporter', false);
        var actions : string [] = tl.getDelimitedInput('actions', ' ', true);
        var packageApp : boolean = tl.getBoolInput('packageApp', true);
        var args : string = tl.getInput('args', false);

        //--------------------------------------------------------
        // Exec Tools
        //--------------------------------------------------------

        // --- Xcode Version ---
        var xcv : ToolRunner = tl.tool(tool);
        xcv.arg('-version');
        var xcodeVersion: number;
        xcv.on('stdout', (data) => {
            var match: string = data.toString().trim().match(/Xcode (.+)/g);
            if(match && parseInt(match) !== NaN) {
                xcodeVersion = parseInt(match);
            }
        });

        await xcv.exec();

        // --- Xcode build arguments ---
        var xcb: ToolRunner = tl.tool(tool);
        xcb.argIf(sdk, ['-sdk', sdk]);
        xcb.argIf(configuration, ['-configuration', configuration]);
        if(ws && tl.filePathSupplied('xcWorkspacePath')) {
            xcb.arg('-workspace');
            xcb.arg(ws);
        }
        xcb.argIf(scheme, ['-scheme', scheme]);
        xcb.argIf(useXctool && xctoolReporter, ['-reporter', 'plain', '-reporter', xctoolReporter]);
        xcb.arg(actions);
        if(actions.toString().indexOf('archive') < 0) {
            // redirect build output if archive action is not passed
            // xcodebuild archive produces an invalid archive if output is redirected
            xcb.arg('DSTROOT=' + path.join(outPath, 'build.dst'));
            xcb.arg('OBJROOT=' + path.join(outPath, 'build.obj'));
            xcb.arg('SYMROOT=' + path.join(outPath, 'build.sym'));
            xcb.arg('SHARED_PRECOMPS_DIR=' + path.join(outPath, 'build.pch'));
        }
        if (args) {
            xcb.line(args);
        }

        //--------------------------------------------------------
        // iOS signing and provisioning
        //--------------------------------------------------------
        var signMethod : string = tl.getInput('signMethod', false);
        var keychainToDelete : string;
        var profileToDelete : string;
        var automaticSigningWithXcode: boolean = tl.getBoolInput('xcode8AutomaticSigning');
        var xcode_otherCodeSignFlags: string;
        var xcode_codeSignIdentity: string;
        var xcode_provProfile: string;

        if(signMethod === 'file') {
            var p12 : string = tl.getPathInput('p12', false, false);
            var p12pwd : string = tl.getInput('p12pwd', false);
            var provProfilePath : string = tl.getPathInput('provProfile', false);
            var removeProfile : boolean = tl.getBoolInput('removeProfile', false);

            if(tl.filePathSupplied('p12') && tl.exist(p12)) {
                p12 = tl.resolve(workingDir, p12);
                var keychain : string = path.join(workingDir, '_xcodetasktmp.keychain');
                var keychainPwd : string = '_xcodetask_TmpKeychain_Pwd#1';

                //create a temporary keychain and install the p12 into that keychain
                await sign.installCertInTemporaryKeychain(keychain, keychainPwd, p12, p12pwd);
                xcode_otherCodeSignFlags = 'OTHER_CODE_SIGN_FLAGS=--keychain=' + keychain;
                xcb.arg(xcode_otherCodeSignFlags);
                keychainToDelete = keychain;

                //find signing identity
                var signIdentity = await sign.findSigningIdentity(keychain);
                if(signIdentity && !automaticSigningWithXcode) {
                    xcode_codeSignIdentity = 'CODE_SIGN_IDENTITY=' + signIdentity;
                }
                xcb.argIf(xcode_codeSignIdentity, xcode_codeSignIdentity);
            }

            //determine the provisioning profile UUID
            if(tl.filePathSupplied('provProfile') && tl.exist(provProfilePath)) {
                var provProfileUUID = await sign.getProvisioningProfileUUID(provProfilePath);
                if(provProfileUUID && !automaticSigningWithXcode)
                {
                    xcode_provProfile = 'PROVISIONING_PROFILE=' + provProfileUUID;
                }
                xcb.argIf(xcode_provProfile, xcode_provProfile);
                if (removeProfile && provProfileUUID) {
                    profileToDelete = provProfileUUID;
                }
            }

        } else if (signMethod === 'id') {
            var unlockDefaultKeychain : boolean = tl.getBoolInput('unlockDefaultKeychain');
            var defaultKeychainPassword : string = tl.getInput('defaultKeychainPassword');
            if(unlockDefaultKeychain) {
                var defaultKeychain : string = await sign.getDefaultKeychainPath();
                await sign.unlockKeychain(defaultKeychain, defaultKeychainPassword);
            }

            var signIdentity : string = tl.getInput('iosSigningIdentity');
            if(signIdentity && !automaticSigningWithXcode) {
                xcode_codeSignIdentity = 'CODE_SIGN_IDENTITY=' + signIdentity;
            }
            xcb.argIf(xcode_codeSignIdentity, xcode_codeSignIdentity);

            var provProfileUUID : string = tl.getInput('provProfileUuid');
            if(provProfileUUID && !automaticSigningWithXcode) {
                xcode_provProfile = provProfileUUID;
            }
            xcb.argIf(xcode_provProfile, xcode_provProfile);
        }

        var teamId: string = tl.getInput('teamId');
        xcb.argIf(teamId && automaticSigningWithXcode, 'DEVELOPMENT_TEAM=' + teamId);

        //--- Enable Xcpretty formatting if using xcodebuild ---
        if(useXctool && useXcpretty) {
            tl.warning(tl.loc('XcodebuildRequiredForXcpretty'));
        }
        if(!useXctool && useXcpretty) {
            var xcPrettyPath: string = tl.which('xcpretty', true);
            var xcPrettyTool: ToolRunner = tl.tool(xcPrettyPath);
            xcPrettyTool.arg(['-r', 'junit', '--no-color']);

            xcb.pipeExecOutputToTool(xcPrettyTool);
        }

        //--- Xcode Build ---
        await xcb.exec();

        //--------------------------------------------------------
        // Test publishing
        //--------------------------------------------------------
        var testResultsFiles : string;
        var publishResults : boolean = tl.getBoolInput('publishJUnitResults', false);

        if (publishResults)
        { 
            if(useXctool) {
             if(xctoolReporter && 0 !== xctoolReporter.length) {
                 var xctoolReporterString = xctoolReporter.split(":");
                 if (xctoolReporterString && xctoolReporterString.length === 2) {
                     testResultsFiles = tl.resolve(workingDir, xctoolReporterString[1].trim());
                 }
             } else {
                 tl.warning(tl.loc('UseXcToolForTestPublishing'))
             }
            } else if(!useXctool) {
                if(!useXcpretty) {
                    tl.warning(tl.loc('UseXcprettyForTestPublishing'));
                } else {
                    testResultsFiles = tl.resolve(workingDir, '**/build/reports/junit.xml');
                }
            }

            if(testResultsFiles && 0 !== testResultsFiles.length) {
                //check for pattern in testResultsFiles
                if(testResultsFiles.indexOf('*') >= 0 || testResultsFiles.indexOf('?') >= 0) {
                    tl.debug('Pattern found in testResultsFiles parameter');
                    var allFiles : string [] = tl.find(workingDir);
                    var matchingTestResultsFiles : string [] = tl.match(allFiles, testResultsFiles, { matchBase: true });
                }
                else {
                    tl.debug('No pattern found in testResultsFiles parameter');
                    var matchingTestResultsFiles : string [] = [testResultsFiles];
                }

                if(!matchingTestResultsFiles) {
                    tl.warning(tl.loc('NoTestResultsFound', testResultsFiles));
                }

                var tp = new tl.TestPublisher("JUnit");
                tp.publish(matchingTestResultsFiles, false, "", "", "", true);
            }
            
        }

        //--------------------------------------------------------
        // Package app to generate .ipa
        //--------------------------------------------------------
        if(tl.getBoolInput('packageApp', true) && sdk !== 'iphonesimulator') {
            tl.debug('Packaging apps.');
            var buildOutputPath:string = path.join(outPath, 'build.sym');
            tl.debug('buildOutputPath: ' + buildOutputPath);
            var appFolders:string [] = tl.glob(buildOutputPath + '/**/*.app')
            if (appFolders) {
                tl.debug(appFolders.length + ' apps found for packaging.');
                for (var i = 0; i < appFolders.length; i++) {
                    var app:string = appFolders.pop();
                    tl.debug('Packaging ' + app);

                    if (useXctool || xcodeVersion === NaN || xcodeVersion < 7) {
                        //user xcrun tool for older versions of Xcode
                        var xcrunPath:string = tl.which('xcrun', true);
                        var ipa:string = app.substring(0, app.length - 3) + 'ipa';
                        var xcr:ToolRunner = tl.tool(xcrunPath);
                        xcr.arg(['-sdk', sdk, 'PackageApplication', '-v', app, '-o', ipa]);
                        await xcr.exec();
                    } else {
                        //use xcodebuild to create the app package for Xcode 7 and 8
                        var xcodeArchive = tl.tool(tl.which('xcodebuild', true));
                        if (ws && tl.filePathSupplied('xcWorkspacePath')) {
                            xcodeArchive.arg('-workspace');
                            xcodeArchive.arg(ws);
                        }
                        xcodeArchive.argIf(scheme, ['-scheme', scheme]);
                        xcodeArchive.arg('archive'); //archive action
                        xcodeArchive.argIf(sdk, ['-sdk', sdk]);
                        xcodeArchive.argIf(configuration, ['-configuration', configuration]);
                        var archivePath = tl.getInput('archivePath');
                        if (!tl.filePathSupplied((archivePath))) {
                            archivePath = tl.resolve(archivePath, app.substring(0, app.length - 3) + 'xcarchive');
                        }
                        xcodeArchive.arg(archivePath);
                        xcodeArchive.argIf(xcode_otherCodeSignFlags, xcode_otherCodeSignFlags);
                        xcodeArchive.argIf(xcode_codeSignIdentity, xcode_codeSignIdentity);
                        xcodeArchive.argIf(xcode_provProfile, xcode_provProfile);

                        await xcodeArchive.exec();

                        //export the archive
                        var xcodeExport = tl.tool(tl.which('xcodebuild', true));
                        xcodeExport.arg(['-exportArchive', '-archivePath', archivePath]);
                        var exportFormat = tl.getInput('exportFormat');
                        xcodeExport.argIf(exportFormat, ['-exportFormat', exportFormat]);
                        var exportPath = tl.getInput('exportPath');
                        if(!tl.filePathSupplied(exportPath)) {
                            exportPath = tl.resolve(exportPath, app.substring(0, app.length - 3) + 'ipa');
                        }
                        xcodeExport.arg(['-exportPath', exportPath]);

                        await xcodeExport.exec();
                    }
                }
            }

        }
        tl.setResult(tl.TaskResult.Succeeded, tl.loc('XcodeSuccess'));
    }
    catch(err) {
        tl.setResult(tl.TaskResult.Failed, err);
    } finally {
        //clean up the temporary keychain, so it is not used to search for code signing identity in future builds
        if(keychainToDelete) {
            try {
                await sign.deleteKeychain(keychainToDelete);
            } catch(err) {
                tl.debug('Failed to delete temporary keychain. Error = ' + err);
                tl.warning(tl.loc('TempKeychainDeleteFailed', keychainToDelete));
            }
        }

        //delete provisioning profile if specified
        if(profileToDelete) {
            try {
                await sign.deleteProvisioningProfile(profileToDelete);
            } catch(err) {
                tl.debug('Failed to delete provisioning profile. Error = ' + err);
                tl.warning(tl.loc('ProvProfileDeleteFailed', profileToDelete));
            }
        }
    }
}

run();
