function createChromeMock({ refererHeaders = {} } = {}) {
  const listeners = {};
  return {
    runtime: {
      onInstalled: { addListener: jest.fn((cb) => { listeners.onInstalled = cb; }) },
      onMessage: { addListener: jest.fn((cb) => { listeners.onMessage = cb; }) }
    },
    webRequest: {
      onBeforeSendHeaders: { addListener: jest.fn((cb) => { listeners.onBeforeSendHeaders = cb; }) },
      onBeforeRequest: { addListener: jest.fn((cb) => { listeners.onBeforeRequest = cb; }) }
    },
    storage: {
      local: {
        get: jest.fn((key, callback) => callback({ refererHeaders }))
      }
    },
    listeners
  };
}

function loadBackground(chromeMock) {
  jest.resetModules();
  global.chrome = chromeMock;
  // eslint-disable-next-line global-require
  require('../src/background/background.js');
  return chromeMock.listeners;
}

describe('background.js', () => {
  let consoleSpies;

  beforeEach(() => {
    consoleSpies = [
      jest.spyOn(console, 'info').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {})
    ];
  });

  afterEach(() => {
    consoleSpies.forEach((spy) => spy.mockRestore());
    delete global.chrome;
  });

  test('logs on install', () => {
    const chromeMock = createChromeMock();
    const listeners = loadBackground(chromeMock);
    listeners.onInstalled();
    expect(console.info).toHaveBeenCalledWith('Referer By Domain extension installed.');
  });

  describe('onBeforeSendHeaders', () => {
    test('leaves headers untouched when refererSetting is 3 (unrestricted)', async () => {
      const chromeMock = createChromeMock({ refererHeaders: { 'example.com': 3 } });
      const listeners = loadBackground(chromeMock);

      const requestHeaders = [{ name: 'Referer', value: 'https://old.example.com' }];
      const result = await listeners.onBeforeSendHeaders({
        url: 'https://example.com/page',
        requestHeaders
      });

      expect(result.requestHeaders).toBe(requestHeaders);
    });

    test('strips referer when refererSetting is 0', async () => {
      const chromeMock = createChromeMock({ refererHeaders: { 'example.com': 0 } });
      const listeners = loadBackground(chromeMock);

      const result = await listeners.onBeforeSendHeaders({
        url: 'https://example.com/page',
        requestHeaders: [{ name: 'Referer', value: 'https://old.example.com' }, { name: 'Accept', value: '*/*' }]
      });

      expect(result.requestHeaders).toEqual([{ name: 'Accept', value: '*/*' }]);
    });

    test('sends origin as referer when refererSetting is 1 and originUrl present', async () => {
      const chromeMock = createChromeMock({ refererHeaders: { 'example.com': 1 } });
      const listeners = loadBackground(chromeMock);

      const result = await listeners.onBeforeSendHeaders({
        url: 'https://example.com/page',
        originUrl: 'https://initiator.com/somepath',
        requestHeaders: []
      });

      expect(result.requestHeaders).toContainEqual({ name: 'Referer', value: 'https://initiator.com' });
    });

    test('omits referer when refererSetting is 1 and no originUrl', async () => {
      const chromeMock = createChromeMock({ refererHeaders: { 'example.com': 1 } });
      const listeners = loadBackground(chromeMock);

      const result = await listeners.onBeforeSendHeaders({
        url: 'https://example.com/page',
        requestHeaders: []
      });

      expect(result.requestHeaders).toEqual([]);
    });

    test('sends full url as referer when refererSetting is 2 and originUrl present', async () => {
      const chromeMock = createChromeMock({ refererHeaders: { 'example.com': 2 } });
      const listeners = loadBackground(chromeMock);

      const result = await listeners.onBeforeSendHeaders({
        url: 'https://example.com/page',
        originUrl: 'https://initiator.com/somepath',
        requestHeaders: []
      });

      expect(result.requestHeaders).toContainEqual({ name: 'Referer', value: 'https://initiator.com/somepath' });
    });

    test('omits referer when refererSetting is 2 and no originUrl', async () => {
      const chromeMock = createChromeMock({ refererHeaders: { 'example.com': 2 } });
      const listeners = loadBackground(chromeMock);

      const result = await listeners.onBeforeSendHeaders({
        url: 'https://example.com/page',
        requestHeaders: []
      });

      expect(result.requestHeaders).toEqual([]);
    });

    test('warns and leaves headers stripped for unknown referer settings', async () => {
      const chromeMock = createChromeMock({ refererHeaders: { 'example.com': 99 } });
      const listeners = loadBackground(chromeMock);

      const result = await listeners.onBeforeSendHeaders({
        url: 'https://example.com/page',
        requestHeaders: []
      });

      expect(result.requestHeaders).toEqual([]);
    });
  });

  describe('onBeforeRequest', () => {
    test('ignores requests missing documentUrl or url', () => {
      const chromeMock = createChromeMock();
      const listeners = loadBackground(chromeMock);
      expect(() => listeners.onBeforeRequest({ documentUrl: '', url: 'https://a.com' })).not.toThrow();
      expect(() => listeners.onBeforeRequest({ documentUrl: 'https://a.com', url: '' })).not.toThrow();
    });

    test('ignores non-http(s) documentUrl or url', () => {
      const chromeMock = createChromeMock();
      const listeners = loadBackground(chromeMock);
      expect(() =>
        listeners.onBeforeRequest({ documentUrl: 'chrome://extensions', url: 'https://a.com' })
      ).not.toThrow();
      expect(() =>
        listeners.onBeforeRequest({ documentUrl: 'https://a.com', url: 'chrome://extensions' })
      ).not.toThrow();
    });

    test('ignores same-domain requests', () => {
      const chromeMock = createChromeMock();
      const listeners = loadBackground(chromeMock);
      listeners.onBeforeRequest({ documentUrl: 'https://a.com/page', url: 'https://a.com/other' });

      listeners.onMessage({ type: 'getAllRelations' }, {}, (response) => {
        expect(response.relations).toEqual({});
      });
    });

    test('tracks a new initiator -> target relation', () => {
      const chromeMock = createChromeMock();
      const listeners = loadBackground(chromeMock);
      listeners.onBeforeRequest({ documentUrl: 'https://a.com/page', url: 'https://b.com/img.png' });

      let seen;
      listeners.onMessage({ type: 'getAllRelations' }, {}, (response) => {
        seen = response.relations;
      });
      expect(seen).toEqual({ 'a.com': ['b.com'] });
    });

    test('caps targets tracked per initiator', () => {
      const chromeMock = createChromeMock();
      const listeners = loadBackground(chromeMock);

      for (let i = 0; i < 105; i++) {
        listeners.onBeforeRequest({
          documentUrl: 'https://a.com/page',
          url: `https://target${i}.com/`
        });
      }

      let seen;
      listeners.onMessage({ type: 'getRelatedDomains', domain: 'a.com' }, {}, (response) => {
        seen = response.related;
      });
      expect(seen).toHaveLength(100);
    });

    test('evicts the oldest initiator once the initiator cap is reached', () => {
      const chromeMock = createChromeMock();
      const listeners = loadBackground(chromeMock);

      for (let i = 0; i < 201; i++) {
        listeners.onBeforeRequest({
          documentUrl: `https://initiator${i}.com/page`,
          url: 'https://shared-target.com/'
        });
      }

      let seen;
      listeners.onMessage({ type: 'getRelatedDomains', domain: 'initiator0.com' }, {}, (response) => {
        seen = response.related;
      });
      expect(seen).toEqual([]);

      listeners.onMessage({ type: 'getRelatedDomains', domain: 'initiator200.com' }, {}, (response) => {
        seen = response.related;
      });
      expect(seen).toEqual(['shared-target.com']);
    });

    test('catches and logs errors from malformed URLs', () => {
      const chromeMock = createChromeMock();
      const listeners = loadBackground(chromeMock);
      expect(() =>
        listeners.onBeforeRequest({ documentUrl: 'http://[invalid', url: 'https://b.com/' })
      ).not.toThrow();
      expect(console.error).toHaveBeenCalledWith(
        '[background] Error processing webRequest',
        expect.objectContaining({ message: expect.stringContaining('Invalid URL') })
      );
    });
  });

  describe('onMessage', () => {
    test('getRelatedDomains returns [] for an unknown domain', () => {
      const chromeMock = createChromeMock();
      const listeners = loadBackground(chromeMock);
      let seen;
      listeners.onMessage({ type: 'getRelatedDomains', domain: 'unknown.com' }, {}, (response) => {
        seen = response.related;
      });
      expect(seen).toEqual([]);
    });

    test('ignores unknown message types', () => {
      const chromeMock = createChromeMock();
      const listeners = loadBackground(chromeMock);
      const sendResponse = jest.fn();
      expect(() => listeners.onMessage({ type: 'somethingElse' }, {}, sendResponse)).not.toThrow();
      expect(sendResponse).not.toHaveBeenCalled();
    });
  });
});
