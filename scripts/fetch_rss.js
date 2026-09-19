const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const { parseFrontmatter, serializeFrontmatter } = require('./lib/frontmatter');
const {
  GENERAL_JOB_SOURCES,
  SEARCHABLE_JOB_SOURCES,
  matchesJobTerms,
  jobBoardFromSourceLabel,
  resolveJobSources,
  normalizeJobPosting,
  normalizeRssJobPosting
} = require('./lib/jobs');
const { SUB_CATEGORIES } = require('./lib/articles');

const parser = new Parser();

const feedsByCategory = {
  politics: [
    'https://feeds.bbci.co.uk/news/politics/rss.xml',
    'https://www.theguardian.com/politics/rss',
    'https://feeds.npr.org/1014/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml'
  ],
  world: [
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.theguardian.com/world/rss',
    'https://feeds.npr.org/1001/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml'
  ],
  business: [
    'https://feeds.bbci.co.uk/news/business/rss.xml',
    'https://www.theguardian.com/business/rss',
    'https://feeds.npr.org/1006/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml'
  ],
  technology: [
    'https://feeds.bbci.co.uk/news/technology/rss.xml',
    'https://www.theguardian.com/technology/rss',
    'https://feeds.npr.org/1019/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml'
  ],
  sports: [
    'https://feeds.bbci.co.uk/sport/rss.xml?edition=uk',
    'https://www.theguardian.com/sport/rss',
    'https://feeds.npr.org/1045/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml'
  ],
  entertainment: [
    'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml',
    'https://www.theguardian.com/film/rss',
    'https://www.theguardian.com/music/rss',
    'https://www.aljazeera.com/xml/rss/all.xml'
  ],
  science: [
    'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
    'https://www.theguardian.com/science/rss',
    'https://feeds.npr.org/1007/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml'
  ],
  health: [
    'https://feeds.bbci.co.uk/news/health/rss.xml',
    'https://www.theguardian.com/lifeandstyle/health-and-wellbeing/rss',
    'https://feeds.npr.org/1128/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml'
  ],
  'ai-trends': [
    'https://feeds.bbci.co.uk/news/technology/rss.xml',
    'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
    'https://www.theguardian.com/technology/rss',
    'https://www.theguardian.com/science/rss',
    'https://www.theguardian.com/uk-news/rss'
  ],
  india: [
    'https://news.google.com/rss/search?q=India+news&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=India+government+news&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=India+business+news&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=India+technology+news&hl=en-IN&gl=IN&ceid=IN:en'
  ],
  'andhra-pradesh': [
    'https://news.google.com/rss/search?q=Andhra+Pradesh+news&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=Vijayawada+news&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=Visakhapatnam+news&hl=en-IN&gl=IN&ceid=IN:en'
  ],
  telangana: [
    'https://news.google.com/rss/search?q=Telangana+news&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=Hyderabad+Telangana+news&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=Warangal+news&hl=en-IN&gl=IN&ceid=IN:en'
  ],
  hyderabad: [
    'https://news.google.com/rss/search?q=Hyderabad+news&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=Hyderabad+city+news&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=GHMC+Hyderabad+news&hl=en-IN&gl=IN&ceid=IN:en'
  ],
  'daily-briefing': [
    'https://news.google.com/rss/search?q=India+daily+briefing&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=Hyderabad+daily+briefing&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=Telangana+daily+briefing&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=Andhra+Pradesh+daily+briefing&hl=en-IN&gl=IN&ceid=IN:en'
  ],
  // Sub-categories of the daily briefing: live job-market news for Java roles.
  'java-developer-jobs': [
    'https://news.google.com/rss/search?q=Java+developer+jobs&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=Java+developer+hiring+India&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=Java+developer+job+openings&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=Java+developer+vacancy+Hiring&hl=en-IN&gl=IN&ceid=IN:en'
  ],
  'java-full-stack-jobs': [
    'https://news.google.com/rss/search?q=Java+full+stack+developer+jobs&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=Java+full+stack+developer+hiring&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=Full+stack+Java+developer+openings&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=Java+full+stack+engineer+job&hl=en-IN&gl=IN&ceid=IN:en'
  ],
  'it-jobs': [
    'https://news.google.com/rss/search?q=IT+jobs+India&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=software+engineer+jobs+India&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=IT+hiring+India&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=tech+jobs+India&hl=en-IN&gl=IN&ceid=IN:en'
  ],
  'freshers-jobs': [
    'https://news.google.com/rss/search?q=freshers+jobs+India&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=entry+level+jobs+India&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=graduate+hiring+India&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=internship+India&hl=en-IN&gl=IN&ceid=IN:en'
  ],
  'government-jobs': [
    'https://news.google.com/rss/search?q=government+jobs+India&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=government+job+notification&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=public+sector+jobs+India&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=sarkari+naukri+notification&hl=en-IN&gl=IN&ceid=IN:en'
  ],
  'hyderabad-jobs': [
    'https://news.google.com/rss/search?q=Hyderabad+jobs&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=Hyderabad+hiring&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=Hyderabad+IT+jobs&hl=en-IN&gl=IN&ceid=IN:en',
    'https://news.google.com/rss/search?q=Hyderabad+walk+in+drives&hl=en-IN&gl=IN&ceid=IN:en'
  ],
  favourites: []
};

/**
 * Real job postings merged into the job sub-categories from public job boards.
 *
 * `tags` are sent to the tag-based source. `match` terms are applied to every
 * posting (including tag results, which are only loosely related) before it is
 * accepted. Postings are claimed by the first section that matches, so nothing
 * is listed twice.
 */
const jobBoardsByCategory = {
  'java-developer-jobs': { tags: ['java'], match: ['java'] },
  'java-full-stack-jobs': { tags: ['full-stack'], match: ['full stack', 'fullstack'] },
  'it-jobs': { tags: ['devops', 'python', 'javascript'], match: ['engineer', 'developer', 'devops', 'programmer'] },
  'freshers-jobs': { tags: ['entry-level'], match: ['fresher', 'entry level', 'graduate', 'intern', 'junior', 'trainee'] }
};

// Categories whose feed URL itself identifies the region, so the region is read
// from the source before falling back to keyword matching on the headline.
const REGIONAL_SOURCE_CATEGORIES = [
  'daily-briefing',
  'java-developer-jobs',
  'java-full-stack-jobs',
  'it-jobs',
  'freshers-jobs',
  'government-jobs',
  'hyderabad-jobs',
  'india',
  'andhra-pradesh',
  'telangana',
  'hyderabad'
];

function slugify(s) {
  return s
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 120);
}

function normalizeRegionToken(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'global';

  const normalized = raw
    .replace(/&/g, ' and ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const aliases = {
    'united kingdom': 'uk',
    'uk': 'uk',
    'usa': 'us',
    'united states': 'us',
    'us': 'us',
    'india': 'india',
    'andhra pradesh': 'andhra-pradesh',
    'andhra': 'andhra-pradesh',
    'telangana': 'telangana',
    'hyderabad': 'hyderabad',
    'australia': 'australia',
    'uae': 'uae',
    'united arab emirates': 'uae',
    'dubai': 'uae',
    'abu dhabi': 'uae'
  };

  return aliases[normalized] || normalized.replace(/\s+/g, '-');
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function fetchWithRetry(url, attempts = 3, timeoutMs = 20000, init = {}) {
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; news-aggregator/1.0; +https://github.com/snivas22/mynewsapp)',
          'Accept': 'application/rss+xml, application/xml, text/xml, application/json, text/html;q=0.9, */*;q=0.8',
          ...(init.headers || {})
        }
      });
      clearTimeout(id);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text || text.trim().length < 20) throw new Error('empty response');
      return text;
    } catch (err) {
      clearTimeout(id);
      if (i === attempts - 1) throw err;
      const delay = 1000 * Math.pow(2, i);
      console.warn(`Attempt ${i + 1} failed for ${url}: ${err.message}. Retrying in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

function matchesAITrend(text) {
  if (!text) return false;
  const haystack = text.toLowerCase();

  const aiMarkers = [
    'artificial intelligence', 'ai ', 'ai.', 'ai,', 'machine learning', 'deep learning',
    'large language model', 'llm', 'gpt', 'chatgpt', 'openai', 'anthropic', 'nvidia',
    'gpu', 'chip', 'semiconductor', 'data centre', 'datacentre', 'robotics', 'humanoid',
    'voice cloning', 'deepfake', 'genai', 'generative ai', 'cybersecurity', 'cyber security',
    'automation', 'algorithmic', 'startup', 'ai model', 'ai regulation', 'ai safety', 'ai risk',
    'meta', 'google', 'microsoft', 'apple', 'software', 'digital platform', 'telecoms', 'platform', 'model launch'
  ];

  const nonAiMarkers = [
    'weather', 'storm', 'rain', 'flood', 'election', 'football', 'sport', 'climate',
    'government', 'minister', 'parliament', 'crime', 'bank', 'health', 'hospital', 'medical',
    'music', 'film', 'festival', 'celebrity', 'travel', 'migrant', 'ukraine', 'war', 'tiktok'
  ];

  const hasAi = aiMarkers.some(marker => haystack.includes(marker));
  const hasNonAi = nonAiMarkers.some(marker => haystack.includes(marker));
  return hasAi && !hasNonAi;
}

function resolveArticleCountry(category, feedUrl, title, summary) {
  const urlValue = String(feedUrl || '').toLowerCase();
  const textValue = String(`${title || ''} ${summary || ''}`).toLowerCase();
  const haystack = `${textValue} ${urlValue}`.toLowerCase();

  const regionalPriority = [
    ['hyderabad', /(hyderabad|secunderabad|begumpet|charminar|ghmc|hyderabad city)/],
    ['telangana', /(telangana|warangal|nizamabad|rangareddy|ghmc|secunderabad)/],
    ['andhra-pradesh', /(andhra pradesh|andhra|vijayawada|amaravati|visakhapatnam|guntur|nellore)/],
    ['india', /(\bindia\b|mumbai|delhi|modi|bengaluru|new delhi|gujarat|bangalore|india's)/]
  ];

  if (REGIONAL_SOURCE_CATEGORIES.includes(category)) {
    const sourceRegion = [
      ['hyderabad', /hyderabad/],
      ['telangana', /telangana/],
      ['andhra-pradesh', /andhra\s*pradesh|andhra/],
      ['india', /india/]
    ].find(([_, regex]) => regex.test(urlValue) || regex.test(textValue));

    if (sourceRegion) {
      const [region] = sourceRegion;
      if (region === 'hyderabad' && urlValue.includes('telangana')) return 'telangana';
      if (region === 'telangana' && urlValue.includes('hyderabad') && category === 'hyderabad') return 'hyderabad';
      return region;
    }

    for (const [region, regex] of regionalPriority) {
      if (regex.test(haystack)) return region;
    }
  }

  const countryChecks = [
    ['uk', /(uk|united kingdom|britain|england|scotland|wales|northern ireland|london|parliament|government|westminster|downing street|brexit)/],
    ['us', /(us|united states|usa|washington|california|texas|new york|washington dc|federal|congress|white house|senate)/],
    ['australia', /(australia|sydney|melbourne|canberra|australian|queensland|nsw|victoria)/],
    ['uae', /(uae|dubai|abu dhabi|emirates|united arab emirates|sharjah|ajman|ras al khaimah)/]
  ];

  for (const [country, regex] of countryChecks) {
    if (regex.test(haystack)) return country;
  }

  return 'global';
}

function inferCountry(text, source, url) {
  return resolveArticleCountry('global', url, text, source);
}

function dedupeArticles(items) {
  const seen = new Map();
  for (const entry of items) {
    if (!entry || !entry.link || !entry.title) continue;
    const key = `${entry.link}|${entry.title}`;
    if (!seen.has(key)) seen.set(key, entry);
  }
  return Array.from(seen.values());
}

function mergeCategoryArticles(existing = [], incoming = [], limit = 80) {
  const merged = new Map();

  for (const article of [...existing, ...incoming]) {
    if (!article || !article.link || !article.title) continue;
    const key = `${article.link}|${article.title}`;

    // A freshly fetched copy refreshes the stored one instead of being dropped,
    // so new fields (such as the job-board marker) survive the markdown
    // round-trip. Order is re-established by the sort below.
    merged.set(key, {
      ...(merged.get(key) || {}),
      ...article,
      country: normalizeRegionToken(article.country || article.region || 'global')
    });
  }

  return Array.from(merged.values())
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, limit);
}

function readExistingCategoryArticles(categoryDir) {
  if (!fs.existsSync(categoryDir)) return [];

  return fs.readdirSync(categoryDir)
    .filter(file => file.endsWith('.md'))
    .map((file) => {
      const fullPath = path.join(categoryDir, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      const { data } = parseFrontmatter(content);
      if (!data || Object.keys(data).length === 0) return null;

      const title = cleanText(data.title || file.replace(/\.md$/, '').replace(/-/g, ' '));
      const link = cleanText(data.original_link || '#');
      const source = cleanText(data.source || 'Open source feed');
      const date = data.date || new Date().toISOString();
      const country = normalizeRegionToken(data.country || 'global');

      return { title, link, source, date, country, category: data.category || 'general', jobBoard: data.job_board || jobBoardFromSourceLabel(source) };
    })
    .filter(Boolean);
}

/** Parse a job-board payload (JSON API or RSS feed) into article-shaped postings. */
async function parseJobBoardPayload(source, text, fallbackDate) {
  if (source.kind === 'json') {
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (err) {
      console.warn(`Job source ${source.id} returned invalid JSON: ${err.message}`);
      return [];
    }

    return source
      .pick(payload)
      .map((raw) => normalizeJobPosting(source.id, raw, fallbackDate))
      .filter(Boolean);
  }

  const feed = await parser.parseString(text);
  const items = Array.isArray(feed.items) ? feed.items : [];
  return items
    .map((item) => normalizeRssJobPosting(source.id, item, fallbackDate))
    .filter(Boolean);
}

/** Build the request for a job source. Jooble needs a POST with a JSON body. */
function jobSourceRequest(source, term, env) {
  if (source.method === 'POST') {
    return {
      url: source.url(term, env),
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: source.body ? source.body(term, env) : undefined
      }
    };
  }

  return { url: source.url(term, env), init: {} };
}

/**
 * Poll every job board once per run. Searchable sources are queried once per
 * unique keyword and the results are reused across categories. Sources whose
 * API key is missing from the environment are reported and skipped.
 */
async function fetchJobBoardCache(env = process.env) {
  const fallbackDate = new Date().toISOString();
  const general = new Map();
  const searchable = new Map();

  const generalSources = resolveJobSources(GENERAL_JOB_SOURCES, env);
  const searchableSources = resolveJobSources(SEARCHABLE_JOB_SOURCES, env);

  for (const source of [...generalSources.skipped, ...searchableSources.skipped]) {
    console.log(`Job board ${source.label}: skipped, set ${source.requiresEnv.join(', ')} to enable`);
  }

  for (const source of generalSources.available) {
    try {
      const request = jobSourceRequest(source, undefined, env);
      const text = await fetchWithRetry(request.url, 2, 20000, request.init);
      const postings = await parseJobBoardPayload(source, text, fallbackDate);
      general.set(source.id, postings);
      console.log(`Job board ${source.label}: ${postings.length} postings`);
    } catch (err) {
      console.warn(`Job board ${source.label} failed: ${err.message}`);
      general.set(source.id, []);
    }
  }

  const terms = [...new Set(Object.values(jobBoardsByCategory).flatMap((config) => config.tags))];

  for (const source of searchableSources.available) {
    for (const term of terms) {
      try {
        const request = jobSourceRequest(source, term, env);
        const text = await fetchWithRetry(request.url, 2, 20000, request.init);
        const postings = await parseJobBoardPayload(source, text, fallbackDate);
        searchable.set(`${source.id}:${term}`, postings);
        console.log(`Job board ${source.label} (${term}): ${postings.length} postings`);
      } catch (err) {
        console.warn(`Job board ${source.label} (${term}) failed: ${err.message}`);
        searchable.set(`${source.id}:${term}`, []);
      }
    }
  }

  return { general, searchable };
}

/**
 * Postings for one category. Query results are often only loosely related, so
 * every posting is filtered by the category's `match` terms.
 */
function collectJobPostingsForCategory(cache, config, claimed = new Set()) {
  const accepted = [];

  // General feeds are unfiltered, so a posting must name the keyword in its
  // title to stay relevant. Tag queries already filtered server-side, so a hit
  // anywhere in the posting is good enough.
  const matchesTitle = (job) => matchesJobTerms(job.title, config.match);
  const matchesPosting = (job) => matchesJobTerms(`${job.title} ${job.summary}`, config.match);

  for (const postings of cache.general.values()) {
    accepted.push(...postings.filter(matchesTitle));
  }

  for (const tag of config.tags) {
    for (const source of SEARCHABLE_JOB_SOURCES) {
      const postings = cache.searchable.get(`${source.id}:${tag}`) || [];
      accepted.push(...postings.filter(matchesPosting));
    }
  }

  return dedupeArticles(accepted).filter((job) => !claimed.has(job.link));
}

async function fetchAndWrite() {
  const articlesDir = path.join(__dirname, '..', 'src', 'articles');
  fs.mkdirSync(articlesDir, { recursive: true });

  for (const category of Object.keys(feedsByCategory)) {
    const categoryDir = path.join(articlesDir, category);
    fs.mkdirSync(categoryDir, { recursive: true });
  }

  const jobBoardCache = Object.keys(jobBoardsByCategory).length > 0
    ? await fetchJobBoardCache()
    : { general: new Map(), searchable: new Map() };

  // Sub-category sections sit side by side, so a story claimed by an earlier
  // (more specific) section must not be repeated in a later one.
  const claimedSubCategoryLinks = new Set();

  for (const [category, feeds] of Object.entries(feedsByCategory)) {
    const categoryDir = path.join(articlesDir, category);
    const existingArticles = readExistingCategoryArticles(categoryDir);
    const collected = [];

    for (const feedUrl of feeds) {
      try {
        const text = await fetchWithRetry(feedUrl, 3, 20000);
        const feed = await parser.parseString(text);
        const items = Array.isArray(feed.items) ? feed.items : [];

        for (const item of items.slice(0, 8)) {
          const title = cleanText(item.title || 'Untitled');
          const link = cleanText(item.link || item.guid || '');
          const source = cleanText(feed.title || item.source || 'Open source feed');
          const date = item.isoDate || item.pubDate || new Date().toISOString();
          const summary = cleanText(item.contentSnippet || item.summary || item.content || '');

          if (!title || !link) continue;

          const country = resolveArticleCountry(category, feedUrl, title, summary);

          const shouldKeep = category === 'ai-trends'
            ? matchesAITrend(`${title} ${summary}`)
            : true;

          if (!shouldKeep) continue;

          collected.push({
            title,
            link,
            source,
            date,
            category,
            summary,
            country
          });
        }
      } catch (err) {
        console.error(`Failed to fetch ${feedUrl}:`, err.message);
      }
    }

    const jobConfig = jobBoardsByCategory[category];
    if (jobConfig) {
      const postings = collectJobPostingsForCategory(jobBoardCache, jobConfig, claimedSubCategoryLinks);

      for (const posting of postings) {
        collected.push({
          title: posting.title,
          link: posting.link,
          source: posting.source,
          date: posting.date,
          category,
          summary: posting.summary,
          jobBoard: posting.jobBoard,
          country: resolveArticleCountry(category, posting.link, posting.title, posting.summary)
        });
      }

      console.log(`  job boards contributed ${postings.length} postings to ${category}`);
    }

    if (SUB_CATEGORIES.includes(category)) {
      const seen = new Set();
      const unique = [];

      for (const entry of collected) {
        if (!entry.link || claimedSubCategoryLinks.has(entry.link) || seen.has(entry.link)) continue;
        seen.add(entry.link);
        unique.push(entry);
      }

      collected.length = 0;
      collected.push(...unique);

      for (const entry of unique) claimedSubCategoryLinks.add(entry.link);
    }

    const mergedArticles = mergeCategoryArticles(existingArticles, dedupeArticles(collected), category === 'favourites' ? 40 : 120);
    let count = 0;

    for (const article of mergedArticles) {
      const slug = slugify(`${article.title}-${article.link}`);
      const filename = path.join(categoryDir, `${slug}.md`);
      const body = `${article.summary || 'No summary available.'}\n\n[Read original article](${article.link})`;
      const frontmatter = {
        title: article.title,
        date: article.date,
        category: article.category,
        source: article.source,
        original_link: article.link,
        country: normalizeRegionToken(article.country || 'global')
      };

      // Marks a posting as coming from a job board, so job sections can mix
      // postings with editorial stories instead of newest-wins ordering.
      if (article.jobBoard) frontmatter.job_board = article.jobBoard;

      const md = serializeFrontmatter(frontmatter, body);

      fs.writeFileSync(filename, md, 'utf8');
      count++;
    }

    const validSlugs = new Set(mergedArticles.map(article => slugify(`${article.title}-${article.link}`)));
    fs.readdirSync(categoryDir)
      .filter(file => file.endsWith('.md'))
      .filter(file => !validSlugs.has(file.replace(/\.md$/, '')))
      .forEach(file => fs.unlinkSync(path.join(categoryDir, file)));

    console.log(`Wrote ${count} articles for category ${category}`);
  }
}

if (require.main === module) {
  fetchAndWrite().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  feedsByCategory,
  jobBoardsByCategory,
  REGIONAL_SOURCE_CATEGORIES,
  collectJobPostingsForCategory,
  normalizeRegionToken,
  mergeCategoryArticles,
  resolveArticleCountry,
  inferCountry,
  fetchAndWrite
};
