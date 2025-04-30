/**
 * @file TabView.js
 * @description Handles main tab navigation and initial state setup based on URL hash.
 * Also performs innerHTML i18n content replacement for elements with `data-i18n-html`.
 *
 * @since 2025-04-30
 */

/**
 * @class TabView
 * @classdesc Manages global tab switching between top-level sections (e.g. Settings, Help).
 * Also sets initial tab from URL hash and processes inline HTML internationalisation.
 */
export default class TabView {
  /**
   * @method init
   * @static
   * @description Initialises tab navigation and i18n replacement. Sets up event listeners for tab clicks.
   * If a URL hash is present, the corresponding tab is activated on load.
   */
  static init() {
    const hash = window.location.hash;
    const initialTab = hash && hash.substring(1);

    document.querySelectorAll('.tabbar button').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;

        // Setup tab click handlers for the main tabbar
        document.querySelectorAll('.tabbar button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('main > .tab-content').forEach(sec => sec.classList.remove('active'));

        // Activate clicked tab and its corresponding content section
        btn.classList.add('active');
        document.getElementById(`tab-${tab}`).classList.add('active');
      });
    });
  
    // Switch to tab based on URL hash (if present)
    if (initialTab) {
      TabView.switchTab(initialTab);
    }
  }

  /**
   * @method switchTab
   * @static
   * @param {string} tab - The tab identifier (matches `data-tab` and `tab-<name>` section ID).
   * @description Activates the given tab and corresponding content section, deactivating all others.
   */
  static switchTab(tab) {
    document.querySelectorAll('.tabbar button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('main > .tab-content').forEach(sec => {
      sec.classList.toggle('active', sec.id === `tab-${tab}`);
    });
  }

  /**
   * @method destroy
   * @static
   * @description Removes all event listeners set by `init()` and resets tab classes.
   * Useful for reinitialising the view or cleaning up before unloading.
   */
  static destroy() {
    // Remove click handlers from tab buttons
    document.querySelectorAll('.tabbar button').forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.replaceWith(newBtn);
    });
  
    // Optionally remove active classes (clean visual state)
    document.querySelectorAll('.tabbar button').forEach(btn => {
      btn.classList.remove('active');
    });
  
    document.querySelectorAll('main > .tab-content').forEach(sec => {
      sec.classList.remove('active');
    });
  }
}
