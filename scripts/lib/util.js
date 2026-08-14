/**
 * Small helpers shared by the build script. Node-only — never shipped to the browser.
 */

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape a value before interpolating it into raw HTML.
 *
 * Frontmatter fields (title, description, tags) are injected into templates by
 * our own code, so they never pass through marked's escaping. Every such
 * interpolation must go through here, or a title like `Rust & Go: A <fair> take`
 * breaks the generated markup.
 */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** Format a Date as e.g. "August 10, 2026". */
export function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Machine-readable date for <time datetime="..."> — e.g. "2026-08-10". */
export function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

/** Strip tags and collapse whitespace, for building plain-text excerpts. */
export function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Decode the handful of entities marked emits, so excerpts read as plain text
 * before we re-escape them on output.
 */
export function decodeEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Truncate at a word boundary, appending an ellipsis when shortened. */
export function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}
