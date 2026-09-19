const path = require('path');

const {
  CATEGORIES,
  COUNTRY_SLUGS,
  COUNTRY_LABELS,
  CATEGORY_LIMIT,
  COUNTRY_LIMIT,
  countryLabel: formatCountryLabel,
  readCategory,
  readPool,
  byCountry,
  countryCounts
} = require('./scripts/lib/articles');

module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy('src/assets');

  const now = new Date();
  eleventyConfig.addGlobalData('site', {
    baseUrl: 'https://snivas22.github.io/mynewsapp',
    description: 'లైవ్ వార్తా డాష్‌బోర్డ్ - రాజకీయాలు, వ్యాపారం, సాంకేతికత, క్రీడలు మరియు మరిన్ని.',
    lastUpdated: now.toISOString(),
    currentDateLabel: now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }),
    categories: [
      { slug: 'politics', label: 'Politics', blurb: 'Government and policy updates' },
      { slug: 'world', label: 'World', blurb: 'Global events and international stories' },
      { slug: 'business', label: 'Business', blurb: 'Markets, brands, and industry moves' },
      { slug: 'technology', label: 'Technology', blurb: 'AI, software, startups, and digital culture' },
      { slug: 'ai-trends', label: 'AI & Trends', blurb: 'Signal, disruption, and the next big shifts' },
      { slug: 'sports', label: 'Sports', blurb: 'Fixtures, results, and major contests' },
      { slug: 'entertainment', label: 'Entertainment', blurb: 'Film, music, culture, and celebrity news' },
      { slug: 'science', label: 'Science', blurb: 'Research and environmental updates' },
      { slug: 'health', label: 'Health', blurb: 'Medical reporting and wellbeing stories' },
      { slug: 'favourites', label: 'Favourites', blurb: 'Your saved spotlight stories and must-reads' }
    ],
    countries: [
      { slug: 'uk', label: 'United Kingdom' },
      { slug: 'us', label: 'United States' },
      { slug: 'india', label: 'India' },
      { slug: 'andhra-pradesh', label: 'Andhra Pradesh' },
      { slug: 'telangana', label: 'Telangana' },
      { slug: 'hyderabad', label: 'Hyderabad' },
      { slug: 'australia', label: 'Australia' },
      { slug: 'uae', label: 'UAE' }
    ]
  });

  // Top-level list used by the country dashboard template's pagination.
  eleventyConfig.addGlobalData('countryList', COUNTRY_SLUGS.map((slug) => ({
    slug,
    label: COUNTRY_LABELS[slug]
  })));

  eleventyConfig.addFilter('readableDate', (dateObj) => {
    try {
      const d = new Date(dateObj);
      if (isNaN(d)) return dateObj || '';
      return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return dateObj || '';
    }
  });

  eleventyConfig.addFilter('filterByCountry', (items = [], country) => {
    if (!country) return items;
    const normalized = String(country).trim().toLowerCase();
    return (items || []).filter((item) => {
      const itemCountry = String(item?.data?.country || item?.country || '').trim().toLowerCase() || 'global';
      return itemCountry === normalized;
    });
  });

  eleventyConfig.addFilter('countryLabel', (value) => formatCountryLabel(value));

  const categories = CATEGORIES;
  const countrySlugs = COUNTRY_SLUGS;
  const articlesRoot = path.join(__dirname, 'src', 'articles');

  // The full story pool is expensive to read, so cache it for the duration of
  // one build and invalidate it before the next one (watch/serve friendly).
  let pool = null;
  function getPool() {
    if (!pool) pool = readPool(articlesRoot);
    return pool;
  }
  eleventyConfig.on('eleventy.before', () => { pool = null; });

  categories.forEach((cat) => {
    eleventyConfig.addCollection(cat, () =>
      readCategory(articlesRoot, cat).slice(0, CATEGORY_LIMIT)
    );
  });

  countrySlugs.forEach((country) => {
    eleventyConfig.addCollection(`country_${country}`, () =>
      byCountry(getPool(), country).slice(0, COUNTRY_LIMIT)
    );
  });

  eleventyConfig.addCollection('countriesOverview', () => {
    const counts = countryCounts(getPool());
    return countrySlugs.map((slug) => ({
      slug,
      label: COUNTRY_LABELS[slug],
      count: counts[slug]
    }));
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
