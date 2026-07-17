/**
 * @jest-environment jsdom
 */

import PopupManager from '../src/popup/popup.js';
import * as logger from '../src/lib/logger.js';

function setupDom() {
  document.body.innerHTML = `
    <input id="domainInput" />
    <div id="matchInfo" style="display: none;"></div>
    <div class="referer-options">
      <button data-mode="0"></button>
      <button data-mode="1"></button>
      <button data-mode="2"></button>
      <button data-mode="3"></button>
    </div>
    <div id="status"></div>
    <div id="relatedDomainsSection">
      <div id="relatedDomainsList"></div>
    </div>
    <div class="link-options">
      <a class="popup-link" href="../options/options.html#help" target="_blank">Help</a>
      <a class="popup-link" href="../options/options.html" target="_blank">Settings</a>
    </div>
  `;
}

beforeEach(() => {
  setupDom();

  global.chrome = {
    storage: {
      local: {
        get: jest.fn()
      }
    },
    tabs: {
      query: jest.fn()
    },
    runtime: {
      sendMessage: jest.fn()
    },
    i18n: {
      getMessage: jest.fn((key) => key)
    }
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('highlightSelectedButton highlights correct button', () => {
  PopupManager.highlightSelectedButton(2);
  const buttons = document.querySelectorAll('.referer-options button');
  expect(buttons[2].classList.contains('active')).toBe(true);
  expect(buttons[0].classList.contains('active')).toBe(false);
});

test('clearButtonHighlights removes active class from all buttons', () => {
  document.querySelectorAll('.referer-options button')[1].classList.add('active');
  PopupManager.clearButtonHighlights();
  document.querySelectorAll('.referer-options button').forEach(button => {
    expect(button.classList.contains('active')).toBe(false);
  });
});

test('showStatus sets and clears status message', () => {
  jest.useFakeTimers();
  PopupManager.showStatus('Saved!');
  expect(document.getElementById('status').textContent).toBe('Saved!');
  jest.advanceTimersByTime(3000);
  expect(document.getElementById('status').textContent).toBe('');
  jest.useRealTimers();
});

describe('loadDomainSettings()', () => {
  test('highlights the correct mode on an exact match', () => {
    chrome.storage.local.get.mockImplementation((key, callback) => {
      callback({ refererHeaders: { 'example.com': 1 } });
    });

    PopupManager.loadDomainSettings('example.com');

    const buttons = document.querySelectorAll('.referer-options button');
    expect(buttons[1].classList.contains('active')).toBe(true);
    expect(document.getElementById('matchInfo').style.display).toBe('none');
  });

  test('highlights the matched mode and shows the wildcard match info', () => {
    chrome.storage.local.get.mockImplementation((key, callback) => {
      callback({ refererHeaders: { '*.example.com': 2 } });
    });

    PopupManager.loadDomainSettings('sub.example.com');

    const buttons = document.querySelectorAll('.referer-options button');
    expect(buttons[2].classList.contains('active')).toBe(true);
    const matchInfo = document.getElementById('matchInfo');
    expect(matchInfo.style.display).toBe('block');
    expect(matchInfo.textContent).toBe('matchedRuleText');
  });

  test('leaves buttons unhighlighted when nothing matches, including non-wildcard saved domains', () => {
    chrome.storage.local.get.mockImplementation((key, callback) => {
      callback({ refererHeaders: { 'other.com': 1 } });
    });

    PopupManager.loadDomainSettings('unknown.com');

    document.querySelectorAll('.referer-options button').forEach(button => {
      expect(button.classList.contains('active')).toBe(false);
    });
  });

  test('defaults to an empty map when nothing is stored', () => {
    chrome.storage.local.get.mockImplementation((key, callback) => {
      callback({});
    });

    expect(() => PopupManager.loadDomainSettings('unknown.com')).not.toThrow();
  });

  test('clicking the wildcard match info re-runs loadDomainSettings for the matched domain', () => {
    chrome.storage.local.get.mockImplementation((key, callback) => {
      callback({ refererHeaders: { '*.example.com': 2 } });
    });
    PopupManager.loadDomainSettings('sub.example.com');

    const loadSpy = jest.spyOn(PopupManager, 'loadDomainSettings').mockImplementation(() => {});
    document.getElementById('matchInfo').onclick();

    expect(document.getElementById('domainInput').value).toBe('*.example.com');
    expect(loadSpy).toHaveBeenCalledWith('*.example.com');
  });
});

describe('applyTranslations()', () => {
  test('sets text content for elements with a translation and skips ones without', () => {
    document.body.innerHTML += `
      <span data-i18n="greeting"></span>
      <span data-i18n="emptyKey">unchanged</span>
    `;
    chrome.i18n.getMessage = jest.fn((key) => (key === 'greeting' ? 'Hello' : ''));

    PopupManager.applyTranslations();

    expect(document.querySelector('[data-i18n="greeting"]').textContent).toBe('Hello');
    expect(document.querySelector('[data-i18n="emptyKey"]').textContent).toBe('unchanged');
  });
});

describe('initialisePopup()', () => {
  test('does nothing when there are no open tabs', () => {
    chrome.tabs.query.mockImplementation((opts, callback) => callback([]));
    PopupManager.initialisePopup();
    expect(document.getElementById('domainInput').value).toBe('');
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
  });

  test('populates the domain input from a valid tab URL and wires up listeners', () => {
    chrome.tabs.query.mockImplementation((opts, callback) => callback([{ url: 'https://Example.com/page' }]));
    chrome.storage.local.get.mockImplementation((key, callback) => callback({ refererHeaders: {} }));
    chrome.runtime.sendMessage.mockImplementation((msg, callback) => callback({ relations: {} }));

    PopupManager.initialisePopup();

    expect(document.getElementById('domainInput').value).toBe('example.com');
  });

  test('falls back to an empty domain when the tab URL is invalid', () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    chrome.tabs.query.mockImplementation((opts, callback) => callback([{ url: 'not-a-valid-url' }]));
    chrome.storage.local.get.mockImplementation((key, callback) => callback({ refererHeaders: {} }));
    chrome.runtime.sendMessage.mockImplementation((msg, callback) => callback({ relations: {} }));

    PopupManager.initialisePopup();

    expect(document.getElementById('domainInput').value).toBe('');
    expect(warnSpy).toHaveBeenCalledWith(
      'Invalid URL:',
      'not-a-valid-url',
      expect.objectContaining({ message: expect.stringContaining('Invalid URL') })
    );
  });

  test('falls back to an empty domain when the tab has no usable url', () => {
    chrome.tabs.query.mockImplementation((opts, callback) => callback([{}]));
    chrome.storage.local.get.mockImplementation((key, callback) => callback({ refererHeaders: {} }));
    chrome.runtime.sendMessage.mockImplementation((msg, callback) => callback({ relations: {} }));

    PopupManager.initialisePopup();

    expect(document.getElementById('domainInput').value).toBe('');
  });

  test('typing a domain triggers loadDomainSettings only when non-empty', () => {
    chrome.tabs.query.mockImplementation((opts, callback) => callback([{ url: 'https://example.com/' }]));
    chrome.storage.local.get.mockImplementation((key, callback) => callback({ refererHeaders: {} }));
    chrome.runtime.sendMessage.mockImplementation((msg, callback) => callback({ relations: {} }));

    PopupManager.initialisePopup();

    const loadSpy = jest.spyOn(PopupManager, 'loadDomainSettings').mockImplementation(() => {});
    const domainInput = document.getElementById('domainInput');

    domainInput.value = '  other.com  ';
    domainInput.dispatchEvent(new Event('input'));
    expect(loadSpy).toHaveBeenCalledWith('other.com');

    loadSpy.mockClear();
    domainInput.value = '   ';
    domainInput.dispatchEvent(new Event('input'));
    expect(loadSpy).not.toHaveBeenCalled();
  });

  test('clicking a referer option saves the setting only when a domain is present', () => {
    chrome.tabs.query.mockImplementation((opts, callback) => callback([{ url: 'https://example.com/' }]));
    chrome.storage.local.get.mockImplementation((key, callback) => callback({ refererHeaders: {} }));
    chrome.storage.local.set = jest.fn();
    chrome.runtime.sendMessage.mockImplementation((msg, callback) => callback({ relations: {} }));

    PopupManager.initialisePopup();

    const domainInput = document.getElementById('domainInput');
    const buttons = document.querySelectorAll('.referer-options button');

    domainInput.value = 'clicked.com';
    buttons[1].click();
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      refererHeaders: { 'clicked.com': 1 }
    });
    expect(document.getElementById('status').textContent).toBe('savedStatus');
    expect(buttons[1].classList.contains('active')).toBe(true);

    chrome.storage.local.set.mockClear();
    domainInput.value = '   ';
    buttons[2].click();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});

describe('loadRelatedDomains()', () => {
  test('logs an error and stops when no relations are received', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    chrome.runtime.sendMessage.mockImplementation((msg, callback) => callback(undefined));

    PopupManager.loadRelatedDomains('example.com');

    expect(errorSpy).toHaveBeenCalledWith('[popup] No relations received.');
    expect(document.getElementById('relatedDomainsList').innerHTML).toBe('');
  });

  test('hides the section when there are no related domains', () => {
    chrome.runtime.sendMessage.mockImplementation((msg, callback) => callback({ relations: {} }));

    PopupManager.loadRelatedDomains('example.com');

    expect(document.getElementById('relatedDomainsSection').style.display).toBe('none');
  });

  test('shows related domains from initiators pointing at this domain and from this domain as initiator', () => {
    chrome.runtime.sendMessage.mockImplementation((msg, callback) => callback({
      relations: {
        'initiator.com': ['example.com'],
        'example.com': ['target-a.com', 'target-b.com']
      }
    }));
    chrome.storage.local.get.mockImplementation((key, callback) => callback({
      refererHeaders: { 'target-a.com': 1 }
    }));

    PopupManager.loadRelatedDomains('example.com');

    const cards = document.querySelectorAll('.related-domain-card');
    const names = Array.from(cards).map(c => c.textContent.replace('🔍', ''));
    expect(names).toEqual(expect.arrayContaining(['initiator.com', 'target-a.com', 'target-b.com']));
    expect(document.getElementById('relatedDomainsSection').style.display).toBe('block');

    const savedCard = Array.from(cards).find(c => c.textContent.includes('target-a.com'));
    expect(savedCard.classList.contains('saved')).toBe(true);
    const unsavedCard = Array.from(cards).find(c => c.textContent.includes('target-b.com'));
    expect(unsavedCard.classList.contains('saved')).toBe(false);
  });

  test('defaults to an empty map of saved domains when nothing is stored', () => {
    chrome.runtime.sendMessage.mockImplementation((msg, callback) => callback({
      relations: { 'example.com': ['target-a.com'] }
    }));
    chrome.storage.local.get.mockImplementation((key, callback) => callback({}));

    expect(() => PopupManager.loadRelatedDomains('example.com')).not.toThrow();
    const card = document.querySelector('.related-domain-card');
    expect(card.classList.contains('saved')).toBe(false);
  });

  test('ignores inherited (non-own) properties, so a prototype-polluted relation cannot appear as related', () => {
    const proto = {};
    Object.defineProperty(proto, 'evil.com', {
      value: ['example.com'],
      enumerable: true,
      configurable: true
    });
    const relations = Object.create(proto);
    relations['other.com'] = ['target-x.com'];

    chrome.runtime.sendMessage.mockImplementation((msg, callback) => callback({ relations }));

    PopupManager.loadRelatedDomains('example.com');

    // Without the hasOwnProperty guard, the inherited 'evil.com' entry
    // would match (its targets include 'example.com') and be shown.
    expect(document.querySelectorAll('.related-domain-card').length).toBe(0);
    expect(document.getElementById('relatedDomainsSection').style.display).toBe('none');
  });

  test('clicking a related domain card loads its settings and highlights it', () => {
    chrome.runtime.sendMessage.mockImplementation((msg, callback) => callback({
      relations: { 'example.com': ['target-a.com'] }
    }));
    chrome.storage.local.get.mockImplementation((key, callback) => callback({ refererHeaders: {} }));

    PopupManager.loadRelatedDomains('example.com');

    const loadSpy = jest.spyOn(PopupManager, 'loadDomainSettings').mockImplementation(() => {});
    const card = document.querySelector('.related-domain-card');
    card.click();

    expect(document.getElementById('domainInput').value).toBe('target-a.com');
    expect(loadSpy).toHaveBeenCalledWith('target-a.com');
    expect(card.classList.contains('highlight-match')).toBe(true);
  });
});

describe('bindPopupLinks()', () => {
  test('closes the popup window when a Settings/Help link is clicked', () => {
    window.close = jest.fn();

    PopupManager.bindPopupLinks();
    document.querySelectorAll('.popup-link').forEach(link => link.click());

    expect(window.close).toHaveBeenCalledTimes(2);
  });
});

describe('module bootstrap', () => {
  test('DOMContentLoaded initialises the popup', () => {
    chrome.tabs.query.mockImplementation((opts, callback) => callback([]));

    document.dispatchEvent(new Event('DOMContentLoaded'));

    expect(chrome.tabs.query).toHaveBeenCalled();
  });
});
