import tl = require("azure-pipelines-task-lib/task");
import * as telemetry from "utility-common-v2/telemetry";
import { Utility, GitHubAttributes, AzureDevOpsVariables, ActionType} from "./Utility";
import { Inputs } from "./Constants";
import { Release } from "./Release";
import * as crypto from "crypto";

interface IRelease {
    tagName: string;
    id: number;
}

interface ITelemetryData {
    area: string;
    action: string;
    repository: string;
    tagSource: string;
    isDraft: boolean;
    isPreRelease: boolean;
    addChangeLog: boolean;
}

export class Helper {
    
    /**
     * Returns tag name to be used for creating a release.
     * If tagPattern is specified, returns tag matching the given pattern
     * If user has specified tag, then use it 
     * else if $(Build.SourceBranch) is referencing to a tag, then parse tag name and use it
     * else fetch tag from the target specified by user
     * if no tag found for that target commit, then return undefined
     * else if more than 1 tag found, then throw error
     * else return the found tag name
     * @param githubEndpointToken 
     * @param repositoryName 
     * @param target 
     * @param tag 
     * @param tagPattern
     */
    public async getTagForCommitTarget(githubEndpointToken: string, repositoryName: string, target: string, tagPattern: string = null): Promise<string> {
        console.log(tl.loc("FetchTagForTarget", target));
        let tag = undefined; 
        
        let commit_sha: string = await this.getCommitShaFromTarget(githubEndpointToken, repositoryName, target);
        tl.debug("commit sha for target: " + commit_sha);
        let buildSourceVersion = tl.getVariable(AzureDevOpsVariables.buildSourceVersion);

        // If the buildSourceVersion and user specified target does not match, then prefer user specified target
        if (commit_sha !== buildSourceVersion) {
            tag = await this._getTagForCommit(githubEndpointToken, repositoryName, commit_sha, tagPattern);
        }
        else {
            let buildSourceBranch = tl.getVariable(AzureDevOpsVariables.buildSourceBranch);
            let normalizedBranch = Utility.normalizeBranchName(buildSourceBranch);

            // Check if branch is referencing to tag, if yes, then parse tag from branch name e.g. refs/tags/v1.0.1
            // Else fetch tag from commit
            if (!!normalizedBranch) {
                tag = normalizedBranch;
                if (!!tagPattern && !Utility.isTagMatching(tag, tagPattern)) {
                    tag = null;
                }
            }
            else {
                tag = await this._getTagForCommit(githubEndpointToken, repositoryName, commit_sha, tagPattern);
            }
        }

        if (!!tag) {
            console.log(tl.loc("FetchTagForTargetSuccess", target));
        }
        
        return tag;
    }

    /**
     * Returns latest commit on the target if target is branch else returns target.
     * Target can be branch as well e.g. 'master' and in this scenario we need to fetch commit associated to that branch
     * @param githubEndpointToken 
     * @param repositoryName 
     * @param target 
     */
    public async getCommitShaFromTarget(githubEndpointToken: string, repositoryName: string, target: string): Promise<string> {
        let commit_sha: string = undefined;
        let response = await new Release().getBranch(githubEndpointToken, repositoryName, target);
        tl.debug("Get branch response: " + JSON.stringify(response));

        if (response.statusCode === 200) {
            commit_sha = response.body[GitHubAttributes.commit][GitHubAttributes.sha];
        }
        else if (response.statusCode === 404) {
            commit_sha = target;
        }
        else {
            tl.error(tl.loc("GithubApiFailError"));
            throw new Error(response.body[GitHubAttributes.message]);
        }

        return commit_sha;
    }

    /**
     * Returns releaseId associated with the tag.
     * If 0 release found return undefined
     * else if 1 release found return releaseId
     * else throw error
     * @param githubEndpointToken 
     * @param repositoryName 
     * @param tag 
     */
    public async getReleaseIdForTag(githubEndpointToken: string, repositoryName: string, tag: string): Promise<any> {
        let release = new Release();
        
        // Fetching all releases in the repository.
        let releasesResponse = await release.getReleases(githubEndpointToken, repositoryName);
        let releasesWithGivenTag: IRelease[] = [];
        let links: { [key: string]: string } = {};

        // Fetching releases api call may end up in paginated results.
        // Traversing all the pages and filtering all the releases with given tag.
        while (true) {
            tl.debug("Get releases response: " + JSON.stringify(releasesResponse));

            if (releasesResponse.statusCode === 200) {
                // Filter the releases fetched
                (releasesResponse.body || []).forEach(release => {
                    tl.debug("release[GitHubAttributes.tagName]: " + release[GitHubAttributes.tagName] + " " + "tag: " + tag);
                    // Push release if tag matches
                    if (release[GitHubAttributes.tagName] === tag) {
                        releasesWithGivenTag.push({
                            tagName: release[GitHubAttributes.tagName],
                            id: release[GitHubAttributes.id]
                        } as IRelease);
                    }
                });

                // Throw error in case of ambiguity as we do not know which release to pick for editing or deleting release.
                if (releasesWithGivenTag.length >= 2) {
                    throw new Error(tl.loc("MultipleReleasesFoundError", tag));
                }

                links = Utility.parseHTTPHeaderLink(releasesResponse.headers[GitHubAttributes.link]);

                // Calling the next page if it exists
                if (links && links[GitHubAttributes.next]) {
                    let paginatedResponse = await release.getPaginatedResult(githubEndpointToken, links[GitHubAttributes.next]);
                    releasesResponse = paginatedResponse;
                    continue;
                }
                else {
                    return releasesWithGivenTag.length === 0 ? null : releasesWithGivenTag[0].id;
                }
            }
            else {
                tl.error(tl.loc("GetReleasesError"));
                throw new Error(releasesResponse.body[GitHubAttributes.message]);
            }
        }
    }   

    /**
     * Returns tag object associated with the commit.
     * If 0 tag found return undefined
     * else if 1 tag found return tag object
     * else throw error
     * @param githubEndpointToken 
     * @param repositoryName 
     * @param filterValue 
     * @param filterTagsCallback Callback to filter the tags
     */
    public async filterTag(githubEndpointToken: string, repositoryName: string, filterValue: string, filterTagsCallback: (tagsList: any[], filterValue: string) => any[]): Promise<any> {
        let release = new Release();

        // Fetching the tags in the repository
        let tagsResponse = await release.getTags(githubEndpointToken, repositoryName);
        let links: { [key: string]: string } = {};
        let filteredTags: any[] = [];

        // Fetching tags api call may end up in paginated results.
        // So, traversing pages one by one and throwing error if more than 1 tag found.
        while (true) {
            tl.debug("Get tags response: " + JSON.stringify(tagsResponse));

            if (tagsResponse.statusCode === 200) {
                // Parse header link and get links to different pages
                links = Utility.parseHTTPHeaderLink(tagsResponse.headers[GitHubAttributes.link]);
                
                // Filter the tags returned in current page
                let tags: any[] = filterTagsCallback(tagsResponse.body, filterValue);

                if (!!tags && tags.length > 0) {
                    // Push returned tags in filtered tags.
                    tags.forEach((tag: any) => {
                        filteredTags.push(tag);
                    })

                    // Throw error in case of ambiguity as we do not know which tag to pick for creating release.
                    if (filteredTags.length >= 2 ) {
                        throw new Error(tl.loc("MultipleTagFound", filterValue));
                    }
                }

                // Calling the next page if it exists
                if (links && links[GitHubAttributes.next]) {
                    let paginatedResponse = await release.getPaginatedResult(githubEndpointToken, links[GitHubAttributes.next]);
                    tagsResponse = paginatedResponse;
                    continue;
                }
                else {
                    return filteredTags.length === 0 ? undefined : filteredTags[0];
                }
            }
            else{
                tl.error(tl.loc("GetTagsError"));
                throw new Error(tagsResponse.body[GitHubAttributes.message]);
            }
        }
    }

    public publishTelemetry(): void {
        let telemetryData = {} as ITelemetryData;

        const releaseId: string = tl.getVariable(AzureDevOpsVariables.releaseId);

        telemetryData.area = !!releaseId ? "release" : "build";
        telemetryData.action = tl.getInput(Inputs.action, true).toLowerCase();
        let repositoryName = tl.getInput(Inputs.repositoryName, true);
        telemetryData.repository = crypto.createHash('sha256').update(repositoryName).digest('hex');

        if (telemetryData.action !== ActionType.delete) {

            if (telemetryData.action === ActionType.create) {
                telemetryData.tagSource = tl.getInput(Inputs.tagSource);
            }

            telemetryData.isDraft = tl.getBoolInput(Inputs.isDraft);
            telemetryData.isPreRelease = tl.getBoolInput(Inputs.isPreRelease);
            telemetryData.addChangeLog = tl.getBoolInput(Inputs.addChangeLog);
        }

        telemetry.emitTelemetry("TaskHub", "GitHubRelease", telemetryData);
    }
    
    /**
     * Returns tag name associated with the commit.
     * If tagPattern is specified returns tag name
     * If 0 tag found return undefined
     * else if 1 tag found return tag name
     * else throw error
     * @param githubEndpointToken 
     * @param repositoryName 
     * @param commit_sha 
     */
    private async _getTagForCommit(githubEndpointToken: string, repositoryName: string, commit_sha: string, tagPattern: string = null): Promise<string> {
        let filteredTag: any;
        let filterTagsCallback = (tagsList: any[], commit_sha: string): any[] => {
            tagsList = this._filterTagsByCommitSha(tagsList, commit_sha);
            if (!tagPattern) {
                return tagsList;
            }
            return tagsList.filter((tag: any) => Utility.isTagMatching(tag[GitHubAttributes.nameAttribute], tagPattern));
        }

        filteredTag = await this.filterTag(githubEndpointToken, repositoryName, commit_sha, filterTagsCallback);

        return filteredTag && filteredTag[GitHubAttributes.nameAttribute];
    }

    /**
     * Returns an array of matched tags, filtering on basis of commit sha
     */
    private _filterTagsByCommitSha = (tagsList: any[], commit_sha: string): any[] => {
        let filteredTags: any[] = [];

        for (let tag of (tagsList || [])) {
            if (tag[GitHubAttributes.commit][GitHubAttributes.sha] === commit_sha) {
                filteredTags.push(tag);
            }
        }

        return filteredTags;
    }
}