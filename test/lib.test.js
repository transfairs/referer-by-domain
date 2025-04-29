// Import the functions to be tested
import { domainMatchesWildcard, getRefererHeaderForDomain, saveRefererHeaderForDomain } from '../src/lib/lib.js';

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

  test('should save a new referer header entry correctly', (done) => {
    saveRefererHeaderForDomain('newdomain.com', 2);

    // Allow async behavior to complete
    setImmediate(() => {
      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        refererHeaders: { 'newdomain.com': 2 }
      });
      done();
    });
  });
});
