module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy('src/assets');
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
