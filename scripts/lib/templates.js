/**
 * HTML page templates — plain template literals, no templating engine.
 *
 * Path rule: every href/src here must be root-relative (`/styles/base.css`, `/`).
 * Post pages live at `/posts/<slug>/index.html`, two levels below the index, so
 * page-relative paths would work on the index and 404 on every post page.
 */

import { escapeHtml } from './util.js';

/**
 * Applies the stored (or system) theme before first paint.
 *
 * This must stay inline in <head>, ahead of the stylesheets. Moved to an
 * external or deferred file it would run after first paint, producing a visible
 * light-to-dark flash on load for dark-mode readers.
 */
const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;d.classList.add('js');\
try{var s=localStorage.getItem('theme');\
var t=s||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');\
d.setAttribute('data-theme',t);}catch(e){}})();`;

export function baseLayout(site, { title, description, bodyHtml, isHome = false }) {
  const pageTitle = isHome ? site.title : `${title} · ${site.title}`;

  return `<!DOCTYPE html>
<html lang="${escapeHtml(site.lang)}">
<head>
  <meta charset="UTF-8">
  <script>${THEME_INIT_SCRIPT}</script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(description || site.description)}">
  <meta name="color-scheme" content="light dark">
  <link rel="stylesheet" href="/styles/variables.css">
  <link rel="stylesheet" href="/styles/base.css">
  <link rel="stylesheet" href="/styles/layout.css">
  <link rel="stylesheet" href="/styles/highlight-theme.css">
</head>
<body>
  <header class="site-header">
    <a class="site-title" href="/">${escapeHtml(site.title)}</a>
    <nav class="site-nav">
      <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Toggle dark mode" aria-pressed="false">
        <span class="theme-toggle__icon" aria-hidden="true"></span>
      </button>
    </nav>
  </header>
  <main class="site-main">
${bodyHtml}
  </main>
  <footer class="site-footer">
    <p>&copy; ${new Date().getFullYear()} ${escapeHtml(site.title)}</p>
  </footer>
  <script src="/scripts/theme-toggle.js" defer></script>
</body>
</html>
`;
}

function renderTags(tags) {
  if (tags.length === 0) return '';
  const items = tags
    .map((tag) => `<li class="tag">${escapeHtml(tag)}</li>`)
    .join('');
  return `\n        <ul class="tag-list">${items}</ul>`;
}

export function renderIndexPage(site, posts) {
  if (posts.length === 0) {
    return baseLayout(site, {
      title: site.title,
      description: site.description,
      isHome: true,
      bodyHtml: '    <p class="empty-state">No posts yet.</p>',
    });
  }

  const items = posts
    .map(
      (post) => `      <li class="post-list__item">
        <h2 class="post-list__title"><a href="${post.url}">${escapeHtml(post.title)}</a></h2>
        <p class="post-meta"><time datetime="${post.dateISO}">${post.dateFormatted}</time></p>
        <p class="post-list__excerpt">${escapeHtml(post.excerpt)}</p>
      </li>`,
    )
    .join('\n');

  return baseLayout(site, {
    title: site.title,
    description: site.description,
    isHome: true,
    bodyHtml: `    <ul class="post-list">\n${items}\n    </ul>`,
  });
}

export function renderPostPage(site, post) {
  const bodyHtml = `    <article class="post">
      <header class="post__header">
        <h1 class="post__title">${escapeHtml(post.title)}</h1>
        <p class="post-meta"><time datetime="${post.dateISO}">${post.dateFormatted}</time></p>${renderTags(post.tags)}
      </header>
      <div class="post-body">
${post.html}
      </div>
      <p class="post__back"><a href="/">&larr; Back to all posts</a></p>
    </article>`;

  return baseLayout(site, {
    title: post.title,
    description: post.description || post.excerpt,
    bodyHtml,
  });
}
