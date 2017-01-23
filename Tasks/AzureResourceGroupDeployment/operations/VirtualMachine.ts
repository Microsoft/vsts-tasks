/// <reference path="../../../definitions/node.d.ts" /> 
/// <reference path="../../../definitions/vsts-task-lib.d.ts" /> 

import path = require("path");
import tl = require("vsts-task-lib/task");
import armCompute = require('./azure-rest/azure-arm-compute');
import deployAzureRG = require("../models/DeployAzureRG");
import utils = require("./Utils")
import mgExtensionHelper = require("./MachineGroupExtensionHelper");

export class VirtualMachine {
    private taskParameters: deployAzureRG.AzureRGTaskParameters;
    private machineGroupExtensionHelper: mgExtensionHelper.MachineGroupExtensionHelper;

    constructor(taskParameters: deployAzureRG.AzureRGTaskParameters) {
        this.taskParameters = taskParameters;
        this.machineGroupExtensionHelper = new mgExtensionHelper.MachineGroupExtensionHelper(this.taskParameters);
    }

    public execute(): Promise<void> {
        var client = new armCompute.ComputeManagementClient(this.taskParameters.credentials, this.taskParameters.subscriptionId);
        return new Promise<void>((resolve, reject) => {
            client.virtualMachines.list(this.taskParameters.resourceGroupName, null, (error, listOfVms, request, response) => {
                if (error) {
                    return reject(tl.loc("VM_ListFetchFailed", this.taskParameters.resourceGroupName, utils.getError(error)));
                }
                if (listOfVms.length == 0) {
                    console.log(tl.loc("NoVMsFound"));
                    return resolve();
                }

                var callback = this.getCallback(listOfVms.length, resolve, reject);

                for (var i = 0; i < listOfVms.length; i++) {
                    var vmName = listOfVms[i]["name"];
                    switch (this.taskParameters.action) {
                        case "Start":
                            console.log(tl.loc("VM_Start", vmName));
                            client.virtualMachines.start(this.taskParameters.resourceGroupName, vmName, callback(vmName));
                            break;
                        case "Stop":
                            console.log(tl.loc("VM_Stop", vmName));
                            client.virtualMachines.powerOff(this.taskParameters.resourceGroupName, vmName, callback(vmName));
                            break;
                        case "Restart":
                            console.log(tl.loc("VM_Restart", vmName));
                            client.virtualMachines.restart(this.taskParameters.resourceGroupName, vmName, callback(vmName));
                            break;
                        case "Delete":
                            var extDelPromise = this.machineGroupExtensionHelper.deleteExtension(listOfVms[i]);
                            var deleteVM = this.getDeleteVMCallback(client, vmName, callback(vmName));
                            extDelPromise.then(deleteVM, deleteVM); 
                    }
                }
            });
        });
    }

    private getDeleteVMCallback(client, vmName, callback) {
        var deleteExtensionFromVM = () => {
            console.log(tl.loc("VM_Delete", vmName));
            client.virtualMachines.deleteMethod(this.taskParameters.resourceGroupName, vmName, callback);
        }
        return deleteExtensionFromVM;
    }

    private getCallback(count: number, resolve, reject): (vmName: string ) => (error, result, request, response) => void {
        var successCount = 0;
        var failureCount = 0;
        var total = count;
        var errors = "";

        return (vmName: string) => {
            return (error, result, request, response) => {
                if (error) {
                    failureCount++;
                    errors += tl.loc("VirtualMachineNameAndError", vmName, utils.getError(error));
                    errors += "\n";
                } else {
                    successCount++;
                }

                if (successCount + failureCount == total) {
                    if (failureCount) {
                        reject(tl.loc("FailureOnVMOperation", this.taskParameters.action, errors));
                    }
                    else {
                        console.log(tl.loc("SucceededOnVMOperation", this.taskParameters.action));
                        resolve();
                    }
                }
            }
        }
    }
}


