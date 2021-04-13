import tl = require('azure-pipelines-task-lib');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import ma = require('azure-pipelines-task-lib/mock-answer');
import * as path from 'path';
import { AzureResourceFilterUtility } from '../operations/AzureResourceFilterUtility';
import { KuduServiceUtility } from '../operations/KuduServiceUtility';
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
import { ApplicationTokenCredentials } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-common';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-endpoint'; 
import { setEndpointData, setAgentsData, mockTaskArgument, mockTaskInputParameters } from './utils';

export class WindowsWebAppZipDeployProviderTests {

    public static startWindowsWebAppZipDeployProviderTests(){
        let tp = path.join(__dirname, 'WindowsWebAppZipDeployProviderL0Tests.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        mockTaskInputParameters(tr);
        setEndpointData();
        setAgentsData();

        tr.registerMock('azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-app-service-kudu', {
            Kudu: function(A, B, C) {
                return {
                    updateDeployment : function(D) {
                        return "MOCK_DEPLOYMENT_ID";
                    },
                    getAppSettings : function() {
                        var map: Map<string, string> = new Map<string, string>();
                        map.set('MSDEPLOY_RENAME_LOCKED_FILES', '1');
                        map.set('ScmType', 'ScmType');
                        return map;
                    },
                    zipDeploy: function(E, F) {
                        return '{id: "ZIP_DEPLOY_FAILED_ID", status: 3, deployer: "VSTS_ZIP_DEPLOY", author: "VSTS USER"}';
                    },
                    warDeploy: function(G, H) {
                        return '{id: "ZIP_DEPLOY_FAILED_ID", status: 3, deployer: "VSTS_ZIP_DEPLOY", author: "VSTS USER"}';
                    },
                    getDeploymentDetails: function(I) {
                        return "{ type: 'Deployment',url: 'http://MOCK_SCM_WEBSITE/api/deployments/MOCK_DEPLOYMENT_ID'}";
                    }  
                }
            }
        });

        tr.registerMock('azure-pipelines-tasks-webdeployment-common/utility.js', {
            generateTemporaryFolderForDeployment: function () {
                return "webAppPkg";
            },
            archiveFolderForDeployment: function() {
                return {
                    "webDeployPkg": "webAppPkg",
                    "tempPackagePath": "webAppPkg"
                };
            },
            getFileNameFromPath: function(A, B) {
                return "webAppPkg";
            },
            generateTemporaryFolderOrZipPath: function(C, D) {
                return "webAppPkg.zip";
            }
        });
        
        tr.registerMock('azure-pipelines-tasks-webdeployment-common/ziputility.js', {
            archiveFolder: function(A, B){
                return "webAppPkg.zip";
            }
        });
        

        tr.setAnswers(mockTaskArgument());
        tr.run();
    }

}

WindowsWebAppZipDeployProviderTests.startWindowsWebAppZipDeployProviderTests();
