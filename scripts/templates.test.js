const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const srcDir = path.join(__dirname, '..', 'src');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}

function templateFiles() {
  return walk(srcDir).filter((file) => file.endsWith('.njk'));
}

test('absolute URLs never run through the `url` filter twice', () => {
  // `pathPrefix` is applied by the `url` filter, and `site.baseUrl` already
  // contains that prefix, so `{{ site.baseUrl }}{{ something | url }}`
  // produces ".../mynewsapp/mynewsapp/...". This bit us once already.
  const offenders = [];

  for (const file of templateFiles()) {
    const content = fs.readFileSync(file, 'utf8');
    for (const match of content.matchAll(/site\.baseUrl\s*\}\}\s*\{\{[^}]*\|\s*url/g)) {
      offenders.push(`${path.relative(srcDir, file)}: ${match[0]}`);
    }
  }

  assert.deepEqual(offenders, [], `Double-prefixed URLs found:\n${offenders.join('\n')}`);
});

test('elements translated via data-i18n never wrap other elements', () => {
  // applyLanguage() replaces textContent, which deletes any child elements.
  // The footer's live "last updated" span used to sit inside a data-i18n <p>
  // and was silently wiped on every page. Keep them as siblings instead.
  const base = fs.readFileSync(path.join(srcDir, 'layouts', 'base.njk'), 'utf8');

  assert.doesNotMatch(
    base,
    /<[a-z][^>]*data-i18n="[^"]*"[^>]*>\s*<span[^>]*data-last-updated/,
    'data-last-updated must not be nested inside a data-i18n element'
  );
  assert.match(
    base,
    /<span data-i18n="footerText">[\s\S]*?<\/span>\s*<span data-last-updated=/,
    'the footer text and the last-updated span must be siblings'
  );
});

test('sitemap and robots are emitted with the expected permalinks', () => {
  const sitemap = fs.readFileSync(path.join(srcDir, 'sitemap.njk'), 'utf8');
  const robots = fs.readFileSync(path.join(srcDir, 'robots.njk'), 'utf8');

  assert.match(sitemap, /permalink:\s*"\/sitemap\.xml"/);
  assert.match(robots, /permalink:\s*"\/robots\.txt"/);
  assert.match(robots, /Sitemap:\s*\{\{ site\.baseUrl \}\}\/sitemap\.xml/);
  assert.equal(
    sitemap.includes('| safe'),
    true,
    'the XML declaration must bypass Nunjucks autoescaping'
  );
});
