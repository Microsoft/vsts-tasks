import tl = require('azure-pipelines-task-lib/task');
import msRestAzure = require("./azure-arm-common");
import azureServiceClient = require("./AzureServiceClient");
import azureServiceClientBase = require("./AzureServiceClientBase");
import webClient = require("./webClient");
import util = require("util");
import Q = require("q");

export class GraphManagementClient extends azureServiceClient.ServiceClient {
    public servicePrincipals: ServicePrincipals;

    constructor(credentials: msRestAzure.ApplicationTokenCredentials, baseUri?: any, options?: any) {
        super(credentials, null);

        this.apiVersion = '1.6';
        this.acceptLanguage = 'en-US';
        this.generateClientRequestId = true;

        if (!options)
            options = {};

        if (baseUri) {
            this.baseUri = baseUri;
        } else {
            this.baseUri = credentials.activeDirectoryResourceId;
        }

        if (options.acceptLanguage) {
            this.acceptLanguage = options.acceptLanguage;
        }
        if (options.longRunningOperationRetryTimeout) {
            this.longRunningOperationRetryTimeout = options.longRunningOperationRetryTimeout;
        }
        if (options.generateClientRequestId) {
            this.generateClientRequestId = options.generateClientRequestId;
        }

        this.servicePrincipals = new ServicePrincipals(this);
    }

    //Since there is no subscriptionId so keeping the check here and empty.
    protected validateInputs(subscriptionId: string) {
    }
}

export class ServicePrincipals {
    private client: GraphManagementClient;

    constructor(graphClient: GraphManagementClient) {
        this.client = graphClient;
    }

    public async GetServicePrincipal(options): Promise<any> {
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = this.client.setCustomHeaders(options);

        var filterQuery = util.format("appId eq '%s'", this.client.getCredentials().getClientId());
        httpRequest.uri = this.client.getRequestUri("{tenantId}/servicePrincipals",
            {
                '{tenantId}': this.client.getCredentials().getDomain()
            },
            ['$filter=' + encodeURIComponent(filterQuery)]
        );

        var deferred = Q.defer<any>();
        this.client.beginRequest(httpRequest).then(async function(response) {
            if (response.statusCode == 200) {
                var result = null;
                if (response.body.value) {
                    result = response.body.value[0];
                }

                deferred.resolve(result);
            }
            else {
                deferred.reject(azureServiceClientBase.ToError(response));
            }
        }).catch(function(error) {
            deferred.reject(error);
        });

        return deferred.promise;
    }
}