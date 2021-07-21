import * as path from 'path';
import * as fs from 'fs';
import * as tl from 'azure-pipelines-task-lib/task';

let globule = require('globule');

export function findFiles(pattern: string, includeDir: boolean, cwd?: string): string[];
export function findFiles(pattern: string[], includeDir: boolean, cwd?: string): string[];
export function findFiles(pattern: any, includeDir: boolean, cwd?: string): string[] {
    let patterns: string[] = [];
    let baseDir = isNullOrWhitespace(cwd) ? process.cwd() : cwd;

    tl.debug('Input pattern: ' + pattern + ' cwd: ' + baseDir);

    if (typeof pattern === 'string') {
        patterns = [pattern];
    } else if (pattern instanceof Array) {
        patterns = pattern;
    }

    let searchPattern = extractPattern(patterns, baseDir);
    let globPattern: string[] = searchPattern.includePatterns;

    searchPattern.excludePatterns.forEach(p => globPattern.push('!' + p));
    tl.debug('Glob pattern: ' + JSON.stringify(globPattern));

    let result = globule.find(globPattern);
    tl.debug('Glob result length: ' + result.length);
    if (!includeDir) {
        return result.filter(isFile);
    }

    return result;
}

function appendCwd(filterPattern: string[], cwd: string): string[] {
    let result: string[] = [];
    filterPattern.forEach(p => result.push(path.isAbsolute(p) ? p : path.join(cwd, p)));
    return result;
}

function extractPattern(patterns: string[], cwd: string): any {
    let includePatterns: string[] = [];
    let excludePatterns: string[] = [];

    patterns.forEach(p => {
        p.split(';').forEach(inputFilter => {
            if (isNullOrWhitespace(inputFilter) || inputFilter.length < 2) {
                tl.warning('Ignoring this filter: ' + inputFilter);
            }

            switch (inputFilter.charAt(0)) {
                case '+':
                    includePatterns.push(inputFilter.substr(2));
                    break;
                case '-':
                    excludePatterns.push(inputFilter.substr(2));
                    break;
                default:
                    includePatterns.push(inputFilter);
            }
        });
    });

    tl.debug('Include patterns length: ' + includePatterns.length + ' Exclude patterns length: ' + excludePatterns.length);
    return {
        includePatterns: appendCwd(includePatterns, cwd),
        excludePatterns: appendCwd(excludePatterns, cwd)
    };
}

function isNullOrWhitespace(input) {
    if (typeof input === 'undefined' || input == null) {
        return true;
    }
    return input.replace(/\s/g, '').length < 1;
}

function isFile(path: string): boolean {
    try {
        return fs.lstatSync(path).isFile();
    } catch (err) {
        return true;
    }
}
