const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

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
  favourites: []
};

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

function escapeFrontmatter(value) {
  return String(value || '').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
}

async function fetchWithRetry(url, attempts = 3, timeoutMs = 20000) {
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; news-aggregator/1.0; +https://github.com/snivas22/mynewsapp)',
          'Accept': 'application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8'
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

  if (category === 'daily-briefing' || category === 'india' || category === 'andhra-pradesh' || category === 'telangana' || category === 'hyderabad') {
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
    if (!merged.has(key)) {
      merged.set(key, {
        ...article,
        country: normalizeRegionToken(article.country || article.region || 'global')
      });
    }
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
      const match = content.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/);
      if (!match) return null;

      const data = {};
      for (const line of match[1].split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf(':');
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        data[key] = value.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
      }

      const title = cleanText(data.title || file.replace(/\.md$/, '').replace(/-/g, ' '));
      const link = cleanText(data.original_link || '#');
      const source = cleanText(data.source || 'Open source feed');
      const date = data.date || new Date().toISOString();
      const country = normalizeRegionToken(data.country || 'global');

      return { title, link, source, date, country, category: data.category || 'general' };
    })
    .filter(Boolean);
}

async function fetchAndWrite() {
  const articlesDir = path.join(__dirname, '..', 'src', 'articles');
  fs.mkdirSync(articlesDir, { recursive: true });

  for (const category of Object.keys(feedsByCategory)) {
    const categoryDir = path.join(articlesDir, category);
    fs.mkdirSync(categoryDir, { recursive: true });
  }

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

    const mergedArticles = mergeCategoryArticles(existingArticles, dedupeArticles(collected), category === 'favourites' ? 40 : 120);
    let count = 0;

    for (const article of mergedArticles) {
      const slug = slugify(`${article.title}-${article.link}`);
      const filename = path.join(categoryDir, `${slug}.md`);
      const body = article.summary || 'No summary available.';
      const md = `---\ntitle: "${escapeFrontmatter(article.title)}"\ndate: "${article.date}"\ncategory: "${article.category}"\nsource: "${escapeFrontmatter(article.source)}"\noriginal_link: "${escapeFrontmatter(article.link)}"\ncountry: "${escapeFrontmatter(normalizeRegionToken(article.country || 'global'))}"\n---\n\n${body}\n\n[Read original article](${article.link})\n`;

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
  normalizeRegionToken,
  mergeCategoryArticles,
  resolveArticleCountry,
  inferCountry,
  fetchAndWrite
};
