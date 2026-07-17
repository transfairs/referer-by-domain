import * as logger from '../lib/logger.js';
import { getRefererHeaderForDomain, isDebugMode } from '../lib/lib.js';

const domainRelations = {};
const MAX_INITIATOR_DOMAINS = 200;
const MAX_TARGETS_PER_DOMAIN = 100;
const RELATIONS_STORAGE_KEY = 'domainRelations';

/**
 * Fired when the extension is installed or updated.
 */
chrome.runtime.onInstalled.addListener(() => {
    logger.info("Referer By Domain extension installed.");
});

// The background script is a non-persistent MV3 service worker: it gets
// terminated after ~30s idle and loses all module-level state. Restore
// whatever was last observed from chrome.storage.session, which survives
// worker restarts for the lifetime of the browser session (unlike
// storage.local, it isn't written to disk, so it still clears on browser
// restart - the right behaviour for this kind of transient traffic data).
if (chrome.storage.session) {
    chrome.storage.session.get(RELATIONS_STORAGE_KEY, (result) => {
        const stored = (result && result[RELATIONS_STORAGE_KEY]) || {};
        for (const [initiator, targets] of Object.entries(stored)) {
            domainRelations[initiator] = new Set(targets);
        }
        logger.debug("[background] Restored domainRelations from session storage:", stored);
    });
}

/**
 * Persists the current domainRelations to session storage so they survive
 * service-worker restarts.
 */
function persistDomainRelations() {
    if (!chrome.storage.session) return;
    chrome.storage.session.set({ [RELATIONS_STORAGE_KEY]: simplifyRelations() });
}

/**
 * Intercepts outgoing HTTP requests to modify the Referer header based on domain-specific settings.
 */
chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        // Debug: Output the original Referer if present
        const originalReferer = details.requestHeaders.find(
            (header) => header.name.toLowerCase() === "referer"
        );
        if (originalReferer) {
            logger.debug("Original Referer:", originalReferer.value);
        }

        const domain = new URL(details.url).hostname;

        logger.debug("Request details:", details);
        logger.debug("Domain:", domain);

        // Retrieve user-defined Referer setting for the domain
        return new Promise((resolve) => {
            getRefererHeaderForDomain(domain, (refererSetting) => {
                if (refererSetting === 3) {
                    // Unrestricted: leave the browser's original Referer untouched
                    logger.debug(`Referer left unrestricted for ${domain}.`);
                    resolve({ requestHeaders: details.requestHeaders });
                    return;
                }

                // Remove any existing Referer header before applying a rule
                const headers = details.requestHeaders.filter(
                    (header) => header.name.toLowerCase() !== "referer"
                );

                // Origin-based modes require a known originating page; without one
                // (e.g. a typed URL or bookmark navigation) there is nothing
                // meaningful to send as a Referer.
                if (refererSetting === 0) {
                    logger.debug(`No Referer will be sent for ${domain}.`);
                    // No Referer is added
                } else if (refererSetting === 1) {
                    if (details.originUrl) {
                        const origin = new URL(details.originUrl).origin;
                        logger.debug(`Sending origin as Referer for ${domain}: ${origin}`);
                        headers.push({ name: "Referer", value: origin });
                    } else {
                        logger.debug(`No originating page for ${domain}; omitting Referer.`);
                    }
                } else if (refererSetting === 2) {
                    if (details.originUrl) {
                        logger.debug(`Sending full URL as Referer for ${domain}: ${details.originUrl}`);
                        headers.push({ name: "Referer", value: details.originUrl });
                    } else {
                        logger.debug(`No originating page for ${domain}; omitting Referer.`);
                    }
                } else {
                    logger.warn(`Unknown referer setting (${refererSetting}) for ${domain}.`);
                }

                resolve({ requestHeaders: headers });
            });
        });
    },
    { urls: ["<all_urls>"] },
    ["blocking", "requestHeaders"]
);


// Listen to outgoing web requests (filtered and safe)
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    try {
      logger.debug(`[background] In try`, details.documentUrl, details.url, (!details.documentUrl || !details.url));
      if (!details.documentUrl || !details.url) return;
      logger.debug(`[background] After first if`, (!details.documentUrl.startsWith('http') || !details.url.startsWith('http')));
      if (!details.documentUrl.startsWith('http') || !details.url.startsWith('http')) return;

      const initiatorUrl = new URL(details.documentUrl);
      const targetUrl = new URL(details.url);

      const initiatorDomain = initiatorUrl.hostname;
      const targetDomain = targetUrl.hostname;

      logger.debug(`[background] Observed Request: ${initiatorDomain} → ${targetDomain}`);

      // Ignore same domain requests
      if (initiatorDomain === targetDomain) return;

      if (!domainRelations[initiatorDomain]) {
        if (Object.keys(domainRelations).length >= MAX_INITIATOR_DOMAINS) {
          // Evict the oldest tracked initiator to keep memory bounded
          const oldestInitiator = Object.keys(domainRelations)[0];
          delete domainRelations[oldestInitiator];
        }
        domainRelations[initiatorDomain] = new Set();
      }
      if (domainRelations[initiatorDomain].size < MAX_TARGETS_PER_DOMAIN) {
        domainRelations[initiatorDomain].add(targetDomain);
      }

      logger.debug(`[background] Updated domainRelations:`, JSON.parse(JSON.stringify(simplifyRelations())));
      persistDomainRelations();

    } catch (error) {
      logger.error('[background] Error processing webRequest', error);
    }
  },
  {
    urls: ["<all_urls>"],
    types: ["xmlhttprequest", "main_frame", "sub_frame"]
  },
  []
);

// Helper function to simplify domainRelations for better readable logging
function simplifyRelations() {
  const simple = {};
  for (const [initiator, targets] of Object.entries(domainRelations)) {
    simple[initiator] = Array.from(targets);
  }
  return simple;
}

// Provide related domains OR all relations
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.debug("[background] Received message:", message);

  if (message.type === 'getRelatedDomains') {
    const mainDomain = message.domain;
    const related = domainRelations[mainDomain] ? Array.from(domainRelations[mainDomain]) : [];
    logger.debug(`[background] getRelatedDomains for "${mainDomain}":`, related);
    sendResponse({ related });
  }

  if (message.type === 'getAllRelations') {
    const simplifiedRelations = {};
    for (const [initiator, targets] of Object.entries(domainRelations)) {
      simplifiedRelations[initiator] = Array.from(targets);
    }
    logger.debug("[background] getAllRelations result:", simplifiedRelations);
    sendResponse({ relations: simplifiedRelations });
  }
});
