/**
 * HTML page templates — plain template literals, no templating engine.
 *
 * Path rule: every href/src here must be site-absolute and passed through
 * `href()` — never page-relative. Post pages live at `/posts/<slug>/index.html`,
 * two levels below the index, so a relative path would work on the index and
 * 404 on every post page. `href()` also prefixes `site.basePath`, which is how
 * the same output works both at a domain root and under a GitHub Pages
 * project subdirectory.
 */

import { escapeHtml } from './util.js';

/** Turns a site-absolute path into one the deployed site can actually serve. */
function href(site, urlPath) {
  return `${site.basePath || ''}${urlPath}`;
}

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

/**
 * @param {object} site
 * @param {object} options
 * @param {string[]} [options.extraStyles]  Site-absolute stylesheet paths, loaded
 *   after the four shared sheets. Order matters: page CSS only consumes the
 *   custom properties declared in variables.css, so it must come last.
 * @param {string[]} [options.extraScripts] Site-absolute script paths, deferred
 *   and emitted after theme-toggle.js. Deferred scripts run in document order,
 *   so array order is execution order.
 *
 * Both default to empty arrays so the existing callers need no changes.
 */
export function baseLayout(
  site,
  { title, description, bodyHtml, isHome = false, extraStyles = [], extraScripts = [] },
) {
  const pageTitle = isHome ? site.title : `${title} · ${site.title}`;

  const extraStyleTags = extraStyles
    .map((stylePath) => `\n  <link rel="stylesheet" href="${href(site, stylePath)}">`)
    .join('');
  const extraScriptTags = extraScripts
    .map((scriptPath) => `\n  <script src="${href(site, scriptPath)}" defer></script>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="${escapeHtml(site.lang)}">
<head>
  <meta charset="UTF-8">
  <script>${THEME_INIT_SCRIPT}</script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(description || site.description)}">
  <meta name="color-scheme" content="light dark">
  <link rel="stylesheet" href="${href(site, '/styles/variables.css')}">
  <link rel="stylesheet" href="${href(site, '/styles/base.css')}">
  <link rel="stylesheet" href="${href(site, '/styles/layout.css')}">
  <link rel="stylesheet" href="${href(site, '/styles/highlight-theme.css')}">${extraStyleTags}
</head>
<body>
  <header class="site-header">
    <a class="site-title" href="${href(site, '/')}">${escapeHtml(site.title)}</a>
    <nav class="site-nav">
      <a class="site-nav__link" href="${href(site, '/games/2048/')}">2048</a>
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
  <script src="${href(site, '/scripts/theme-toggle.js')}" defer></script>${extraScriptTags}
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
        <h2 class="post-list__title"><a href="${href(site, post.url)}">${escapeHtml(post.title)}</a></h2>
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

/** Static background grid. Tiles are created by the game's JS, never here. */
const BOARD_CELL_COUNT = 16;

/**
 * The 2048 page. This template owns only the markup contract (element ids and
 * class names); behaviour lives in game-2048-core/ui.js and styling in
 * game-2048.css, so nothing here may be renamed without updating those.
 *
 * The board and tiles stay empty on the server — the JS builds them. What is
 * rendered statically is the 16-cell background grid, so the board keeps its
 * shape before the script runs.
 */
export function renderGamePage(site) {
  const cells = Array.from(
    { length: BOARD_CELL_COUNT },
    () => '        <div class="board__cell" role="gridcell" aria-label="empty"></div>',
  ).join('\n');

  const bodyHtml = `    <section id="game-2048" class="game">
      <h1 class="game__title">2048</h1>
      <div class="game__scores">
        <p class="game__score">Score <span id="score-value">0</span></p>
        <p class="game__score">Best <span id="best-value">0</span></p>
      </div>
      <button id="new-game" class="game__new" type="button">New Game</button>
      <div id="board" class="board" role="grid" tabindex="0" aria-label="2048 board">
${cells}
      </div>
      <div id="game-over" class="game__overlay" hidden></div>
      <p id="game-status" aria-live="polite"></p>
      <p class="game__help">Use arrow keys to move tiles.</p>
      <p class="game__nojs">This game requires JavaScript.</p>
    </section>`;

  return baseLayout(site, {
    title: '2048',
    description: 'Play 2048 — join the tiles to reach 2048.',
    bodyHtml,
    extraStyles: ['/styles/game-2048.css'],
    // core must load before ui: deferred scripts run in document order.
    extraScripts: ['/scripts/game-2048-core.js', '/scripts/game-2048-ui.js'],
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
      <p class="post__back"><a href="${href(site, '/')}">&larr; Back to all posts</a></p>
    </article>`;

  return baseLayout(site, {
    title: post.title,
    description: post.description || post.excerpt,
    bodyHtml,
  });
}
