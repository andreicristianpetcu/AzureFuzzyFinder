browser.omnibox.setDefaultSuggestion({
  description: `Search for azure resources by name and path (e.g. "ff my-resource-group" or "ff myproject prod west vault")`
});

const ignoredSegments = [
  'providers',
  'actionGroups',
  'components',
  'databases',
  'containerService',
  'managedClusters',
  'overview',
  'resourceGroups',
  'searchv1',
  'searchv2',
  'servers',
  'vaults',
  'virtualNetworks',
  'disks',
  'metricsalerts',
  'scheduledqueryrules',
  'namespaces',
  'smartDetectorAlertRules',
];

class AzureApiService {
  static async getSubscriptions() {
    return await this.fetchData('https://management.azure.com/subscriptions?api-version=2020-01-01');
  }

  static async getTenants() {
    return await this.fetchData('https://management.azure.com/tenants?api-version=2020-01-01');
  }

  static async getResources(subscriptionId) {
    return await this.fetchData(`https://management.azure.com/subscriptions/${subscriptionId}/resources?api-version=2020-06-01`);
  }

  static async fetchData(url) {
    const accessToken = await getAccessToken();
    const response = fetch(url, {
      "headers": {
        "Authorization": `Bearer ${accessToken}`,
      },
    });
    const awaitedResponse = await response;
    const json = await awaitedResponse.json();
    return json;
  }

  static getTokenFromUrl(url) {
    return url.split('#access_token=')[1].split('&')[0];
  }

  static async getAggregatedData() {
    let azureAggregatedData = await browser.storage.local.get('azureAggregatedData');
    if (!!azureAggregatedData && !!azureAggregatedData.azureAggregatedData && Object.keys(azureAggregatedData.azureAggregatedData).length > 0) {
      return azureAggregatedData.azureAggregatedData;
    } else {
      azureAggregatedData = await AzureApiService.fetchAggregatedData();
      browser.storage.local.set({ azureAggregatedData });
      return azureAggregatedData
    }
  }

  static async fetchAggregatedData() {
    const resources = [];
    const tenantNameToDefaultDomainMap = {};
    const tenantsResponse = await AzureApiService.getTenants();
    for (const tenant of tenantsResponse.value) {
      tenantNameToDefaultDomainMap[tenant.tenantId] = tenant.defaultDomain;
      ObjectNameMatcher.putObjectName(tenant.tenantId, tenant.defaultDomain);
    }

    const subscriptionsResponse = await AzureApiService.getSubscriptions();
    for (const subscription of subscriptionsResponse.value) {
      ObjectNameMatcher.putObjectName(subscription.subscriptionId, subscription.displayName);
      let nextLink = `https://management.azure.com/subscriptions/${subscription.subscriptionId}/resources?api-version=2020-06-01`;
      while (nextLink) {
        let resourcesResponse = await AzureApiService.fetchData(nextLink);
        for (const resource of resourcesResponse.value) {
          resources.push(resource);
        }
        nextLink = resourcesResponse.nextLink
      }
    }
    return {
      subscriptions: subscriptionsResponse.value,
      tenants: tenantsResponse.value,
      resources: resources,
    };
  }
}

class ExtensionService {
  static urlRoot = 'https://portal.azure.com';
  static loadedResourceUrls;
  static allSuggestions;

  static async loadResourceUrls() {
    if (!loadedResourceUrls) {
      loadedResourceUrls = await this.getAllResourceUrls();
    }
    return loadedResourceUrls;
  }

  static async getAllResourceUrls() {
    const resourceUrls = [];
    const tenantNameToDefaultDomainMap = {};
    const tenantsResponse = await AzureApiService.getTenants();
    for (const tenant of tenantsResponse.value) {
      tenantNameToDefaultDomainMap[tenant.tenantId] = tenant.defaultDomain;
      ObjectNameMatcher.putObjectName(tenant.tenantId, tenant.defaultDomain);
    }

    const subscriptionsResponse = await AzureApiService.getSubscriptions();
    for (const subscription of subscriptionsResponse.value) {
      const tenantDefaultDomain = tenantNameToDefaultDomainMap[subscription.tenantId];
      ObjectNameMatcher.putObjectName(subscription.subscriptionId, subscription.displayName);
      resourceUrls.push(`${this.urlRoot}/#@${tenantDefaultDomain}/resource/subscriptions/${subscription.subscriptionId}/overview`);

      let resourcesResponse = await AzureApiService.getResources(subscription.subscriptionId);
      if (resourcesResponse.value) {
        for (const resource of resourcesResponse.value) {
          resourceUrls.push(`${this.urlRoot}/#@${tenantDefaultDomain}/resource${resource.id}/overview`);
        }
        let nextLink = resourcesResponse.nextLink;
        while (nextLink) {
          let resourcesResponse = await AzureApiService.fetchData(nextLink);
          for (const resource of resourcesResponse.value) {
            resourceUrls.push(`${this.urlRoot}/#@${tenantDefaultDomain}/resource${resource.id}/overview`);
          }
          nextLink = resourcesResponse.nextLink
        }
      }
    }
    return resourceUrls;
  }

  static async getAllSuggestions() {
    if (!this.allSuggestions) {
      let allSuggestions = [];
      try {
        allSuggestions = allSuggestions.concat(await ExtensionService.buildAzureResourceSuggestions());
      } catch { }
      try {
        allSuggestions = allSuggestions.concat(await ExtensionService.buildAzureServiceSuggestions());
      } catch { }
      try {
        allSuggestions = allSuggestions.concat(await ExtensionService.buildAzureHistorySuggestions());
      } catch { }


      allSuggestions = allSuggestions.sort(function (a, b) {
        const lengthDifference = a.description.length - b.description.length;
        if (lengthDifference === 0) {
          return a.description.localeCompare(b.description);
        } else {
          return lengthDifference;
        }
      });
      this.allSuggestions = allSuggestions;
    }
    return this.allSuggestions;
  }

  static async buildAzureHistorySuggestions() {
    console.log(ObjectNameMatcher.getObjectIdToName());
    let history = await browser.history.search({
      text: "portal.azure.com",
      startTime: 0,
      maxResults: 99999999
    });
    history = history.map(searchResult => searchResult.url)
      .filter(url => url.indexOf('%s') === -1 && url.indexOf('https://portal.azure.com/') !== -1);
    history = history.map(content => {
      try {
        const description = "🕒 " + ExtensionService.parseUrl(content).join('🔹');
        return {
          description,
          descriptionToLowerCase: description.toLocaleLowerCase(),
          content,
          contentToLowerCase: content.toLowerCase(),
        };
      } catch {
        return {}
      }
    }).filter(h => !!h.description);
    return history;
  }

  static async buildAzureServiceSuggestions() {
    const files = ['general', 'compute', 'mobile', 'networking', 'storage', 'web'];
    const suggestions = [];
    for (const file of files) {
      var dataFromJson = await IOService.getContent(`services/${file}.json`);
      if (dataFromJson && dataFromJson.name && dataFromJson.values) {
        const categoryName = dataFromJson.name;
        for (let service of dataFromJson.values) {
          const content = service.url;
          const description = `🎛️Services🔹${categoryName}🔹${service.name}`;
          suggestions.push({
            content,
            contentToLowerCase: content.toLocaleLowerCase(),
            description,
            descriptionToLowerCase: description.toLocaleLowerCase(),
          });
        }
      }
    }
    return suggestions;
  }

  static async buildAzureResourceSuggestions() {
    let suggestions = [];
    const data = await AzureApiService.getAggregatedData();
    const subscriptionsById = {};
    const tenantsById = {};
    for (const tenant of data.tenants) {
      tenantsById[tenant.tenantId] = tenant;
    }
    for (const subscription of data.subscriptions) {
      subscriptionsById[subscription.subscriptionId] = subscription;
      const tenant = tenantsById[subscription.tenantId];
      suggestions.push(this.buildSuggestion(tenant, subscription));
      ObjectNameMatcher.putObjectName(subscription.subscriptionId, subscription.displayName);
    }
    for (const resource of data.resources) {
      try {
        let subscriptionId;
        if (resource.subscriptionId) {
          subscriptionId = resource.subscriptionId
        } else {
          subscriptionId = resource.id.split('/subscriptions/')[1].split('/resourceGroups/')[0];
        }
        const subscription = subscriptionsById[subscriptionId];
        const tenant = tenantsById[subscription.tenantId];
        let newSuggestion = this.buildSuggestion(tenant, subscription, resource);
        suggestions.push(newSuggestion);
      } catch (e) {
      }
    }
    return suggestions.sort(function (a, b) {
      const lengthDifference = a.description.length - b.description.length;
      if (lengthDifference === 0) {
        return a.description.localeCompare(b.description);
      } else {
        return lengthDifference;
      }
    });
  }

  static buildSuggestion(tenant, subscription, resource) {
    let content;
    if (resource) {
      content = `${this.urlRoot}/#@${tenant.defaultDomain}/resource${resource.id}/overview`;
    } else {
      content = `${this.urlRoot}/#@${tenant.defaultDomain}/resource/subscriptions/${subscription.subscriptionId}/overview`;
    }
    const urlFragments = this.parseUrl(content);
    if (urlFragments) {
      if (urlFragments[0] === subscription.subscriptionId) {
        urlFragments[0] = subscription.displayName;
      }
      const description = "▶️ " + urlFragments.join('🔹');
      return {
        content,
        contentToLowerCase: content.toLocaleLowerCase(),
        description,
        descriptionToLowerCase: description.toLocaleLowerCase(),
      }
    }
  }
  static parseUrl(url) {
    try {
      const mainResourceFragments = url.split('/resource/subscriptions/')[1].split('/');
      const pathFragments = [];
      for (const fragment of mainResourceFragments) {
        if (ignoredSegments.indexOf(fragment) === -1
          && fragment.indexOf('Microsoft.') === -1
          && fragment.indexOf('microsoft.') === -1) {
          const objectName = ObjectNameMatcher.getObjectName(fragment);
          if (!!objectName) {
            pathFragments.push(objectName);
          } else {
            pathFragments.push(fragment);
          }
        }
      }
      return pathFragments;
    } catch (e) {
    }
  }

  static resetAllSuggestions() {
    this.allSuggestions = undefined;
  }
}

class IOService {
  static async getContent(filePath) {
    try {
      var jsonUrl = browser.runtime.getURL(filePath);
      const dataFromFile = await fetch(jsonUrl);
      const dataFromJson = await dataFromFile.json();
      return dataFromJson;
    } catch {
      return {}
    }
  }
}


class ObjectNameMatcher {
  static objectIdToName = {}
  static getObjectName(id) {
    return this.objectIdToName[id];
  }

  static putObjectName(id, name) {
    this.objectIdToName[id] = name;
  }

  static clean() {
    this.objectIdToName = {};
  }

  static getObjectIdToName(){
    return this.objectIdToName;
  }

  static setObjectIdToName(objectIdToName){
    this.objectIdToName = objectIdToName;
  }
}
class SearchService {

  static async onInputChangedListener(text, addSuggestions) {
    const suggestions = await ExtensionService.getAllSuggestions();
    const words = text.toLowerCase().split(" ").map(word => word.trim());
    const alreadyAdded = new Set();
    const allSuggestions = [];
    for (const suggestionToAdd of suggestions) {
      if (allSuggestions.length === 5) {
        break;
      }
      if (!alreadyAdded.has(suggestionToAdd.contentToLowerCase)) {
        let matchAllWords = true;
        for (const word of words) {
          if (suggestionToAdd.descriptionToLowerCase.indexOf(word) === -1
            && suggestionToAdd.contentToLowerCase.indexOf(word) === -1) {
            matchAllWords = false;
          }
        }
        if (matchAllWords) {
          alreadyAdded.add(suggestionToAdd.contentToLowerCase);
          const { content, description } = suggestionToAdd;
          allSuggestions.push({ content, description });
        }
      }
    }
    if (allSuggestions.length > 0) {
      addSuggestions(allSuggestions);
    } else {
      addSuggestions([{
        description: '😞 Nothing found in your history and bookmarks. Let\'s check portal.azure.com',
        content: 'https://portal.azure.com/'
      }]);
    }
  }

  static async onInputEnteredListener(url, disposition) {
    switch (disposition) {
      case "currentTab":
        browser.tabs.update({ url });
        break;
      case "newForegroundTab":
        browser.tabs.create({ url });
        break;
      case "newBackgroundTab":
        browser.tabs.create({ url, active: false });
        break;
    }
  }

}

browser.omnibox.onInputChanged.addListener(SearchService.onInputChangedListener);
browser.omnibox.onInputEntered.addListener(SearchService.onInputEnteredListener);

function validate(returnedUrl) {
  return AzureApiService.getTokenFromUrl(returnedUrl);
}

function authorize() {
  const redirectURL = browser.identity.getRedirectURL();
  const clientID = "963c2ebd-0cf6-4731-a756-65c51e02cc4d";
  const scopes = ["user_impersonation"];
  let authURL = "https://login.microsoftonline.com/common/oauth2/authorize";
  authURL += `?client_id=${clientID}`;
  authURL += `&response_type=token`;
  authURL += `&resource=https://management.azure.com/`;
  authURL += `&redirect_uri=${encodeURIComponent(redirectURL)}`;
  authURL += `&scope=${encodeURIComponent(scopes.join(' '))}`;

  return browser.identity.launchWebAuthFlow({
    interactive: true,
    url: authURL
  });
}

let accessToken;
async function getAccessToken() {
  if (!accessToken) {
    accessToken = await authorize().then(validate);
  }
  return accessToken;
}

// if (!window.isTest) {
//   ExtensionService.buildAzureResourceSuggestions();
// }
