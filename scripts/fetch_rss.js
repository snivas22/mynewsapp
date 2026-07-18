const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new Parser();

const feedsByCategory = {
  politics: [
    'https://feeds.bbci.co.uk/news/politics/rss.xml',
    'https://www.theguardian.com/politics/rss'
  ],
  world: [
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://rss.cnn.com/rss/edition_world.rss'
  ],
  business: [
    'https://feeds.bbci.co.uk/news/business/rss.xml',
    'https://rss.cnn.com/rss/edition_business.rss'
  ],
  technology: [
    'https://feeds.bbci.co.uk/news/technology/rss.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml'
  ],
  sports: [
    'https://feeds.bbci.co.uk/sport/rss.xml?edition=uk',
    'https://rss.cnn.com/rss/edition_sport.rss'
  ],
  entertainment: [
    'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml'
  ],
  science: [
    'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml'
  ],
  health: [
    'https://feeds.bbci.co.uk/news/health/rss.xml'
  ]
};

function slugify(s) {
  return s
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function fetchAndWrite() {
  const articlesDir = path.join(__dirname, '..', 'src', 'articles');
  if (!fs.existsSync(articlesDir)) fs.mkdirSync(articlesDir, { recursive: true });

  for (const [category, feeds] of Object.entries(feedsByCategory)) {
    const categoryDir = path.join(articlesDir, category);
    if (!fs.existsSync(categoryDir)) fs.mkdirSync(categoryDir, { recursive: true });

    let count = 0;
    for (const feedUrl of feeds) {
      try {
        const feed = await parser.parseURL(feedUrl);
        for (const item of feed.items.slice(0, 5)) { // limit per feed
          const title = item.title || 'Untitled';
          const date = item.isoDate || item.pubDate || new Date().toISOString();
          const link = item.link || '';
          const source = feed.title || feedUrl;
          const slug = slugify(title + '-' + (item.guid || item.link || Math.random()));
          const filename = path.join(categoryDir, `${slug}.md`);

          const md = `---\ntitle: "${title.replace(/"/g, '\\"')}"\ndate: "${date}"\ncategory: "${category}"\nsource: "${source.replace(/"/g, '\\"')}"\noriginal_link: "${link}"\n---\n\n${item.contentSnippet || item.content || ''}\n\n[Read original article](${link})\n`;

          // Avoid overwriting existing files
          if (!fs.existsSync(filename)) {
            fs.writeFileSync(filename, md, 'utf8');
            count++;
          }
        }
      } catch (err) {
        console.error('Failed to fetch', feedUrl, err.message);
      }
    }
    console.log(`Wrote ${count} new articles for category ${category}`);
  }
}

fetchAndWrite().catch(err => { console.error(err); process.exit(1); });
