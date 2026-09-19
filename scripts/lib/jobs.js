'use strict';

/**
 * Job-board integration.
 *
 * Only sources that publish a documented feed or public API are used.
 *
 * The big four sites people usually ask for cannot be added:
 *
 * - Indeed's Publisher API is partner-gated and closed to new applicants.
 * - LinkedIn's Jobs API is restricted to approved partners.
 * - Naukri and Glassdoor publish no public jobs API at all.
 *
 * All four also prohibit scraping in their terms of service and actively block
 * it (bot detection, 403/999 responses), so no scraping is attempted here.
 *
 * Instead the same postings are reached the legitimate way: aggregators that
 * syndicate those boards, and the companies' own applicant-tracking boards,
 * which is where a listing originates before it is syndicated to LinkedIn,
 * Indeed or Naukri.
 *
 * Everything here is pure so it can be unit tested without network access.
 * `scripts/fetch_rss.js` does the fetching and merging.
 */

/**
 * Only sources whose keyword query is actually honoured are `searchable`.
 * Jobicy tags and the Adzuna/Jooble search parameters work; Remotive's
 * `search`, Arbeitnow's `search` and Remote OK's `tag` all return unfiltered
 * lists, so those are polled once and filtered locally instead.
 *
 * `requiresEnv` sources are skipped unless every named variable is set. Keys
 * belong in the environment (a GitHub secret in CI), never in this file.
 */
const JOB_BOARD_SOURCES = [
  {
    id: 'jobicy',
    label: 'Jobicy',
    kind: 'json',
    searchable: true,
    url: (tag) => `https://jobicy.com/api/v2/remote-jobs?count=20&tag=${encodeURIComponent(tag)}`,
    pick: (payload) => (Array.isArray(payload && payload.jobs) ? payload.jobs : [])
  },
  {
    id: 'adzuna',
    label: 'Adzuna',
    kind: 'json',
    searchable: true,
    requiresEnv: ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY'],
    // Adzuna aggregates many boards, including India (adzuna.in).
    url: (term, env) =>
      `https://api.adzuna.com/v1/api/jobs/${env.ADZUNA_COUNTRY || 'in'}/search/1` +
      `?app_id=${encodeURIComponent(env.ADZUNA_APP_ID)}&app_key=${encodeURIComponent(env.ADZUNA_APP_KEY)}` +
      `&results_per_page=20&what=${encodeURIComponent(term)}`,
    pick: (payload) => (Array.isArray(payload && payload.results) ? payload.results : [])
  },
  {
    id: 'jooble',
    label: 'Jooble',
    kind: 'json',
    searchable: true,
    method: 'POST',
    requiresEnv: ['JOOBLE_API_KEY'],
    url: (_term, env) => `https://jooble.org/api/${encodeURIComponent(env.JOOBLE_API_KEY)}`,
    body: (term) => JSON.stringify({ keywords: term, location: 'India' }),
    pick: (payload) => (Array.isArray(payload && payload.jobs) ? payload.jobs : [])
  },
  {
    id: 'remotive',
    label: 'Remotive',
    kind: 'json',
    searchable: false,
    url: () => 'https://remotive.com/api/remote-jobs',
    pick: (payload) => (Array.isArray(payload && payload.jobs) ? payload.jobs : [])
  },
  {
    id: 'remoteok',
    label: 'Remote OK',
    kind: 'json',
    searchable: false,
    url: () => 'https://remoteok.com/api',
    pick: (payload) => (Array.isArray(payload) ? payload : [])
  },
  {
    id: 'weworkremotely',
    label: 'We Work Remotely',
    kind: 'rss',
    searchable: false,
    url: () => 'https://weworkremotely.com/categories/remote-programming-jobs.rss'
  },
  {
    id: 'himalayas',
    label: 'Himalayas',
    kind: 'rss',
    searchable: false,
    url: () => 'https://himalayas.app/jobs/rss'
  },
  {
    id: 'themuse',
    label: 'The Muse',
    kind: 'json',
    searchable: false,
    url: () => 'https://www.themuse.com/api/public/jobs?page=1&category=Software%20Engineering',
    pick: (payload) => (Array.isArray(payload && payload.results) ? payload.results : [])
  }
];

/**
 * Company applicant-tracking boards. These are the companies' own public job
 * boards, so the postings are the originals that later appear on the big
 * aggregators. One request per board per run.
 */
const ATS_BOARDS = [
  { id: 'greenhouse-gitlab', ats: 'greenhouse', token: 'gitlab', label: 'GitLab' },
  { id: 'greenhouse-databricks', ats: 'greenhouse', token: 'databricks', label: 'Databricks' },
  { id: 'greenhouse-stripe', ats: 'greenhouse', token: 'stripe', label: 'Stripe' },
  { id: 'ashby-openai', ats: 'ashby', token: 'openai', label: 'OpenAI' },
  { id: 'ashby-ramp', ats: 'ashby', token: 'ramp', label: 'Ramp' },
  { id: 'lever-spotify', ats: 'lever', token: 'spotify', label: 'Spotify' },
  { id: 'lever-toptal', ats: 'lever', token: 'toptal', label: 'Toptal' }
];

const ATS_ENDPOINTS = {
  greenhouse: (token) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=false`,
  lever: (token) => `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`,
  ashby: (token) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}`
};

/** Turn the ATS board list into fetchable job sources. */
const ATS_SOURCES = ATS_BOARDS.map((board) => ({
  id: board.id,
  ats: board.ats,
  label: `${board.label} careers`,
  kind: 'json',
  searchable: false,
  url: () => ATS_ENDPOINTS[board.ats](board.token),
  pick: (payload) => pickAtsJobs(board.ats, payload)
}));

function pickAtsJobs(ats, payload) {
  if (!payload || typeof payload !== 'object') return [];

  switch (ats) {
    case 'greenhouse':
      return Array.isArray(payload.jobs) ? payload.jobs : [];
    case 'lever':
      return Array.isArray(payload) ? payload : [];
    case 'ashby':
      return Array.isArray(payload.jobs) ? payload.jobs : [];
    default:
      return [];
  }
}

const ALL_JOB_SOURCES = [...JOB_BOARD_SOURCES, ...ATS_SOURCES];

const JOB_BOARD_IDS = ALL_JOB_SOURCES.map((source) => source.id);

/** Which normalizer a source id maps to (ATS boards share per-vendor shapes). */
const SOURCE_SHAPE = new Map(ALL_JOB_SOURCES.map((source) => [source.id, source.ats || source.id]));

/** Sources that need a keyword in the request. */
const SEARCHABLE_JOB_SOURCES = ALL_JOB_SOURCES.filter((source) => source.searchable);

/** Sources polled once per run and filtered locally. */
const GENERAL_JOB_SOURCES = ALL_JOB_SOURCES.filter((source) => !source.searchable);

/** True when every environment variable the source needs is present. */
function isSourceAvailable(source, env) {
  if (!source.requiresEnv || source.requiresEnv.length === 0) return true;
  return source.requiresEnv.every((name) => Boolean(env && env[name]));
}

/**
 * Split sources into the ones usable with this environment and the ones that
 * were skipped for want of a key, so the fetcher can report both.
 */
function resolveJobSources(sources, env) {
  const available = [];
  const skipped = [];

  for (const source of sources) {
    if (isSourceAvailable(source, env)) available.push(source);
    else skipped.push(source);
  }

  return { available, skipped };
}

const ENTITIES = {
  '&amp;': '&',
  '&#39;': "'",
  '&apos;': "'",
  '&quot;': '"',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' '
};

/** Strip tags and collapse whitespace, so job descriptions stay readable. */
function cleanText(value) {
  return String(value == null ? '' : value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:amp|#39|apos|quot|lt|gt|nbsp);/g, (entity) => ENTITIES[entity] || ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalise a string for keyword matching: hyphens, slashes and case. */
function matchableText(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * True when any term appears in the text. Multi-word terms survive hyphens and
 * extra spacing ("Full-Stack" matches "full stack").
 */
function matchesJobTerms(text, terms = []) {
  const haystack = ` ${matchableText(text)} `;
  return terms.some((term) => {
    const needle = matchableText(term);
    return needle.length > 0 && haystack.includes(` ${needle} `);
  });
}

function buildSummary(parts) {
  const text = parts.filter(Boolean).join(' • ');
  const cleaned = cleanText(text);
  return cleaned.length > 0 ? cleaned.slice(0, 280) : 'No summary available.';
}

function salaryRange(min, max, currency = '') {
  const low = Number(min) || 0;
  const high = Number(max) || 0;
  if (!low && !high) return '';
  const fmt = (value) => (value ? `${currency}${Math.round(value / 1000)}k` : '');
  if (low && high) return `${fmt(low)}-${fmt(high)}`;
  return fmt(low || high);
}

const JSON_NORMALIZERS = {
  remotive(job) {
    return {
      title: cleanText(job.title),
      link: cleanText(job.url),
      sourceLabel: `Remotive • ${cleanText(job.company_name)}`,
      date: job.publication_date,
      summary: buildSummary([
        job.candidate_required_location,
        cleanText(job.job_type).replace('_', ' '),
        job.description
      ])
    };
  },

  jobicy(job) {
    return {
      title: cleanText(job.jobTitle),
      link: cleanText(job.url),
      sourceLabel: `Jobicy • ${cleanText(job.companyName)}`,
      date: job.pubDate,
      summary: buildSummary([
        cleanText(job.jobGeo),
        Array.isArray(job.jobType) ? job.jobType.join(', ') : job.jobType,
        job.jobExcerpt || job.jobDescription
      ])
    };
  },

  remoteok(job) {
    // The first entry of the Remote OK payload is a legal notice, not a job.
    if (!job || !job.position) return null;

    return {
      title: cleanText(job.position),
      link: cleanText(job.apply_url || job.url),
      sourceLabel: `Remote OK • ${cleanText(job.company)}`,
      date: job.date,
      summary: buildSummary([
        cleanText(job.location),
        salaryRange(job.salary_min, job.salary_max, '$'),
        job.description
      ])
    };
  },

  adzuna(job) {
    return {
      title: cleanText(job.title),
      link: cleanText(job.redirect_url),
      sourceLabel: `Adzuna • ${cleanText(job.company && job.company.display_name)}`,
      date: job.created,
      summary: buildSummary([
        cleanText(job.location && job.location.display_name),
        cleanText(job.contract_time) || cleanText(job.contract_type),
        job.description
      ])
    };
  },

  jooble(job) {
    return {
      title: cleanText(job.title),
      link: cleanText(job.link),
      sourceLabel: `Jooble • ${cleanText(job.company)}`,
      date: job.updated,
      summary: buildSummary([cleanText(job.location), cleanText(job.type), job.snippet])
    };
  },

  themuse(job) {
    const locations = Array.isArray(job.locations)
      ? job.locations.map((entry) => cleanText(entry && entry.name)).filter(Boolean).join(', ')
      : '';

    return {
      title: cleanText(job.name),
      link: cleanText(job.refs && job.refs.landing_page),
      sourceLabel: `The Muse • ${cleanText(job.company && job.company.name)}`,
      date: job.publication_date,
      summary: buildSummary([locations, job.contents])
    };
  },

  greenhouse(job) {
    return {
      title: cleanText(job.title),
      link: cleanText(job.absolute_url),
      date: job.updated_at,
      summary: buildSummary([cleanText(job.location && job.location.name), job.content])
    };
  },

  lever(job) {
    const categories = job.categories || {};

    return {
      title: cleanText(job.text),
      link: cleanText(job.hostedUrl),
      date: job.createdAt ? new Date(Number(job.createdAt)).toISOString() : undefined,
      summary: buildSummary([
        cleanText(categories.location),
        cleanText(categories.team),
        cleanText(categories.commitment),
        job.descriptionPlain || job.description
      ])
    };
  },

  ashby(job) {
    return {
      title: cleanText(job.title),
      link: cleanText(job.jobUrl),
      date: job.publishedAt,
      summary: buildSummary([
        cleanText(job.location),
        cleanText(job.employmentType),
        job.descriptionPlain || job.descriptionHtml
      ])
    };
  }
};

const RSS_NORMALIZERS = {
  weworkremotely(item) {
    // We Work Remotely titles look like "Company: Job Title".
    const raw = cleanText(item.title);
    const separator = raw.indexOf(':');
    const company = separator > 0 ? raw.slice(0, separator).trim() : '';
    const title = separator > 0 ? raw.slice(separator + 1).trim() : raw;

    return {
      title,
      link: cleanText(item.link),
      sourceLabel: company ? `We Work Remotely • ${company}` : 'We Work Remotely',
      date: item.isoDate || item.pubDate,
      summary: buildSummary([item.contentSnippet || item.summary || item.content])
    };
  },

  himalayas(item) {
    return {
      title: cleanText(item.title),
      link: cleanText(item.link),
      sourceLabel: 'Himalayas',
      date: item.isoDate || item.pubDate,
      summary: buildSummary([item.contentSnippet || item.summary || item.content])
    };
  }
};

/**
 * Convert a raw source record into the article shape used everywhere else.
 * Returns null when the record is not a usable job posting.
 */
function normalizeJobPosting(sourceId, raw, fallbackDate) {
  const normalize = JSON_NORMALIZERS[SOURCE_SHAPE.get(sourceId) || sourceId];
  if (!normalize) return null;

  const job = normalize(raw);
  return finalize(sourceId, job, fallbackDate);
}

/** Convert an RSS entry from a job board into the article shape. */
function normalizeRssJobPosting(sourceId, item, fallbackDate) {
  const normalize = RSS_NORMALIZERS[sourceId];
  if (!normalize) return null;

  const job = normalize(item);
  return finalize(sourceId, job, fallbackDate);
}

/**
 * Source label prefixes mapped to a board id. Derived from the source
 * definitions, so a new board is recognised automatically. Longest label
 * first, so a longer label cannot be shadowed by a shorter prefix of another.
 */
const SOURCE_LABEL_IDS = Object.fromEntries(
  ALL_JOB_SOURCES
    .map((source) => [source.label, source.id])
    .sort((a, b) => b[0].length - a[0].length)
);

/**
 * Infer a posting's board from its stored source label ("Jobicy • Acme").
 *
 * Articles archived before job boards were introduced (or postings that have
 * since dropped out of the feed) carry no marker, so the label is the only
 * signal that they are postings rather than editorial stories.
 */
function jobBoardFromSourceLabel(source) {
  const label = String(source == null ? '' : source);
  const prefix = Object.keys(SOURCE_LABEL_IDS).find((name) => label.startsWith(name));
  return prefix ? SOURCE_LABEL_IDS[prefix] : '';
}

/** The label written into frontmatter for a board id. */
const SOURCE_LABELS = new Map(ALL_JOB_SOURCES.map((source) => [source.id, source.label]));

function finalize(sourceId, job, fallbackDate) {
  if (!job || !job.title || !job.link) return null;

  return {
    title: job.title,
    link: job.link,
    // Vendor adapters set a rich label ("Jobicy • Acme"); company boards fall
    // back to their board definition ("GitLab careers").
    source: job.sourceLabel || SOURCE_LABELS.get(sourceId) || sourceId,
    // Job boards often omit a date; fall back to the run timestamp.
    date: job.date || fallbackDate,
    summary: job.summary || 'No summary available.',
    jobBoard: sourceId
  };
}

module.exports = {
  JOB_BOARD_SOURCES,
  ATS_BOARDS,
  ATS_SOURCES,
  ALL_JOB_SOURCES,
  JOB_BOARD_IDS,
  SOURCE_LABEL_IDS,
  SEARCHABLE_JOB_SOURCES,
  GENERAL_JOB_SOURCES,
  isSourceAvailable,
  resolveJobSources,
  cleanText,
  matchableText,
  matchesJobTerms,
  jobBoardFromSourceLabel,
  normalizeJobPosting,
  normalizeRssJobPosting
};
