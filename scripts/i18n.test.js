const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { parseFrontmatter, escapeFrontmatterValue, serializeFrontmatter } = require('./lib/frontmatter');

const srcDir = path.join(__dirname, '..', 'src');
const baseLayoutPath = path.join(srcDir, 'layouts', 'base.njk');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}

function translationKeys(block) {
  const keys = new Set();
  for (const match of block.matchAll(/(?:^|\n)\s*([A-Za-z0-9_]+)\s*:/g)) {
    keys.add(match[1]);
  }
  return keys;
}

function readTranslations() {
  const base = fs.readFileSync(baseLayoutPath, 'utf8');
  const enMatch = base.match(/\n\s+en:\s*\{([\s\S]*?)\n\s+\},\s*\n\s+te:\s*\{/);
  const teMatch = base.match(/\n\s+te:\s*\{([\s\S]*?)\n\s+\}\s*\n\s*\};/);

  assert.ok(enMatch, 'expected an `en` translation block in base.njk');
  assert.ok(teMatch, 'expected a `te` translation block in base.njk');

  return { en: translationKeys(enMatch[1]), te: translationKeys(teMatch[1]) };
}

function usedI18nKeys() {
  const used = new Map();
  for (const file of walk(srcDir).filter((f) => f.endsWith('.njk'))) {
    const content = fs.readFileSync(file, 'utf8');
    for (const match of content.matchAll(/data-i18n(?:-placeholder)?="([A-Za-z0-9_]+)"/g)) {
      if (!used.has(match[1])) used.set(match[1], []);
      used.get(match[1]).push(path.relative(srcDir, file));
    }
  }
  return used;
}

test('every data-i18n key used in templates exists in both languages', () => {
  const { en, te } = readTranslations();
  const missing = [];

  for (const [key, files] of usedI18nKeys()) {
    if (!en.has(key)) missing.push(`${key} (English) used in ${[...new Set(files)].join(', ')}`);
    if (!te.has(key)) missing.push(`${key} (Telugu) used in ${[...new Set(files)].join(', ')}`);
  }

  assert.deepEqual(missing, [], `Missing translation keys:\n${missing.join('\n')}`);
});

test('English and Telugu translation blocks stay in sync', () => {
  const { en, te } = readTranslations();
  const onlyEnglish = [...en].filter((key) => !te.has(key));
  const onlyTelugu = [...te].filter((key) => !en.has(key));

  assert.deepEqual(onlyEnglish, [], `Keys missing from Telugu: ${onlyEnglish.join(', ')}`);
  assert.deepEqual(onlyTelugu, [], `Keys missing from English: ${onlyTelugu.join(', ')}`);
});

test('daily briefing sub-category label and blurb keys exist in both languages', () => {
  const { en, te } = readTranslations();
  const template = fs.readFileSync(path.join(srcDir, 'categories', 'daily-briefing.njk'), 'utf8');

  const keys = [...template.matchAll(/(?:labelKey|blurbKey):\s*'([A-Za-z0-9_]+)'/g)].map((match) => match[1]);
  assert.equal(keys.length > 0, true, 'expected labelKey/blurbKey entries in the daily briefing template');

  const missing = keys.filter((key) => !en.has(key) || !te.has(key));
  assert.deepEqual(missing, [], `Missing sub-category translations: ${missing.join(', ')}`);
});

test('frontmatter round-trips values containing quotes and newlines', () => {
  const data = {
    title: 'He said "hello"',
    date: '2026-09-19T00:00:00.000Z',
    category: 'world',
    source: 'Example Feed',
    original_link: 'https://example.com/a?b=1&c=2',
    country: 'india'
  };

  const doc = serializeFrontmatter(data, 'Body line.\n');
  const parsed = parseFrontmatter(doc);

  assert.deepEqual(parsed.data, data);
  assert.equal(parsed.body.trim(), 'Body line.');
});

test('parseFrontmatter handles unquoted values, comments and missing blocks', () => {
  const parsed = parseFrontmatter('---\n# comment\ntitle: Plain title\ncountry: uae\n---\n\nHello\n');
  assert.equal(parsed.data.title, 'Plain title');
  assert.equal(parsed.data.country, 'uae');
  assert.equal(parsed.data['# comment'], undefined);
  assert.equal(parsed.body.trim(), 'Hello');

  const noFrontmatter = parseFrontmatter('Just a body');
  assert.deepEqual(noFrontmatter.data, {});
  assert.equal(noFrontmatter.body, 'Just a body');
});

test('escapeFrontmatterValue keeps values on a single line', () => {
  assert.equal(escapeFrontmatterValue('a\nb'), 'a b');
  assert.equal(escapeFrontmatterValue('say "hi"'), 'say \\"hi\\"');
});
