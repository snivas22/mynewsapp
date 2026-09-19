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
const { jobBoardFromSourceLabel } = require('./jobs');

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
 * Sub-categories of the daily briefing. Each one gets its own collection and
 * its own section on the daily briefing page, but stays out of the country
 * pool so job-market news never lands on a regional dashboard.
 *
 * `defaultLabel` / `defaultBlurb` are the Telugu markup defaults. The English
 * and Telugu translations live in the layout's `translations` object under
 * `labelKey` / `blurbKey`.
 */
const DAILY_BRIEFING_SUB_CATEGORIES = [
  {
    slug: 'java-developer-jobs',
    labelKey: 'subJavaDeveloperJobs',
    blurbKey: 'subJavaDeveloperJobsBlurb',
    defaultLabel: 'జావా డెవలపర్ ఉద్యోగాలు',
    defaultBlurb: 'జావా డెవలపర్ పాత్రల కోసం లైవ్ నియామక వార్తలు.'
  },
  {
    slug: 'java-full-stack-jobs',
    labelKey: 'subJavaFullStackJobs',
    blurbKey: 'subJavaFullStackJobsBlurb',
    defaultLabel: 'జావా ఫుల్ స్టాక్ డెవలపర్ ఉద్యోగాలు',
    defaultBlurb: 'జావా ఫుల్ స్టాక్ డెవలపర్ పాత్రల కోసం లైవ్ నియామక వార్తలు.'
  },
  {
    slug: 'it-jobs',
    labelKey: 'subItJobs',
    blurbKey: 'subItJobsBlurb',
    defaultLabel: 'IT & సాఫ్ట్‌వేర్ ఉద్యోగాలు',
    defaultBlurb: 'IT మరియు సాఫ్ట్‌వేర్ పాత్రల కోసం లైవ్ నియామక వార్తలు.'
  },
  {
    slug: 'freshers-jobs',
    labelKey: 'subFreshersJobs',
    blurbKey: 'subFreshersJobsBlurb',
    defaultLabel: 'ఫ్రెషర్స్ & ఇంటర్న్‌షిప్‌లు',
    defaultBlurb: 'ఫ్రెషర్లు మరియు ఇంటర్న్‌షిప్‌ల కోసం లైవ్ అవకాశాలు.'
  },
  {
    slug: 'government-jobs',
    labelKey: 'subGovernmentJobs',
    blurbKey: 'subGovernmentJobsBlurb',
    defaultLabel: 'ప్రభుత్వ ఉద్యోగాలు',
    defaultBlurb: 'ప్రభుత్వ ఉద్యోగ నోటిఫికేషన్లు మరియు నియామక అప్‌డేట్లు.'
  },
  {
    slug: 'hyderabad-jobs',
    labelKey: 'subHyderabadJobs',
    blurbKey: 'subHyderabadJobsBlurb',
    defaultLabel: 'హైదరాబాద్ ఉద్యోగాలు',
    defaultBlurb: 'హైదరాబాద్ మరియు పరిసర ప్రాంతాల ఉద్యోగ అవకాశాలు.'
  }
];

const SUB_CATEGORIES = DAILY_BRIEFING_SUB_CATEGORIES.map((sub) => sub.slug);

/** Every category that has an article directory, in sidebar/reading order. */
const ALL_CATEGORIES = [...CATEGORIES, ...SUB_CATEGORIES];

const COUNTRY_SLUGS = ['uk', 'us', 'india', 'andhra-pradesh', 'telangana', 'hyderabad', 'australia', 'uae'];

/** How many stories a single category page lists. */
const CATEGORY_LIMIT = 8;
/** The daily briefing is an aggregate page, so it lists more than a topic page. */
const DAILY_BRIEFING_LIMIT = 24;
/** Per-category overrides for CATEGORY_LIMIT. */
const CATEGORY_LIMITS = { 'daily-briefing': DAILY_BRIEFING_LIMIT };
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

/** Listing limit for a category, honouring per-category overrides. */
function categoryLimit(slug) {
  return CATEGORY_LIMITS[slug] || CATEGORY_LIMIT;
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
      country: normalizeCountry(data.country),
      // Set only for job-board postings; empty for editorial stories. Archived
      // postings predate the marker, so fall back to the source label.
      job_board: String(data.job_board || jobBoardFromSourceLabel(data.source) || '')
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
 * Pick up to `quota` items spread across sources, newest first within each.
 *
 * Without this a section can show three postings from one board and none from
 * the others, which hides the point of polling several job sites.
 */
function diversifyBySource(items, quota) {
  const groups = new Map();

  for (const item of items) {
    const key = (item.data && item.data.job_board) || 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const buckets = [...groups.values()];
  const picked = [];

  for (let depth = 0; picked.length < quota; depth += 1) {
    const before = picked.length;

    for (const bucket of buckets) {
      if (picked.length >= quota) break;
      if (bucket[depth]) picked.push(bucket[depth]);
    }

    // Nothing left in any bucket.
    if (picked.length === before) break;
  }

  return picked;
}

/**
 * Build a sub-category section that shows both job-board postings and news.
 *
 * Plain date ordering lets one kind crowd the other out, so take half the
 * quota from each group, top up from whatever is left, then order by date.
 */
function mixJobSection(items, limit) {
  const all = items || [];
  const postings = all.filter((item) => item.data && item.data.job_board);
  const news = all.filter((item) => !(item.data && item.data.job_board));
  const quota = Math.ceil(limit / 2);

  const picked = [
    ...diversifyBySource(postings, quota),
    ...news.slice(0, Math.max(0, limit - Math.min(postings.length, quota)))
  ];

  if (picked.length < limit) {
    const chosen = new Set(picked);
    const remaining = [...postings, ...news].filter((item) => !chosen.has(item));
    picked.push(...remaining.slice(0, limit - picked.length));
  }

  return picked
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
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
  DAILY_BRIEFING_SUB_CATEGORIES,
  COUNTRY_SLUGS,
  COUNTRY_LABELS,
  CATEGORY_LIMIT,
  DAILY_BRIEFING_LIMIT,
  CATEGORY_LIMITS,
  SUB_CATEGORY_LIMIT,
  COUNTRY_LIMIT,
  DEFAULT_COUNTRY,
  normalizeCountry,
  categoryLimit,
  countryLabel,
  readCategory,
  readPool,
  mixJobSection,
  byCountry,
  countryCounts,
  dedupeByLink
};
