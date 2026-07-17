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
    { mode: 0, label: "🚫" }, // No Referer
    { mode: 1, label: "🌍" }, // Origin
    { mode: 2, label: "🔗" }, // Unsafe URL
    { mode: 3, label: "♾️" }  // Always
  ];

  /**
   * Initialize the page functionality.
   */
  static init() {
    this.domainList = document.getElementById('domainList');
    this.searchInput = document.getElementById('search');
    this.addDomainButton = document.getElementById('addDomainButton');

    this.applyI18n();
    this.addDomainButton.addEventListener('click', () => this.addDomain(this.searchInput.value));
    this.searchInput.addEventListener('input', () => this.loadDomains());

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
    this.refererModes.forEach(({ mode: modeValue, label }) => {
      const button = document.createElement('button');
      button.textContent = label;
      button.className = 'mode-button';
      if (modeValue === mode) button.classList.add('selected');

      button.addEventListener('click', () => this.updateDomainMode(domain, modeValue));
      modeButtons.appendChild(button);
    });

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '🗑️';
    deleteButton.className = 'delete-button';
    deleteButton.addEventListener('click', () => this.deleteDomain(domain));

    card.appendChild(domainName);
    card.appendChild(modeButtons);
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
}