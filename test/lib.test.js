/**
 * @jest-environment jsdom
 */

// Import the functions to be tested
import {
  domainMatchesWildcard,
  getRefererHeaderForDomain,
  saveRefererHeaderForDomain,
  isDebugMode,
  loadSavedSettings,
  parseHTML
} from '../src/lib/lib.js';
import * as debugMode from '../src/lib/debugMode.js';

//
// isDebugMode() tests
//
describe('isDebugMode()', () => {
  test('returns false by default', () => {
    expect(isDebugMode()).toBe(false);
  });
});

//
// internal debug() logging tests
//
describe('debug logging', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('logs via console.debug when debug mode is enabled', () => {
    jest.spyOn(debugMode, 'isDebugMode').mockReturnValue(true);
    const spy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    global.chrome = {
      storage: {
        local: {
          get: jest.fn((key, callback) => callback({ refererHeaders: {} })),
          set: jest.fn()
        }
      }
    };

    saveRefererHeaderForDomain('debug.com', 1);

    expect(spy).toHaveBeenCalledWith('Saved refererHeader for debug.com:', 1);
  });
});

//
// parseHTML() tests
//
describe('parseHTML()', () => {
  test('returns the direct children of the body as an array of elements', () => {
    const nodes = parseHTML('<div id="a"></div><span id="b"></span>');
    expect(nodes).toHaveLength(2);
    expect(nodes[0].id).toBe('a');
    expect(nodes[1].id).toBe('b');
  });

  test('returns an empty array for empty HTML', () => {
    expect(parseHTML('')).toHaveLength(0);
  });
});

//
// loadSavedSettings() tests
//
describe('loadSavedSettings()', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    global.chrome = {
      storage: {
        local: {
          get: jest.fn((key, callback) => {
            callback({ refererHeaders: { 'example.com': 2 } });
          }),
          set: jest.fn()
        }
      }
    };
  });

  test('fills in the referer input when a domain is entered', () => {
    document.body.innerHTML = `
      <input id="domain" value="example.com" />
      <input id="refererHeader" value="" />
    `;
    loadSavedSettings();
    expect(document.getElementById('refererHeader').value).toBe('2');
  });

  test('does nothing when the domain input is empty', () => {
    document.body.innerHTML = `
      <input id="domain" value="   " />
      <input id="refererHeader" value="" />
    `;
    loadSavedSettings();
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
  });

  test('does nothing when the required inputs are missing', () => {
    document.body.innerHTML = '';
    expect(() => loadSavedSettings()).not.toThrow();
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
  });
});

//
// domainMatchesWildcard() tests
//
describe('domainMatchesWildcard()', () => {
  test.each([
    // [domain, wildcardDomain, expectedResult]
    ['example.com', 'example.com', true],
    ['sub.example.com', '*.example.com', true],
    ['sub.sub.example.com', '*.example.com', true],
    ['sub.example.org', '*.example.com', false],
    ['completelydifferent.com', '*.example.com', false],
    ['anotherdomain.org', 'example.com', false]
  ])(
    'should return %s when comparing "%s" to "%s"',
    (domain, wildcardDomain, expected) => {
      expect(domainMatchesWildcard(domain, wildcardDomain)).toBe(expected);
    }
  );
});

//
// getRefererHeaderForDomain() tests
//
describe('getRefererHeaderForDomain()', () => {
  beforeEach(() => {
    // Mock the chrome.storage.local.get API
    global.chrome = {
      storage: {
        local: {
          get: jest.fn((key, callback) => {
            callback({
              refererHeaders: {
                'example.com': 2,
                '*.testsite.com': 1
              }
            });
          }),
          set: jest.fn()
        }
      }
    };
  });

  test.each([
    ['example.com', 2],
    ['news.testsite.com', 1],
    ['sub.testsite.com', 1],
    ['unknownsite.com', 0]
  ])(
    'should return %i for domain "%s"',
    (domain, expected) => {
      return new Promise((done) => {
        getRefererHeaderForDomain(domain, (value) => {
          expect(value).toBe(expected);
          done();
        });
      });
    }
  );

  test('defaults to an empty map when no refererHeaders are stored', () => {
    global.chrome.storage.local.get = jest.fn((key, callback) => callback({}));
    return new Promise((done) => {
      getRefererHeaderForDomain('example.com', (value) => {
        expect(value).toBe(0);
        done();
      });
    });
  });

  test('ignores inherited (non-own) properties, so a prototype-polluted wildcard rule cannot match', () => {
    const proto = {};
    Object.defineProperty(proto, '*.com', {
      value: 99,
      enumerable: true,
      configurable: true
    });
    const refererHeaders = Object.create(proto);
    refererHeaders['other.com'] = 1;

    global.chrome.storage.local.get = jest.fn((key, callback) => callback({ refererHeaders }));

    return new Promise((done) => {
      getRefererHeaderForDomain('evil.com', (value) => {
        // Without the hasOwnProperty guard the inherited '*.com' rule would
        // match 'evil.com' and return 99.
        expect(value).toBe(0);
        done();
      });
    });
  });
});

//
// saveRefererHeaderForDomain() tests
//
describe('saveRefererHeaderForDomain()', () => {
  beforeEach(() => {
    // Mock chrome.storage.local.get and chrome.storage.local.set
    global.chrome = {
      storage: {
        local: {
          get: jest.fn((key, callback) => callback({ refererHeaders: {} })),
          set: jest.fn()
        }
      }
    };
  });

  test('should save a new referer header entry correctly', () => {
    saveRefererHeaderForDomain('newdomain.com', 2);

    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
      refererHeaders: { 'newdomain.com': 2 }
    });
  });

  test('defaults to an empty map when no refererHeaders are stored', () => {
    global.chrome.storage.local.get = jest.fn((key, callback) => callback({}));
    saveRefererHeaderForDomain('freshdomain.com', 1);
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
      refererHeaders: { 'freshdomain.com': 1 }
    });
  });
});
