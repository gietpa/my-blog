#!/usr/bin/env node
/**
 * Imports finished posts from the Obsidian vault into posts/.
 *
 *   node scripts/import-vault.js --dry-run   # show what would happen
 *   node scripts/import-vault.js             # import and mark as published
 *
 * Picks up vault notes with `type: post` and `status: ready`, writes them as
 * blog posts, then writes `status: published` back to the vault note so the
 * same post is never imported twice.
 *
 * Vault location can be overridden with VAULT_BLOG_DIR.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const VAULT_DIR =
  process.env.VAULT_BLOG_DIR || path.join(os.homedir(), 'Documents', 'Obsidian Vault', '04-Blog');

const READY = 'ready';
const PUBLISHED = 'published';

const dryRun = process.argv.includes('--dry-run');

/**
 * Obsidian wikilinks don't exist in the published site — the notes they point
 * at aren't there. Keep the human-readable text and drop the syntax rather than
 * emitting a link to nowhere.
 */
function stripWikiLinks(markdown, warnings, filename) {
  let result = markdown.replace(/!\[\[([^\]]+)\]\]/g, (_, target) => {
    warnings.push(`${filename}: embed ![[${target}]] removed — copy the asset in manually if needed`);
    return '';
  });

  result = result.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, __, alias) => alias);
  result = result.replace(/\[\[([^\]|]+)\]\]/g, (_, target) => target);
  return result;
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug;
}

function firstParagraph(markdown) {
  const body = markdown.replace(/<!--[\s\S]*?-->/g, '').trim();
  for (const block of body.split(/\n\s*\n/)) {
    const line = block.trim();
    if (line && !line.startsWith('#') && !line.startsWith('---')) {
      return line.replace(/\s+/g, ' ');
    }
  }
  return '';
}

function toDateString(value) {
  const date = value ? new Date(value) : new Date();
  return (Number.isNaN(date.getTime()) ? new Date() : date).toISOString().slice(0, 10);
}

/** Quote only when YAML needs it, so simple values stay readable in the file. */
function yamlString(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function buildPost(data, body, warnings, filename) {
  const title = data.title || path.basename(filename, '.md');
  const date = toDateString(data.created);
  const slug = data.slug || slugify(title) || slugify(path.basename(filename, '.md'));

  if (!slug) {
    throw new Error(
      `${filename}: could not derive a URL slug from the title. Add a \`slug:\` field to the note.`,
    );
  }

  const content = stripWikiLinks(body, warnings, filename).trim();
  const description = data.description || firstParagraph(content).slice(0, 160);
  const tags = Array.isArray(data.tags)
    ? data.tags.map((tag) => String(tag).replace(/^category\//, '')).filter(Boolean)
    : [];

  const frontmatter = [
    '---',
    `title: ${yamlString(title)}`,
    `date: ${yamlString(date)}`,
    tags.length ? `tags: [${tags.map(yamlString).join(', ')}]` : null,
    description ? `description: ${yamlString(description)}` : null,
    '---',
    '',
    '',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return { slug, date, title, markdown: `${frontmatter}${content}\n` };
}

/**
 * Rewrite status/published in place with a line-level edit rather than
 * re-serializing the frontmatter. The vault notes carry ontology fields and
 * comments that a naive dump would reformat or lose.
 */
function markPublished(raw, today) {
  let updated = raw.replace(/^status:.*$/m, `status: ${PUBLISHED}`);
  if (/^published:.*$/m.test(updated)) {
    updated = updated.replace(/^published:.*$/m, `published: ${today}`);
  } else {
    updated = updated.replace(/^status: .*$/m, (line) => `${line}\npublished: ${today}`);
  }
  return updated;
}

function main() {
  if (!fs.existsSync(VAULT_DIR)) {
    console.error(`Vault blog folder not found: ${VAULT_DIR}`);
    console.error('Set VAULT_BLOG_DIR if your vault lives elsewhere.');
    process.exit(1);
  }

  const notes = fs.readdirSync(VAULT_DIR).filter((name) => name.endsWith('.md'));
  const warnings = [];
  const imported = [];
  const skipped = [];

  for (const filename of notes) {
    const notePath = path.join(VAULT_DIR, filename);
    const raw = fs.readFileSync(notePath, 'utf8');
    const { data, content } = matter(raw);

    if (data.type && data.type !== 'post') {
      skipped.push(`${filename} (type: ${data.type})`);
      continue;
    }
    if (data.status !== READY) {
      skipped.push(`${filename} (status: ${data.status || 'none'})`);
      continue;
    }

    const post = buildPost(data, content, warnings, filename);
    const target = path.join(POSTS_DIR, `${post.date}-${post.slug}.md`);

    if (fs.existsSync(target)) {
      throw new Error(
        `${filename}: ${path.relative(ROOT, target)} already exists. ` +
          'Set a different `slug:` in the note, or remove the existing post first.',
      );
    }

    if (!dryRun) {
      fs.writeFileSync(target, post.markdown, 'utf8');
      fs.writeFileSync(notePath, markPublished(raw, post.date), 'utf8');
    }

    imported.push({ from: filename, to: path.relative(ROOT, target), title: post.title });
  }

  if (skipped.length) {
    console.log(`Skipped ${skipped.length}:`);
    for (const entry of skipped) console.log(`  - ${entry}`);
    console.log('');
  }

  for (const warning of warnings) console.warn(`  ! ${warning}`);
  if (warnings.length) console.log('');

  if (imported.length === 0) {
    console.log(`Nothing to import. Set \`status: ${READY}\` on a note in ${VAULT_DIR} first.`);
    return;
  }

  console.log(`${dryRun ? 'Would import' : 'Imported'} ${imported.length}:`);
  for (const entry of imported) {
    console.log(`  ${entry.title}`);
    console.log(`    ${entry.from} → ${entry.to}`);
  }

  console.log(
    dryRun
      ? '\nDry run — nothing written. Re-run without --dry-run to import.'
      : `\nVault notes marked \`status: ${PUBLISHED}\`. Run \`npm run build\` to publish.`,
  );
}

try {
  main();
} catch (error) {
  console.error(`\nImport failed: ${error.message}\n`);
  process.exitCode = 1;
}
