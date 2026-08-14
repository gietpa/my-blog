---
title: "Hello, World"
date: "2026-08-10"
tags: ["meta", "intro"]
description: "The first post on this blog — why I started it and how it's built."
---

This is the first post on my new blog. It's built by a small Node.js script that
reads Markdown files and writes plain HTML — no framework, no client-side
rendering, nothing to go stale in two years.

## Why a blog?

I wanted somewhere simple to write about programming. Most blogging setups spend
more complexity on the build pipeline than on the writing, and I'd rather the
whole thing fit in my head.

The generator is about two hundred lines. Here's roughly how a post becomes a page:

```js
const { data, content } = matter(raw);
const html = markdownToHtml(content);

await writePage(`dist/posts/${slug}/index.html`, renderPostPage(site, {
  title: data.title,
  date: new Date(data.date),
  html,
}));
```

## What to expect

Short posts, mostly. Notes on things I've debugged, tools I've built, and the
occasional opinion about software that I'll probably disagree with later.
