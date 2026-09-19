const test = require('node:test');
const assert = require('node:assert/strict');
const pkg = require('../package.json');

const { feedsByCategory, REGIONAL_SOURCE_CATEGORIES, normalizeRegionToken, mergeCategoryArticles, resolveArticleCountry } = require('./fetch_rss.js');

test('npm ci should not trigger live fetch/build during install', () => {
  assert.equal(pkg.scripts.prepare, undefined);
});

test('normalizeRegionToken keeps Hyderabad, Telangana and Andhra Pradesh distinct', () => {
  assert.equal(normalizeRegionToken('india'), 'india');
  assert.equal(normalizeRegionToken('HYDERABAD'), 'hyderabad');
  assert.equal(normalizeRegionToken('andhra pradesh'), 'andhra-pradesh');
  assert.equal(normalizeRegionToken('telangana'), 'telangana');
});

test('resolveArticleCountry respects the feed source for daily briefing', () => {
  assert.equal(resolveArticleCountry('daily-briefing', 'https://news.google.com/rss/search?q=Hyderabad+daily+briefing', 'Hyderabad civic update', 'India city report'), 'hyderabad');
  assert.equal(resolveArticleCountry('daily-briefing', 'https://news.google.com/rss/search?q=India+daily+briefing', 'India policy briefing', 'Delhi update'), 'india');
  assert.equal(resolveArticleCountry('daily-briefing', 'https://news.google.com/rss/search?q=Telangana+daily+briefing', 'Telangana weather update', 'Hyderabad region alert'), 'telangana');
});

test('mergeCategoryArticles keeps older stories and adds fresh unique ones without duplicates', () => {
  const existing = [
    { title: 'Old India story', link: 'https://example.com/old-india', country: 'india', date: '2026-08-01T00:00:00.000Z' },
    { title: 'Old Hyderabad story', link: 'https://example.com/old-hyd', country: 'hyderabad', date: '2026-08-02T00:00:00.000Z' }
  ];

  const incoming = [
    { title: 'New Hyderabad story', link: 'https://example.com/new-hyd', country: 'hyderabad', date: '2026-08-03T00:00:00.000Z' },
    { title: 'Old Hyderabad story', link: 'https://example.com/old-hyd', country: 'hyderabad', date: '2026-08-02T00:00:00.000Z' }
  ];

  const merged = mergeCategoryArticles(existing, incoming, 20);
  assert.equal(merged.length, 3);
  assert.deepEqual(merged.map(item => item.country).sort(), ['hyderabad', 'hyderabad', 'india']);
  assert.equal(merged.some(item => item.link === 'https://example.com/new-hyd'), true);
});

test('daily briefing job sub-categories have live RSS feeds', () => {
  const jobCategories = ['java-developer-jobs', 'java-full-stack-jobs'];

  for (const category of jobCategories) {
    const feeds = feedsByCategory[category];
    assert.ok(Array.isArray(feeds) && feeds.length > 0, `${category} needs at least one feed`);

    for (const url of feeds) {
      assert.match(url, /^https:\/\/news\.google\.com\/rss\/search\?q=/, `${category} feed must be a Google News RSS search`);
    }
  }

  assert.match(feedsByCategory['java-developer-jobs'].join(' '), /Java\+developer\+jobs/);
  assert.match(feedsByCategory['java-full-stack-jobs'].join(' '), /full\+stack/);
});

test('job sub-categories resolve their region from the feed URL', () => {
  assert.equal(REGIONAL_SOURCE_CATEGORIES.includes('java-developer-jobs'), true);
  assert.equal(REGIONAL_SOURCE_CATEGORIES.includes('java-full-stack-jobs'), true);

  assert.equal(
    resolveArticleCountry(
      'java-developer-jobs',
      'https://news.google.com/rss/search?q=Java+developer+jobs+Hyderabad&hl=en-IN',
      'Java developer jobs in Hyderabad',
      'Apply now'
    ),
    'hyderabad'
  );

  assert.equal(
    resolveArticleCountry(
      'java-full-stack-jobs',
      'https://news.google.com/rss/search?q=Java+full+stack+developer+jobs&hl=en-IN&gl=IN',
      'Java full stack developer jobs in India',
      'Hiring drive'
    ),
    'india'
  );
});
