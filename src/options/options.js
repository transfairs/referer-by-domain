/**
 * @file options.js
 * @description Manage domain referer settings with interactive UI for a browser extension.
 *
 * @since 2025-04-28
 */
import HelpView from './HelpView.js';
import TabView from './TabView.js';
import { parseHTML } from '../lib/lib.js';
import * as logger from '../lib/logger.js';

document.addEventListener('DOMContentLoaded', () => {
  DomainManager.init();
  TabView.init();
  HelpView.init();
});


/**
 * Class responsible for managing domain rules in the extension options page.
 */
export default class DomainManager {
  static refererModes = [
    { mode: 0, label: "🚫", titleKey: "legendNoReferer" },   // No Referer
    { mode: 1, label: "🌍", titleKey: "legendOriginOnly" },  // Origin
    { mode: 2, label: "🔗", titleKey: "legendFullUrl" },     // Unsafe URL
    { mode: 3, label: "♾️", titleKey: "legendUnlimited" }    // Always
  ];

  /**
   * Initialize the page functionality.
   */
  static init() {
    this.domainList = document.getElementById('domainList');
    this.searchInput = document.getElementById('search');
    this.addDomainButton = document.getElementById('addDomainButton');
    this.exportButton = document.getElementById('exportButton');
    this.importButton = document.getElementById('importButton');
    this.importFileInput = document.getElementById('importFileInput');

    this.applyI18n();
    this.addDomainButton.addEventListener('click', () => this.addDomain(this.searchInput.value));
    this.searchInput.addEventListener('input', () => this.loadDomains());
    this.exportButton.addEventListener('click', () => this.exportSettings());
    this.importButton.addEventListener('click', () => this.importFileInput.click());
    this.importFileInput.addEventListener('change', (event) => this.importSettings(event));

    this.loadDomains();
  }

  /**
   * Apply internationalisation texts to elements.
   */
  static applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(elem => {
      const key = elem.getAttribute('data-i18n');
      const message = chrome.i18n.getMessage(key);
      if (message) elem.innerText = message;
    });

    document.querySelectorAll('[data-i18n-html]').forEach(el => {
       const key = el.dataset.i18nHtml;
       const msg = chrome.i18n.getMessage(key);
       if (msg) {
         el.innerHTML = '';
   
         const parsedNodes = parseHTML(msg);
   
         parsedNodes.forEach(node => {
           el.appendChild(node);
         });
       }
     });

    document.querySelectorAll('[data-placeholder-i18n]').forEach(elem => {
      const key = elem.getAttribute('data-placeholder-i18n');
      const message = chrome.i18n.getMessage(key);
      if (message) elem.setAttribute('placeholder', message);
    });
  }

  /**
   * Load domains from storage and render them.
   */
  static async loadDomains() {
    try {
      const result = await chrome.storage.local.get('refererHeaders');
      const domains = result.refererHeaders || {};

      if (typeof domains !== 'object') {
        logger.error('Error: Expected refererHeaders object is missing or invalid.', domains);
        return;
      }

      const filter = this.searchInput.value.trim().toLowerCase();
      const matchingDomains = Object.entries(domains)
        .filter(([domain]) => domain.includes(filter))
        .sort(([a], [b]) => a.localeCompare(b));

      this.domainList.innerHTML = '';

      if (matchingDomains.length === 0) {
        const placeholder = document.createElement('div');
        placeholder.className = 'placeholder';
        placeholder.textContent = 'No domains found.';
        this.domainList.appendChild(placeholder);
        return;
      }

      matchingDomains.forEach(([domain, mode]) => this.renderDomainCard(domain, mode));
    } catch (error) {
      logger.error('Failed to load domains:', error);
    }
  }

  /**
   * Render a single domain card.
   * @param {string} domain 
   * @param {number} mode 
   */
  static renderDomainCard(domain, mode) {
    const card = document.createElement('div');
    card.className = 'domain-card';
    card.style.opacity = '0';
    card.style.transform = 'translateY(10px)';

    const domainName = document.createElement('div');
    domainName.className = 'domain-name';
    domainName.textContent = domain;

    const modeButtons = document.createElement('div');
    modeButtons.className = 'mode-buttons';
    this.refererModes.forEach(({ mode: modeValue, label, titleKey }) => {
      const button = document.createElement('button');
      button.textContent = label;
      button.className = 'mode-button';
      button.title = chrome.i18n.getMessage(titleKey);
      if (modeValue === mode) button.classList.add('selected');

      button.addEventListener('click', () => this.updateDomainMode(domain, modeValue));
      modeButtons.appendChild(button);
    });

    const editButton = document.createElement('button');
    editButton.textContent = '✏️';
    editButton.className = 'edit-button';
    editButton.title = chrome.i18n.getMessage('editDomainButton');
    editButton.addEventListener('click', () => this.editDomain(domain));

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '🗑️';
    deleteButton.className = 'delete-button';
    deleteButton.title = chrome.i18n.getMessage('deleteDomainButton');
    deleteButton.addEventListener('click', () => this.deleteDomain(domain));

    card.appendChild(domainName);
    card.appendChild(modeButtons);
    card.appendChild(editButton);
    card.appendChild(deleteButton);

    this.domainList.appendChild(card);

    // Simple fade-in animation
    requestAnimationFrame(() => {
      card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    });
  }

  /**
   * Update the referer mode for a domain.
   * @param {string} domain 
   * @param {number} newMode 
   */
  static async updateDomainMode(domain, newMode) {
    try {
      const result = await chrome.storage.local.get('refererHeaders');
      const domains = result.refererHeaders || {};
      domains[domain] = newMode;
      await chrome.storage.local.set({ refererHeaders: domains });
      this.loadDomains();
    } catch (error) {
      logger.error(`Failed to update domain ${domain}:`, error);
    }
  }

  /**
   * Delete a domain after user confirmation.
   * @param {string} domain 
   */
  static async deleteDomain(domain) {
    const confirmation = confirm(`Do you really want to delete the domain "${domain}"?`);
    if (!confirmation) return;

    try {
      const result = await chrome.storage.local.get('refererHeaders');
      const domains = result.refererHeaders || {};
      delete domains[domain];
      await chrome.storage.local.set({ refererHeaders: domains });
      this.loadDomains();
    } catch (error) {
      logger.error(`Failed to delete domain ${domain}:`, error);
    }
  }

  /**
   * Prompt user to rename an existing domain, keeping its referer mode.
   * @param {string} domain
   */
  static async editDomain(domain) {
    const newDomain = prompt(chrome.i18n.getMessage("promptEditDomain"), domain);
    if (newDomain === null) return;

    const trimmed = newDomain.trim().toLowerCase();
    if (trimmed.length === 0 || trimmed === domain) return;

    try {
      const result = await chrome.storage.local.get('refererHeaders');
      const domains = result.refererHeaders || {};

      if (domains.hasOwnProperty(trimmed)) {
        alert(chrome.i18n.getMessage("domainAlreadyExists"));
        this.editDomain(domain);
        return;
      }

      domains[trimmed] = domains[domain];
      delete domains[domain];
      await chrome.storage.local.set({ refererHeaders: domains });
      this.loadDomains();
    } catch (error) {
      logger.error(`Failed to rename domain ${domain}:`, error);
    }
  }

  /**
   * Prompt user to add a new domain.
   */
  static async addDomain(domain) {
    const newDomain = prompt(chrome.i18n.getMessage("promptNewDomain"), domain);
    if (newDomain) {
      const trimmed = newDomain.trim().toLowerCase();
      if (trimmed.length === 0) return;
      try {
        const result = await chrome.storage.local.get('refererHeaders');
        const domains = result.refererHeaders || {};
        
        if (domains.hasOwnProperty(trimmed)) {
          alert(chrome.i18n.getMessage("domainAlreadyExists"));
          this.addDomain(trimmed);
          return;
        }

        domains[trimmed] = 0; // Default to "No Referer"
        await chrome.storage.local.set({ refererHeaders: domains });
        this.loadDomains();
      } catch (error) {
        logger.error('Failed to add domain:', error);
      }
    }
  }

  /**
   * Export the current domain rules as a downloadable JSON file.
   */
  static async exportSettings() {
    try {
      const result = await chrome.storage.local.get('refererHeaders');
      const domains = result.refererHeaders || {};

      const blob = new Blob([JSON.stringify({ refererHeaders: domains }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `referer-by-domain-settings-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Failed to export settings:', error);
    }
  }

  /**
   * Import domain rules from a previously exported JSON file, merging them
   * into the existing rules (imported values win on conflict).
   * @param {Event} event
   */
  static async importSettings(event) {
    const [file] = event.target.files;
    event.target.value = ''; // Allow re-importing the same file later.
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      const imported = parsed && typeof parsed.refererHeaders === 'object' ? parsed.refererHeaders : parsed;

      if (!this.isValidRuleSet(imported)) {
        alert(chrome.i18n.getMessage('importInvalidFile'));
        return;
      }

      const importedCount = Object.keys(imported).length;
      const confirmed = confirm(chrome.i18n.getMessage('importConfirm', String(importedCount)));
      if (!confirmed) return;

      const result = await chrome.storage.local.get('refererHeaders');
      const domains = { ...(result.refererHeaders || {}), ...imported };

      await chrome.storage.local.set({ refererHeaders: domains });
      this.loadDomains();
      alert(chrome.i18n.getMessage('importSuccess'));
    } catch (error) {
      logger.error('Failed to import settings:', error);
      alert(chrome.i18n.getMessage('importInvalidFile'));
    }
  }

  /**
   * Validate that a parsed import payload is a plain domain-to-mode map.
   * @param {*} rules
   * @returns {boolean}
   */
  static isValidRuleSet(rules) {
    if (typeof rules !== 'object' || rules === null || Array.isArray(rules)) return false;
    const validModes = this.refererModes.map(({ mode }) => mode);
    return Object.entries(rules).every(
      ([domain, mode]) => typeof domain === 'string' && domain.length > 0 && validModes.includes(mode)
    );
  }
}