var jsonSubUtil = require('webdeployment-common-v2/jsonvariablesubstitutionutility.js');
var utility = require('webdeployment-common-v2/utility.js');
import fs = require('fs');
import path = require('path');

const alias_test: string = 'test';
const alias_tt4: string = 'tt4';
const delimiter: string = ';';

var files = ['L1JSONVarSub/JSONWithComments.json' + delimiter + alias_test, 
    'L1JSONVarSub/JSONWithComments2.json' + delimiter + alias_tt4, 
    'L1JSONVarSub/JSONWithComments3.json'];

var envVarObject = jsonSubUtil.createEnvTree([
    { name: 'dataSourceBindings.0.target', value: 'AppServiceName', secret: false},
    { name: 'name', value: 'App Service Deploy', secret: false},
    { name: alias_tt4 + delimiter + 'name', value: 'App Service Deploy1', secret: false },
    { name: alias_test + delimiter + 'name', value: 'App Service Deploy2', secret: false },
    { name: 'tt2' + delimiter + 'name', value: 'App Service Deploy', secret: false },
    { name: alias_test + delimiter + 'Hello.World', value: 'Hello World3', secret: false },
    { name: alias_tt4 + delimiter + 'Hello.World', value: 'Hello World', secret: false },
    { name: 'Hello.World', value: 'Hello World', secret: false},
    { name: 'dataSourceBindings.1.parameters.WebAppName', value: 'App Service Name params', secret: false},
    { name: 'messages.Invalidwebapppackageorfolderpathprovided', value: 'Invalidwebapppackageorfolderpathprovided', secret: true}
]);

function validateJSONWithComments() {
    var fileContent: string = fs.readFileSync(path.join(__dirname, 'L1JSONVarSub', 'JSONWithComments.json'), 'utf-8');
    var jsonContent: string = jsonSubUtil.stripJsonComments(fileContent);
    var jsonObject = JSON.parse(jsonContent);
    jsonSubUtil.substituteJsonVariable(jsonObject, envVarObject);

    if(jsonObject['dataSourceBindings']['0']['target'] != 'AppServiceName') {
        throw new Error('JSON VAR SUB FAIL #1');
    }
    if(jsonObject['name'] != 'App Service Deploy') {
        throw new Error('JSON VAR SUB FAIL #2');
    }
    if(jsonObject['Hello']['World'] != 'Hello World') {
        throw new Error('JSON VAR SUB FAIL #3');
    }
    if(jsonObject['dataSourceBindings']['1']['parameters']['WebAppName'] != 'App Service Name params') {
        throw new Error('JSON VAR SUB FAIL #4');
    }
    if(jsonObject['messages']['Invalidwebapppackageorfolderpathprovided'] != 'Invalidwebapppackageorfolderpathprovided') {
        throw new Error('JSON VAR SUB FAIL #5');
    }
    console.log("VALID JSON COMMENTS TESTS PASSED");
}

function validateJSONFiles() {
    for (let jsonSubFile of files) {

        var jsonSubFile_alias: string = null;
        var jsonSubFile_file: string = jsonSubFile;
        var aliasWithDelimiter: string = '';

        var jsonSubFileWithAlias = jsonSubFile.split(delimiter);

        if (jsonSubFileWithAlias.length > 1) {
            jsonSubFile_file = jsonSubFileWithAlias[0];
            jsonSubFile_alias = jsonSubFileWithAlias[1];
            aliasWithDelimiter = jsonSubFile_alias + delimiter;

            if (jsonSubFile_alias.length == 0) {
                jsonSubFile_alias = null;
            }
        }

        console.log('JSONvariableSubstitution: ' + jsonSubFile_file);
        var matchFiles = utility.findfiles(path.join(__dirname, jsonSubFile_file));
        if (matchFiles.length === 0) {
            throw new Error('NOJSONfilematchedwithspecificpattern: ' + jsonSubFile_file);
        }
        for (let file of matchFiles) {
            console.log('File name: ' + file);
            console.log('Alias name: ' + jsonSubFile_alias);

            var fileContent: string = fs.readFileSync(file, 'utf-8');
            var jsonContent: string = jsonSubUtil.stripJsonComments(fileContent);
            var jsonObject = JSON.parse(jsonContent);

            jsonSubUtil.substituteJsonVariable(jsonObject, envVarObject, jsonSubFile_alias);

            console.log(aliasWithDelimiter + 'name: ' + envVarObject.child[aliasWithDelimiter + 'name'].value)

            if (jsonObject['dataSourceBindings']['0']['target'] != 'AppServiceName') {
                throw new Error('JSON VAR SUB FAIL #1');
            }
            if (jsonObject['name'] != envVarObject.child[aliasWithDelimiter + 'name'].value) {
                throw new Error('JSON VAR SUB FAIL #2');
            }
            if (jsonObject['Hello']['World'] != envVarObject.child[aliasWithDelimiter + 'Hello'].child['World'].value) {
                throw new Error('JSON VAR SUB FAIL #3');
            }
            if (jsonObject['dataSourceBindings']['1']['parameters']['WebAppName'] != 'App Service Name params') {
                throw new Error('JSON VAR SUB FAIL #4');
            }
            if (jsonObject['messages']['Invalidwebapppackageorfolderpathprovided'] != 'Invalidwebapppackageorfolderpathprovided') {
                throw new Error('JSON VAR SUB FAIL #5');
            }
            console.log("VALID JSON COMMENTS TESTS PASSED");
        }
    }
    console.log("VALID JSON files");
}

function validateInvalidJSONWithComments() {
    var fileContent: string = fs.readFileSync(path.join(__dirname, 'L1JSONVarSub', 'InvalidJSONWithComments.json'), 'utf-8');
    var jsonContent: string = jsonSubUtil.stripJsonComments(fileContent);
    try {
        var jsonObject = JSON.parse(jsonContent);
        throw new Error('JSON VAR SUB FAIL #6');
    }
    catch(error) {
        console.log("INVALID JSON COMMENTS TESTS PASSED");
    }
}

export function validate() {
    validateJSONWithComments();
    validateJSONFiles();
    validateInvalidJSONWithComments();
}