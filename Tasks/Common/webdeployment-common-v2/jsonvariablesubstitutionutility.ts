import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import fs = require('fs');
import { isNumber, isBoolean } from 'util';

const alias_delimiter = ';';

var varUtility = require ('./variableutility.js');
var fileEncoding = require('./fileencoding.js');
var utility = require('./utility.js');
export function createEnvTree(envVariables) {
    // __proto__ is marked as null, so that custom object can be assgined.
    // This replacement do not affect the JSON object, as no inbuilt JSON function is referenced.
    var envVarTree = {
        value: null,
        isEnd: false,
        child: {
            '__proto__': null
        }
    };
    for(let envVariable of envVariables) {
        var envVarTreeIterator = envVarTree;
        if(varUtility.isPredefinedVariable(envVariable.name)) {
            continue;
        } 
        var envVariableNameArray = (envVariable.name).split('.');
        
        for(let variableName of envVariableNameArray) {
            if(envVarTreeIterator.child[variableName] === undefined || typeof envVarTreeIterator.child[variableName] === 'function') {
                envVarTreeIterator.child[variableName] = {
                    value: null,
                    isEnd: false,
                    child: {}
                };
            }
            envVarTreeIterator = envVarTreeIterator.child[variableName];
        }
        envVarTreeIterator.isEnd = true;
        envVarTreeIterator.value = envVariable.value;
    }
    return envVarTree;
}

function checkEnvTreePath(jsonObjectKey, index, jsonObjectKeyLength, envVarTree, alias?: string) {
    if(index == jsonObjectKeyLength) {
        return envVarTree;
    }
    if (alias != null && alias != undefined && envVarTree.child[alias + alias_delimiter + jsonObjectKey[index]] !== undefined && typeof envVarTree.child[alias + alias_delimiter + jsonObjectKey[index]] !== 'function') {
        return checkEnvTreePath(jsonObjectKey, index + 1, jsonObjectKeyLength, envVarTree.child[alias + alias_delimiter + jsonObjectKey[index]], alias);
    }
    else if (envVarTree.child[jsonObjectKey[index]] !== undefined && typeof envVarTree.child[jsonObjectKey[index]] !== 'function') {
        return checkEnvTreePath(jsonObjectKey, index + 1, jsonObjectKeyLength, envVarTree.child[jsonObjectKey[index]], alias);
    }
    else {
        return undefined;
    }
}

export function substituteJsonVariable(jsonObject, envObject, alias?: string) {
    let isValueChanged: boolean = false;
    for(var jsonChild in jsonObject) {
        var jsonChildArray = jsonChild.split('.');
        var resultNode = checkEnvTreePath(jsonChildArray, 0, jsonChildArray.length, envObject, alias);
        if(resultNode != undefined) {
            if(resultNode.isEnd && (jsonObject[jsonChild] == null || typeof jsonObject[jsonChild] !== "object")) {
                console.log(tl.loc('SubstitutingValueonKey', jsonChild));
                jsonObject[jsonChild] = resultNode.value;
                isValueChanged = true;
            }
            else {
                isValueChanged = substituteJsonVariable(jsonObject[jsonChild], resultNode, alias) || isValueChanged;
            }
        }
    }
    return isValueChanged;
}

export function substituteJsonVariableV2(jsonObject, envObject, alias?: string) {
    let isValueChanged: boolean = false;
    for(var jsonChild in jsonObject) {
        var jsonChildArray = jsonChild.split('.');
        var resultNode = checkEnvTreePath(jsonChildArray, 0, jsonChildArray.length, envObject, alias);
        if(resultNode != undefined) {
            if(resultNode.isEnd) {
                switch(typeof(jsonObject[jsonChild])) {
                    case 'number':
                        console.log(tl.loc('SubstitutingValueonKeyWithNumber', jsonChild , resultNode.value));
                        jsonObject[jsonChild] = !isNaN(resultNode.value) ? Number(resultNode.value): resultNode.value;
                        break;
                    case 'boolean':
                        console.log(tl.loc('SubstitutingValueonKeyWithBoolean' , jsonChild , resultNode.value));
                        jsonObject[jsonChild] = (
                            resultNode.value == 'true' ? true : (resultNode.value == 'false' ? false : resultNode.value)
                        )
                        break;
                    case 'object':
                    case null:
                        try {
                            console.log(tl.loc('SubstitutingValueonKeyWithObject' , jsonChild , resultNode.value));
                            jsonObject[jsonChild] = JSON.parse(resultNode.value);
                        }
                        catch(exception) {
                            tl.debug('unable to substitute the value. falling back to string value');
                            jsonObject[jsonChild] = resultNode.value;
                        }
                        break;
                    case 'string':
                        console.log(tl.loc('SubstitutingValueonKeyWithString' , jsonChild , resultNode.value));
                        jsonObject[jsonChild] = resultNode.value;
                }
                isValueChanged = true;
            }
            else {
                isValueChanged = substituteJsonVariableV2(jsonObject[jsonChild], resultNode, alias) || isValueChanged;
            }
        }
    }
    return isValueChanged;
}

export function stripJsonComments(content) {
    if (!content || (content.indexOf("//") < 0 && content.indexOf("/*") < 0)) {
        return content;
    }

    var currentChar;
    var nextChar;
    var insideQuotes = false;
    var contentWithoutComments = '';
    var insideComment = 0;
    var singlelineComment = 1;
    var multilineComment = 2;

    for (var i = 0; i < content.length; i++) {
        currentChar = content[i];
        nextChar = i + 1 < content.length ? content[i + 1] : "";

        if (insideComment) {
            var update = false;
            if (insideComment == singlelineComment && (currentChar + nextChar === '\r\n' || currentChar === '\n')) {
                i--;
                insideComment = 0;
                continue;
            }

            if (insideComment == multilineComment && currentChar + nextChar === '*/') {
                i++;
                insideComment = 0;
                continue;
            }

        } else {
            if (insideQuotes && currentChar == "\\") {
                contentWithoutComments += currentChar + nextChar;
                i++; // Skipping checks for next char if escaped
                continue;
            }
            else {
                if (currentChar == '"') {
                    insideQuotes = !insideQuotes;
                }

                if (!insideQuotes) {
                    if (currentChar + nextChar === '//') {
                        insideComment = singlelineComment;
                        i++;
                    }

                    if (currentChar + nextChar === '/*') {
                        insideComment = multilineComment;
                        i++;
                    }
                }
            }
        }

        if (!insideComment) {
            contentWithoutComments += content[i];
        }
    }

    return contentWithoutComments;
}

export function jsonVariableSubstitution(absolutePath, jsonSubFiles, substituteAllTypes?: boolean) {
    var envVarObject = createEnvTree(tl.getVariables());
    let isSubstitutionApplied: boolean = false;
    for(let jsonSubFile of jsonSubFiles) {
        var jsonSubFile_alias: string = null;
        var jsonSubFile_file: string = jsonSubFile;

        var jsonSubFileWithAlias = jsonSubFile.split(alias_delimiter);

        if (jsonSubFileWithAlias.length > 1) {
            jsonSubFile_file = jsonSubFileWithAlias[0];
            jsonSubFile_alias = jsonSubFileWithAlias[1];

            if (jsonSubFile_alias.length == 0) {
                jsonSubFile_alias = null;
            }
        }

        console.log(tl.loc('JSONvariableSubstitution', jsonSubFile_file));
        var matchFiles = utility.findfiles(path.join(absolutePath, jsonSubFile_file));
        if(matchFiles.length === 0) {
            throw new Error(tl.loc('NOJSONfilematchedwithspecificpattern', jsonSubFile_file));
        }
        for(let file of matchFiles) {
            var fileBuffer: Buffer = fs.readFileSync(file);
            var fileEncodeType = fileEncoding.detectFileEncoding(file, fileBuffer);
            var fileContent: string = fileBuffer.toString(fileEncodeType[0]);
            if(fileEncodeType[1]) {
                fileContent = fileContent.slice(1);
            }
            try {
                fileContent = stripJsonComments(fileContent);
                var jsonObject = JSON.parse(fileContent);
            }
            catch(exception) {
                throw Error(tl.loc('JSONParseError', file, exception));
            }
            console.log(tl.loc('JSONvariableSubstitution' , file));
            if(substituteAllTypes) {
                isSubstitutionApplied = substituteJsonVariableV2(jsonObject, envVarObject, jsonSubFile_alias) || isSubstitutionApplied;
            }
            else {
                isSubstitutionApplied = substituteJsonVariable(jsonObject, envVarObject, jsonSubFile_alias) || isSubstitutionApplied;
            }
            
            tl.writeFile(file, (fileEncodeType[1] ? '\uFEFF' : '') + JSON.stringify(jsonObject, null, 4), fileEncodeType[0]);
        }
    }
    
    return isSubstitutionApplied;
}