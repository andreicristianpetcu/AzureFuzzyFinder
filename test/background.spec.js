(() => {
    'use strict';
    var expect = require('chai').expect;

    describe('AzureApiService', () => {
        let sandbox;
        beforeEach(function () {
            sandbox = sinon.createSandbox();
        });
        afterEach(function () {
            sandbox.restore();
        });

        it('should parse the token', () => {
            const token = AzureApiService.getTokenFromUrl('https://b4b50a805f18e5fd477683058c7ea9673a19365b.extensions.allizom.org/#access_token=klmajR.L21hbm.w6VU-BBe_ar47M-iWS5-d7-NKH-1Xh-hi_aHA&token_type=Bearer&expires_in=3599&session_state=27b3b096-325e-4d6a-8726-272c055a3c7e');

            expect(token).to.eq('klmajR.L21hbm.w6VU-BBe_ar47M-iWS5-d7-NKH-1Xh-hi_aHA');
        })

        it('should fetch all resources in one go', async () => {
            browser.storage.local.get.withArgs("azureAggregatedData").returns(Promise.resolve(undefined));
            sandbox.stub(AzureApiService, 'getSubscriptions').returns({ "value": [aSubscription()] });
            sandbox.stub(AzureApiService, 'getTenants').returns({ "value": [aTenant()] })
            const fetchStub = sandbox.stub(AzureApiService, 'fetchData');
            fetchStub.withArgs(`https://management.azure.com/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resources?api-version=2020-06-01`)
                .returns({
                    'value': [aKubernetesCluster()],
                    'nextLink': 'https://management.azure.com/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resources?api-version=2020-06-01&%24skiptoken=eyJuZXh0UGFydGl0aW9uS2V5IjoiMSE4IVJEQXdORFktIiwibmV4dFJvd0tleSI6IjEhMjU2IVJERXdSakEwTWtVM01FRkRORVJCTUVFMk1qWkZSREU1TXpkRU5VTkdORUpmUjFKTUxVSlBUMDQ2TWtSVFZFSTZNa1JCUTFRNk1rUlhSVG95UkVGTVJWSlVVem95UkZKSExVMUpRMUpQVTA5R1ZEb3lSVWxPVTBsSFNGUlRPakpHVTBOSVJVUlZURVZFVVZWRlVsbFNWVXhGVXpveVJrSlBUMDQ2TWtSVFZFSTZNa1JCUTFRNk1rUlhSVG95UkVKRk9qSkVSa0ZKVEVWRVVrVlJWVVZUVkZNNk1rUkJURVZTVkRveVJFRlNUVG95UkRNdFYwVlRWRVZWVWs5UVJRLS0ifQ%3d%3d',
                })
            fetchStub.withArgs('https://management.azure.com/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resources?api-version=2020-06-01&%24skiptoken=eyJuZXh0UGFydGl0aW9uS2V5IjoiMSE4IVJEQXdORFktIiwibmV4dFJvd0tleSI6IjEhMjU2IVJERXdSakEwTWtVM01FRkRORVJCTUVFMk1qWkZSREU1TXpkRU5VTkdORUpmUjFKTUxVSlBUMDQ2TWtSVFZFSTZNa1JCUTFRNk1rUlhSVG95UkVGTVJWSlVVem95UkZKSExVMUpRMUpQVTA5R1ZEb3lSVWxPVTBsSFNGUlRPakpHVTBOSVJVUlZURVZFVVZWRlVsbFNWVXhGVXpveVJrSlBUMDQ2TWtSVFZFSTZNa1JCUTFRNk1rUlhSVG95UkVKRk9qSkVSa0ZKVEVWRVVrVlJWVVZUVkZNNk1rUkJURVZTVkRveVJFRlNUVG95UkRNdFYwVlRWRVZWVWs5UVJRLS0ifQ%3d%3d')
                .returns({ 'value': [aKubernetesCluster('prd')] })

            const aggregatedResources = await AzureApiService.getAggregatedData();

            expect(aggregatedResources.subscriptions).to.eql([aSubscription()]);
            expect(aggregatedResources.tenants).to.eql([aTenant()]);
            expect(aggregatedResources.resources).to.eql([aKubernetesCluster(), aKubernetesCluster('prd')]);
        });

        it('should not fetch all resources if they are in local storage', async () => {
            const azureAggregatedData = {
                tenants: [aTenant()],
                subscriptions: [aSubscription()],
                resources: [aResourceGroup()]
            };
            browser.storage.local.get.withArgs("azureAggregatedData").returns(Promise.resolve({ azureAggregatedData }));

            const aggregatedResources = await AzureApiService.getAggregatedData();

            expect(aggregatedResources).to.eql(azureAggregatedData);
        });
    });

    describe('ExtensionService', () => {
        let sandbox;
        beforeEach(function () {
            sandbox = sinon.createSandbox();
        });

        afterEach(function () {
            sandbox.restore();
        });
        it('should fetch subscription url', async () => {
            sandbox.stub(AzureApiService, 'getSubscriptions').returns({ "value": [aSubscription()] });
            sandbox.stub(AzureApiService, 'getTenants').returns({ "value": [aTenant()] })
            sandbox.stub(AzureApiService, 'getResources').returns({});

            const subscriptionUrls = await ExtensionService.getAllResourceUrls();

            expect(subscriptionUrls[0]).to.eql('https://portal.azure.com/#@example.com/resource/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/overview');
        });

        it('should fetch resource url', async () => {
            sandbox.stub(AzureApiService, 'getSubscriptions').returns({ "value": [aSubscription()] });
            sandbox.stub(AzureApiService, 'getTenants').returns({ "value": [aTenant()] })
            sandbox.stub(AzureApiService, 'getResources').withArgs('4bcd1bca-825c-4bb0-bf9e-428ad6861858').returns({
                "value": [aKubernetesCluster()]
            })

            const clusterUrl = await ExtensionService.getAllResourceUrls();

            expect(clusterUrl[1]).to.eql('https://portal.azure.com/#@example.com/resource/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resourceGroups/myproject-rg/providers/Microsoft.ContainerService/managedClusters/myproject-stb-aks/overview');
        });

        it('should fetch paginated responses', async () => {
            sandbox.stub(AzureApiService, 'getSubscriptions').returns({ "value": [aSubscription()] });
            sandbox.stub(AzureApiService, 'getTenants').returns({ "value": [aTenant()] })
            sandbox.stub(AzureApiService, 'getResources').withArgs('4bcd1bca-825c-4bb0-bf9e-428ad6861858').returns({
                "value": [aKubernetesCluster()],
                "nextLink": "https://management.azure.com/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resources?api-version=2020-06-01&%24skiptoken=eyJuZXh0UGFydGl0aW9uS2V5IjoiMSE4IVJEQXdORFktIiwibmV4dFJvd0tleSI6IjEhMjU2IVJERXdSakEwTWtVM01FRkRORVJCTUVFMk1qWkZSREU1TXpkRU5VTkdORUpmUjFKTUxVSlBUMDQ2TWtSVFZFSTZNa1JCUTFRNk1rUlhSVG95UkVGTVJWSlVVem95UkZKSExVMUpRMUpQVTA5R1ZEb3lSVWxPVTBsSFNGUlRPakpHVTBOSVJVUlZURVZFVVZWRlVsbFNWVXhGVXpveVJrSlBUMDQ2TWtSVFZFSTZNa1JCUTFRNk1rUlhSVG95UkVKRk9qSkVSa0ZKVEVWRVVrVlJWVVZUVkZNNk1rUkJURVZTVkRveVJFRlNUVG95UkRNdFYwVlRWRVZWVWs5UVJRLS0ifQ%3d%3d"
            })
            sandbox.stub(AzureApiService, 'fetchData').withArgs('https://management.azure.com/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resources?api-version=2020-06-01&%24skiptoken=eyJuZXh0UGFydGl0aW9uS2V5IjoiMSE4IVJEQXdORFktIiwibmV4dFJvd0tleSI6IjEhMjU2IVJERXdSakEwTWtVM01FRkRORVJCTUVFMk1qWkZSREU1TXpkRU5VTkdORUpmUjFKTUxVSlBUMDQ2TWtSVFZFSTZNa1JCUTFRNk1rUlhSVG95UkVGTVJWSlVVem95UkZKSExVMUpRMUpQVTA5R1ZEb3lSVWxPVTBsSFNGUlRPakpHVTBOSVJVUlZURVZFVVZWRlVsbFNWVXhGVXpveVJrSlBUMDQ2TWtSVFZFSTZNa1JCUTFRNk1rUlhSVG95UkVKRk9qSkVSa0ZKVEVWRVVrVlJWVVZUVkZNNk1rUkJURVZTVkRveVJFRlNUVG95UkRNdFYwVlRWRVZWVWs5UVJRLS0ifQ%3d%3d')
                .returns({ "value": [aKubernetesCluster('prd')] })

            const clusterUrl = await ExtensionService.getAllResourceUrls();

            expect(clusterUrl[1]).to.eql('https://portal.azure.com/#@example.com/resource/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resourceGroups/myproject-rg/providers/Microsoft.ContainerService/managedClusters/myproject-stb-aks/overview');
            expect(clusterUrl[2]).to.eql('https://portal.azure.com/#@example.com/resource/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resourceGroups/myproject-rg/providers/Microsoft.ContainerService/managedClusters/myproject-prd-aks/overview');
        });

        describe('suggestions', () => {
            let sandbox;
            beforeEach(function () {
                sandbox = sinon.createSandbox();
            });

            afterEach(function () {
                sandbox.restore();
                ExtensionService.resetAllSuggestions();
            });

            it('should build subscription suggestion', () => {
                const suggestion = ExtensionService.buildSuggestion(aTenant(), aSubscription());

                expect(suggestion.description).to.eql('▶️ Free Trial');
                expect(suggestion.content).to.eql('https://portal.azure.com/#@example.com/resource/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/overview');
            });

            it('should build resource group suggestion', () => {
                const suggestion = ExtensionService.buildSuggestion(aTenant(), aSubscription(), aResourceGroup());

                expect(suggestion.description).to.eql('▶️ Free Trial🔹myproject-rg');
                expect(suggestion.content).to.eql('https://portal.azure.com/#@example.com/resource/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resourceGroups/myproject-rg/overview');
                expect(suggestion.descriptionToLowerCase).to.eql('▶️ free trial🔹myproject-rg');
                expect(suggestion.contentToLowerCase).to.eql('https://portal.azure.com/#@example.com/resource/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resourcegroups/myproject-rg/overview');
            });

            it('should build vault suggestion', () => {
                const suggestion = ExtensionService.buildSuggestion(aTenant(), aSubscription(), {
                    id: '/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resourceGroups/myproject-rg/providers/Microsoft.KeyVault/vaults/myproject-kv'
                });

                expect(suggestion.description).to.eql('▶️ Free Trial🔹myproject-rg🔹myproject-kv');
                expect(suggestion.content).to.eql('https://portal.azure.com/#@example.com/resource/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resourceGroups/myproject-rg/providers/Microsoft.KeyVault/vaults/myproject-kv/overview');
            });

            it('should build virtual network suggestion', () => {
                const suggestion = ExtensionService.buildSuggestion(aTenant(), aSubscription(), {
                    id: '/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resourceGroups/myproject-rg/providers/Microsoft.Network/virtualNetworks/my-cool-lan'
                });

                expect(suggestion.description).to.eql('▶️ Free Trial🔹myproject-rg🔹my-cool-lan');
                expect(suggestion.content).to.eql('https://portal.azure.com/#@example.com/resource/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resourceGroups/myproject-rg/providers/Microsoft.Network/virtualNetworks/my-cool-lan/overview');
            });

            it('should build smartDetectorAlertRules suggestion', () => {
                const suggestion = ExtensionService.buildSuggestion(aTenant(), aSubscription(), {
                    id: '/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resourceGroups/myproject-rg/providers/microsoft.alertsmanagement/smartDetectorAlertRules/Failure Anomalies - myproject-appins'
                });

                expect(suggestion.description).to.eql('▶️ Free Trial🔹myproject-rg🔹Failure Anomalies - myproject-appins');
                expect(suggestion.content).to.eql('https://portal.azure.com/#@example.com/resource/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resourceGroups/myproject-rg/providers/microsoft.alertsmanagement/smartDetectorAlertRules/Failure Anomalies - myproject-appins/overview');
            });

            it('should build subscription, rg and k8s cluster suggestions', async () => {
                sandbox.stub(AzureApiService, 'getAggregatedData').returns({
                    tenants: [aTenant()],
                    subscriptions: [aSubscription()],
                    resources: [aResourceGroup(), aKubernetesCluster()]
                })

                const suggestions = await ExtensionService.buildAzureResourceSuggestions();

                expect(suggestions[0].description).to.eql('▶️ Free Trial');
                expect(suggestions[1].description).to.eql('▶️ Free Trial🔹myproject-rg');
                expect(suggestions[2].description).to.eql('▶️ Free Trial🔹myproject-rg🔹myproject-stb-aks');
            });

            it('should build a resource without explicit subscriptionId', async () => {
                sandbox.stub(AzureApiService, 'getAggregatedData').returns({
                    tenants: [aTenant()],
                    subscriptions: [aSubscription()],
                    resources: [{
                        id: "/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resourceGroups/myproject-rg/providers/Microsoft.Compute/disks/DataDisk",
                        name: "DataDisk",
                        type: "Microsoft.Compute/disks",
                    }]
                });

                const suggestions = await ExtensionService.buildAzureResourceSuggestions();

                expect(suggestions[1].description).to.eql('▶️ Free Trial🔹myproject-rg🔹DataDisk');
                expect(suggestions[1].content).to.eql('https://portal.azure.com/#@example.com/resource/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resourceGroups/myproject-rg/providers/Microsoft.Compute/disks/DataDisk/overview');
            });

            it('should render items from shortest to longest', async () => {
                sandbox.stub(AzureApiService, 'getAggregatedData').returns({
                    tenants: [aTenant()],
                    subscriptions: [aSubscription()],
                    resources: [aKubernetesCluster('medium'), aKubernetesCluster('really-long'), aKubernetesCluster('small')]
                });

                const suggestions = await ExtensionService.buildAzureResourceSuggestions();

                expect(suggestions[0].description).to.be.equal('▶️ Free Trial');
                expect(suggestions[1].description).to.be.equal('▶️ Free Trial🔹myproject-rg🔹myproject-small-aks');
                expect(suggestions[2].description).to.be.equal('▶️ Free Trial🔹myproject-rg🔹myproject-medium-aks');
                expect(suggestions[3].description).to.be.equal('▶️ Free Trial🔹myproject-rg🔹myproject-really-long-aks');
            });
        });
    })

    describe('SearchService', () => {
        let sandbox;
        let addSuggestions;
        beforeEach(function () {
            sandbox = sinon.createSandbox();
            addSuggestions = sinon.spy();
            ObjectNameMatcher.clean();
            ExtensionService.resetAllSuggestions();
        });

        afterEach(function () {
            sandbox.restore();
        });

        it('should render item based on entered text', async () => {
            const second = aSuggestion('second');
            sandbox.stub(ExtensionService, 'buildAzureResourceSuggestions').returns([
                aSuggestion('first'), second, aSuggestion('third'),
            ]);

            await SearchService.onInputChangedListener('second', addSuggestions);
            const addedSuggestions = addSuggestions.getCall(0).args[0];

            expect(addedSuggestions[0].content).to.be.equal(second.content);
            expect(addedSuggestions[0].description).to.be.equal(second.description);
            expect(addedSuggestions).to.eql([{
                content: second.content,
                description: second.description,
            }]);
        });

        it('should render item based on multiple entered texts', async () => {
            sandbox.stub(ExtensionService, 'buildAzureResourceSuggestions').returns([
                aSuggestion('north-europe'), aSuggestion('west-europe'), aSuggestion('usa'),
            ]);

            await SearchService.onInputChangedListener('europe west', addSuggestions);
            const addedSuggestions = addSuggestions.getCall(0).args[0];

            expect(addedSuggestions.length).to.be.equal(1);
            expect(addedSuggestions[0].description).to.be.equal('▶️ Free Trial🔹myproject-rg🔹myproject-west-europe-aks');
        });

        it('should render items not found result', async () => {
            sandbox.stub(ExtensionService, 'buildAzureResourceSuggestions').returns([
                aSuggestion('my-project'),
            ]);

            await SearchService.onInputChangedListener('other-project', addSuggestions);
            const addedSuggestions = addSuggestions.getCall(0).args[0];

            expect(addedSuggestions.length).to.be.eq(1);
            expect(addedSuggestions[0].description).to.be.equal('😞 Nothing found in your history and bookmarks. Let\'s check portal.azure.com');
            expect(addedSuggestions[0].content).to.be.equal('https://portal.azure.com/');
        });

        it('should render search results from services', async () => {
            sandbox.stub(IOService, 'getContent').returns({
                "name": "General",
                "values": [
                    {
                        "name": "Subscriptions",
                        "url": "https://portal.azure.com/#blade/Microsoft_Azure_Billing/SubscriptionsBlade"
                    }
                ]
            });

            await SearchService.onInputChangedListener('services general subscriptions', addSuggestions);
            const addedSuggestions = addSuggestions.getCall(0).args[0];

            expect(addedSuggestions[0].description).to.be.equal('🎛️Services🔹General🔹Subscriptions');
            expect(addedSuggestions[0].content).to.be.equal('https://portal.azure.com/#blade/Microsoft_Azure_Billing/SubscriptionsBlade');
        });

        it('should render search results from history', async () => {
            sandbox.stub(ExtensionService, 'buildAzureResourceSuggestions').returns([]);
            browser.history.search.returns([{
                'url': 'https://portal.azure.com/#@example.com/resource/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resourceGroups/myproject-rg/providers/Microsoft.KeyVault/vaults/myproject-kv/secrets'
            }]);
            ObjectNameMatcher.putObjectName('4bcd1bca-825c-4bb0-bf9e-428ad6861858', 'Free Trial');

            await SearchService.onInputChangedListener('myproject kv secrets', addSuggestions);
            const addedSuggestions = addSuggestions.getCall(0).args[0];

            expect(addedSuggestions[0].description).to.be.equal('🕒 Free Trial🔹myproject-rg🔹myproject-kv🔹secrets');
            expect(addedSuggestions[0].content).to.be.equal('https://portal.azure.com/#@example.com/resource/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resourceGroups/myproject-rg/providers/Microsoft.KeyVault/vaults/myproject-kv/secrets');
        });

    });
})();

function aSubscription() {
    return {
        "displayName": "Free Trial",
        "subscriptionId": "4bcd1bca-825c-4bb0-bf9e-428ad6861858",
        "tenantId": "8d509bd1-5a2e-41a7-955d-362d4b6aae85",
    }
}

function aTenant() {
    return {
        "tenantId": "8d509bd1-5a2e-41a7-955d-362d4b6aae85",
        "defaultDomain": "example.com"
    }
}

function aResourceGroup() {
    return {
        'id': '/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resourceGroups/myproject-rg',
        'subscriptionId': '4bcd1bca-825c-4bb0-bf9e-428ad6861858'
    }
}

function aKubernetesCluster(env) {
    if (!env) {
        env = 'stb';
    }
    return {
        "id": `/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resourceGroups/myproject-rg/providers/Microsoft.ContainerService/managedClusters/myproject-${env}-aks`,
        "subscriptionId": "4bcd1bca-825c-4bb0-bf9e-428ad6861858"
    }
}

function aSuggestion(env) {
    const source = {
        content: `https://portal.azure.com/#@example.com/resource/subscriptions/4bcd1bca-825c-4bb0-bf9e-428ad6861858/resourceGroups/myproject-rg/providers/Microsoft.ContainerService/managedClusters/myproject-${env}-aks/overview`,
        description: `▶️ Free Trial🔹myproject-rg🔹myproject-${env}-aks`
    };
    return {
        content: source.content,
        description: source.description,
        contentToLowerCase: source.content.toLocaleLowerCase(),
        descriptionToLowerCase: source.description.toLocaleLowerCase(),
    }
}