#!/usr/bin/env node
/**
 * Collects what actually changed in the repo recently, as raw material for a
 * blog post draft.
 *
 *   node scripts/daily-brief.js            # last 24 hours
 *   node scripts/daily-brief.js --since 3.days
 *
 * This script deliberately does NOT write prose. It only reports facts — commit
 * subjects, bodies, and which files moved — so that whatever writes the post is
 * working from real events rather than inventing a plausible-sounding day.
 *
 * Exits 1 with a clear message when nothing happened, so a morning routine can
 * skip writing instead of manufacturing a post out of nothing.
 */

import { execFileSync } from 'node:child_process';

function git(args, { quiet = false } = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    // Probing calls swallow git's stderr so an expected miss doesn't look like
    // a real failure in the output.
    stdio: quiet ? ['ignore', 'pipe', 'ignore'] : ['ignore', 'pipe', 'inherit'],
  }).trim();
}

function parseArgs(argv) {
  const sinceIndex = argv.indexOf('--since');
  return { since: sinceIndex === -1 ? '24.hours' : argv[sinceIndex + 1] };
}

const { since } = parseArgs(process.argv.slice(2));
const sinceArg = `--since=${since}.ago`;

let commits;
try {
  // %x1f / %x1e are unit/record separators — safe against subjects containing
  // any character a human might type.
  commits = git(['log', sinceArg, '--no-merges', '--pretty=format:%h%x1f%s%x1f%b%x1e'])
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, subject, body] = record.split('\x1f');
      return { hash, subject, body: (body || '').trim() };
    });
} catch (error) {
  console.error('Could not read git history. Is this a git repository?');
  console.error(error.message);
  process.exit(1);
}

if (commits.length === 0) {
  console.error(`No commits in the last ${since.replace('.', ' ')}. Nothing to write about.`);
  process.exit(1);
}

/**
 * Diff base for the range. Counting back `HEAD~<commits.length>` would be wrong
 * twice over: merge commits are filtered out of the list, so the count doesn't
 * match ancestry depth, and on a young repo it walks off the root commit
 * entirely. Use the oldest commit's parent, falling back to git's empty tree
 * when that commit *is* the root.
 */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const oldest = commits[commits.length - 1].hash;

let base;
try {
  base = git(['rev-parse', '--verify', `${oldest}^`], { quiet: true });
} catch {
  base = EMPTY_TREE;
}

const stat = git(['diff', '--stat', base, 'HEAD']) || '(no file changes)';
const files = git(['diff', '--name-only', base, 'HEAD'])
  .split('\n')
  .filter(Boolean);

const lines = [
  `# Repo activity — last ${since.replace('.', ' ')}`,
  '',
  `${commits.length} commit${commits.length === 1 ? '' : 's'}, ${files.length} file${files.length === 1 ? '' : 's'} touched.`,
  '',
  '## Commits',
  '',
];

for (const commit of commits) {
  lines.push(`- **${commit.subject}** (\`${commit.hash}\`)`);
  if (commit.body) {
    for (const bodyLine of commit.body.split('\n')) {
      lines.push(`  ${bodyLine}`);
    }
  }
}

lines.push('', '## Files changed', '', '```', stat, '```', '');

console.log(lines.join('\n'));
