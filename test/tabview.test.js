/**
 * @jest-environment jsdom
 */

import TabView from '../src/options/TabView.js';

function setupDom() {
  document.body.innerHTML = `
    <nav class="tabbar">
      <button data-tab="settings" class="active">Settings</button>
      <button data-tab="help">Help</button>
    </nav>
    <main>
      <section id="tab-settings" class="tab-content active"></section>
      <section id="tab-help" class="tab-content"></section>
    </main>
  `;
}

beforeEach(() => {
  setupDom();
  window.location.hash = '';
});

test('init() without a hash leaves the default tab active', () => {
  TabView.init();
  expect(document.getElementById('tab-settings').classList.contains('active')).toBe(true);
  expect(document.getElementById('tab-help').classList.contains('active')).toBe(false);
});

test('init() with a hash switches to the matching tab', () => {
  window.location.hash = '#help';
  TabView.init();
  expect(document.getElementById('tab-help').classList.contains('active')).toBe(true);
  expect(document.querySelector('[data-tab="help"]').classList.contains('active')).toBe(true);
  expect(document.getElementById('tab-settings').classList.contains('active')).toBe(false);
});

test('clicking a tab button activates its section and deactivates the others', () => {
  TabView.init();
  document.querySelector('[data-tab="help"]').click();

  expect(document.getElementById('tab-help').classList.contains('active')).toBe(true);
  expect(document.querySelector('[data-tab="help"]').classList.contains('active')).toBe(true);
  expect(document.getElementById('tab-settings').classList.contains('active')).toBe(false);
  expect(document.querySelector('[data-tab="settings"]').classList.contains('active')).toBe(false);
});

test('switchTab() activates the matching tab and content directly', () => {
  TabView.switchTab('help');
  expect(document.getElementById('tab-help').classList.contains('active')).toBe(true);
  expect(document.querySelector('[data-tab="help"]').classList.contains('active')).toBe(true);
  expect(document.getElementById('tab-settings').classList.contains('active')).toBe(false);
  expect(document.querySelector('[data-tab="settings"]').classList.contains('active')).toBe(false);
});

test('destroy() removes click handlers and clears active state', () => {
  TabView.init();
  TabView.destroy();

  document.querySelectorAll('.tabbar button').forEach((btn) => {
    expect(btn.classList.contains('active')).toBe(false);
  });
  document.querySelectorAll('main > .tab-content').forEach((sec) => {
    expect(sec.classList.contains('active')).toBe(false);
  });

  document.querySelector('[data-tab="help"]').click();
  expect(document.getElementById('tab-help').classList.contains('active')).toBe(false);
});
