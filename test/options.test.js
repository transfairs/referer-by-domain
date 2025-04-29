/**
 * @jest-environment jsdom
 */

// Import the functions and classes to be tested
import DomainManager from '../src/options/options.js';

global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

beforeEach(() => {
  document.body.innerHTML = `
    <input id="search" />
    <div id="domainList"></div>
  `;
  DomainManager.domainList = document.getElementById('domainList');
  DomainManager.searchInput = document.getElementById('search');
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

test('updateDomainMode updates storage and reloads list', async () => {
  const mockSet = jest.fn();
  chrome.storage.local.get.mockResolvedValue({
    refererHeaders: { "example.com": 1 }
  });
  chrome.storage.local.set = mockSet;
  DomainManager.loadDomains = jest.fn();
  await DomainManager.updateDomainMode("example.com", 2);
  expect(mockSet).toHaveBeenCalledWith({
    refererHeaders: { "example.com": 2 }
  });
  expect(DomainManager.loadDomains).toHaveBeenCalled();
});

test('deleteDomain removes domain from storage', async () => {
  chrome.storage.local.get.mockResolvedValue({
    refererHeaders: { "a.com": 0, "b.com": 1 }
  });
  const mockSet = jest.fn();
  chrome.storage.local.set = mockSet;
  global.confirm = jest.fn(() => true);
  DomainManager.loadDomains = jest.fn();
  await DomainManager.deleteDomain("b.com");
  expect(mockSet).toHaveBeenCalledWith({
    refererHeaders: { "a.com": 0 }
  });
});

test('addDomain saves new domain with default mode', async () => {
  chrome.storage.local.get.mockResolvedValue({
    refererHeaders: {}
  });
  const mockSet = jest.fn();
  chrome.storage.local.set = mockSet;
  global.prompt = jest.fn(() => "newdomain.com");
  DomainManager.loadDomains = jest.fn();
  await DomainManager.addDomain();
  expect(mockSet).toHaveBeenCalledWith({
    refererHeaders: { "newdomain.com": 0 }
  });
});