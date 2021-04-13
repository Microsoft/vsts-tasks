import path = require('path');
import * as ParameterParserUtility from 'azure-pipelines-tasks-webdeployment-common/ParameterParserUtility';

function validateParameterParserUtility() {
    var paramString = "-port 8080 -Release.ReleaseName Release-1173";
    var expectedJSON = JSON.stringify({
        "port": {
            value: "8080"
        },
        "Release.ReleaseName":  {
            value: "Release-1173"
        }
    });

    var resultJSON = JSON.stringify(ParameterParserUtility.parse(paramString));

    if(expectedJSON == resultJSON) {
        console.log("PARAMETERPARSERUTILITY CASE 1 PASSED");
    }
    else {
        throw new Error("PARAMETERPARSERUTILITY CASE 1 FAILED");
    }
}

function validateParameterParserUtilityWithEmptyValues() {
    var paramString = "-port 8080 -ErrorCode -ErrorMessage -Release.ReleaseName Release-1173";
    var expectedJSON = JSON.stringify({
        "port": {
            value: "8080"
        },
        "ErrorCode": {
            value: ""
        },
        "ErrorMessage": {
            value: ""
        },
        "Release.ReleaseName":  {
            value: "Release-1173"
        }
    });

    var resultJSON = JSON.stringify(ParameterParserUtility.parse(paramString));

    if(expectedJSON == resultJSON) {
        console.log("PARAMETERPARSERUTILITY CASE 2 WITH EMPTY VALUE PASSED");
    }
    else {
        throw new Error("PARAMETERPARSERUTILITY CASE 2 WITH EMPTY VALUE FAILED");
    }
}

function validateParameterParserUtilityWithExtraSpaces() {
    var paramString = "-port         8080    -ErrorCode    -ErrorMessage     -Release.ReleaseName         Release-1173";
    var expectedJSON = JSON.stringify({
        "port": {
            value: "8080"
        },
        "ErrorCode": {
            value: ""
        },
        "ErrorMessage": {
            value: ""
        },
        "Release.ReleaseName":  {
            value: "Release-1173"
        }
    });

    var resultJSON = JSON.stringify(ParameterParserUtility.parse(paramString));

    if(expectedJSON == resultJSON) {
        console.log("PARAMETERPARSERUTILITY CASE 3 WITH EXTRA SPACES PASSED");
    }
    else {
        throw new Error("PARAMETERPARSERUTILITY CASE 3 WITH EXTRA SPACES FAILED");
    }
}


validateParameterParserUtility();
validateParameterParserUtilityWithEmptyValues();
validateParameterParserUtilityWithExtraSpaces();