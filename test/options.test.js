/**
 * @jest-environment jsdom
 */

// Import the functions and classes to be tested
import DomainManager from '../src/options/options.js';

// jsdom does not implement innerText (it has no layout engine), but options.js
// relies on it for i18n text replacement. Polyfill it as a textContent alias
// so those code paths can be exercised and asserted on.
Object.defineProperty(HTMLElement.prototype, 'innerText', {
  configurable: true,
  get() {
    return this.textContent;
  },
  set(value) {
    this.textContent = value;
  }
});

beforeEach(() => {
  document.body.innerHTML = `
    <input id="search" />
    <div id="domainList"></div>
  `;
  DomainManager.domainList = document.getElementById('domainList');
  DomainManager.searchInput = document.getElementById('search');

  global.chrome = {
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn()
      }
    },
    i18n: {
      getMessage: jest.fn((key) => (key.startsWith('empty') ? '' : key))
    }
  };
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('loadDomains filters and renders matching domains', async () => {
  chrome.storage.local.get.mockResolvedValue({
    refererHeaders: {
      "example.com": 0,
      "testsite.org": 2,
      "another.net": 1
    }
  });
  DomainManager.searchInput.value = "test";
  await DomainManager.loadDomains();
  expect(DomainManager.domainList.textContent).toContain("testsite.org");
});

test('loadDomains renders multiple matches sorted alphabetically', async () => {
  chrome.storage.local.get.mockResolvedValue({
    refererHeaders: {
      "zebra.com": 0,
      "apple.com": 1,
      "mango.com": 2
    }
  });
  DomainManager.searchInput.value = "";
  await DomainManager.loadDomains();
  const names = Array.from(DomainManager.domainList.querySelectorAll('.domain-name')).map((el) => el.textContent);
  expect(names).toEqual(['apple.com', 'mango.com', 'zebra.com']);
});

test('loadDomains shows a placeholder when nothing matches', async () => {
  chrome.storage.local.get.mockResolvedValue({
    refererHeaders: { "example.com": 0 }
  });
  DomainManager.searchInput.value = "doesnotmatch";
  await DomainManager.loadDomains();
  const placeholder = DomainManager.domainList.querySelector('.placeholder');
  expect(placeholder).not.toBeNull();
  expect(placeholder.textContent).toBe('No domains found.');
});

test('loadDomains defaults to an empty map when nothing is stored', async () => {
  chrome.storage.local.get.mockResolvedValue({});
  DomainManager.searchInput.value = "";
  await DomainManager.loadDomains();
  expect(DomainManager.domainList.querySelector('.placeholder')).not.toBeNull();
});

test('loadDomains logs an error when refererHeaders is not an object', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  chrome.storage.local.get.mockResolvedValue({ refererHeaders: 'not-an-object' });
  DomainManager.searchInput.value = "";
  await DomainManager.loadDomains();
  expect(spy).toHaveBeenCalledWith(
    'Error: Expected refererHeaders object is missing or invalid.',
    'not-an-object'
  );
});

test('loadDomains logs an error when storage access fails', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  chrome.storage.local.get.mockRejectedValue(new Error('storage unavailable'));
  DomainManager.searchInput.value = "";
  await DomainManager.loadDomains();
  expect(spy).toHaveBeenCalledWith('Failed to load domains:', expect.any(Error));
});

test('renderDomainCard applies the fade-in animation and wires up mode/delete buttons', async () => {
  window.requestAnimationFrame = (cb) => cb();
  chrome.storage.local.get.mockResolvedValue({ refererHeaders: { 'example.com': 1 } });
  DomainManager.searchInput.value = '';
  await DomainManager.loadDomains();

  const card = DomainManager.domainList.querySelector('.domain-card');
  expect(card.style.opacity).toBe('1');
  expect(card.style.transition).toContain('opacity');

  const modeButtons = card.querySelectorAll('.mode-button');
  expect(modeButtons[1].classList.contains('selected')).toBe(true);

  const updateSpy = jest.spyOn(DomainManager, 'updateDomainMode').mockImplementation(() => {});
  modeButtons[2].click();
  expect(updateSpy).toHaveBeenCalledWith('example.com', 2);

  const deleteSpy = jest.spyOn(DomainManager, 'deleteDomain').mockImplementation(() => {});
  card.querySelector('.delete-button').click();
  expect(deleteSpy).toHaveBeenCalledWith('example.com');

  const editSpy = jest.spyOn(DomainManager, 'editDomain').mockImplementation(() => {});
  card.querySelector('.edit-button').click();
  expect(editSpy).toHaveBeenCalledWith('example.com');
});

test('updateDomainMode updates storage and reloads list', async () => {
  const mockSet = jest.fn();
  chrome.storage.local.get.mockResolvedValue({
    refererHeaders: { "example.com": 1 }
  });
  chrome.storage.local.set = mockSet;
  jest.spyOn(DomainManager, "loadDomains").mockImplementation(() => {});
  await DomainManager.updateDomainMode("example.com", 2);
  expect(mockSet).toHaveBeenCalledWith({
    refererHeaders: { "example.com": 2 }
  });
  expect(DomainManager.loadDomains).toHaveBeenCalled();
});

test('updateDomainMode defaults to an empty map when nothing is stored', async () => {
  const mockSet = jest.fn();
  chrome.storage.local.get.mockResolvedValue({});
  chrome.storage.local.set = mockSet;
  jest.spyOn(DomainManager, "loadDomains").mockImplementation(() => {});
  await DomainManager.updateDomainMode("example.com", 1);
  expect(mockSet).toHaveBeenCalledWith({
    refererHeaders: { "example.com": 1 }
  });
});

test('updateDomainMode logs an error when storage fails', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  chrome.storage.local.get.mockRejectedValue(new Error('fail'));
  await DomainManager.updateDomainMode('example.com', 2);
  expect(spy).toHaveBeenCalledWith('Failed to update domain example.com:', expect.any(Error));
});

test('deleteDomain removes domain from storage', async () => {
  chrome.storage.local.get.mockResolvedValue({
    refererHeaders: { "a.com": 0, "b.com": 1 }
  });
  const mockSet = jest.fn();
  chrome.storage.local.set = mockSet;
  global.confirm = jest.fn(() => true);
  jest.spyOn(DomainManager, "loadDomains").mockImplementation(() => {});
  await DomainManager.deleteDomain("b.com");
  expect(mockSet).toHaveBeenCalledWith({
    refererHeaders: { "a.com": 0 }
  });
});

test('deleteDomain defaults to an empty map when nothing is stored', async () => {
  const mockSet = jest.fn();
  chrome.storage.local.get.mockResolvedValue({});
  chrome.storage.local.set = mockSet;
  global.confirm = jest.fn(() => true);
  jest.spyOn(DomainManager, "loadDomains").mockImplementation(() => {});
  await DomainManager.deleteDomain("b.com");
  expect(mockSet).toHaveBeenCalledWith({ refererHeaders: {} });
});

test('deleteDomain does nothing when the user cancels the confirmation', async () => {
  global.confirm = jest.fn(() => false);
  const mockSet = jest.fn();
  chrome.storage.local.set = mockSet;
  await DomainManager.deleteDomain("b.com");
  expect(mockSet).not.toHaveBeenCalled();
  expect(chrome.storage.local.get).not.toHaveBeenCalled();
});

test('deleteDomain logs an error when storage fails', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  global.confirm = jest.fn(() => true);
  chrome.storage.local.get.mockRejectedValue(new Error('fail'));
  await DomainManager.deleteDomain('a.com');
  expect(spy).toHaveBeenCalledWith('Failed to delete domain a.com:', expect.any(Error));
});

test('addDomain saves new domain with default mode', async () => {
  chrome.storage.local.get.mockResolvedValue({
    refererHeaders: {}
  });
  const mockSet = jest.fn();
  chrome.storage.local.set = mockSet;
  global.prompt = jest.fn(() => "newdomain.com");
  jest.spyOn(DomainManager, "loadDomains").mockImplementation(() => {});
  await DomainManager.addDomain();
  expect(mockSet).toHaveBeenCalledWith({
    refererHeaders: { "newdomain.com": 0 }
  });
});

test('addDomain defaults to an empty map when nothing is stored', async () => {
  chrome.storage.local.get.mockResolvedValue({});
  const mockSet = jest.fn();
  chrome.storage.local.set = mockSet;
  global.prompt = jest.fn(() => "newdomain.com");
  jest.spyOn(DomainManager, "loadDomains").mockImplementation(() => {});
  await DomainManager.addDomain();
  expect(mockSet).toHaveBeenCalledWith({
    refererHeaders: { "newdomain.com": 0 }
  });
});

test('addDomain does nothing when the prompt is cancelled', async () => {
  global.prompt = jest.fn(() => null);
  const mockSet = jest.fn();
  chrome.storage.local.set = mockSet;
  await DomainManager.addDomain('');
  expect(mockSet).not.toHaveBeenCalled();
  expect(chrome.storage.local.get).not.toHaveBeenCalled();
});

test('addDomain does nothing when the trimmed input is empty', async () => {
  global.prompt = jest.fn(() => '   ');
  const mockSet = jest.fn();
  chrome.storage.local.set = mockSet;
  await DomainManager.addDomain('');
  expect(mockSet).not.toHaveBeenCalled();
  expect(chrome.storage.local.get).not.toHaveBeenCalled();
});

test('addDomain alerts and re-prompts when the domain already exists', async () => {
  chrome.storage.local.get.mockResolvedValue({ refererHeaders: { 'existing.com': 0 } });
  global.alert = jest.fn();
  global.prompt = jest.fn()
    .mockReturnValueOnce('existing.com')
    .mockReturnValueOnce(null);
  jest.spyOn(DomainManager, "loadDomains").mockImplementation(() => {});

  await DomainManager.addDomain('existing.com');

  expect(global.alert).toHaveBeenCalledWith('domainAlreadyExists');
  expect(global.prompt).toHaveBeenCalledTimes(2);
});

test('addDomain logs an error when storage fails', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  global.prompt = jest.fn(() => 'new.com');
  chrome.storage.local.get.mockRejectedValue(new Error('fail'));
  await DomainManager.addDomain('');
  expect(spy).toHaveBeenCalledWith('Failed to add domain:', expect.any(Error));
});

describe('editDomain()', () => {
  test('does nothing when the prompt is cancelled', async () => {
    global.prompt = jest.fn(() => null);
    const mockSet = jest.fn();
    chrome.storage.local.set = mockSet;
    await DomainManager.editDomain('example.com');
    expect(mockSet).not.toHaveBeenCalled();
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
  });

  test('does nothing when the trimmed input is empty', async () => {
    global.prompt = jest.fn(() => '   ');
    const mockSet = jest.fn();
    chrome.storage.local.set = mockSet;
    await DomainManager.editDomain('example.com');
    expect(mockSet).not.toHaveBeenCalled();
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
  });

  test('does nothing when the new name is unchanged after trimming/lowercasing', async () => {
    global.prompt = jest.fn(() => '  Example.com  ');
    const mockSet = jest.fn();
    chrome.storage.local.set = mockSet;
    await DomainManager.editDomain('example.com');
    expect(mockSet).not.toHaveBeenCalled();
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
  });

  test('renames a domain, keeping its mode, and reloads the list', async () => {
    chrome.storage.local.get.mockResolvedValue({
      refererHeaders: { 'old.com': 2, 'other.com': 0 }
    });
    const mockSet = jest.fn();
    chrome.storage.local.set = mockSet;
    global.prompt = jest.fn(() => 'new.com');
    jest.spyOn(DomainManager, "loadDomains").mockImplementation(() => {});

    await DomainManager.editDomain('old.com');

    expect(mockSet).toHaveBeenCalledWith({
      refererHeaders: { 'other.com': 0, 'new.com': 2 }
    });
    expect(DomainManager.loadDomains).toHaveBeenCalled();
  });

  test('defaults to an empty map when nothing is stored', async () => {
    chrome.storage.local.get.mockResolvedValue({});
    const mockSet = jest.fn();
    chrome.storage.local.set = mockSet;
    global.prompt = jest.fn(() => 'new.com');
    jest.spyOn(DomainManager, "loadDomains").mockImplementation(() => {});

    await DomainManager.editDomain('old.com');

    expect(mockSet).toHaveBeenCalledWith({
      refererHeaders: { 'new.com': undefined }
    });
  });

  test('alerts and re-prompts when the new name already exists', async () => {
    chrome.storage.local.get.mockResolvedValue({
      refererHeaders: { 'old.com': 1, 'existing.com': 0 }
    });
    global.alert = jest.fn();
    global.prompt = jest.fn()
      .mockReturnValueOnce('existing.com')
      .mockReturnValueOnce(null);
    const mockSet = jest.fn();
    chrome.storage.local.set = mockSet;

    await DomainManager.editDomain('old.com');

    expect(global.alert).toHaveBeenCalledWith('domainAlreadyExists');
    expect(global.prompt).toHaveBeenCalledTimes(2);
    expect(mockSet).not.toHaveBeenCalled();
  });

  test('logs an error when storage fails', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    global.prompt = jest.fn(() => 'new.com');
    chrome.storage.local.get.mockRejectedValue(new Error('fail'));
    await DomainManager.editDomain('old.com');
    expect(spy).toHaveBeenCalledWith('Failed to rename domain old.com:', expect.any(Error));
  });
});

describe('applyI18n()', () => {
  test('sets text, html, and placeholder content only when a message is available', () => {
    document.body.innerHTML = `
      <span data-i18n="greeting"></span>
      <span data-i18n="emptyGreeting">unchanged</span>
      <div data-i18n-html="richHtml"></div>
      <div data-i18n-html="emptyRichHtml">untouched</div>
      <input data-placeholder-i18n="placeholderKey" />
      <input data-placeholder-i18n="emptyPlaceholderKey" />
    `;
    chrome.i18n.getMessage = jest.fn((key) => {
      if (key === 'greeting') return 'Hello';
      if (key === 'richHtml') return '<b>bold</b><i>italic</i>';
      if (key === 'placeholderKey') return 'Type here';
      return '';
    });

    DomainManager.applyI18n();

    expect(document.querySelector('[data-i18n="greeting"]').innerText).toBe('Hello');
    expect(document.querySelector('[data-i18n="emptyGreeting"]').innerText).toBe('unchanged');

    const richHtmlEl = document.querySelector('[data-i18n-html="richHtml"]');
    expect(richHtmlEl.children).toHaveLength(2);
    expect(richHtmlEl.innerHTML).toContain('<b>bold</b>');
    expect(document.querySelector('[data-i18n-html="emptyRichHtml"]').innerHTML).toBe('untouched');

    expect(document.querySelector('[data-placeholder-i18n="placeholderKey"]').getAttribute('placeholder')).toBe('Type here');
    expect(document.querySelector('[data-placeholder-i18n="emptyPlaceholderKey"]').hasAttribute('placeholder')).toBe(false);
  });
});

describe('module bootstrap', () => {
  test('DOMContentLoaded wires up DomainManager (and TabView/HelpView) without error', async () => {
    document.body.innerHTML = `
      <input id="search" />
      <div id="domainList"></div>
      <button id="addDomainButton"></button>
      <button id="exportButton"></button>
      <button id="importButton"></button>
      <input type="file" id="importFileInput" />
    `;
    chrome.storage.local.get.mockResolvedValue({ refererHeaders: {} });

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await Promise.resolve();
    await Promise.resolve();

    expect(DomainManager.domainList).toBe(document.getElementById('domainList'));
    expect(DomainManager.searchInput).toBe(document.getElementById('search'));
    expect(DomainManager.addDomainButton).toBe(document.getElementById('addDomainButton'));
    expect(DomainManager.exportButton).toBe(document.getElementById('exportButton'));
    expect(DomainManager.importButton).toBe(document.getElementById('importButton'));
    expect(DomainManager.importFileInput).toBe(document.getElementById('importFileInput'));
    expect(chrome.storage.local.get).toHaveBeenCalled();

    const addDomainSpy = jest.spyOn(DomainManager, 'addDomain').mockImplementation(() => {});
    DomainManager.searchInput.value = 'typed.com';
    DomainManager.addDomainButton.click();
    expect(addDomainSpy).toHaveBeenCalledWith('typed.com');

    const loadDomainsSpy = jest.spyOn(DomainManager, 'loadDomains').mockImplementation(() => {});
    DomainManager.searchInput.dispatchEvent(new Event('input'));
    expect(loadDomainsSpy).toHaveBeenCalled();

    const exportSpy = jest.spyOn(DomainManager, 'exportSettings').mockImplementation(() => {});
    DomainManager.exportButton.click();
    expect(exportSpy).toHaveBeenCalled();

    const clickSpy = jest.spyOn(DomainManager.importFileInput, 'click').mockImplementation(() => {});
    DomainManager.importButton.click();
    expect(clickSpy).toHaveBeenCalled();

    const importSpy = jest.spyOn(DomainManager, 'importSettings').mockImplementation(() => {});
    DomainManager.importFileInput.dispatchEvent(new Event('change'));
    expect(importSpy).toHaveBeenCalled();
  });
});

describe('exportSettings()', () => {
  let createObjectURL;
  let revokeObjectURL;

  beforeEach(() => {
    createObjectURL = jest.fn(() => 'blob:mock-url');
    revokeObjectURL = jest.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;
  });

  test('downloads the stored rules as a JSON file', async () => {
    chrome.storage.local.get.mockResolvedValue({
      refererHeaders: { 'example.com': 1 }
    });

    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await DomainManager.exportSettings();

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  test('defaults to an empty map when nothing is stored', async () => {
    chrome.storage.local.get.mockResolvedValue({});
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await expect(DomainManager.exportSettings()).resolves.toBeUndefined();
    expect(createObjectURL).toHaveBeenCalled();
  });

  test('logs an error when storage access fails', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    chrome.storage.local.get.mockRejectedValue(new Error('fail'));

    await DomainManager.exportSettings();

    expect(spy).toHaveBeenCalledWith('Failed to export settings:', expect.any(Error));
  });
});

describe('isValidRuleSet()', () => {
  test('accepts a plain domain-to-mode map', () => {
    expect(DomainManager.isValidRuleSet({ 'example.com': 0, 'other.com': 3 })).toBe(true);
  });

  test('rejects arrays, null, and non-objects', () => {
    expect(DomainManager.isValidRuleSet([])).toBe(false);
    expect(DomainManager.isValidRuleSet(null)).toBe(false);
    expect(DomainManager.isValidRuleSet('not-an-object')).toBe(false);
  });

  test('rejects out-of-range or non-numeric modes', () => {
    expect(DomainManager.isValidRuleSet({ 'example.com': 4 })).toBe(false);
    expect(DomainManager.isValidRuleSet({ 'example.com': '1' })).toBe(false);
  });
});

describe('importSettings()', () => {
  const fileWith = (content) => ({ text: () => Promise.resolve(content) });

  test('does nothing when no file is selected', async () => {
    const mockSet = jest.fn();
    chrome.storage.local.set = mockSet;

    await DomainManager.importSettings({ target: { files: [], value: '' } });

    expect(mockSet).not.toHaveBeenCalled();
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
  });

  test('merges imported rules into existing storage after confirmation', async () => {
    chrome.storage.local.get.mockResolvedValue({
      refererHeaders: { 'existing.com': 1 }
    });
    const mockSet = jest.fn();
    chrome.storage.local.set = mockSet;
    global.confirm = jest.fn(() => true);
    global.alert = jest.fn();
    jest.spyOn(DomainManager, 'loadDomains').mockImplementation(() => {});

    const target = { files: [fileWith(JSON.stringify({ refererHeaders: { 'imported.com': 2 } }))], value: 'x' };
    await DomainManager.importSettings({ target });

    expect(mockSet).toHaveBeenCalledWith({
      refererHeaders: { 'existing.com': 1, 'imported.com': 2 }
    });
    expect(target.value).toBe('');
    expect(global.alert).toHaveBeenCalledWith('importSuccess');
    expect(DomainManager.loadDomains).toHaveBeenCalled();
  });

  test('accepts a bare domain-to-mode map without a refererHeaders wrapper', async () => {
    chrome.storage.local.get.mockResolvedValue({ refererHeaders: {} });
    const mockSet = jest.fn();
    chrome.storage.local.set = mockSet;
    global.confirm = jest.fn(() => true);
    global.alert = jest.fn();
    jest.spyOn(DomainManager, 'loadDomains').mockImplementation(() => {});

    const target = { files: [fileWith(JSON.stringify({ 'imported.com': 0 }))], value: 'x' };
    await DomainManager.importSettings({ target });

    expect(mockSet).toHaveBeenCalledWith({ refererHeaders: { 'imported.com': 0 } });
  });

  test('does nothing when the user cancels the confirmation', async () => {
    chrome.storage.local.get.mockResolvedValue({ refererHeaders: {} });
    const mockSet = jest.fn();
    chrome.storage.local.set = mockSet;
    global.confirm = jest.fn(() => false);

    const target = { files: [fileWith(JSON.stringify({ 'imported.com': 0 }))], value: 'x' };
    await DomainManager.importSettings({ target });

    expect(mockSet).not.toHaveBeenCalled();
  });

  test('alerts and does not save when the file contains invalid JSON', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    global.alert = jest.fn();
    const mockSet = jest.fn();
    chrome.storage.local.set = mockSet;

    const target = { files: [fileWith('not-json')], value: 'x' };
    await DomainManager.importSettings({ target });

    expect(global.alert).toHaveBeenCalledWith('importInvalidFile');
    expect(mockSet).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith('Failed to import settings:', expect.any(Error));
  });

  test('alerts and does not save when the parsed content is not a valid rule set', async () => {
    global.alert = jest.fn();
    const mockSet = jest.fn();
    chrome.storage.local.set = mockSet;

    const target = { files: [fileWith(JSON.stringify({ 'example.com': 99 }))], value: 'x' };
    await DomainManager.importSettings({ target });

    expect(global.alert).toHaveBeenCalledWith('importInvalidFile');
    expect(mockSet).not.toHaveBeenCalled();
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
  });
});
