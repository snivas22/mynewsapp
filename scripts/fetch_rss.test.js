const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeRegionToken, mergeCategoryArticles } = require('./fetch_rss.js');

test('normalizeRegionToken keeps Hyderabad, Telangana and Andhra Pradesh distinct', () => {
  assert.equal(normalizeRegionToken('india'), 'india');
  assert.equal(normalizeRegionToken('HYDERABAD'), 'hyderabad');
  assert.equal(normalizeRegionToken('andhra pradesh'), 'andhra-pradesh');
  assert.equal(normalizeRegionToken('telangana'), 'telangana');
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
