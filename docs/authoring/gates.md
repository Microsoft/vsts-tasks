
You can take a look at this document to learn about how you can add a new [server task](https://github.com/Microsoft/azure-pipelines-tasks/blob/master/docs/authoring/servertaskauthoring.md). Assuming that you are aware of the process for adding a server task, then to make it a gate, you should do the following.

#### Change the RunsOn property :
RunsOn property in task.json specifies where the task should run. The possible values for this property are as follows: -

- Agent
- DeploymentGroup
- Server
- ServerGate

The default value of this property is Agent, but you can change it to ServerGate to specify that the task should run on Azure Pipelines/TFS server and should show up in the list of gates in the definition editor. In case you want the task to appear in both server tasks as well as gate tasks, specify the value of RunsOn as Server | ServerGate.

#### Provide the result evaluation expression :

In case you are using http request executions in your task, then you should provide the result evaluation expression so that the system can evaluate whether a particular run of a gate has passed or failed. You can learn more about the possible constructs in the expression in this [document](https://github.com/Microsoft/azure-pipelines-tasks/blob/master/docs/authoring/servertaskauthoring.md) and can also look at our built-in tasks for the real world usages ([Azure monitor task](https://github.com/Microsoft/azure-pipelines-tasks/blob/master/Tasks/AzureMonitorV0/task.json), [Query work items](https://github.com/Microsoft/azure-pipelines-tasks/blob/master/Tasks/QueryWorkItemsV0/task.json)).

#### Understand the model difference between gate and server task:

Server tasks can be used to do 2 kinds of activities:

- Create a new resource on an external system.
- Query an external system.

For example: - You can have 2 Chef server tasks, one which creates a new deployment on Chef and another which queries the status of an existing deployment.

Gate tasks, in a typical usage will primarily do one kind of activity and that activity will be "query an external system". You will typically not create a new resource in a gate because gates run N times in a deployment and creating N resources in a single deployment does not look natural.

So a good gate will typically query an external system. For example:- Querying work items is a good gate because the result of the query can change in between runs. Similarly querying azure monitors is a good gate because the health of the monitors of a live system can change in between runs. But creation of new work item is not a good gate as you dont want to create N work items in a run given that work item is a long lived object. 

With sprint 144, multiple activities can be clubbed in a gate. This can be leveraged in scenarios where you need to create a resource on an external system and query the resource status N times. The resource will be created only once in the first run and subsequent runs will skip the creation and query the resource status. For example:- Trigger policy evaluation and query N times to check if the evaluation is complete. Once complete, evaluate the results. 

You can learn more about constructs to chain multiple activities in this [document](https://github.com/Microsoft/azure-pipelines-tasks/blob/master/docs/authoring/servertaskauthoring.md) and can also look at our built-in tasks for the real world usages ([Azure policy gate](https://github.com/Microsoft/azure-pipelines-tasks/blob/master/Tasks/AzurePolicyV0/task.json))
