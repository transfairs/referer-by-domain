/**
 * @jest-environment jsdom
 */
import Modal from '../src/options/Modal.js';

beforeEach(() => {
  document.body.innerHTML = '';
  global.chrome = {
    i18n: {
      getMessage: jest.fn((key) => key)
    }
  };
});

afterEach(() => {
  jest.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('Modal.confirm()', () => {
  test('renders title/message and resolves true when the primary button is clicked', async () => {
    const resultPromise = Modal.confirm({ title: 'Delete domain', message: 'Are you sure?', confirmText: 'Delete' });

    expect(document.querySelector('.modal-title').textContent).toBe('Delete domain');
    expect(document.querySelector('.modal-message').textContent).toBe('Are you sure?');
    const buttons = document.querySelectorAll('.modal-button');
    expect(buttons).toHaveLength(2);
    expect(buttons[1].textContent).toBe('Delete');

    buttons[1].click();
    await expect(resultPromise).resolves.toBe(true);
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  test('resolves false when Cancel is clicked', async () => {
    const resultPromise = Modal.confirm({ title: 't', message: 'm' });
    document.querySelectorAll('.modal-button')[0].click();
    await expect(resultPromise).resolves.toBe(false);
  });

  test('resolves false when clicking the backdrop (not the dialog itself)', async () => {
    const resultPromise = Modal.confirm({ title: 't', message: 'm' });
    document.querySelector('.modal-overlay').click();
    await expect(resultPromise).resolves.toBe(false);
  });

  test('does not close when clicking inside the dialog', () => {
    Modal.confirm({ title: 't', message: 'm' });
    document.querySelector('.modal-dialog').click();
    expect(document.querySelector('.modal-overlay')).not.toBeNull();
  });

  test('resolves false on Escape', async () => {
    const resultPromise = Modal.confirm({ title: 't', message: 'm' });
    document.querySelector('.modal-overlay').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(resultPromise).resolves.toBe(false);
  });

  test('applies the danger class to the primary button when danger is set', () => {
    Modal.confirm({ title: 't', message: 'm', danger: true });
    const primary = document.querySelectorAll('.modal-button')[1];
    expect(primary.classList.contains('modal-button-danger')).toBe(true);
  });

  test('falls back to i18n defaults for button labels when none are given', () => {
    Modal.confirm({ title: 't', message: 'm' });
    const buttons = document.querySelectorAll('.modal-button');
    expect(buttons[0].textContent).toBe('modalCancel');
    expect(buttons[1].textContent).toBe('modalConfirm');
  });

  test('closing one dialog removes any previously open dialog', () => {
    Modal.confirm({ title: 'first', message: 'm' });
    Modal.confirm({ title: 'second', message: 'm' });
    expect(document.querySelectorAll('.modal-overlay')).toHaveLength(1);
    expect(document.querySelector('.modal-title').textContent).toBe('second');
  });

  test('renders without a title or message when omitted', () => {
    Modal.confirm({});
    expect(document.querySelector('.modal-title')).toBeNull();
    expect(document.querySelector('.modal-message')).toBeNull();
  });

  test('can be called with no arguments at all', () => {
    Modal.confirm();
    expect(document.querySelector('.modal-overlay')).not.toBeNull();
  });

  test('Enter is a no-op on a button-only dialog (no text input to submit)', async () => {
    const resultPromise = Modal.confirm({ title: 't', message: 'm' });
    document.querySelector('.modal-overlay').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    // Still open: Enter only auto-submits prompt()'s text input, not a bare confirm.
    expect(document.querySelector('.modal-overlay')).not.toBeNull();

    document.querySelectorAll('.modal-button')[1].click();
    await expect(resultPromise).resolves.toBe(true);
  });

  test('a dialog resolved after being replaced by a newer one does not clear the active overlay', async () => {
    const firstPromise = Modal.confirm({ title: 'first', message: 'm' });
    const firstConfirmButton = document.querySelectorAll('.modal-button')[1];

    Modal.confirm({ title: 'second', message: 'm' });
    expect(document.querySelector('.modal-title').textContent).toBe('second');

    // The first dialog's button is detached but still resolves its own promise.
    firstConfirmButton.click();
    await expect(firstPromise).resolves.toBe(true);

    // The second (still active) dialog must remain open.
    expect(document.querySelector('.modal-title').textContent).toBe('second');
  });
});

describe('Modal.prompt()', () => {
  test('resolves with the input value when confirmed, pre-filled with defaultValue', async () => {
    const resultPromise = Modal.prompt({ title: 'Add domain', message: 'Enter domain', defaultValue: 'example.com' });

    const input = document.querySelector('.modal-input');
    expect(input.value).toBe('example.com');
    input.value = 'changed.com';

    document.querySelectorAll('.modal-button')[1].click();
    await expect(resultPromise).resolves.toBe('changed.com');
  });

  test('resolves null when cancelled', async () => {
    const resultPromise = Modal.prompt({ title: 't', message: 'm' });
    document.querySelectorAll('.modal-button')[0].click();
    await expect(resultPromise).resolves.toBeNull();
  });

  test('resolves null on Escape', async () => {
    const resultPromise = Modal.prompt({ title: 't', message: 'm' });
    document.querySelector('.modal-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(resultPromise).resolves.toBeNull();
  });

  test('submits the current input value on Enter', async () => {
    const resultPromise = Modal.prompt({ title: 't', message: 'm', defaultValue: 'x' });
    const input = document.querySelector('.modal-input');
    input.value = 'typed.com';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await expect(resultPromise).resolves.toBe('typed.com');
  });

  test('resolves null when clicking the backdrop', async () => {
    const resultPromise = Modal.prompt({ title: 't', message: 'm' });
    document.querySelector('.modal-overlay').click();
    await expect(resultPromise).resolves.toBeNull();
  });

  test('can be called with no arguments at all', () => {
    Modal.prompt();
    expect(document.querySelector('.modal-input').value).toBe('');
  });
});

describe('Modal.alert()', () => {
  test('resolves when the OK button is clicked, using the default label', async () => {
    const resultPromise = Modal.alert({ title: 'Notice', message: 'Something happened' });
    const buttons = document.querySelectorAll('.modal-button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toBe('modalOk');
    buttons[0].click();
    await expect(resultPromise).resolves.toBeUndefined();
  });

  test('resolves on Escape', async () => {
    const resultPromise = Modal.alert({ title: 't', message: 'm' });
    document.querySelector('.modal-overlay').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(resultPromise).resolves.toBeUndefined();
  });

  test('uses a custom OK label when provided', () => {
    Modal.alert({ title: 't', message: 'm', okText: 'Got it' });
    expect(document.querySelector('.modal-button').textContent).toBe('Got it');
  });

  test('can be called with no arguments at all', () => {
    Modal.alert();
    expect(document.querySelector('.modal-overlay')).not.toBeNull();
  });
});
