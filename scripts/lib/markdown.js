/**
 * Markdown -> HTML conversion, with syntax highlighting applied at build time.
 *
 * Highlighting happens here rather than in the browser so that highlight.js
 * never ships to the client: code blocks are already colored in the static HTML,
 * they work with JS disabled, and there is no re-render flash on load.
 */

import { Marked, Renderer } from 'marked';
import hljs from 'highlight.js';

/**
 * Renderer signature note: marked changes this across major versions. Verified
 * against the installed marked (12.x), where `code` receives positional args
 * `(code, infoString, escaped)`. If marked is upgraded, re-check this — a
 * mismatch makes highlighting silently do nothing rather than throw.
 */
function createRenderer() {
  const renderer = new Renderer();

  renderer.code = function code(source, infoString) {
    // Info strings can carry extras after the language (```js title=foo).
    const lang = (infoString || '').trim().split(/\s+/)[0];

    if (lang && hljs.getLanguage(lang)) {
      const { value } = hljs.highlight(source, { language: lang });
      return `<pre><code class="hljs language-${lang}">${value}</code></pre>\n`;
    }

    // No usable language tag: fall back to auto-detection. Authors should tag
    // fences explicitly (```js) — auto-detection guesses and sometimes guesses wrong.
    const { value } = hljs.highlightAuto(source);
    return `<pre><code class="hljs">${value}</code></pre>\n`;
  };

  return renderer;
}

const marked = new Marked({
  renderer: createRenderer(),
  gfm: true,
  breaks: false,
});

/** Convert a markdown body (frontmatter already stripped) to HTML. */
export function markdownToHtml(markdown) {
  return marked.parse(markdown);
}
