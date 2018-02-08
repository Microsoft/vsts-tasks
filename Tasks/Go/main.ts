import tl = require("vsts-task-lib/task");
import tr = require("vsts-task-lib/toolrunner");
import * as path from 'path';

try {
    tl.setResourcePath(path.join(__dirname, "task.json"));
} catch (error) {
    tl.setResult(tl.TaskResult.Failed, error);
}

export class goExe {
    private command: string = "";
    private argument: string = "";
    private workingDir: string = "";
    private failOnStdErr: boolean = false;

    constructor() {
        this.command = tl.getInput("command", true).trim();
        if (this.command == "custom") {
            this.command = tl.getInput("customCommand", true).trim();
        }
        this.argument = tl.getInput("arguments", false);
        this.workingDir = tl.getInput("workingDirectory", false);
        if (this.workingDir == null) {
            this.workingDir = tl.getVariable("System.DefaultWorkingDirectory");
        }
        this.failOnStdErr = tl.getBoolInput("failOnStandardError", false);
    }

    public async execute() {
        return new Promise<string>(async (resolve, reject) => {
            try {
                let goPath = tl.which("go", true);
                let go: tr.ToolRunner = tl.tool(goPath);

                go.arg(this.command);
                go.line(this.argument);

                var result = await go.exec(<tr.IExecOptions>{
                    cwd: this.workingDir,
                    failOnStdErr: this.failOnStdErr,
                });
                resolve(result);
            }
            catch (err) {
                reject(err);
            }
        });

    }
}

var exe = new goExe();
exe.execute().catch((reason) => tl.setResult(tl.TaskResult.Failed, tl.loc("TaskFailedWithError", reason)));