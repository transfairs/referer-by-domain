// DEBUG MODE: Change to 'true' to enable debug logging
const DEBUG_MODE = false;

/**
 * Checks whether debug mode is enabled.
 * @returns {boolean} True if debug mode is active.
 */
export function isDebugMode() {
    return DEBUG_MODE;
}

/**
 * Outputs debug messages if debug mode is enabled.
 * @param {...any} args Arguments to log.
 */
function debug(...args) {
    if (isDebugMode()) {
        console.debug(...args);
    }
}

/**
 * Checks if a domain matches a wildcard pattern.
 * @param {string} domain The domain to check.
 * @param {string} wildcardDomain The wildcard domain pattern (e.g., "*.example.com").
 * @returns {boolean} True if matched, false otherwise.
 */
export function domainMatchesWildcard(domain, wildcardDomain) {
    if (wildcardDomain.startsWith('*')) {
        const suffix = wildcardDomain.slice(1);
        return domain.endsWith(suffix);
    }
    return domain === wildcardDomain;
}

/**
 * Retrieves the referer setting for a given domain.
 * @param {string} domain The domain to lookup.
 * @param {function} callback The callback receiving the referer value.
 */
export function getRefererHeaderForDomain(domain, callback) {
    chrome.storage.local.get('refererHeaders', (result) => {
        const refererHeaders = result.refererHeaders || {};
        debug("Loaded refererHeaders:", refererHeaders);

        let refererValue = 0;
        for (const savedDomain in refererHeaders) {
            if (Object.prototype.hasOwnProperty.call(refererHeaders, savedDomain)) {
                debug(`Comparing "${domain}" with "${savedDomain}"`);
                if (domainMatchesWildcard(domain, savedDomain)) {
                    refererValue = refererHeaders[savedDomain];
                    debug(`Match found: ${domain} => ${refererValue}`);
                    break;
                }
            }
        }
        callback(refererValue);
    });
}

/**
 * Loads and displays the saved referer setting for the domain entered in the input field.
 */
export function loadSavedSettings() {
    const domainInput = document.getElementById('domain');
    const refererInput = document.getElementById('refererHeader');

    if (domainInput && refererInput) {
        const domain = domainInput.value.trim();
        if (domain) {
            getRefererHeaderForDomain(domain, (value) => {
                refererInput.value = value;
            });
        }
    }
}

/**
 * Saves a referer header setting for a specific domain.
 * @param {string} domain The domain to save for.
 * @param {number|string} value The referer header setting to save.
 */
export function saveRefererHeaderForDomain(domain, value) {
    chrome.storage.local.get('refererHeaders', (result) => {
        const refererHeaders = result.refererHeaders || {};
        refererHeaders[domain] = Number(value); // Always store as Number
        chrome.storage.local.set({ refererHeaders });
        debug(`Saved refererHeader for ${domain}:`, value);
    });
}
