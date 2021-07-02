import tl = require("azure-pipelines-task-lib/task");
import util = require("util");
import path = require("path");
import fs = require('fs');
import mime = require('browserify-mime');
import { Utility } from "./Utility";
import { WebRequest, sendRequest, WebResponse } from "./webClient";

export class Release {

    public async createRelease(githubEndpointToken: string, repositoryName: string, target: string, tag: string, releaseTitle: string, releaseNote: string, isDraft: boolean, isPrerelease: boolean): Promise<WebResponse> {
        let request = new WebRequest();
        
        request.uri = util.format(this._createReleaseApiUrlFormat, Utility.getGitHubApiUrl(), repositoryName);
        request.method = "POST";
        request.body = JSON.stringify({
            "tag_name": tag,
            "target_commitish": target,
            "name": releaseTitle,
            "body": releaseNote,
            "draft": isDraft,
            "prerelease": isPrerelease
        });
        request.headers = {
            "Content-Type": "application/json",
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Create release request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public async editRelease(githubEndpointToken: string, repositoryName: string, target: string, tag: string, releaseTitle: string, releaseNote: string, isDraft: boolean, isPrerelease: boolean, releaseId: string): Promise<WebResponse> {
        let request = new WebRequest();
            
        request.uri = util.format(this._editOrDeleteReleaseApiUrlFormat, Utility.getGitHubApiUrl(), repositoryName, releaseId);
        request.method = "PATCH";
        request.body = JSON.stringify({
            "tag_name": tag,
            "target_commitish": target,
            "name": releaseTitle,
            "body": releaseNote,
            "draft": isDraft,
            "prerelease": isPrerelease
        });
        request.headers = {
            "Content-Type": "application/json",
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Edit release request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public async deleteRelease(githubEndpointToken: string, repositoryName: string, releaseId: string): Promise<WebResponse> {
        let request = new WebRequest();
            
        request.uri = util.format(this._editOrDeleteReleaseApiUrlFormat, Utility.getGitHubApiUrl(), repositoryName, releaseId);
        request.method = "DELETE";
        request.headers = {
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Delete release request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public async deleteReleaseAsset(githubEndpointToken: string, repositoryName: string, asset_id: string): Promise<WebResponse> {
        let request = new WebRequest();
        
        request.uri = util.format(this._deleteReleaseAssetApiUrlFormat, Utility.getGitHubApiUrl(), repositoryName, asset_id);
        request.method = "DELETE";
        request.headers = {
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Delete release asset request: " + JSON.stringify(request));

        return await sendRequest(request);
    }


    public async uploadReleaseAsset(githubEndpointToken: string, filePath: string, uploadUrl: string): Promise<WebResponse> {
        let fileName = path.basename(filePath);
        tl.debug("Filename: " + fileName);
        
        let rd = fs.createReadStream(filePath);
        var stats = fs.statSync(filePath);

        let request = new WebRequest();
        request.uri = util.format(this._uploadReleaseAssetApiUrlFormat, uploadUrl.split('{')[0], encodeURIComponent(fileName));
        request.method = "POST";
        request.headers = {
            "Content-Type": mime.lookup(fileName),
            'Content-Length': stats.size,
            'Authorization': 'token ' + githubEndpointToken
        };
        request.body = rd;
        tl.debug("Upload release request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public async getBranch(githubEndpointToken: string, repositoryName: string, target: string): Promise<WebResponse> {
        let request = new WebRequest();
        
        request.uri = util.format(this._getBranchApiUrlFormat, Utility.getGitHubApiUrl(), repositoryName, target);
        request.method = "GET";
        request.headers = {
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Get branch request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public async getTags(githubEndpointToken: string, repositoryName: string): Promise<WebResponse> {
        let request = new WebRequest();
        
        request.uri = util.format(this._getTagsApiUrlFormat, Utility.getGitHubApiUrl(), repositoryName);
        request.method = "GET";
        request.headers = {
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Get tags request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public async getReleases(githubEndpointToken: string, repositoryName: string): Promise<WebResponse> {
        let request = new WebRequest();
        
        request.uri = util.format(this._getReleasesApiUrlFormat, Utility.getGitHubApiUrl(), repositoryName);
        request.method = "GET";
        request.headers = {
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Get releases request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public async getLatestRelease(githubEndpointToken: string, repositoryName: string): Promise<WebResponse> {
        let request = new WebRequest();
        
        request.uri = util.format(this._getLatestReleasesApiUrlFormat, Utility.getGitHubApiUrl(), repositoryName);
        request.method = "GET";
        request.headers = {
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Get latest release request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public async getPaginatedResult(githubEndpointToken: string, nextPageLink: string): Promise<WebResponse> {
        let request = new WebRequest();
        
        request.uri = nextPageLink;
        request.method = "GET";
        request.headers = {
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Get paginated request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public async getCommitsList(githubEndpointToken: string,repositoryName: string, startCommitSha: string, endCommitSha: string): Promise<WebResponse> {
        let request = new WebRequest();
        
        request.uri = util.format(this._getCommitsListApiUrlFormat, Utility.getGitHubApiUrl(), repositoryName, startCommitSha, endCommitSha);
        request.method = "GET";
        request.headers = {
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Get commits list request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public async getCommitsBeforeGivenSha(githubEndpointToken: string,repositoryName: string, sha: string): Promise<WebResponse> {
        let request = new WebRequest();
        
        request.uri = util.format(this._getCommitsBeforeGivenShaApiUrlFormat, Utility.getGitHubApiUrl(), repositoryName, sha);
        request.method = "GET";
        request.headers = {
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Get commits before given sha request: " + JSON.stringify(request));

        return await sendRequest(request);
    }

    public async getIssuesList(githubEndpointToken: string, repositoryName: string, issues: number[], includeLabels: boolean) {
        let request = new WebRequest();
        request.uri = util.format(this._graphQLUrlFormat, Utility.getGitHubApiUrl());
        request.method = "POST";
        request.headers = {
            'Authorization': 'token ' + githubEndpointToken
        };
        tl.debug("Fetching labels for issues: " + issues);
        let issuesQuery = issues.map(issue => `_${issue}: issueOrPullRequest(number: ${issue}){ ...labelsForIssue ...labelsForPullRequest }`).join(", ");
        let repositoryDetails = repositoryName.split("/");
        let labelsFragmentForIssue = `fragment labelsForIssue on Issue{
        title
        state
        labels(last: 10) {
            edges {
                node{
                    name
                    }
                }
            }
        }`;
        let labelsFragmentForPullRequest = `fragment labelsForPullRequest on PullRequest{
            title
            state
            changedFiles
            labels(last: 10) {
                edges {
                    node{
                        name
                        }
                    }
                }
            }`;
        let fragmentForIssue = `fragment labelsForIssue on Issue{
                title
                state
                }`;
        let fragmentForPullRequest = `fragment labelsForPullRequest on PullRequest{
                    title
                    state
                    }`;
        
        let query = `query{
            repository(owner: "${repositoryDetails[0]}", name: "${repositoryDetails[1]}"){
                ${issuesQuery}
            }
        }
        ${includeLabels ? labelsFragmentForIssue : fragmentForIssue}
        ${includeLabels ? labelsFragmentForPullRequest : fragmentForPullRequest}`;
        request.body = JSON.stringify({ query });
        tl.debug("Get issues along with labels: " + JSON.stringify(request));
        return await sendRequest(request);
    }

    private readonly _createReleaseApiUrlFormat: string = "%s/repos/%s/releases";
    private readonly _editOrDeleteReleaseApiUrlFormat: string = "%s/repos/%s/releases/%s";
    private readonly _deleteReleaseAssetApiUrlFormat: string = "%s/repos/%s/releases/assets/%s";
    private readonly _uploadReleaseAssetApiUrlFormat: string = "%s?name=%s";
    private readonly _getReleasesApiUrlFormat: string = "%s/repos/%s/releases";
    private readonly _getLatestReleasesApiUrlFormat: string = "%s/repos/%s/releases/latest";
    private readonly _getBranchApiUrlFormat: string = "%s/repos/%s/branches/%s";
    private readonly _getTagsApiUrlFormat: string = "%s/repos/%s/tags";
    private readonly _getCommitsListApiUrlFormat: string = "%s/repos/%s/compare/%s...%s";
    private readonly _getCommitsBeforeGivenShaApiUrlFormat: string = "%s/repos/%s/commits?sha=%s&per_page=100";
    private readonly _graphQLUrlFormat: string = "%s/graphql";
}