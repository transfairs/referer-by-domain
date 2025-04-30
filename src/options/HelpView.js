/**
 * @file HelpView.js
 * @description Provides logic for handling tab navigation in the help section.
 * Switches between different content panels and updates tab button states accordingly.
 * Designed for use in the options/help page of the extension.
 *
 * @since 2025-04-30
 */

/**
 * @class HelpView
 * @classdesc Manages help section tab behaviour by toggling visible content and active tabs.
 */
export default class HelpView {
  /**
   * @method init
   * @static
   * @description Attaches click event handlers to all help subtab buttons.
   * When a tab is clicked, it activates the corresponding content section and tab button.
   */
  static init() {
    // Select all subtab buttons within the help view
    document.querySelectorAll('.help-subtabs button').forEach(button => {
      button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        
        // Show matching tab content, hide others
        document.querySelectorAll('.help-section .tab-content').forEach(sec => {
          sec.classList.toggle('active', sec.id === tab);
        });
        
        // Set active class on clicked button, remove from others
        document.querySelectorAll('.help-subtabs button').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.tab === tab);
        });
      });
    });
  }
}
