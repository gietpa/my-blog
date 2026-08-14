/**
 * Reading and parsing the post collection.
 *
 * This module knows nothing about HTML pages — it just returns a sorted array of
 * post objects. A future RSS or tag-page generator can import `loadPosts` as-is.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

import { markdownToHtml } from './markdown.js';
import { decodeEntities, formatDate, isoDate, stripHtml, truncate } from './util.js';

const EXCERPT_LENGTH = 160;

/** Derive a URL slug from the filename, dropping any `YYYY-MM-DD-` prefix. */
function slugFromFilename(filename) {
  return path
    .basename(filename, '.md')
    .replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

/** First rendered paragraph, as plain text — used when no description is given. */
function excerptFromHtml(html) {
  const firstParagraph = html.match(/<p>([\s\S]*?)<\/p>/);
  const text = decodeEntities(stripHtml(firstParagraph ? firstParagraph[1] : html));
  return truncate(text, EXCERPT_LENGTH);
}

function parsePost(filename, raw) {
  const { data, content } = matter(raw);

  // Bad frontmatter is an authoring bug: fail the build loudly rather than
  // quietly publishing a post with a missing title or date.
  if (!data.title) {
    throw new Error(`posts/${filename}: missing required frontmatter field "title"`);
  }
  if (!data.date) {
    throw new Error(`posts/${filename}: missing required frontmatter field "date"`);
  }

  const date = new Date(data.date);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`posts/${filename}: invalid date "${data.date}" (expected e.g. 2026-08-10)`);
  }

  const slug = data.slug || slugFromFilename(filename);
  const html = markdownToHtml(content);

  return {
    title: String(data.title),
    date,
    dateISO: isoDate(date),
    dateFormatted: formatDate(date),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    description: data.description ? String(data.description) : '',
    excerpt: data.description ? String(data.description) : excerptFromHtml(html),
    slug,
    url: `/posts/${slug}/`,
    html,
  };
}

/**
 * Load every published post from `postsDir`, newest first.
 * Posts with `draft: true` in frontmatter are excluded.
 */
export async function loadPosts(postsDir) {
  let entries;
  try {
    entries = await fs.readdir(postsDir);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const markdownFiles = entries.filter((name) => name.endsWith('.md')).sort();
  const posts = [];
  const seenSlugs = new Map();

  for (const filename of markdownFiles) {
    const raw = await fs.readFile(path.join(postsDir, filename), 'utf8');
    const { data } = matter(raw);
    if (data.draft === true) continue;

    const post = parsePost(filename, raw);

    // Two posts writing to the same dist/posts/<slug>/ would silently clobber
    // each other, so surface the collision instead.
    if (seenSlugs.has(post.slug)) {
      throw new Error(
        `posts/${filename}: slug "${post.slug}" already used by ${seenSlugs.get(post.slug)}`,
      );
    }
    seenSlugs.set(post.slug, `posts/${filename}`);

    posts.push(post);
  }

  return posts.sort((a, b) => b.date - a.date);
}
