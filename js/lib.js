const debugMode = false;

export function isDebugMode() {
    return debugMode;
}

export function domainMatchesWildcard(domain, wildcardDomain) {
    if (wildcardDomain.startsWith('*')) {
        const wildcardPrefix = wildcardDomain.slice(1);
        return domain.endsWith(wildcardPrefix);
    }
    return domain === wildcardDomain;
}

export function getRefererHeaderForDomain(domain, callback) {
    chrome.storage.local.get('refererHeaders', (result) => {
        const refererHeaders = result.refererHeaders || {};
        if (isDebugMode())
            console.debug("Local Storage:" +  JSON.stringify(result, null, 2));

        let refererValue = 0;
        for (const savedDomain in refererHeaders) {
            if (isDebugMode())
                console.debug("Compare domain", domain, "with saved", savedDomain);
            if (domainMatchesWildcard(domain, savedDomain)) {
                refererValue = refererHeaders[savedDomain];
                if (isDebugMode())
                    console.debug("Found!", domain, savedDomain, refererValue)
                break;
            }
        }
        //const refererHeaders = result.refererHeaders || {};
        callback(refererValue);
    });
}

export function loadSavedSettings() {
    const domain = document.getElementById('domain').value;

    if (domain) {
        getRefererHeaderForDomain(domain, (value) => {
            document.getElementById('refererHeader').value = value;
        });
    }
}

export function saveRefererHeaderForDomain(domain, value) {
    chrome.storage.local.get('refererHeaders', (result) => {
        const refererHeaders = result.refererHeaders || {};
        refererHeaders[domain] = value;
        chrome.storage.local.set({ refererHeaders });
    });
}

