const test = require('node:test');
const assert = require('node:assert/strict');
const pkg = require('../package.json');

const { feedsByCategory, jobBoardsByCategory, REGIONAL_SOURCE_CATEGORIES, collectJobPostingsForCategory, normalizeRegionToken, mergeCategoryArticles, resolveArticleCountry } = require('./fetch_rss.js');
const { DAILY_BRIEFING_SUB_CATEGORIES, SUB_CATEGORIES } = require('./lib/articles');
const { JOB_BOARD_IDS } = require('./lib/jobs');

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

test('every daily briefing sub-category has news feeds', () => {
  for (const sub of DAILY_BRIEFING_SUB_CATEGORIES) {
    const feeds = feedsByCategory[sub.slug];
    assert.ok(Array.isArray(feeds) && feeds.length > 0, `${sub.slug} has no news feeds`);

    for (const url of feeds) {
      assert.match(url, /^https:\/\/news\.google\.com\/rss\/search\?q=/, `${sub.slug} feed must be a Google News RSS search`);
    }
  }
});

test('mergeCategoryArticles refreshes stored entries with freshly fetched fields', () => {
  const existing = [
    { title: 'Java Engineer', link: 'https://x.dev/1', date: '2026-09-01T00:00:00.000Z', source: 'Jobicy' }
  ];
  const incoming = [
    { title: 'Java Engineer', link: 'https://x.dev/1', date: '2026-09-01T00:00:00.000Z', source: 'Jobicy', jobBoard: 'jobicy' }
  ];

  const merged = mergeCategoryArticles(existing, incoming, 10);

  assert.equal(merged.length, 1, 'duplicates must still collapse');
  assert.equal(merged[0].jobBoard, 'jobicy', 'the fresh copy must win so new fields persist');
});

test('job postings are filtered by title, or title plus summary for tag sources', () => {
  const cache = {
    general: new Map([['remoteok', [
      { title: 'Java Engineer', link: 'https://general-title', summary: 'Build services' },
      { title: 'Marketing Lead', link: 'https://general-summary-only', summary: 'We use Java' }
    ]]]),
    searchable: new Map([['jobicy:java', [
      { title: 'Senior Software Engineer', link: 'https://tag-summary', summary: 'Java and Spring' },
      { title: 'Sales Executive', link: 'https://tag-irrelevant', summary: 'No tech here' }
    ]]])
  };

  const accepted = collectJobPostingsForCategory(cache, { tags: ['java'], match: ['java'] });
  assert.deepEqual(accepted.map((job) => job.link).sort(), ['https://general-title', 'https://tag-summary']);
});

test('a posting claimed by an earlier sub-category is not repeated', () => {
  const cache = {
    general: new Map([['remoteok', [{ title: 'Java Engineer', link: 'https://shared', summary: '' }]]]),
    searchable: new Map()
  };

  const accepted = collectJobPostingsForCategory(cache, { tags: [], match: ['java'] }, new Set(['https://shared']));
  assert.deepEqual(accepted, []);
});

test('job board sources feed real sub-categories from multiple sites', () => {
  assert.equal(JOB_BOARD_IDS.length >= 3, true, 'expected several job boards, not just one');

  for (const [category, config] of Object.entries(jobBoardsByCategory)) {
    assert.equal(SUB_CATEGORIES.includes(category), true, `${category} must be a daily briefing sub-category`);
    assert.equal(config.tags.length > 0, true, `${category} needs tag queries`);
    assert.equal(config.match.length > 0, true, `${category} needs match terms`);
  }
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
