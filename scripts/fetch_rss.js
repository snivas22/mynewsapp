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
    'https://www.theguardian.com/science/rss'
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

function dedupeArticles(items) {
  const seen = new Map();
  for (const entry of items) {
    if (!entry || !entry.link || !entry.title) continue;
    const key = `${entry.link}|${entry.title}`;
    if (!seen.has(key)) seen.set(key, entry);
  }
  return Array.from(seen.values());
}

async function fetchAndWrite() {
  const articlesDir = path.join(__dirname, '..', 'src', 'articles');
  fs.mkdirSync(articlesDir, { recursive: true });

  for (const category of Object.keys(feedsByCategory)) {
    const categoryDir = path.join(articlesDir, category);
    fs.rmSync(categoryDir, { recursive: true, force: true });
    fs.mkdirSync(categoryDir, { recursive: true });
  }

  for (const [category, feeds] of Object.entries(feedsByCategory)) {
    const categoryDir = path.join(articlesDir, category);
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

          collected.push({
            title,
            link,
            source,
            date,
            category,
            summary
          });
        }
      } catch (err) {
        console.error(`Failed to fetch ${feedUrl}:`, err.message);
      }
    }

    const uniqueArticles = dedupeArticles(collected).slice(0, 15);
    let count = 0;

    for (const article of uniqueArticles) {
      const slug = slugify(`${article.title}-${article.link}`);
      const filename = path.join(categoryDir, `${slug}.md`);
      const body = article.summary ? article.summary : 'No summary available.';
      const md = `---\ntitle: "${escapeFrontmatter(article.title)}"\ndate: "${article.date}"\ncategory: "${article.category}"\nsource: "${escapeFrontmatter(article.source)}"\noriginal_link: "${escapeFrontmatter(article.link)}"\n---\n\n${body}\n\n[Read original article](${article.link})\n`;

      fs.writeFileSync(filename, md, 'utf8');
      count++;
    }

    console.log(`Wrote ${count} articles for category ${category}`);
  }
}

fetchAndWrite().catch(err => {
  console.error(err);
  process.exit(1);
});
