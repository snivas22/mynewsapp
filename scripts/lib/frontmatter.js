'use strict';

/**
 * Shared, dependency-free frontmatter helpers.
 *
 * Both the RSS writer (`scripts/fetch_rss.js`) and the Eleventy build
 * (`.eleventy.js`) need to read the same `---` delimited blocks from
 * `src/articles/**`, so the parsing rules live here to avoid the two copies
 * drifting apart.
 *
 * Format notes:
 * - Flat `key: value` pairs only (no nested YAML). Values are plain strings.
 * - Values may be wrapped in single or double quotes.
 * - `\"` inside a quoted value is unescaped on read and produced on write.
 * - Newlines inside values are collapsed to spaces on write, because the
 *   format is line based.
 */

const FRONTMATTER_RE = /^\s*---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n)?([\s\S]*)$/;

function unquote(value) {
  const trimmed = String(value == null ? '' : value).trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1).replace(/\\"/g, '"');
    }
  }
  return trimmed;
}

/**
 * Parse a markdown document with an optional frontmatter block.
 * @param {string} content
 * @returns {{ data: Record<string, string>, body: string }}
 */
function parseFrontmatter(content) {
  const raw = String(content == null ? '' : content);
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) return { data: {}, body: raw };

  const front = match[1] || '';
  const body = match[2] || '';
  const data = {};

  for (const line of front.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const idx = trimmed.indexOf(':');
    if (idx <= 0) continue;

    const key = trimmed.slice(0, idx).trim();
    if (!key) continue;

    data[key] = unquote(trimmed.slice(idx + 1));
  }

  return { data, body };
}

/**
 * Escape a value so it can be written as a single quoted frontmatter line.
 * The inverse of `unquote`.
 */
function escapeFrontmatterValue(value) {
  return String(value == null ? '' : value)
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ');
}

/**
 * Render a frontmatter block plus body back into a markdown document.
 * @param {Record<string, string>} data
 * @param {string} [body]
 */
function serializeFrontmatter(data, body = '') {
  const lines = Object.entries(data || {})
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}: "${escapeFrontmatterValue(value)}"`);

  return `---\n${lines.join('\n')}\n---\n\n${body}\n`;
}

module.exports = {
  parseFrontmatter,
  escapeFrontmatterValue,
  serializeFrontmatter
};
