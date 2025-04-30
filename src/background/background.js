import * as logger from '../lib/logger.js';
import { getRefererHeaderForDomain, isDebugMode } from '../lib/lib.js';

const domainRelations = {};
let activeDomains = new Set();

/**
 * Fired when the extension is installed or updated.
 */
chrome.runtime.onInstalled.addListener(() => {
    logger.info("Referer By Domain extension installed.");
});

/**
 * Intercepts outgoing HTTP requests to modify the Referer header based on domain-specific settings.
 */
chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        // Remove any existing Referer header
        const headers = details.requestHeaders.filter(
            (header) => header.name.toLowerCase() !== "referer"
        );

        // Debug: Output the original Referer if present
        const originalReferer = details.requestHeaders.find(
            (header) => header.name.toLowerCase() === "referer"
        );
        if (originalReferer) {
            logger.debug("Original Referer:", originalReferer.value);
        }

        const requestUrl = details.originUrl ? details.originUrl : details.url;
        const domain = new URL(details.url).hostname;

        logger.debug("Request details:", details);
        logger.debug("Domain:", domain);

        // Retrieve user-defined Referer setting for the domain
        return new Promise((resolve) => {
            getRefererHeaderForDomain(domain, (refererSetting) => {
                if (refererSetting === 0) {
                    logger.debug(`No Referer will be sent for ${domain}.`);
                    // No Referer is added
                } else if (refererSetting === 1) {
                    const origin = new URL(requestUrl).origin;
                    logger.debug(`Sending origin as Referer for ${domain}: ${origin}`);
                    headers.push({ name: "Referer", value: origin });
                } else if (refererSetting === 2) {
                    logger.debug(`Sending full URL as Referer for ${domain}: ${requestUrl}`);
                    headers.push({ name: "Referer", value: requestUrl });
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


// Track active tabs
chrome.tabs.onActivated.addListener(updateActiveDomains);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    updateActiveDomains();
  }
});

function updateActiveDomains() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    activeDomains.clear();
    tabs.forEach((tab) => {
      if (tab.url) {
        try {
          const url = new URL(tab.url);
          activeDomains.add(url.hostname);
        } catch (error) {
          logger.error('Invalid tab URL', tab.url);
        }
      }
    });
  });
}

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
        domainRelations[initiatorDomain] = new Set();
      }
      domainRelations[initiatorDomain].add(targetDomain);

      logger.debug(`[background] Updated domainRelations:`, JSON.parse(JSON.stringify(simplifyRelations())));

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
