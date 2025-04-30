/**
 * @jest-environment jsdom
 */

import PopupManager from '../src/popup/popup.js';

beforeEach(() => {
  document.body.innerHTML = `
    <input id="domainInput" />
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
  `;

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
});

test('loadDomainSettings highlights correct mode if domain matched exactly', () => {
  chrome.storage.local.get.mockImplementation((key, callback) => {
    callback({
      refererHeaders: {
        "example.com": 1
      }
    });
  });

  PopupManager.loadDomainSettings('example.com');

  const buttons = document.querySelectorAll('.referer-options button');
  setTimeout(() => {
    expect(buttons[1].classList.contains('active')).toBe(true);
  }, 0);
});