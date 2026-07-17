/**
 * @jest-environment jsdom
 */

import HelpView from '../src/options/HelpView.js';

beforeEach(() => {
  document.body.innerHTML = `
    <div class="help-subtabs">
      <button data-tab="help_a" class="active">A</button>
      <button data-tab="help_b">B</button>
    </div>
    <div class="help-section">
      <section id="help_a" class="tab-content active"></section>
      <section id="help_b" class="tab-content"></section>
    </div>
  `;
});

test('clicking a subtab activates its content and button, deactivating the others', () => {
  HelpView.init();

  document.querySelector('[data-tab="help_b"]').click();

  expect(document.getElementById('help_b').classList.contains('active')).toBe(true);
  expect(document.getElementById('help_a').classList.contains('active')).toBe(false);
  expect(document.querySelector('[data-tab="help_b"]').classList.contains('active')).toBe(true);
  expect(document.querySelector('[data-tab="help_a"]').classList.contains('active')).toBe(false);
});
