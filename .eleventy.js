module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy('src/assets');

  const categories = ['politics','world','business','technology','sports','entertainment','science','health'];
  categories.forEach(cat => {
    eleventyConfig.addCollection(cat, function(collectionApi) {
      return collectionApi.getAll()
        .filter(item => item.data && item.data.category === cat)
        .reverse()
        .slice(0, 8);
    });
  });

  return {
    dir: {
      input: 'src',
      includes: 'includes',
      layouts: 'layouts',
      output: '_site'
    },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk'
  };
};
