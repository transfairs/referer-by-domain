/**
 * @file theme.js
 * @description Shared light/dark theme handling for the popup and options page.
 * Defaults to following the OS/browser colour scheme, but can be pinned to
 * 'light' or 'dark' manually. The preference is stored in chrome.storage.local
 * so it applies consistently across the popup and the options page.
 */
import * as logger from './logger.js';

const STORAGE_KEY = 'uiTheme';
const THEMES = ['auto', 'light', 'dark'];
const DEFAULT_THEME = 'auto';

/**
 * Read the stored theme preference.
 * @returns {Promise<'auto'|'light'|'dark'>}
 */
export async function getThemePreference() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY];
  return THEMES.includes(stored) ? stored : DEFAULT_THEME;
}

/**
 * Persist a theme preference.
 * @param {'auto'|'light'|'dark'} theme
 */
export async function setThemePreference(theme) {
  const value = THEMES.includes(theme) ? theme : DEFAULT_THEME;
  await chrome.storage.local.set({ [STORAGE_KEY]: value });
  return value;
}

/**
 * Apply a theme preference to the document: 'auto' clears any override so
 * the `prefers-color-scheme` media query takes over, otherwise the choice
 * is stamped onto <html data-theme> for the CSS overrides to match.
 * @param {'auto'|'light'|'dark'} theme
 */
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') {
    root.dataset.theme = theme;
  } else {
    delete root.dataset.theme;
  }
}

/**
 * Move to the next theme in the auto -> light -> dark -> auto cycle.
 * @param {'auto'|'light'|'dark'} theme
 * @returns {'auto'|'light'|'dark'}
 */
export function nextTheme(theme) {
  const index = THEMES.indexOf(theme);
  return THEMES[(index + 1) % THEMES.length];
}

/**
 * Load the stored preference and apply it to the document.
 * @returns {Promise<'auto'|'light'|'dark'>}
 */
export async function initTheme() {
  try {
    const theme = await getThemePreference();
    applyTheme(theme);
    return theme;
  } catch (error) {
    logger.error('Failed to load theme preference:', error);
    applyTheme(DEFAULT_THEME);
    return DEFAULT_THEME;
  }
}

export { THEMES, DEFAULT_THEME };
