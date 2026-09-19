const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  CATEGORY_LIMIT,
  COUNTRY_LIMIT,
  COUNTRY_SLUGS,
  SUB_CATEGORIES,
  countryLabel,
  countryCounts,
  normalizeCountry,
  readCategory,
  readPool,
  byCountry,
  dedupeByLink
} = require('./lib/articles');

function writeArticle(root, category, slug, data, body = 'Body text.') {
  const dir = path.join(root, category);
  fs.mkdirSync(dir, { recursive: true });

  const front = Object.entries(data)
    .map(([key, value]) => `${key}: "${value}"`)
    .join('\n');

  fs.writeFileSync(path.join(dir, `${slug}.md`), `---\n${front}\n---\n\n${body}\n`, 'utf8');
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'news-articles-'));

  writeArticle(root, 'politics', 'older-westminster', {
    title: 'Older Westminster story',
    date: '2026-08-01T00:00:00.000Z',
    category: 'politics',
    source: 'Example',
    original_link: 'https://example.com/old',
    country: 'uk'
  });

  writeArticle(root, 'politics', 'newer-westminster', {
    title: 'Newer Westminster story',
    date: '2026-08-09T00:00:00.000Z',
    category: 'politics',
    source: 'Example',
    original_link: 'https://example.com/new',
    country: 'uk'
  });

  // Same link as the politics story: the pool must dedupe it away.
  writeArticle(root, 'technology', 'duplicate-technology', {
    title: 'Duplicate of the newer Westminster story',
    date: '2026-08-08T00:00:00.000Z',
    category: 'technology',
    source: 'Example',
    original_link: 'https://example.com/new',
    country: 'uk'
  });

  writeArticle(root, 'hyderabad', 'charminar-update', {
    title: 'Charminar area update',
    date: '2026-08-07T00:00:00.000Z',
    category: 'hyderabad',
    source: 'Example',
    original_link: 'https://example.com/hyd',
    country: 'hyderabad'
  });

  writeArticle(root, 'andhra-pradesh', 'vijayawada-update', {
    title: 'Vijayawada road update',
    date: '2026-08-06T00:00:00.000Z',
    category: 'andhra-pradesh',
    source: 'Example',
    original_link: 'https://example.com/ap',
    country: 'andhra-pradesh'
  });

  return root;
}

test('readCategory returns newest first and tolerates missing directories', () => {
  const root = makeFixture();
  const politics = readCategory(root, 'politics');

  assert.equal(politics.length, 2);
  assert.equal(politics[0].data.title, 'Newer Westminster story');
  assert.equal(politics[1].data.title, 'Older Westminster story');
  assert.deepEqual(readCategory(root, 'does-not-exist'), []);
});

test('readPool dedupes repeated links and excludes empty categories', () => {
  const root = makeFixture();
  const pool = readPool(root);

  assert.equal(pool.length, 4, 'expected 4 unique stories');
  assert.equal(pool.filter((item) => item.data.original_link === 'https://example.com/new').length, 1);
  assert.equal(pool.some((item) => item.data.category === 'favourites'), false);
  assert.equal(new Date(pool[0].date) >= new Date(pool[1].date), true);
});

test('byCountry keeps hyphenated regions distinct from their parent country', () => {
  const root = makeFixture();
  const pool = readPool(root);

  assert.deepEqual(byCountry(pool, 'hyderabad').map((i) => i.data.title), ['Charminar area update']);
  assert.deepEqual(byCountry(pool, 'andhra-pradesh').map((i) => i.data.title), ['Vijayawada road update']);
  assert.equal(byCountry(pool, 'india').length, 0, 'Hyderabad stories must not be counted as India');
  assert.equal(byCountry(pool, 'uk').length, 1 + 1, 'deduped UK stories');
});

test('countryCounts reports every supported region with real numbers', () => {
  const root = makeFixture();
  const counts = countryCounts(readPool(root));

  assert.deepEqual(Object.keys(counts).sort(), [...COUNTRY_SLUGS].sort());
  assert.equal(counts.uk, 2);
  assert.equal(counts.hyderabad, 1);
  assert.equal(counts['andhra-pradesh'], 1);
  assert.equal(counts.india, 0);
  assert.equal(counts.uae, 0);
});

test('daily briefing job sub-categories stay out of the country pool', () => {
  const root = makeFixture();

  for (const slug of SUB_CATEGORIES) {
    writeArticle(root, slug, `${slug}-opening`, {
      title: `${slug} opening`,
      date: '2026-08-10T00:00:00.000Z',
      category: slug,
      source: 'Example',
      original_link: `https://example.com/${slug}`,
      country: 'india'
    });
  }

  const pool = readPool(root);
  assert.deepEqual(
    pool.filter((item) => SUB_CATEGORIES.includes(item.data.category)),
    [],
    'job sub-categories must not feed the country pool'
  );

  for (const slug of SUB_CATEGORIES) {
    assert.equal(readCategory(root, slug).length, 1, `${slug} should still be readable as its own collection`);
  }

  assert.equal(byCountry(pool, 'india').length, 0);
});

test('display limits stay meaningful', () => {
  assert.equal(CATEGORY_LIMIT > 0, true);
  assert.equal(COUNTRY_LIMIT >= CATEGORY_LIMIT, true);
});

test('normalizeCountry and countryLabel fall back sensibly', () => {
  assert.equal(normalizeCountry(''), 'global');
  assert.equal(normalizeCountry('  HYDERABAD '), 'hyderabad');
  assert.equal(countryLabel('andhra-pradesh'), 'Andhra Pradesh');
  assert.equal(countryLabel('unmapped-region'), 'Unmapped Region');
});

test('dedupeByLink keeps the first occurrence', () => {
  const items = [
    { inputPath: 'a', data: { original_link: 'https://x.dev/1' } },
    { inputPath: 'b', data: { original_link: 'https://x.dev/1' } },
    { inputPath: 'c', data: { original_link: 'https://x.dev/2' } }
  ];

  assert.deepEqual(dedupeByLink(items).map((i) => i.inputPath), ['a', 'c']);
});
