/**
 * @jest-environment jsdom
 */
import {
  getThemePreference,
  setThemePreference,
  applyTheme,
  nextTheme,
  initTheme,
  THEMES,
  DEFAULT_THEME
} from '../src/lib/theme.js';
import * as logger from '../src/lib/logger.js';

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme');
  global.chrome = {
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn()
      }
    }
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getThemePreference()', () => {
  test('returns the stored value when it is a known theme', async () => {
    chrome.storage.local.get.mockResolvedValue({ uiTheme: 'dark' });
    expect(await getThemePreference()).toBe('dark');
  });

  test.each(['bogus', undefined])('falls back to the default for an unknown/missing value (%s)', async (stored) => {
    chrome.storage.local.get.mockResolvedValue({ uiTheme: stored });
    expect(await getThemePreference()).toBe(DEFAULT_THEME);
  });

  test('falls back to the default when nothing is stored', async () => {
    chrome.storage.local.get.mockResolvedValue({});
    expect(await getThemePreference()).toBe(DEFAULT_THEME);
  });
});

describe('setThemePreference()', () => {
  test('persists a known theme', async () => {
    const result = await setThemePreference('light');
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ uiTheme: 'light' });
    expect(result).toBe('light');
  });

  test('normalises an unknown value to the default before storing', async () => {
    const result = await setThemePreference('not-a-theme');
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ uiTheme: DEFAULT_THEME });
    expect(result).toBe(DEFAULT_THEME);
  });
});

describe('applyTheme()', () => {
  test('stamps light/dark onto <html data-theme>', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  test('clears the attribute for "auto" so prefers-color-scheme takes over', () => {
    document.documentElement.dataset.theme = 'dark';
    applyTheme('auto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});

describe('nextTheme()', () => {
  test('cycles auto -> light -> dark -> auto', () => {
    expect(nextTheme('auto')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('auto');
  });

  test('treats an unrecognised value as if it came before the first theme', () => {
    expect(nextTheme('nonsense')).toBe(THEMES[0]);
  });
});

describe('initTheme()', () => {
  test('loads the stored preference and applies it', async () => {
    chrome.storage.local.get.mockResolvedValue({ uiTheme: 'dark' });
    const theme = await initTheme();
    expect(theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  test('falls back to the default and logs when storage access fails', async () => {
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    chrome.storage.local.get.mockRejectedValue(new Error('storage unavailable'));

    const theme = await initTheme();

    expect(theme).toBe(DEFAULT_THEME);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith('Failed to load theme preference:', expect.any(Error));
  });
});
