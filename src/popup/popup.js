/**
 * @file popup.js
 * @description Handles popup interactions for managing referer header settings in the browser extension UI.
 */

import * as logger from '../lib/logger.js';
import { saveRefererHeaderForDomain, domainMatchesWildcard } from '../lib/lib.js';

document.addEventListener('DOMContentLoaded', () => {
  PopupManager.init();
});

/**
 * Class responsible for handling popup page logic.
 */
class PopupManager {
  /**
   * Initialise popup functionalities.
   */
  static init() {
    this.applyTranslations();
    this.initialisePopup();
  }

  /**
   * Apply internationalisation to elements.
   */
  static applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(elem => {
      const key = elem.getAttribute('data-i18n');
      const message = chrome.i18n.getMessage(key);
      if (message) {
        elem.textContent = message;
      }
    });
  }

  /**
   * Initialise popup elements and event listeners.
   */
  static initialisePopup() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;

      let activeDomain = "";
      if (Array.isArray(tabs) && tabs.length > 0 && typeof tabs[0].url === "string") {
        try {
          const url = new URL(tabs[0].url);
          activeDomain = url.hostname.toLowerCase();
        } catch (e) {
          logger.warn("Invalid URL:", tabs[0].url, e);
        }
      }

      const domainInput = document.getElementById('domainInput');
      domainInput.value = activeDomain;

      this.loadDomainSettings(activeDomain);
      this.loadRelatedDomains(activeDomain);

      domainInput.addEventListener('input', () => {
        const typedDomain = domainInput.value.trim().toLowerCase();
        if (typedDomain.length > 0) {
          this.loadDomainSettings(typedDomain);
        }
      });

      document.querySelectorAll('.referer-options button').forEach(button => {
        button.addEventListener('click', () => {
          const mode = parseInt(button.dataset.mode, 10);
          const domain = domainInput.value.trim().toLowerCase();
          if (domain.length > 0) {
            saveRefererHeaderForDomain(domain, mode);
            this.showStatus(chrome.i18n.getMessage('savedStatus'));
            this.highlightSelectedButton(mode);
          }
        });
      });
    });
  }

  /**
   * Load referer settings for a specific domain.
   * @param {string} domain 
   */
  static loadDomainSettings(domain) {
    this.clearButtonHighlights();
    chrome.storage.local.get('refererHeaders', (result) => {
      const refererHeaders = result.refererHeaders || {};
      let matchedValue = null;
      let matchedDomain = null;

      if (refererHeaders.hasOwnProperty(domain)) {
        matchedValue = refererHeaders[domain];
      } else {
        for (const savedDomain in refererHeaders) {
          if (savedDomain.startsWith('*') && domainMatchesWildcard(domain, savedDomain)) {
            matchedValue = refererHeaders[savedDomain];
            matchedDomain = savedDomain;
            break;
          }
        }
      }

      if (matchedValue !== null) {
        this.highlightSelectedButton(matchedValue);
        if (matchedDomain) {
          this.showWildcardMatch(matchedDomain);
        }
      }
    });
  }
  
  /**
   * Show matched domain if it is a wildcard domain (e.g., *.example.com)
   * @param {text} matchDomain
   */
  static showWildcardMatch(matchDomain) {
    const matchInfoEl = document.getElementById('matchInfo');
    matchInfoEl.textContent = chrome.i18n.getMessage('matchedRuleText', matchDomain);
    matchInfoEl.style.display = 'block';
    matchInfoEl.onclick = () => {
      const input = document.getElementById('domainInput');
      input.value = matchDomain;
      this.loadDomainSettings(matchDomain);
    };
  }


  /**
   * Highlight the selected referer mode button.
   * @param {number} selectedMode 
   */
  static highlightSelectedButton(selectedMode) {
    document.querySelectorAll('.referer-options button').forEach(button => {
      if (parseInt(button.dataset.mode, 10) === selectedMode) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }

  /**
   * Clear all button highlights.
   */
  static clearButtonHighlights() {
    document.querySelectorAll('.referer-options button').forEach(button => {
      button.classList.remove('active');
    });
  }

  /**
   * Display a short status message.
   * @param {string} message 
   */
  static showStatus(message) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    setTimeout(() => {
      statusEl.textContent = '';
    }, 3000);
  }
  
  /*
  static reloadActiveTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  }
  */

  /**
   * Load domains related to the current domain from background script.
   * @param {string} domain 
   */
  static loadRelatedDomains(domain) {
    logger.debug('[popup] Requesting related domains for:', domain);
    chrome.runtime.sendMessage({ type: 'getAllRelations' }, (response) => {
      logger.debug('[popup] Received response from background:', response);

      if (!response || !response.relations) {
        logger.error('[popup] No relations received.');
        return;
      }

      const relations = response.relations;
      const relatedDomains = [];

      for (const initiator in relations) {
        if (relations.hasOwnProperty(initiator)) {
          const targets = relations[initiator];
          if (targets.includes(domain)) {
            relatedDomains.push(initiator.toLowerCase());
          }
          if (initiator === domain) {
            relatedDomains.push(...targets);
          }
        }
      }

      logger.debug('[popup] Related domains found:', relatedDomains);

      const section = document.getElementById('relatedDomainsSection');
      const list = document.getElementById('relatedDomainsList');
      list.innerHTML = '';

      if (relatedDomains.length > 0) {
        chrome.storage.local.get('refererHeaders', (result) => {
          const refererHeaders = result.refererHeaders || {};

          relatedDomains.forEach(d => {
            const card = document.createElement('div');
            card.className = 'related-domain-card';

            const domainName = document.createElement('div');
            domainName.style.fontSize = '12px';
            domainName.style.fontWeight = 'bold';

            if (refererHeaders.hasOwnProperty(d)) {
              domainName.textContent = `${d}`;
              card.classList.add('saved');
            } else {
              domainName.textContent = d;
            }

            const info = document.createElement('div');
            info.className = 'related-domain-info';
            info.textContent = '🔍';

            card.appendChild(domainName);
            card.appendChild(info);

            card.addEventListener('click', () => {
              document.getElementById('domainInput').value = d;
              PopupManager.loadDomainSettings(d);

              document.querySelectorAll('.related-domain-card').forEach(c => c.classList.remove('highlight-match'));
              card.classList.add('highlight-match');
            });

            list.appendChild(card);
          });
        });

        section.style.display = 'block';
      } else {
        section.style.display = 'none';
      }
    });
  }
}

// Expose for browser and testing
if (typeof window !== 'undefined') {
  window.PopupManager = PopupManager;
}

if (typeof module !== 'undefined') {
  module.exports = PopupManager;
}