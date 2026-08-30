const fs = require('fs');
const path = require('path');

module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy('src/assets');

  eleventyConfig.addFilter('readableDate', (dateObj) => {
    try {
      const d = new Date(dateObj);
      if (isNaN(d)) return dateObj || '';
      return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return dateObj || '';
    }
  });

  const categories = ['politics','world','business','technology','sports','entertainment','science','health','ai-trends','favourites'];
  const articlesRoot = path.join(__dirname, 'src', 'articles');

  function parseFrontmatter(fileContent) {
    const match = fileContent.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/);
    if (!match) return { data: {}, body: fileContent };

    const front = match[1];
    const body = match[2] || '';
    const data = {};

    front.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf(':');
      if (idx === -1) return;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      data[key] = value.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    });

    return { data, body };
  }

  function buildCategoryItems(cat) {
    const categoryDir = path.join(articlesRoot, cat);
    if (!fs.existsSync(categoryDir)) return [];

    return fs.readdirSync(categoryDir)
      .filter(file => file.endsWith('.md'))
      .map(file => {
        const fullPath = path.join(categoryDir, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        const { data, body } = parseFrontmatter(content);
        const title = data.title || file.replace(/\.md$/, '').replace(/-/g, ' ');
        const date = data.date || new Date().toISOString();
        const source = data.source || 'Open source feed';
        const originalLink = data.original_link || '#';

        return {
          inputPath: `src/articles/${cat}/${file}`,
          url: originalLink,
          date,
          templateContent: body,
          data: {
            title,
            category: cat,
            source,
            original_link: originalLink,
            date
          }
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8);
  }

  categories.forEach(cat => {
    eleventyConfig.addCollection(cat, () => buildCategoryItems(cat));
  });

  return {
    dir: {
      input: 'src',
      includes: 'includes',
      layouts: 'layouts',
      output: '_site'
    },
    pathPrefix: '/mynewsapp/',
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk'
  };
};
