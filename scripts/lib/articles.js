'use strict';

/**
 * Reads the markdown written by `scripts/fetch_rss.js` into collection items
 * that Eleventy templates can consume.
 *
 * Why this exists: Eleventy 2 respects `.gitignore`, and `src/articles/` is
 * gitignored, so those markdown files are never registered as Eleventy
 * templates and never show up in `collectionApi.getAll()`. Every non-category
 * collection therefore has to read the files directly, the same way the
 * category collections already did.
 */

const fs = require('fs');
const path = require('path');

const { parseFrontmatter } = require('./frontmatter');

const CATEGORIES = [
  'politics',
  'world',
  'business',
  'technology',
  'sports',
  'entertainment',
  'science',
  'health',
  'ai-trends',
  'india',
  'andhra-pradesh',
  'telangana',
  'hyderabad',
  'daily-briefing',
  'favourites'
];

/**
 * Sub-categories of the daily briefing. They get their own collections so the
 * daily briefing page can render them, but they stay out of the country pool so
 * job-market news never shows up on a regional dashboard.
 */
const SUB_CATEGORIES = ['java-developer-jobs', 'java-full-stack-jobs'];

/** Every category that has an article directory, in sidebar/reading order. */
const ALL_CATEGORIES = [...CATEGORIES, ...SUB_CATEGORIES];

const COUNTRY_SLUGS = ['uk', 'us', 'india', 'andhra-pradesh', 'telangana', 'hyderabad', 'australia', 'uae'];

/** How many stories a single category page lists. */
const CATEGORY_LIMIT = 8;
/** How many stories each daily-briefing sub-category section lists. */
const SUB_CATEGORY_LIMIT = 6;
/** How many stories a single country/region dashboard lists. */
const COUNTRY_LIMIT = 40;
/** Categories that should never feed the shared pool (no articles of their own). */
const POOL_EXCLUDES = ['favourites'];

const DEFAULT_COUNTRY = 'global';

const COUNTRY_LABELS = {
  global: 'Global',
  uk: 'United Kingdom',
  us: 'United States',
  india: 'India',
  'andhra-pradesh': 'Andhra Pradesh',
  telangana: 'Telangana',
  hyderabad: 'Hyderabad',
  australia: 'Australia',
  uae: 'UAE'
};

function normalizeCountry(value) {
  const normalized = String(value == null ? '' : value).trim().toLowerCase();
  return normalized || DEFAULT_COUNTRY;
}

function countryLabel(value) {
  const slug = normalizeCountry(value);
  if (COUNTRY_LABELS[slug]) return COUNTRY_LABELS[slug];
  return slug.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function toItem(cat, file, raw, mtimeIso) {
  const { data, body } = parseFrontmatter(raw);
  const date = data.date || mtimeIso;
  const originalLink = data.original_link || '#';

  return {
    inputPath: `src/articles/${cat}/${file}`,
    url: originalLink,
    date,
    templateContent: body,
    data: {
      title: data.title || file.replace(/\.md$/, '').replace(/-/g, ' '),
      category: cat,
      source: data.source || 'Open source feed',
      original_link: originalLink,
      date,
      country: normalizeCountry(data.country)
    }
  };
}

/**
 * Read one category directory, newest first. Not limited or deduped.
 */
function readCategory(articlesRoot, cat) {
  const categoryDir = path.join(articlesRoot, String(cat));

  let files;
  try {
    files = fs.readdirSync(categoryDir);
  } catch (error) {
    return [];
  }

  return files
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const fullPath = path.join(categoryDir, file);
      const raw = fs.readFileSync(fullPath, 'utf8');
      const mtimeIso = fs.statSync(fullPath).mtime.toISOString();
      return toItem(cat, file, raw, mtimeIso);
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function dedupeByLink(items) {
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    const key = item.data.original_link || item.inputPath;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

/**
 * Every story across every article category, newest first, deduped by link.
 * The same story can be written into more than one category by the fetcher,
 * so country dashboards must dedupe before listing.
 */
function readPool(articlesRoot, options = {}) {
  const exclude = options.exclude || POOL_EXCLUDES;

  const items = CATEGORIES
    .filter((cat) => !exclude.includes(cat))
    .flatMap((cat) => readCategory(articlesRoot, cat));

  return dedupeByLink(items.sort((a, b) => new Date(b.date) - new Date(a.date)));
}

/**
 * Filter pool items by their region slug.
 */
function byCountry(items, country) {
  const slug = normalizeCountry(country);
  return (items || []).filter((item) => normalizeCountry(item.data && item.data.country) === slug);
}

/**
 * Story counts per region slug, for the countries index cards.
 */
function countryCounts(items) {
  const counts = {};
  for (const slug of COUNTRY_SLUGS) counts[slug] = 0;

  for (const item of items || []) {
    const slug = normalizeCountry(item.data && item.data.country);
    if (Object.prototype.hasOwnProperty.call(counts, slug)) counts[slug] += 1;
  }

  return counts;
}

module.exports = {
  CATEGORIES,
  SUB_CATEGORIES,
  ALL_CATEGORIES,
  COUNTRY_SLUGS,
  COUNTRY_LABELS,
  CATEGORY_LIMIT,
  SUB_CATEGORY_LIMIT,
  COUNTRY_LIMIT,
  DEFAULT_COUNTRY,
  normalizeCountry,
  countryLabel,
  readCategory,
  readPool,
  byCountry,
  countryCounts,
  dedupeByLink
};
