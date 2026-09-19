'use strict';

/**
 * Job-board integration.
 *
 * Only sources that publish a documented feed or public API are used. Sites
 * such as LinkedIn, Indeed and Naukri have no public feed and prohibit
 * scraping, so they are deliberately not included.
 *
 * Everything here is pure so it can be unit tested without network access.
 * `scripts/fetch_rss.js` does the fetching and merging.
 */

/**
 * Only sources whose keyword query is actually honoured are `searchable`.
 * Jobicy tags work; Remotive's `search` param, Arbeitnow's `search` and
 * Remote OK's `tag` all return unfiltered lists, so those are polled once and
 * filtered locally instead.
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
  }
];

const JOB_BOARD_IDS = JOB_BOARD_SOURCES.map((source) => source.id);

/** Sources that need a keyword in the request URL. */
const SEARCHABLE_JOB_SOURCES = JOB_BOARD_SOURCES.filter((source) => source.searchable);

/** Sources polled once per run and filtered locally. */
const GENERAL_JOB_SOURCES = JOB_BOARD_SOURCES.filter((source) => !source.searchable);

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
  const normalize = JSON_NORMALIZERS[sourceId];
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
 * Infer a posting's board from its stored source label ("Jobicy • Acme").
 *
 * Articles archived before job boards were introduced (or postings that have
 * since dropped out of the feed) carry no marker, so the label is the only
 * signal that they are postings rather than editorial stories.
 */
function jobBoardFromSourceLabel(source) {
  const label = String(source == null ? '' : source);
  const match = JOB_BOARD_SOURCES.find((board) => label.startsWith(board.label));
  return match ? match.id : '';
}

function finalize(sourceId, job, fallbackDate) {
  if (!job || !job.title || !job.link) return null;

  return {
    title: job.title,
    link: job.link,
    source: job.sourceLabel,
    // Job boards often omit a date; fall back to the run timestamp.
    date: job.date || fallbackDate,
    summary: job.summary || 'No summary available.',
    jobBoard: sourceId
  };
}

module.exports = {
  JOB_BOARD_SOURCES,
  JOB_BOARD_IDS,
  SEARCHABLE_JOB_SOURCES,
  GENERAL_JOB_SOURCES,
  cleanText,
  matchableText,
  matchesJobTerms,
  jobBoardFromSourceLabel,
  normalizeJobPosting,
  normalizeRssJobPosting
};
