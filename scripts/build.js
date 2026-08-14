#!/usr/bin/env node
/**
 * Build entry point: turns posts/*.md into a static site in dist/.
 *
 *   npm run build
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPosts } from './lib/posts.js';
import { renderIndexPage, renderPostPage } from './lib/templates.js';

/** Site-wide settings. Change the blog's name and tagline here. */
const SITE = {
  title: 'My Blog',
  description: 'Notes on programming and whatever else holds my attention.',
  lang: 'en',
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const ASSETS_DIR = path.join(ROOT, 'assets');
const DIST_DIR = path.join(ROOT, 'dist');

async function writePage(filePath, html) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, html, 'utf8');
}

async function build() {
  const startedAt = Date.now();

  // Wipe dist/ so deleted posts don't linger as stale pages.
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(DIST_DIR, { recursive: true });

  const posts = await loadPosts(POSTS_DIR);

  for (const post of posts) {
    await writePage(path.join(DIST_DIR, 'posts', post.slug, 'index.html'), renderPostPage(SITE, post));
  }

  await writePage(path.join(DIST_DIR, 'index.html'), renderIndexPage(SITE, posts));

  await fs.cp(path.join(ASSETS_DIR, 'css'), path.join(DIST_DIR, 'styles'), { recursive: true });
  await fs.cp(path.join(ASSETS_DIR, 'js'), path.join(DIST_DIR, 'scripts'), { recursive: true });

  const elapsed = Date.now() - startedAt;
  console.log(`Built ${posts.length} post${posts.length === 1 ? '' : 's'} → dist/ in ${elapsed}ms`);
}

build().catch((error) => {
  console.error(`\nBuild failed: ${error.message}\n`);
  process.exitCode = 1;
});
