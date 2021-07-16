import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import trm = require('azure-pipelines-task-lib/toolrunner');

async function run() {
    try {    
        tl.setResourcePath(path.join( __dirname, 'task.json'));

        var bash: trm.ToolRunner  = tl.tool(tl.which('bash', true));

        var scriptPath: string = path.join(__dirname, 'launch-docker.sh');

        var workingDirectory: string = path.dirname(scriptPath);

        tl.mkdirP(workingDirectory);
        tl.cd(workingDirectory);

        bash.arg(scriptPath);

        bash.line(tl.getInput('args', false));

        const deploymentClient = "mcr.microsoft.com/appsvc/staticappsclient:stable";

        const appLocation: string = tl.getInput('app_location', false) || "";
        const appBuildCommand: string = tl.getInput('app_build_command', false) || "";
        const outputLoction: string = tl.getInput('output_location', false) || "";
        const apiLocation: string = tl.getInput('api_location', false) || "";
        const apiBuildCommand: string = tl.getInput('api_build_command', false) || "";
        const routesLocation: string = tl.getInput('routes_location', false) || "";
        const skipAppBuild: boolean = tl.getBoolInput('skip_app_build', false);
        const configFileLocation: string = tl.getInput('config_file_location', false) || "";
        const apiToken: string = process.env['azure_static_web_apps_api_token'] || tl.getInput('azure_static_web_apps_api_token', false) || "";
        
        process.env['SWA_APP_LOCATION'] = appLocation;
        process.env['SWA_APP_BUILD_COMMAND'] = appBuildCommand;
        process.env['SWA_OUTPUT_LOCATION'] = outputLoction;
        process.env['SWA_API_LOCATION'] = apiLocation;
        process.env['SWA_API_BUILD_COMMAND'] = apiBuildCommand;
        process.env['SWA_ROUTES_LOCATION'] = routesLocation;
        process.env['SWA_DEPLOYMENT_CLIENT'] = deploymentClient;
        process.env['SWA_SKIP_APP_BUILD'] = skipAppBuild.toString();
        process.env['SWA_CONFIG_FILE_LOCATION'] = configFileLocation;
        process.env['SWA_API_TOKEN'] = apiToken;
        
        const options = {
            failOnStdErr: false
        };

        await bash.exec(<any>options);
        tl.setResult(tl.TaskResult.Succeeded, null);
    }
    catch(err) {
        tl.setResult(tl.TaskResult.Failed, null);
    }    
}

run();
