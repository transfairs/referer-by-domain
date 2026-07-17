/**
 * @file popup.js
 * @description Handles popup interactions for managing referer header settings in the browser extension UI.
 */

import * as logger from '../lib/logger.js';
import { saveRefererHeaderForDomain, domainMatchesWildcard } from '../lib/lib.js';
import { applyI18n, getMessage, initLanguage, setLanguagePreference, getSupportedLanguages } from '../lib/i18n.js';
import { initTheme, applyTheme, setThemePreference, nextTheme } from '../lib/theme.js';

const THEME_ICONS = { auto: '🌓', light: '☀️', dark: '🌙' };
const LANGUAGE_NAMES = { en: 'English', de: 'Deutsch' };
// A distinct globe icon for "auto" keeps it from visually doubling up with
// whichever language flag it happens to resolve to.
const LANGUAGE_FLAGS = { auto: '🌐', en: '🇬🇧', de: '🇩🇪' };

document.addEventListener('DOMContentLoaded', () => {
  PopupManager.init();
});

/**
 * Class responsible for handling popup page logic.
 */
export default class PopupManager {
  /**
   * Initialise popup functionalities.
   */
  static init() {
    this.applyTranslations();
    this.initialisePopup();
    this.bindPopupLinks();
    this.bindReloadButton();
    this.initSettingsToolbar();
  }

  /**
   * Load the stored theme/language preferences, wire up the toggle/select
   * controls, and re-apply translations once a manual language override
   * (if any) has finished loading.
   */
  static async initSettingsToolbar() {
    await this.initThemeToggle();
    await this.initLanguageSelect();
    this.applyTranslations();
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
      this.applyTranslations();
    });
  }

  /**
   * Open Settings/Help links as tabs instead of following the anchor's
   * target="_blank" default, which some browsers resolve to a new window
   * rather than a tab when triggered from an extension popup.
   */
  static bindPopupLinks() {
    document.querySelectorAll('.popup-link').forEach(link => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        chrome.tabs.create({ url: link.href });
        window.close();
      });
    });
  }

  /**
   * Apply internationalisation to elements.
   */
  static applyTranslations() {
    applyI18n(document);
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
      this.activeTabId = tabs[0].id;

      const domainInput = document.getElementById('domainInput');
      domainInput.value = activeDomain;

      this.loadDomainSettings(activeDomain);
      this.loadRelatedDomains(activeDomain);

      document.querySelectorAll('.referer-options button').forEach(button => {
        button.addEventListener('click', () => {
          const mode = parseInt(button.dataset.mode, 10);
          const domain = domainInput.value.trim().toLowerCase();
          if (domain.length > 0) {
            saveRefererHeaderForDomain(domain, mode);
            this.showStatus(getMessage('savedStatus'));
            this.highlightSelectedButton(mode);
            // Reloading the active tab applies the new setting whenever the
            // saved domain is the tab's own domain or one it actually talks
            // to (a related domain observed on that tab).
            const affectsActiveTab = domain === activeDomain || (this.relatedDomains && this.relatedDomains.has(domain));
            this.toggleReloadButton(affectsActiveTab);
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
    matchInfoEl.textContent = getMessage('matchedRuleText', matchDomain);
    matchInfoEl.style.display = 'block';
    matchInfoEl.onclick = () => {
      const input = document.getElementById('domainInput');
      input.value = matchDomain;
      this.loadDomainSettings(matchDomain);
      // A wildcard pattern is never the active tab's exact domain, so
      // reloading it wouldn't apply to what's currently selected.
      this.toggleReloadButton(false);
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
  }

  /**
   * Show or hide the "reload tab" button, offered only when the setting
   * just saved applies to the currently open tab's domain.
   * @param {boolean} show
   */
  static toggleReloadButton(show) {
    const reloadButton = document.getElementById('reloadTabButton');
    reloadButton.style.display = show ? 'inline-block' : 'none';
  }

  /**
   * Wire up the reload-tab button shown after saving a setting.
   */
  static bindReloadButton() {
    document.getElementById('reloadTabButton').addEventListener('click', () => this.reloadActiveTab());
  }

  /**
   * Reload the tab that was active when the popup opened, then close the popup.
   */
  static reloadActiveTab() {
    if (this.activeTabId != null) {
      chrome.tabs.reload(this.activeTabId);
    }
    window.close();
  }

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
      this.relatedDomains = new Set(relatedDomains);

      const section = document.getElementById('relatedDomainsSection');
      const list = document.getElementById('relatedDomainsList');
      list.innerHTML = '';

      if (relatedDomains.length === 0) {
        // No open tabs / invalid URL: nothing meaningful to show.
        if (!domain) {
          section.style.display = 'none';
          return;
        }
        // Related domains are only known once the extension has observed
        // this page's requests; explain that instead of silently hiding.
        const empty = document.createElement('div');
        empty.className = 'related-domains-empty';
        empty.setAttribute('data-i18n', 'noRelatedDomains');
        empty.textContent = getMessage('noRelatedDomains');
        list.appendChild(empty);
        section.style.display = 'block';
        return;
      }

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
            // No new setting has been saved yet for this domain selection,
            // so there's nothing to reload the tab for until a mode is chosen.
            PopupManager.toggleReloadButton(false);

            document.querySelectorAll('.related-domain-card').forEach(c => c.classList.remove('highlight-match'));
            card.classList.add('highlight-match');
          });

          list.appendChild(card);
        });
      });

      section.style.display = 'block';
    });
  }
}
