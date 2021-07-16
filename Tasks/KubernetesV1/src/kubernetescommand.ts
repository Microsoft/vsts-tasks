"use strict";
import * as del from "del";
import * as fs from "fs";
import * as tr from "azure-pipelines-task-lib/toolrunner";
import trm = require('azure-pipelines-task-lib/toolrunner');
import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import * as utils from "./utilities";
import ClusterConnection from "./clusterconnection";

export function run(connection: ClusterConnection, kubecommand: string, outputUpdate: (data: string) => any): any {
    var command = connection.createCommand();
    command.on("stdout", output => {
        outputUpdate(output);
    });

    command.arg(kubecommand);
    command.arg(getNameSpace());
    command.arg(getCommandConfigurationFile());
    command.line(getCommandArguments());
    command.arg(getCommandOutputFormat(kubecommand));
    return connection.execCommand(command);
}

function getCommandOutputFormat(kubecommand: string): string[] {
    var args: string[] = [];
    var outputFormat = tl.getInput("outputFormat", false);
    if (outputFormat) {
        switch (outputFormat) {
            case '':
            case 'none':
                tl.debug(`Skipping -o in args as outputFormat is 'none' or empty.`);
                return args;
            case 'json':
            case 'yaml':
                if (!isJsonOrYamlOutputFormatSupported(kubecommand)) {
                    return args;
                }
            default:
                args[0] = "-o";
                args[1] = outputFormat;
        }
    }
    return args;
}

export function getCommandConfigurationFile(): string[] {
    var args: string[] = [];
    var useConfigurationFile: boolean = tl.getBoolInput("useConfigurationFile", false);
    if (useConfigurationFile) {
        let configurationPath = tl.getPathInput("configuration", false);
        var inlineConfiguration = tl.getInput("inline", false);

        if (!tl.filePathSupplied("configuration")) {
            configurationPath = null;
        }

        if (configurationPath != null && inlineConfiguration != null) {
            let type = tl.getInput("configurationType", false);
            if (type == "inline") configurationPath = null;
            else inlineConfiguration = null;
        }

        if (configurationPath == null && inlineConfiguration == null) {
            throw new Error(tl.loc('InvalidConfiguration'));
        }
        else if (configurationPath) {
            if (tl.exist(configurationPath)) {
                args[0] = "-f";
                args[1] = configurationPath;
            }
            else {
                throw new Error(tl.loc('ConfigurationFileNotFound', configurationPath));
            }
        }
        else if (inlineConfiguration) {
            var tempInlineFile = utils.writeInlineConfigInTempPath(inlineConfiguration);
            if (tl.exist(tempInlineFile)) {
                args[0] = "-f";
                args[1] = tempInlineFile;
            } else {
                throw new Error(tl.loc('ConfigurationFileNotFound', tempInlineFile));
            }
        }
    }

    return args;
}

function getCommandArguments(): string {
    return tl.getInput("arguments", false);
}

export function isJsonOrYamlOutputFormatSupported(kubecommand): boolean {
    var commandsThatDontSupportYamlAndJson: string[] = ["explain", "delete", "diff", "cluster-info", "top", "cordon", "uncordon", "drain", "describe", "logs", "attach", "exec", "port-forward", "proxy", "cp", "auth", "completion", "api-versions", "config", "help", "plugin", "rollout"];

    if (commandsThatDontSupportYamlAndJson.findIndex(command => command === kubecommand) > -1) {
        return false;
    }
    else {
        return true;
    }
}

export function getNameSpace(): string[] {
    var args: string[] = [];
    var namespace = tl.getInput("namespace", false);
    if (namespace) {
        args[0] = "-n";
        args[1] = namespace;
    }

    return args;
}