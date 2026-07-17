/**
 * @jest-environment jsdom
 */
import {
  getSupportedLanguages,
  getLanguagePreference,
  loadOverrideMessages,
  setLanguagePreference,
  initLanguage,
  getMessage,
  applyI18n,
  isAiTranslated,
  getActiveLanguage,
  isAiNoticeDismissed,
  dismissAiNotice,
  DEFAULT_LANGUAGE
} from '../src/lib/i18n.js';
import * as logger from '../src/lib/logger.js';

beforeEach(async () => {
  // Reset the module-level override cache between tests.
  await loadOverrideMessages('auto');

  global.chrome = {
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn()
      }
    },
    runtime: {
      getURL: jest.fn((path) => `chrome-extension://test/${path}`)
    },
    i18n: {
      getMessage: jest.fn((key, subs) => {
        if (key === 'greeting') return 'Hello';
        if (key === 'withSub') return `Hi $1${Array.isArray(subs) && subs[1] ? ', $2' : ''}`;
        return '';
      }),
      getUILanguage: jest.fn(() => 'en-US')
    }
  };
  global.fetch = jest.fn();
});

afterEach(async () => {
  await loadOverrideMessages('auto');
  jest.restoreAllMocks();
});

describe('getSupportedLanguages()', () => {
  test('returns a fresh array each call (not a shared reference)', () => {
    const first = getSupportedLanguages();
    first.push('xx');
    expect(getSupportedLanguages()).not.toContain('xx');
  });
});

describe('getLanguagePreference()', () => {
  test('returns the stored value when supported', async () => {
    chrome.storage.local.get.mockResolvedValue({ uiLanguage: 'de' });
    expect(await getLanguagePreference()).toBe('de');
  });

  test('falls back to auto for an unsupported/missing value', async () => {
    chrome.storage.local.get.mockResolvedValue({ uiLanguage: 'xx' });
    expect(await getLanguagePreference()).toBe(DEFAULT_LANGUAGE);

    chrome.storage.local.get.mockResolvedValue({});
    expect(await getLanguagePreference()).toBe(DEFAULT_LANGUAGE);
  });
});

describe('loadOverrideMessages()', () => {
  test('fetches and caches messages.json for a supported language', async () => {
    const messages = { greeting: { message: 'Hallo' } };
    fetch.mockResolvedValue({ json: () => Promise.resolve(messages) });

    await loadOverrideMessages('de');

    expect(chrome.runtime.getURL).toHaveBeenCalledWith('_locales/de/messages.json');
    expect(fetch).toHaveBeenCalledWith('chrome-extension://test/_locales/de/messages.json');
    expect(getMessage('greeting')).toBe('Hallo');
  });

  test('does not re-fetch when the same language is already cached', async () => {
    fetch.mockResolvedValue({ json: () => Promise.resolve({ greeting: { message: 'Hallo' } }) });
    await loadOverrideMessages('de');
    await loadOverrideMessages('de');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('clears the cache for "auto" or an unsupported language', async () => {
    fetch.mockResolvedValue({ json: () => Promise.resolve({ greeting: { message: 'Hallo' } }) });
    await loadOverrideMessages('de');
    expect(getMessage('greeting')).toBe('Hallo');

    await loadOverrideMessages('auto');
    expect(getMessage('greeting')).toBe('Hello'); // falls back to chrome.i18n
  });

  test('logs and clears the cache when the fetch fails', async () => {
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    fetch.mockRejectedValue(new Error('network down'));

    await loadOverrideMessages('de');

    expect(errorSpy).toHaveBeenCalledWith('Failed to load language override "de":', expect.any(Error));
    expect(getMessage('greeting')).toBe('Hello');
  });
});

describe('setLanguagePreference()', () => {
  test('persists a supported language and loads its messages', async () => {
    fetch.mockResolvedValue({ json: () => Promise.resolve({ greeting: { message: 'Hallo' } }) });

    const result = await setLanguagePreference('de');

    expect(chrome.storage.local.set).toHaveBeenCalledWith({ uiLanguage: 'de' });
    expect(result).toBe('de');
    expect(getMessage('greeting')).toBe('Hallo');
  });

  test('normalises an unsupported value to the default', async () => {
    const result = await setLanguagePreference('xx');
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ uiLanguage: DEFAULT_LANGUAGE });
    expect(result).toBe(DEFAULT_LANGUAGE);
  });
});

describe('initLanguage()', () => {
  test('loads the stored preference and its messages', async () => {
    chrome.storage.local.get.mockResolvedValue({ uiLanguage: 'de' });
    fetch.mockResolvedValue({ json: () => Promise.resolve({ greeting: { message: 'Hallo' } }) });

    const language = await initLanguage();

    expect(language).toBe('de');
    expect(getMessage('greeting')).toBe('Hallo');
  });

  test('falls back to the default and logs when storage access fails', async () => {
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    chrome.storage.local.get.mockRejectedValue(new Error('storage unavailable'));

    const language = await initLanguage();

    expect(language).toBe(DEFAULT_LANGUAGE);
    expect(errorSpy).toHaveBeenCalledWith('Failed to load language preference:', expect.any(Error));
  });
});

describe('getMessage()', () => {
  test('falls back to chrome.i18n.getMessage when no override is loaded', () => {
    expect(getMessage('greeting')).toBe('Hello');
  });

  test('prefers the override message when one is loaded for the key', async () => {
    fetch.mockResolvedValue({ json: () => Promise.resolve({ greeting: { message: 'Hallo' }, other: { message: 'x' } }) });
    await loadOverrideMessages('de');

    expect(getMessage('greeting')).toBe('Hallo');
    expect(getMessage('missingKey')).toBe(''); // not in override -> chrome.i18n mock returns ''
  });

  test('substitutes $1/$2 placeholders the same way chrome.i18n does', async () => {
    fetch.mockResolvedValue({
      json: () => Promise.resolve({ withSub: { message: 'Hallo $1 und $2' } })
    });
    await loadOverrideMessages('de');

    expect(getMessage('withSub', 'Welt')).toBe('Hallo Welt und $2');
    expect(getMessage('withSub', ['Welt', 'Sonne'])).toBe('Hallo Welt und Sonne');
  });

  test('returns the message unchanged when no substitutions are given', async () => {
    fetch.mockResolvedValue({ json: () => Promise.resolve({ plain: { message: 'Hallo $1' } }) });
    await loadOverrideMessages('de');
    expect(getMessage('plain')).toBe('Hallo $1');
  });
});

describe('applyI18n()', () => {
  test('applies data-i18n, data-i18n-html and data-placeholder-i18n using getMessage()', async () => {
    document.body.innerHTML = `
      <span data-i18n="greeting"></span>
      <span data-i18n="emptyKey">unchanged</span>
      <div data-i18n-html="richHtml"></div>
      <input data-placeholder-i18n="greeting" />
    `;
    chrome.i18n.getMessage = jest.fn((key) => {
      if (key === 'greeting') return 'Hello';
      if (key === 'richHtml') return '<b>bold</b>';
      return '';
    });

    applyI18n(document);

    expect(document.querySelector('[data-i18n="greeting"]').textContent).toBe('Hello');
    expect(document.querySelector('[data-i18n="emptyKey"]').textContent).toBe('unchanged');
    expect(document.querySelector('[data-i18n-html="richHtml"]').innerHTML).toContain('<b>bold</b>');
    expect(document.querySelector('[data-placeholder-i18n="greeting"]').getAttribute('placeholder')).toBe('Hello');
  });

  test('defaults to the document when no root is given', () => {
    document.body.innerHTML = `<span data-i18n="greeting"></span>`;
    chrome.i18n.getMessage = jest.fn(() => 'Hello');
    applyI18n();
    expect(document.querySelector('[data-i18n="greeting"]').textContent).toBe('Hello');
  });
});

describe('isAiTranslated()', () => {
  test('is true for languages produced by AI translation', () => {
    expect(isAiTranslated('fr')).toBe(true);
    expect(isAiTranslated('ja')).toBe(true);
  });

  test('is false for native/reviewed languages and unknown codes', () => {
    expect(isAiTranslated('en')).toBe(false);
    expect(isAiTranslated('de')).toBe(false);
    expect(isAiTranslated('xx')).toBe(false);
  });
});

describe('getActiveLanguage()', () => {
  test('returns the manual override when one is loaded', async () => {
    fetch.mockResolvedValue({ json: () => Promise.resolve({ greeting: { message: 'Hallo' } }) });
    await loadOverrideMessages('de');
    expect(getActiveLanguage()).toBe('de');
  });

  test('falls back to the base subtag of the browser locale when no override is loaded', () => {
    chrome.i18n.getUILanguage = jest.fn(() => 'fr-CA');
    expect(getActiveLanguage()).toBe('fr');
  });

  test('falls back to "en" when the browser locale is empty', () => {
    chrome.i18n.getUILanguage = jest.fn(() => '');
    expect(getActiveLanguage()).toBe('en');
  });
});

describe('isAiNoticeDismissed()', () => {
  test('is false when nothing has been dismissed yet', async () => {
    chrome.storage.local.get.mockResolvedValue({});
    expect(await isAiNoticeDismissed('fr')).toBe(false);
  });

  test('is false when the stored value is not an array', async () => {
    chrome.storage.local.get.mockResolvedValue({ dismissedAiNoticeLanguages: 'fr' });
    expect(await isAiNoticeDismissed('fr')).toBe(false);
  });

  test('is true when the language is in the dismissed list', async () => {
    chrome.storage.local.get.mockResolvedValue({ dismissedAiNoticeLanguages: ['de', 'fr'] });
    expect(await isAiNoticeDismissed('fr')).toBe(true);
    expect(await isAiNoticeDismissed('ja')).toBe(false);
  });
});

describe('dismissAiNotice()', () => {
  test('persists the language when nothing was previously dismissed', async () => {
    chrome.storage.local.get.mockResolvedValue({});
    await dismissAiNotice('fr');
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ dismissedAiNoticeLanguages: ['fr'] });
  });

  test('appends to the existing dismissed list without duplicating an already-dismissed language', async () => {
    chrome.storage.local.get.mockResolvedValue({ dismissedAiNoticeLanguages: ['de'] });
    await dismissAiNotice('fr');
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ dismissedAiNoticeLanguages: ['de', 'fr'] });

    chrome.storage.local.set.mockClear();
    chrome.storage.local.get.mockResolvedValue({ dismissedAiNoticeLanguages: ['de', 'fr'] });
    await dismissAiNotice('fr');
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});
