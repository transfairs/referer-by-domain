/**
 * @file Modal.js
 * @description Lightweight, promise-based confirm/prompt/alert dialogs used
 * in place of the browser's native window.confirm/prompt/alert, so the
 * options page can offer styling consistent with the rest of the UI (and,
 * unlike the native dialogs, respect the selected dark/light theme).
 */
import { getMessage } from '../lib/i18n.js';

let activeOverlay = null;

/**
 * @param {string} [title]
 * @param {string} [message]
 * @returns {{overlay: HTMLDivElement, dialog: HTMLDivElement}}
 */
function buildOverlay(title, message) {
  if (activeOverlay) activeOverlay.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'modal-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  overlay.appendChild(dialog);

  if (title) {
    const heading = document.createElement('h3');
    heading.className = 'modal-title';
    heading.textContent = title;
    dialog.appendChild(heading);
  }
  if (message) {
    const body = document.createElement('p');
    body.className = 'modal-message';
    body.textContent = message;
    dialog.appendChild(body);
  }

  document.body.appendChild(overlay);
  activeOverlay = overlay;
  return { overlay, dialog };
}

/**
 * Renders a dialog and resolves with a button's value once the user acts on
 * it (clicking a button, clicking the backdrop, or pressing Escape).
 * @param {object} options
 * @param {string} [options.title]
 * @param {string} [options.message]
 * @param {HTMLElement} [options.extraContent] Extra element inserted before the actions (e.g. a text input).
 * @param {boolean} [options.focusInput] Focus/select extraContent instead of the primary button.
 * @param {*} [options.closeValue] Value resolved on Escape/backdrop-click.
 * @param {{label: string, value: *, primary?: boolean, danger?: boolean}[]} options.buttons
 * @returns {Promise<*>}
 */
function openDialog({ title, message, extraContent, focusInput = false, closeValue, buttons }) {
  return new Promise((resolve) => {
    const { overlay, dialog } = buildOverlay(title, message);

    if (extraContent) dialog.appendChild(extraContent);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const finish = (value) => {
      overlay.removeEventListener('keydown', onKeydown);
      overlay.remove();
      if (activeOverlay === overlay) activeOverlay = null;
      resolve(value);
    };

    const onKeydown = (event) => {
      if (event.key === 'Escape') finish(closeValue);
      else if (event.key === 'Enter' && extraContent) finish(resolveValue(extraContent, buttons));
    };

    let primaryButton = null;
    buttons.forEach(({ label, value, primary, danger }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = ['modal-button', !primary && 'secondary-button', danger && 'modal-button-danger']
        .filter(Boolean)
        .join(' ');
      button.textContent = label;
      button.addEventListener('click', () => finish(typeof value === 'function' ? value() : value));
      actions.appendChild(button);
      if (primary) primaryButton = button;
    });

    dialog.appendChild(actions);

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) finish(closeValue);
    });
    overlay.addEventListener('keydown', onKeydown);

    if (focusInput && extraContent) {
      extraContent.focus();
      extraContent.select();
    } else {
      primaryButton.focus();
    }
  });
}

function resolveValue(extraContent) {
  return extraContent.value;
}

/**
 * @class Modal
 * @classdesc Static helpers replacing window.confirm/prompt/alert.
 */
export default class Modal {
  /**
   * @param {{title?: string, message?: string, confirmText?: string, cancelText?: string, danger?: boolean}} [options]
   * @returns {Promise<boolean>}
   */
  static confirm({ title, message, confirmText, cancelText, danger = false } = {}) {
    return openDialog({
      title,
      message,
      closeValue: false,
      buttons: [
        { label: cancelText || getMessage('modalCancel'), value: false },
        { label: confirmText || getMessage('modalConfirm'), value: true, primary: true, danger }
      ]
    });
  }

  /**
   * @param {{title?: string, message?: string, defaultValue?: string, confirmText?: string, cancelText?: string}} [options]
   * @returns {Promise<string|null>}
   */
  static prompt({ title, message, defaultValue = '', confirmText, cancelText } = {}) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'modal-input';
    input.value = defaultValue;

    return openDialog({
      title,
      message,
      extraContent: input,
      focusInput: true,
      closeValue: null,
      buttons: [
        { label: cancelText || getMessage('modalCancel'), value: null },
        { label: confirmText || getMessage('modalConfirm'), value: () => input.value, primary: true }
      ]
    });
  }

  /**
   * @param {{title?: string, message?: string, okText?: string}} [options]
   * @returns {Promise<void>}
   */
  static alert({ title, message, okText } = {}) {
    return openDialog({
      title,
      message,
      closeValue: undefined,
      buttons: [{ label: okText || getMessage('modalOk'), value: undefined, primary: true }]
    });
  }
}
