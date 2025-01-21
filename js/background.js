import {isDebugMode, getRefererHeaderForDomain} from './lib.js';


chrome.runtime.onInstalled.addListener(() => {
    console.info("Here we go.");
});

/*
chrome.action.onClicked.addListener((tab) => {
  console.log('tab:', tab);
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    let currentUrl = tabs[0].url;
    console.log('Current URL:', currentUrl);
    
    chrome.storage.local.set({ currentUrl: currentUrl });
  });
});
*/

chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        const headers = details.requestHeaders.filter(
            (header) => header.name.toLowerCase() !== "referer"
        );
        
        
        if (isDebugMode()) {
            const oriReferer = details.requestHeaders.filter(
                (header) => header.name.toLowerCase() === "referer"
            );
            if (oriReferer != null && oriReferer[0] != null) {
                console.debug("original", oriReferer[0].value);
            }
        }
        
        const domain = new URL(details.url).hostname;
        if (isDebugMode())
            console.debug("details: ", details, domain, isDebugMode());
        
        const url = details.originUrl == null ? details.url : details.originUrl;

        // Get referer for domain
        return new Promise((resolve) => {
            getRefererHeaderForDomain(domain, (refererValue) => {
    
                if (refererValue === 0) {
                    if (isDebugMode())
                        console.debug("No referer for ", domain);
                } else if (refererValue === 1) {
                    if (isDebugMode())
                        console.debug("URL origin", new URL(url).origin);
                    headers.push({ name: "Referer", value: new URL(url).origin });
                } else if (refererValue === 2) {
                    if (isDebugMode())
                        console.debug("Full url", url);
                    headers.push({ name: "Referer", value: url });
                }
                resolve({ requestHeaders: headers });
            });
        });
    },
    { urls: ["<all_urls>"] },
    ["blocking", "requestHeaders"]
);
