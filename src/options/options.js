/**
 * @file options.js
 * @description Manage domain referer settings with interactive UI for a browser extension.
 *
 * @since 2025-04-28
 */
import HelpView from './HelpView.js';
import TabView from './TabView.js';
import Modal from './Modal.js';
import * as logger from '../lib/logger.js';
import {
  applyI18n, getMessage, initLanguage, setLanguagePreference, getSupportedLanguages,
  LANGUAGE_NAMES, LANGUAGE_FLAGS, isAiTranslated, getActiveLanguage, isAiNoticeDismissed, dismissAiNotice
} from '../lib/i18n.js';
import { initTheme, applyTheme, setThemePreference, nextTheme } from '../lib/theme.js';

const THEME_ICONS = { auto: '🌓', light: '☀️', dark: '🌙' };

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
    this.initSettingsToolbar();
    this.initFooter();
  }

  /**
   * Show the running extension version in the page footer.
   */
  static initFooter() {
    const versionElem = document.getElementById('footerVersion');
    if (versionElem) versionElem.textContent = `v${chrome.runtime.getManifest().version}`;
  }

  /**
   * Load the stored theme/language preferences, wire up the toggle/select
   * controls, and re-render translated content once a manual language
   * override (if any) has finished loading.
   */
  static async initSettingsToolbar() {
    await this.initThemeToggle();
    await this.initLanguageSelect();
    this.applyI18n();
    this.loadDomains();
    await this.updateAiNotice();
  }

  /**
   * Show a small, dismissible notice when the language currently in effect
   * was produced by AI translation rather than a native/reviewed speaker.
   * Dismissal is remembered per language so it only needs to be seen once.
   */
  static async updateAiNotice() {
    const notice = document.getElementById('aiTranslationNotice');
    if (!notice) return;

    const language = getActiveLanguage();
    if (!isAiTranslated(language) || await isAiNoticeDismissed(language)) {
      notice.hidden = true;
      return;
    }

    notice.hidden = false;
    const dismissButton = document.getElementById('aiNoticeDismiss');
    const dismissLabel = getMessage('aiTranslatedDismiss');
    dismissButton.title = dismissLabel;
    dismissButton.setAttribute('aria-label', dismissLabel);
    dismissButton.onclick = async () => {
      await dismissAiNotice(language);
      notice.hidden = true;
    };
  }

  /**
   * Apply the stored theme and wire up the theme-cycling button.
   */
  static async initThemeToggle() {
    const button = document.getElementById('themeToggle');
    let theme = await initTheme();
    this.renderThemeToggle(button, theme);

    button.addEventListener('click', async () => {
      theme = nextTheme(theme);
      applyTheme(theme);
      await setThemePreference(theme);
      this.renderThemeToggle(button, theme);
    });
  }

  /**
   * @param {HTMLButtonElement} button
   * @param {'auto'|'light'|'dark'} theme
   */
  static renderThemeToggle(button, theme) {
    const labelKey = theme === 'light' ? 'themeLight' : theme === 'dark' ? 'themeDark' : 'themeAuto';
    button.textContent = THEME_ICONS[theme];
    const title = getMessage('themeToggleTitle', getMessage(labelKey));
    button.title = title;
    button.setAttribute('aria-label', title);
  }

  /**
   * Populate the language select with the stored preference and wire up
   * language switching.
   */
  static async initLanguageSelect() {
    const select = document.getElementById('languageSelect');
    select.innerHTML = '';
    select.setAttribute('aria-label', getMessage('languageSelectLabel'));

    const autoOption = document.createElement('option');
    autoOption.value = 'auto';
    autoOption.textContent = LANGUAGE_FLAGS.auto;
    autoOption.title = getMessage('languageAuto');
    select.appendChild(autoOption);

    getSupportedLanguages().forEach((lang) => {
      const option = document.createElement('option');
      option.value = lang;
      option.textContent = LANGUAGE_FLAGS[lang];
      option.title = LANGUAGE_NAMES[lang];
      select.appendChild(option);
    });

    select.value = await initLanguage();

    select.addEventListener('change', async () => {
      await setLanguagePreference(select.value);
      this.applyI18n();
      this.loadDomains();
      await this.updateAiNotice();
    });
  }

  /**
   * Apply internationalisation texts to elements.
   */
  static applyI18n() {
    applyI18n(document);
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
        this.renderEmptyState(Object.keys(domains).length === 0);
        return;
      }

      matchingDomains.forEach(([domain, mode]) => this.renderDomainCard(domain, mode));
    } catch (error) {
      logger.error('Failed to load domains:', error);
    }
  }

  /**
   * Render the placeholder shown when the domain list is empty, offering a
   * shortcut to add the first domain when there are no rules at all (as
   * opposed to a search simply matching nothing).
   * @param {boolean} isTrulyEmpty
   */
  static renderEmptyState(isTrulyEmpty) {
    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';

    if (!isTrulyEmpty) {
      placeholder.textContent = getMessage('noDomainsSearchEmpty');
      this.domainList.appendChild(placeholder);
      return;
    }

    placeholder.textContent = getMessage('noDomainsFound');

    const hint = document.createElement('div');
    hint.className = 'placeholder-hint';
    hint.appendChild(document.createTextNode(`${getMessage('noDomainsHint')} `));

    const addLink = document.createElement('button');
    addLink.type = 'button';
    addLink.className = 'placeholder-hint-link';
    addLink.textContent = getMessage('addDomainButton');
    addLink.addEventListener('click', () => this.addDomain(this.searchInput.value));
    hint.appendChild(addLink);

    placeholder.appendChild(hint);
    this.domainList.appendChild(placeholder);
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
      const title = getMessage(titleKey);
      button.title = title;
      button.setAttribute('aria-label', title);
      if (modeValue === mode) button.classList.add('selected');

      button.addEventListener('click', () => this.updateDomainMode(domain, modeValue));
      modeButtons.appendChild(button);
    });

    const editButton = document.createElement('button');
    editButton.textContent = '✏️';
    editButton.className = 'edit-button';
    const editTitle = getMessage('editDomainButton');
    editButton.title = editTitle;
    editButton.setAttribute('aria-label', editTitle);
    editButton.addEventListener('click', () => this.editDomain(domain));

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '🗑️';
    deleteButton.className = 'delete-button';
    const deleteTitle = getMessage('deleteDomainButton');
    deleteButton.title = deleteTitle;
    deleteButton.setAttribute('aria-label', deleteTitle);
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
    const confirmed = await Modal.confirm({
      title: getMessage('deleteDomainTitle'),
      message: getMessage('confirmDeleteDomain', domain),
      confirmText: getMessage('deleteDomainButton'),
      danger: true
    });
    if (!confirmed) return;

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
    const newDomain = await Modal.prompt({
      title: getMessage('editDomainTitle'),
      message: getMessage('promptEditDomain'),
      defaultValue: domain
    });
    if (newDomain === null) return;

    const trimmed = newDomain.trim().toLowerCase();
    if (trimmed.length === 0 || trimmed === domain) return;

    try {
      const result = await chrome.storage.local.get('refererHeaders');
      const domains = result.refererHeaders || {};

      if (domains.hasOwnProperty(trimmed)) {
        await Modal.alert({ title: getMessage('editDomainTitle'), message: getMessage('domainAlreadyExists') });
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
   * @param {string} [domain] Pre-filled value, e.g. the current search text.
   */
  static async addDomain(domain) {
    const newDomain = await Modal.prompt({
      title: getMessage('addDomainTitle'),
      message: getMessage('promptNewDomain'),
      defaultValue: domain
    });
    if (newDomain) {
      const trimmed = newDomain.trim().toLowerCase();
      if (trimmed.length === 0) return;
      try {
        const result = await chrome.storage.local.get('refererHeaders');
        const domains = result.refererHeaders || {};

        if (domains.hasOwnProperty(trimmed)) {
          await Modal.alert({ title: getMessage('addDomainTitle'), message: getMessage('domainAlreadyExists') });
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
        await Modal.alert({ title: getMessage('importConfirmTitle'), message: getMessage('importInvalidFile') });
        return;
      }

      const importedCount = Object.keys(imported).length;
      const confirmed = await Modal.confirm({
        title: getMessage('importConfirmTitle'),
        message: getMessage('importConfirm', String(importedCount))
      });
      if (!confirmed) return;

      const result = await chrome.storage.local.get('refererHeaders');
      const domains = { ...(result.refererHeaders || {}), ...imported };

      await chrome.storage.local.set({ refererHeaders: domains });
      this.loadDomains();
      await Modal.alert({ title: getMessage('importConfirmTitle'), message: getMessage('importSuccess') });
    } catch (error) {
      logger.error('Failed to import settings:', error);
      await Modal.alert({ title: getMessage('importConfirmTitle'), message: getMessage('importInvalidFile') });
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
