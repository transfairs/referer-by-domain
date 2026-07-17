const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '../_locales');
const SRC_DIR = path.join(__dirname, '../src');

const LOCALES = fs.readdirSync(LOCALES_DIR).filter((entry) =>
  fs.statSync(path.join(LOCALES_DIR, entry)).isDirectory()
);

function loadLocale(locale) {
  const raw = fs.readFileSync(path.join(LOCALES_DIR, locale, 'messages.json'), 'utf8');
  return JSON.parse(raw);
}

function walk(dir, extension) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath, extension));
    } else if (entry.name.endsWith(extension)) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractKeysFromHtml(content) {
  const keys = [];
  const attrPattern = /data-(?:i18n|i18n-html|placeholder-i18n)="([^"]+)"/g;
  let match;
  while ((match = attrPattern.exec(content)) !== null) {
    keys.push(match[1]);
  }
  return keys;
}

function extractKeysFromJs(content) {
  const keys = [];
  const callPattern = /chrome\.i18n\.getMessage\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = callPattern.exec(content)) !== null) {
    keys.push(match[1]);
  }
  return keys;
}

describe('locale files', () => {
  test('at least one locale is present', () => {
    expect(LOCALES.length).toBeGreaterThan(0);
  });

  test.each(LOCALES)('%s/messages.json is valid JSON', (locale) => {
    expect(() => loadLocale(locale)).not.toThrow();
  });

  test('all locales define the same set of keys', () => {
    const keysByLocale = Object.fromEntries(
      LOCALES.map((locale) => [locale, Object.keys(loadLocale(locale)).sort()])
    );
    const [referenceLocale, ...otherLocales] = LOCALES;
    const referenceKeys = keysByLocale[referenceLocale];

    for (const locale of otherLocales) {
      expect(keysByLocale[locale]).toEqual(referenceKeys);
    }
  });

  test('every i18n key referenced in src/ exists in every locale', () => {
    const htmlFiles = walk(SRC_DIR, '.html');
    const jsFiles = walk(SRC_DIR, '.js');

    const referencedKeys = new Set();
    htmlFiles.forEach((file) => {
      extractKeysFromHtml(fs.readFileSync(file, 'utf8')).forEach((key) => referencedKeys.add(key));
    });
    jsFiles.forEach((file) => {
      extractKeysFromJs(fs.readFileSync(file, 'utf8')).forEach((key) => referencedKeys.add(key));
    });

    expect(referencedKeys.size).toBeGreaterThan(0);

    for (const locale of LOCALES) {
      const localeKeys = new Set(Object.keys(loadLocale(locale)));
      const missing = [...referencedKeys].filter((key) => !localeKeys.has(key));
      expect({ locale, missing }).toEqual({ locale, missing: [] });
    }
  });

  test('every message entry has a non-empty "message" string', () => {
    for (const locale of LOCALES) {
      const messages = loadLocale(locale);
      for (const [key, entry] of Object.entries(messages)) {
        expect(typeof entry.message).toBe('string');
        expect(entry.message.length).toBeGreaterThan(0);
      }
    }
  });
});
