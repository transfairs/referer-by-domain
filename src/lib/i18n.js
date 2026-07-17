/**
 * @file i18n.js
 * @description Shared internationalisation helpers for the popup and options
 * page. Wraps chrome.i18n.getMessage() so the UI language can be pinned
 * manually (persisted in chrome.storage.local) instead of always following
 * the browser's own locale, and applies data-i18n[-html] markup uniformly.
 */
import * as logger from './logger.js';
import { parseHTML } from './lib.js';

const STORAGE_KEY = 'uiLanguage';
const AI_NOTICE_DISMISSED_KEY = 'dismissedAiNoticeLanguages';
const SUPPORTED_LANGUAGES = ['en', 'de', 'fr', 'pl', 'ja', 'es', 'pt', 'cs', 'sk'];
const DEFAULT_LANGUAGE = 'auto';

// Languages whose messages.json was produced by AI translation rather than a
// native/reviewed speaker. Used to surface a dismissible notice in the UI.
const AI_TRANSLATED_LANGUAGES = ['fr', 'pl', 'ja', 'es', 'pt', 'cs', 'sk'];

const LANGUAGE_NAMES = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  pl: 'Polski',
  ja: '日本語',
  es: 'Español',
  pt: 'Português',
  cs: 'Čeština',
  sk: 'Slovenčina'
};

// A distinct globe icon for "auto" keeps it from visually doubling up with
// whichever language flag it happens to resolve to.
const LANGUAGE_FLAGS = {
  auto: '🌐',
  en: '🇬🇧',
  de: '🇩🇪',
  fr: '🇫🇷',
  pl: '🇵🇱',
  ja: '🇯🇵',
  es: '🇪🇸',
  pt: '🇵🇹',
  cs: '🇨🇿',
  sk: '🇸🇰'
};

let overrideMessages = null;
let overrideLanguage = null;

/**
 * Language codes with a bundled messages.json, in addition to 'auto'
 * (follow the browser/extension locale via chrome.i18n).
 * @returns {string[]}
 */
export function getSupportedLanguages() {
  return SUPPORTED_LANGUAGES.slice();
}

/**
 * Read the stored language preference.
 * @returns {Promise<string>} 'auto' or a supported language code.
 */
export async function getLanguagePreference() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY];
  return SUPPORTED_LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE;
}

/**
 * Fetch and cache the bundled messages.json for a manually-selected language.
 * Passing 'auto' (or an unsupported code) clears the cache so getMessage()
 * falls back to chrome.i18n.
 * @param {string} language
 */
export async function loadOverrideMessages(language) {
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    overrideMessages = null;
    overrideLanguage = null;
    return;
  }
  if (overrideLanguage === language && overrideMessages) return;

  try {
    const url = chrome.runtime.getURL(`_locales/${language}/messages.json`);
    const response = await fetch(url);
    overrideMessages = await response.json();
    overrideLanguage = language;
  } catch (error) {
    logger.error(`Failed to load language override "${language}":`, error);
    overrideMessages = null;
    overrideLanguage = null;
  }
}

/**
 * Persist a language preference and load its messages so getMessage() picks
 * it up immediately.
 * @param {string} language 'auto' or a supported language code.
 */
export async function setLanguagePreference(language) {
  const value = SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
  await chrome.storage.local.set({ [STORAGE_KEY]: value });
  await loadOverrideMessages(value);
  return value;
}

/**
 * Load the stored language preference and its messages (if any).
 * @returns {Promise<string>}
 */
export async function initLanguage() {
  try {
    const language = await getLanguagePreference();
    await loadOverrideMessages(language);
    return language;
  } catch (error) {
    logger.error('Failed to load language preference:', error);
    return DEFAULT_LANGUAGE;
  }
}

/**
 * Substitute $1, $2, ... placeholders the same way chrome.i18n.getMessage does.
 * @param {string} message
 * @param {string|string[]} [substitutions]
 * @returns {string}
 */
function substitute(message, substitutions) {
  if (substitutions === undefined || substitutions === null) return message;
  const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
  return message.replace(/\$(\d+)/g, (match, index) => {
    const value = subs[Number(index) - 1];
    return value === undefined ? match : String(value);
  });
}

/**
 * Look up a translated message, preferring a manually-selected language
 * override (if one is loaded) over the browser's own locale.
 * @param {string} key
 * @param {string|string[]} [substitutions]
 * @returns {string}
 */
export function getMessage(key, substitutions) {
  if (overrideMessages && Object.prototype.hasOwnProperty.call(overrideMessages, key)) {
    return substitute(overrideMessages[key].message, substitutions);
  }
  return chrome.i18n.getMessage(key, substitutions);
}

/**
 * Apply data-i18n / data-i18n-html / data-placeholder-i18n markup within a
 * root element, using getMessage() so a manual language override applies.
 * @param {ParentNode} [root]
 */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((elem) => {
    const key = elem.getAttribute('data-i18n');
    const message = getMessage(key);
    if (message) elem.textContent = message;
  });

  root.querySelectorAll('[data-i18n-html]').forEach((elem) => {
    const key = elem.getAttribute('data-i18n-html');
    const message = getMessage(key);
    if (message) {
      elem.innerHTML = '';
      parseHTML(message).forEach((node) => elem.appendChild(node));
    }
  });

  root.querySelectorAll('[data-placeholder-i18n]').forEach((elem) => {
    const key = elem.getAttribute('data-placeholder-i18n');
    const message = getMessage(key);
    if (message) elem.setAttribute('placeholder', message);
  });
}

/**
 * Whether a language's messages.json was produced by AI translation.
 * @param {string} language
 * @returns {boolean}
 */
export function isAiTranslated(language) {
  return AI_TRANSLATED_LANGUAGES.includes(language);
}

/**
 * The language currently in effect for getMessage(): the manual override if
 * one is loaded, otherwise the browser/extension locale chrome.i18n resolved
 * to (reduced to its base subtag, e.g. 'en-US' -> 'en').
 * @returns {string}
 */
export function getActiveLanguage() {
  if (overrideLanguage) return overrideLanguage;
  const uiLanguage = chrome.i18n.getUILanguage();
  return uiLanguage ? uiLanguage.split('-')[0] : 'en';
}

/**
 * Whether the user has already dismissed the AI-translation notice for a
 * given language.
 * @param {string} language
 * @returns {Promise<boolean>}
 */
export async function isAiNoticeDismissed(language) {
  const result = await chrome.storage.local.get(AI_NOTICE_DISMISSED_KEY);
  const dismissed = result[AI_NOTICE_DISMISSED_KEY];
  return Array.isArray(dismissed) && dismissed.includes(language);
}

/**
 * Persist that the AI-translation notice has been dismissed for a language,
 * so it doesn't reappear for that language again.
 * @param {string} language
 */
export async function dismissAiNotice(language) {
  const result = await chrome.storage.local.get(AI_NOTICE_DISMISSED_KEY);
  const dismissed = Array.isArray(result[AI_NOTICE_DISMISSED_KEY]) ? result[AI_NOTICE_DISMISSED_KEY] : [];
  if (!dismissed.includes(language)) {
    await chrome.storage.local.set({ [AI_NOTICE_DISMISSED_KEY]: [...dismissed, language] });
  }
}

export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, LANGUAGE_NAMES, LANGUAGE_FLAGS };
