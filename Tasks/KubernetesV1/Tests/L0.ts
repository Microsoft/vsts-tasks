import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib');
import * as shared from './TestShared';

describe('Kubernetes Suite', function() {
    this.timeout(30000);
    before((done) => {
        process.env[shared.TestEnvVars.operatingSystem] = tl.osType().match(/^Win/) ? shared.OperatingSystems.Windows : shared.OperatingSystems.Other;
        done();
    });
    beforeEach(() => {
        process.env[shared.isKubectlPresentOnMachine] = "true";
        process.env[shared.endpointAuthorizationType] = "Kubeconfig";
        process.env[shared.TestEnvVars.outputFormat] = 'json';
        delete process.env[shared.TestEnvVars.command];
        delete process.env[shared.TestEnvVars.containerType];
        delete process.env[shared.TestEnvVars.connectionType];
        delete process.env[shared.TestEnvVars.versionOrLocation];
        delete process.env[shared.TestEnvVars.specifyLocation];
        delete process.env[shared.TestEnvVars.versionSpec];
        delete process.env[shared.TestEnvVars.checkLatest];
        delete process.env[shared.TestEnvVars.namespace];
        delete process.env[shared.TestEnvVars.arguments];
        delete process.env[shared.TestEnvVars.useConfigurationFile];
        delete process.env[shared.TestEnvVars.configurationType];
        delete process.env[shared.TestEnvVars.secretType];
        delete process.env[shared.TestEnvVars.secretArguments];
        delete process.env[shared.TestEnvVars.secretName];
        delete process.env[shared.TestEnvVars.forceUpdate];
        delete process.env[shared.TestEnvVars.configMapName];
        delete process.env[shared.TestEnvVars.forceUpdateConfigMap];
        delete process.env[shared.TestEnvVars.useConfigMapFile];
        delete process.env[shared.TestEnvVars.configMapFile];
        delete process.env[shared.TestEnvVars.configMapArguments];
        delete process.env[shared.TestEnvVars.configuration];
        delete process.env["chmodShouldThrowError"];
    });
    after(function () {
    });
 
    it('Run successfully when the connectionType is Kubernetes Service Connection', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionType.KubernetesServiceConnection;        
        tr.run();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Run successfully when the authorization type of the endpoint is service account and connectionType is Kubernetes Service Connection', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionType.KubernetesServiceConnection;
        process.env[shared.endpointAuthorizationType] = "ServiceAccount";
        tr.run();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Run successfully when the user provides a specific location for kubectl', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.versionOrLocation] = "location";
        process.env[shared.TestEnvVars.specifyLocation] = shared.formatPath("newUserDir/kubectl.exe");
        process.env[shared.isKubectlPresentOnMachine] = "false";
        tr.run();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.stdout.indexOf(`Set kubectlPath to ${shared.formatPath("newUserDir/kubectl.exe")} and added permissions`) != -1, "Kubectl path should be set to the correct location");
        assert(tr.stdout.indexOf(`[command]${shared.formatPath("newUserDir/kubectl.exe")} get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Run successfully when the user provides a specific location for kubectl even when chmod fails', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.versionOrLocation] = "location";
        process.env[shared.TestEnvVars.specifyLocation] = shared.formatPath("newUserDir/kubectl.exe");
        process.env[shared.isKubectlPresentOnMachine] = "false";
        process.env["chmodShouldThrowError"] = "true";
        tr.run();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.stdout.indexOf(`Could not chmod ${process.env[shared.TestEnvVars.specifyLocation]}`) != -1, "chmod should have failed");
        assert(tr.stdout.indexOf(`[command]${shared.formatPath("newUserDir/kubectl.exe")} get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });
 
    it('Run successfully when the user provides the version for kubectl with checkLatest as false and version that dosent have a v prefix', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.versionOrLocation] = "version";
        process.env[shared.TestEnvVars.versionSpec] = "1.13.2";
        process.env[shared.isKubectlPresentOnMachine] = "false";
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`Got kubectl version v1.13.2`) != -1, "Got the specific version of kubectl");
        assert(tr.stdout.indexOf(`Downloaded kubectl version v1.13.2`) != -1, "Downloaded correct version of kubectl");
        assert(tr.stdout.indexOf(`[command]${shared.formatPath("newUserDir/kubectl.exe")} get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Run successfully when the user provides the version for kubectl with checkLatest as true', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.versionOrLocation] = "version";
        process.env[shared.TestEnvVars.versionSpec] = "1.5.0";
        process.env[shared.TestEnvVars.checkLatest] = "true";
        process.env[shared.isKubectlPresentOnMachine] = "false";
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`Get stable kubectl version`) != -1, "Stable version of kubectl is downloaded");
        assert(tr.stdout.indexOf(`Got kubectl version v1.6.6`) != -1, "Got the latest version of kubectl");
        assert(tr.stdout.indexOf(`Downloaded kubectl version v1.6.6`) != -1, "Downloaded correct version of kubectl");
        assert(tr.stdout.indexOf(`[command]${shared.formatPath("newUserDir/kubectl.exe")} get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Run successfully when the user provides the version 1.7 for kubectl with checkLatest as false', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.versionOrLocation] = "version";
        process.env[shared.TestEnvVars.versionSpec] = "1.7";
        process.env[shared.isKubectlPresentOnMachine] = "false";
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`Get stable kubectl version`) != -1, "Stable version of kubectl is downloaded");
        assert(tr.stdout.indexOf(`Got kubectl version v1.6.6`) != -1, "Got the latest version of kubectl");
        assert(tr.stdout.indexOf(`Downloaded kubectl version v1.6.6`) != -1, "Downloaded correct version of kubectl");
        assert(tr.stdout.indexOf(`[command]${shared.formatPath("newUserDir/kubectl.exe")} get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Run fails when the user provides a wrong location for kubectl', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.versionOrLocation] = "location";
        process.env[shared.TestEnvVars.specifyLocation] = shared.formatPath("wrongDir/kubectl.exe");
        process.env[shared.isKubectlPresentOnMachine] = "false";
        tr.run();
        
        assert(tr.failed, 'task should have failed');
        assert(tr.invokedToolCount == 0, 'should have invoked tool 0 times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length > 0 || tr.errorIssues.length, 'should have written to stderr');
        assert(tr.stdout.indexOf(`Not found ${shared.formatPath("wrongDir/kubectl.exe")}`) != -1, "kubectl get should not run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl diff using configuration file', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.diff;
        process.env[shared.TestEnvVars.useConfigurationFile] = "true";
        process.env[shared.TestEnvVars.configurationType] = shared.ConfigurationTypes.configuration; 
        process.env[shared.TestEnvVars.configuration] = shared.formatPath("dir/deployment.yaml");
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl diff -f ${shared.formatPath("dir/deployment.yaml")}`) != -1, "kubectl diff should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl apply using configuration file', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.apply;
        process.env[shared.TestEnvVars.useConfigurationFile] = "true";
        process.env[shared.TestEnvVars.configurationType] = shared.ConfigurationTypes.configuration; 
        process.env[shared.TestEnvVars.configuration] = shared.formatPath("dir/deployment.yaml");
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl apply -f ${shared.formatPath("dir/deployment.yaml")} -o json`) != -1, "kubectl apply should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl expose with configuration file and arguments', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.expose;
        process.env[shared.TestEnvVars.useConfigurationFile] = "true";
        process.env[shared.TestEnvVars.configurationType] = shared.ConfigurationTypes.configuration;
        process.env[shared.TestEnvVars.configuration] = shared.formatPath("dir/deployment.yaml");
        process.env[shared.TestEnvVars.arguments] = "--port=80 --target-port=8000";
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl expose -f ${shared.formatPath("dir/deployment.yaml")} --port=80 --target-port=8000 -o json`) != -1, "kubectl expose should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl get', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl get in a particular namespace', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.namespace] = "kube-system";
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl get -n kube-system pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl docker-registry secrets using Container Registry with forceUpdate', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.ContainerRegistry;
        process.env[shared.TestEnvVars.secretName] = "my-secret";
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`DeleteSecret my-secret`) != -1, "kubectl delete should run");
        assert(tr.stdout.indexOf(`[command]kubectl create secret docker-registry my-secret --docker-server=https://index.docker.io/v1/ --docker-username=test --docker-password=regpassword --docker-email=test@microsoft.com`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl docker-registry secrets using Container Registry without forceUpdate', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.ContainerRegistry;
        process.env[shared.TestEnvVars.secretName] = "my-secret";
        process.env[shared.TestEnvVars.forceUpdate] = "false";
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`DeleteSecret my-secret`) == -1, "kubectl delete should not run");
        assert(tr.stdout.indexOf(`[command]kubectl create secret docker-registry my-secret --docker-server=https://index.docker.io/v1/ --docker-username=test --docker-password=regpassword --docker-email=test@microsoft.com`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl docker-registry secrets using AzureContainerRegistry Registry with forceUpdate', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.AzureContainerRegistry;
        process.env[shared.TestEnvVars.secretName] = "my-secret";
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`DeleteSecret my-secret`) != -1, "kubectl delete should run");
        assert(tr.stdout.indexOf(`[command]kubectl create secret docker-registry my-secret --docker-server=ajgtestacr1.azurecr.io --docker-username=MOCK_SPN_ID --docker-password=MOCK_SPN_KEY --docker-email=ServicePrincipal@AzureRM`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

     it('Runs successfully for kubectl docker-registry secrets using AzureContainerRegistry without forceUpdate', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.AzureContainerRegistry;
        process.env[shared.TestEnvVars.secretName] = "my-secret";
        process.env[shared.TestEnvVars.forceUpdate] = "false";
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`DeleteSecret my-secret`) == -1, "kubectl delete should not run");
        assert(tr.stdout.indexOf(`[command]kubectl create secret docker-registry my-secret --docker-server=ajgtestacr1.azurecr.io --docker-username=MOCK_SPN_ID --docker-password=MOCK_SPN_KEY --docker-email=ServicePrincipal@AzureRM`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl generic secrets with forceUpdate', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.secretType] = "generic";
        process.env[shared.TestEnvVars.secretArguments] = "--from-literal=key1=value1 --from-literal=key2=value2";
        process.env[shared.TestEnvVars.secretName] = "my-secret";
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`DeleteSecret my-secret`) != -1, "kubectl delete should run");
        assert(tr.stdout.indexOf(`[command]kubectl create secret generic my-secret --from-literal=key1=value1 --from-literal=key2=value2`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl generic secrets without forceUpdate', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.secretType] = "generic";
        process.env[shared.TestEnvVars.secretArguments] = "--from-literal=key1=value1 --from-literal=key2=value2";
        process.env[shared.TestEnvVars.secretName] = "my-secret";
        process.env[shared.TestEnvVars.forceUpdate] = "false";
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`DeleteSecret my-secret`) == -1, "kubectl delete should not run");
        assert(tr.stdout.indexOf(`[command]kubectl create secret generic my-secret --from-literal=key1=value1 --from-literal=key2=value2`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });
 
    it('Runs successfully for kubectl create configMap from file with forceUpdate', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.configMapName] = "myConfigMap";
        process.env[shared.TestEnvVars.useConfigMapFile] = "true";
        process.env[shared.TestEnvVars.forceUpdateConfigMap] = "true";
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`GetConfigMap myConfigMap`) == -1, "kubectl get should not run");
        assert(tr.stdout.indexOf(`DeleteConfigMap myConfigMap`) != -1, "kubectl delete should run");
        assert(tr.stdout.indexOf(`[command]kubectl create configmap myConfigMap --from-file=configmap.properties=${shared.formatPath("configMapDir/configmap.properties")}`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl create configMap from directory without forceUpdate', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.configMapName] = "myConfigMap";
        process.env[shared.TestEnvVars.useConfigMapFile] = "true";
        process.env[shared.TestEnvVars.configMapFile] =  shared.formatPath("kubernetes/configMapDir");
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`GetConfigMap myConfigMap`) != -1, "kubectl get should run");
        assert(tr.stdout.indexOf(`DeleteConfigMap myConfigMap`) == -1, "kubectl delete should not run");
        assert(tr.stdout.indexOf(`[command]kubectl create configmap myConfigMap --from-file=${shared.formatPath("kubernetes/configMapDir")}`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    }); 

    it('Runs successfully for kubectl create configMap using literal values with forceUpdate', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.configMapName] = "myConfigMap";
        process.env[shared.TestEnvVars.configMapArguments] = "--from-literal=key1=value1 --from-literal=key2=value2";
        process.env[shared.TestEnvVars.forceUpdateConfigMap] = "true";
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`GetConfigMap myConfigMap`) == -1, "kubectl get should not run");
        assert(tr.stdout.indexOf(`DeleteConfigMap myConfigMap`) != -1, "kubectl delete should run");
        assert(tr.stdout.indexOf(`[command]kubectl create configmap myConfigMap --from-literal=key1=value1 --from-literal=key2=value2`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl kubectl create configMap using literal values without forceUpdate', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.configMapName] = "myConfigMap";
        process.env[shared.TestEnvVars.configMapArguments] = "--from-literal=key1=value1 --from-literal=key2=value2";
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`GetConfigMap myConfigMap`) != -1, "kubectl get should run");
        assert(tr.stdout.indexOf(`DeleteConfigMap myConfigMap`) == -1, "kubectl delete should not run");
        assert(tr.stdout.indexOf(`[command]kubectl create configmap myConfigMap --from-literal=key1=value1 --from-literal=key2=value2`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl get and print the output in a particular format', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "secrets my-secret";
        process.env[shared.TestEnvVars.outputFormat] = 'yaml';
        tr.run();
        
        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl get secrets my-secret -o yaml`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl create and dont print output', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.create;
        process.env[shared.TestEnvVars.arguments] = "secrets my-secret";
        process.env[shared.TestEnvVars.outputFormat] = 'none';
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`Skipping -o in args as outputFormat is 'none' or empty.`) != -1, 'outputFormat skipped');
        assert(tr.stdout.indexOf(`[command]kubectl create secrets my-secret`) != -1, "kubectl create should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl create and skip print for empty outputFormat', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.create;
        process.env[shared.TestEnvVars.arguments] = "secrets my-secret";
        process.env[shared.TestEnvVars.outputFormat] = '';
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl create secrets my-secret`) != -1, "kubectl create should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl get and print the output in custom format', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "secrets my-secret";
        process.env[shared.TestEnvVars.outputFormat] = 'custom-columns=":metadata.name"';
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl get secrets my-secret -o custom-columns=":metadata.name"`) != -1, "kubectl create should run");
        console.log(tr.stderr);
        done();
    }); 

    it('Runs successfully for checking whether secrets, configmaps and kubectl commands are run in a consecutive manner', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.secretType] = "generic";
        process.env[shared.TestEnvVars.secretArguments] = "--from-literal=key1=value1 --from-literal=key2=value2";
        process.env[shared.TestEnvVars.secretName] = "my-secret";
        process.env[shared.TestEnvVars.configMapName] = "myConfigMap";
        process.env[shared.TestEnvVars.configMapArguments] = "--from-literal=key1=value1 --from-literal=key2=value2";
        process.env[shared.TestEnvVars.forceUpdateConfigMap] = "true";
        tr.run();

        assert(tr.invokedToolCount == 3, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`DeleteSecret my-secret`) != -1, "kubectl delete should run");
        assert(tr.stdout.indexOf(`[command]kubectl create secret generic my-secret --from-literal=key1=value1 --from-literal=key2=value2`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`DeleteConfigMap myConfigMap`) != -1, "kubectl delete should run");
        assert(tr.stdout.indexOf(`[command]kubectl create configmap myConfigMap --from-literal=key1=value1 --from-literal=key2=value2`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        assert(tr.stdout.indexOf(`[command]kubectl create secret generic my-secret --from-literal=key1=value1 --from-literal=key2=value2`) < tr.stdout.indexOf(`[command]kubectl create configmap myConfigMap --from-literal=key1=value1 --from-literal=key2=value2`), "kubectl create secrets should run before create configMap");
        assert(tr.stdout.indexOf(`[command]kubectl create configmap myConfigMap --from-literal=key1=value1 --from-literal=key2=value2`) < tr.stdout.indexOf(`[command]kubectl get pods`), "kubectl create configMap should run before get");
        console.log(tr.stderr);
        done();
    });

    it('Runs fails if create config command fails even if create secret is successful', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.secretType] = "generic";
        process.env[shared.TestEnvVars.secretArguments] = "--from-literal=key1=value1 --from-literal=key2=value2";
        process.env[shared.TestEnvVars.secretName] = "my-secret";
        process.env[shared.TestEnvVars.configMapName] = "someConfigMap";
        process.env[shared.TestEnvVars.configMapArguments] = "--from-literal=key1=value1 --from-literal=key2=value2";
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.failed, 'task should have failed');
        assert(tr.stdout.indexOf(`GetConfigMap someConfigMap`) != -1, "kubectl get should run");
        assert(tr.stdout.indexOf(`[command]kubectl create secret generic my-secret --from-literal=key1=value1 --from-literal=key2=value2`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl create configmap someConfigMap --from-literal=key1=value1 --from-literal=key2=value2`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) == -1, "kubectl get should not run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully when forceUpdateConfigMap is false and configMap exists', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.configMapName] = "existingConfigMap";
        process.env[shared.TestEnvVars.configMapArguments] = "--from-literal=key1=value1 --from-literal=key2=value2";
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`GetConfigMap existingConfigMap`) != -1, "kubectl get should run");
        assert(tr.stdout.indexOf(`DeleteConfigMap existingConfigMap`) == -1, "kubectl delete should not run");
        assert(tr.stdout.indexOf(`[command]kubectl create configmap existingConfigMap --from-literal=key1=value1 --from-literal=key2=value2`) == -1, "kubectl create should not run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });
 
    it('Run successfully using the specified kubectl version when kubectl is present on machine and version is specified ', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.versionSpec] = "1.10.1";
        tr.run();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.stdout.indexOf(`[command]${shared.formatPath("newUserDir/kubectl.exe")} get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Json and yaml output format should not added for commands that dont support it', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.logs;
        process.env[shared.TestEnvVars.arguments] = "nginx";    
        tr.run();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.stdout.indexOf(`[command]kubectl logs nginx`) != -1, "kubectl logs should run");
        console.log(tr.stderr);
        done();
    });

    it('Diffs successfully when a configuration is provided inline', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.diff;
        process.env[shared.TestEnvVars.useConfigurationFile] = "true";
        process.env[shared.TestEnvVars.configurationType] = shared.ConfigurationTypes.inline;
        process.env[shared.TestEnvVars.inline] = "somestring";
        tr.run();

        assert(tr.succeeded, 'task should have run');
        assert(tr.invokedToolCount == 1, 'should have been invoked once. actual : ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.stdout.indexOf(`[command]kubectl diff -f ${shared.formatPath("newUserDir/inlineconfig.yaml")}`) != -1, "kubectl diff should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully when a configuration is provided inline', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.apply;
        process.env[shared.TestEnvVars.useConfigurationFile] = "true";
        process.env[shared.TestEnvVars.configurationType] = shared.ConfigurationTypes.inline;
        process.env[shared.TestEnvVars.inline] = "somestring";
        tr.run();

        assert(tr.succeeded, 'task should have run');
        assert(tr.invokedToolCount == 1, 'should have been invoked once. actual : ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.stdout.indexOf(`[command]kubectl apply -f ${shared.formatPath("newUserDir/inlineconfig.yaml")} -o json`) != -1, "kubectl apply should run");
        console.log(tr.stderr);
        done();
    });

    it('Diff defaults to filepath when both configurations are provided through yaml', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.diff;
        process.env[shared.TestEnvVars.useConfigurationFile] = "true";
        process.env[shared.TestEnvVars.configurationType] = ''; //does not matter during a yaml definition
        process.env[shared.TestEnvVars.configuration] = shared.formatPath("dir/deployment.yaml"); //dummy value to trigger not default configuration condition
        process.env[shared.TestEnvVars.inline] = 'sometextforinline';
        tr.run();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl diff -f ${shared.formatPath("dir/deployment.yaml")}`) != -1, "kubectl diff should run");
        console.log(tr.stderr);
        done();
    });

    it('Run defaults to filepath when both configurations are provided through yaml', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.apply;
        process.env[shared.TestEnvVars.useConfigurationFile] = "true";
        process.env[shared.TestEnvVars.configurationType] = ''; //does not matter during a yaml definition
        process.env[shared.TestEnvVars.configuration] = shared.formatPath("dir/deployment.yaml"); //dummy value to trigger not default configuration condition
        process.env[shared.TestEnvVars.inline] = 'sometextforinline';
        tr.run();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl apply -f ${shared.formatPath("dir/deployment.yaml")} -o json`) != -1, "kubectl apply should run");
        console.log(tr.stderr);
        done();
    });

});