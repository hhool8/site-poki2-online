'use strict';

const fs   = require('fs');
const path = require('path');

const { site, pages, blogPosts } = require('./config.js');

// ── Path helpers ──────────────────────────────────────────────────────────────
const ROOT    = path.join(__dirname, '..');
const SRC     = path.join(ROOT, 'src');
const DIST    = path.join(ROOT, 'dist');
const CSS_SRC = path.join(ROOT, 'css');
const PUB_SRC = path.join(ROOT, 'public');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('  wrote', path.relative(ROOT, filePath));
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

// ── Template fill ─────────────────────────────────────────────────────────────
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function schemaTag(schema) {
  if (!schema || !schema.length) return '';
  return schema.map(s =>
    `<script type="application/ld+json">${JSON.stringify(s, null, 2)}</script>`
  ).join('\n  ');
}

const MID_AD_HTML = `
<div class="ad-unit ad-unit--article">
  <ins class="adsbygoogle"
       style="display:block; text-align:center"
       data-ad-layout="in-article"
       data-ad-format="fluid"
       data-ad-client="ca-pub-6199549323873133"
       data-ad-slot="9336055885"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});<\/script>
</div>`;

function injectMidAd(content) {
  // Insert mid-article ad before the 2nd <h2>; fall back to 50% character split
  const h2Re = /<h2[\s>]/gi;
  let match, count = 0, insertAt = -1;
  while ((match = h2Re.exec(content)) !== null) {
    count++;
    if (count === 2) { insertAt = match.index; break; }
  }
  if (insertAt === -1) insertAt = Math.floor(content.length / 2);
  return content.slice(0, insertAt) + '\n' + MID_AD_HTML + '\n' + content.slice(insertAt);
}

function fillBase(template, page, content) {
  const ogImage = `${site.domain}/og-image.png`;
  return template
    .replace(/\{\{TITLE\}\}/g,               esc(page.title))
    .replace(/\{\{DESCRIPTION\}\}/g,         esc(page.description || ''))
    .replace(/\{\{KEYWORDS\}\}/g,            esc(page.keywords || ''))
    .replace(/\{\{CANONICAL\}\}/g,           page.canonical || '')
    .replace(/\{\{OG_TITLE\}\}/g,            esc(page.title))
    .replace(/\{\{OG_DESCRIPTION\}\}/g,      esc(page.description || ''))
    .replace(/\{\{OG_URL\}\}/g,             page.canonical || '')
    .replace(/\{\{OG_TYPE\}\}/g,            page.ogType || 'website')
    .replace(/\{\{OG_IMAGE\}\}/g,           ogImage)
    .replace(/\{\{TWITTER_TITLE\}\}/g,      esc(page.title))
    .replace(/\{\{TWITTER_DESCRIPTION\}\}/g, esc(page.description || ''))
    .replace(/\{\{TWITTER_IMAGE\}\}/g,      ogImage)
    .replace(/\{\{SCHEMA\}\}/g,             schemaTag(page.schema || []))
    .replace(/\{\{BODY_CLASS\}\}/g,         page.bodyClass || '')
    .replace(/\{\{CONTENT\}\}/g,            content);
}

function fillArticle(template, post, content, relatedLinks) {
  const canonical = `${site.domain}/blog/${post.slug}`;
  const buildTs   = new Date().toISOString();
  const ogImage   = `${site.domain}/og-image.png`;
  const schema    = [{
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    headline:    post.title,
    description: post.description,
    url:         canonical,
    datePublished: post.isoDate || '2026-04-04',
    dateModified:  post.isoDate || '2026-04-04',
    author: { '@type': 'Organization', name: 'Poki2', url: site.domain },
    publisher: {
      '@type': 'Organization', name: 'Poki2', url: site.domain,
      logo: { '@type': 'ImageObject', url: `${site.domain}/favicon.svg` }
    },
  }];

  return template
    .replace(/\{\{TITLE\}\}/g,               esc(`${post.title} — Poki2 Blog`))
    .replace(/\{\{DESCRIPTION\}\}/g,         esc(post.description || ''))
    .replace(/\{\{CANONICAL\}\}/g,           canonical)
    .replace(/\{\{OG_TITLE\}\}/g,            esc(post.title))
    .replace(/\{\{OG_DESCRIPTION\}\}/g,      esc(post.description || ''))
    .replace(/\{\{OG_URL\}\}/g,              canonical)
    .replace(/\{\{OG_IMAGE\}\}/g,           ogImage)
    .replace(/\{\{TWITTER_TITLE\}\}/g,      esc(post.title))
    .replace(/\{\{TWITTER_DESCRIPTION\}\}/g, esc(post.description || ''))
    .replace(/\{\{TWITTER_IMAGE\}\}/g,      ogImage)
    .replace(/\{\{SCHEMA\}\}/g,             schemaTag(schema))
    .replace(/\{\{ARTICLE_TITLE\}\}/g,      post.title)
    .replace(/\{\{ARTICLE_TITLE_PLAIN\}\}/g, esc(post.title))
    .replace(/\{\{ARTICLE_DATE\}\}/g,       post.date || '')
    .replace(/\{\{ARTICLE_CATEGORY\}\}/g,   post.category || '')
    .replace(/\{\{ARTICLE_READ_TIME\}\}/g,  post.readTime || '')
    .replace(/\{\{RELATED_LINKS\}\}/g,      relatedLinks)
    .replace(/\{\{CONTENT\}\}/g,            content)
    .replace(/\{\{BUILD_TS\}\}/g,           buildTs);
}

// ── Build ─────────────────────────────────────────────────────────────────────
function buildPages() {
  console.log('\n[1/4] Building static pages…');
  const baseTemplate = read(path.join(SRC, 'templates', 'base.html'));

  for (const page of pages) {
    const contentFile = path.join(SRC, 'content', `${page.slug}.html`);
    if (!fs.existsSync(contentFile)) {
      console.warn('  SKIP (missing content):', page.slug);
      continue;
    }
    const content = read(contentFile);
    const html    = fillBase(baseTemplate, page, content);
    write(path.join(DIST, page.outputFile), html);
  }
}

function buildBlog() {
  console.log('\n[2/4] Building blog…');
  const articleTemplate = read(path.join(SRC, 'templates', 'article.html'));
  const baseTemplate    = read(path.join(SRC, 'templates', 'base.html'));

  // Build each article
  for (const post of blogPosts) {
    const contentFile = path.join(SRC, 'content', 'blog', `${post.slug}.html`);
    if (!fs.existsSync(contentFile)) {
      console.warn('  SKIP (missing content):', post.slug);
      continue;
    }
    const rawContent = read(contentFile);
    const content = injectMidAd(rawContent);

    // Build related links (all posts except current)
    const relatedLinks = blogPosts
      .filter(p => p.slug !== post.slug)
      .slice(0, 4)
      .map(p => `<li><a href="/blog/${p.slug}">${esc(p.title)}</a></li>`)
      .join('\n          ');

    const html = fillArticle(articleTemplate, post, content, relatedLinks);
    write(path.join(DIST, 'blog', `${post.slug}.html`), html);
  }

  // Build blog index
  const blogIndexContent = read(path.join(SRC, 'content', 'blog', 'index.html'));
  const blogIndexPage = {
    slug:       'blog/index',
    outputFile: 'blog/index.html',
    bodyClass:  'blog-index-page',
    title:      'Browser Games Blog — Guides, Tips & Recommendations | Poki2',
    description:'The Poki2 blog: expert guides, game recommendations, and tips to help you find the best free browser games on the web.',
    keywords:   'browser games blog, free games guide, best online games, io games, unblocked games',
    canonical:  `${site.domain}/blog/`,
    ogType:     'website',
    schema: [{
      '@context': 'https://schema.org',
      '@type': 'Blog',
      url:  `${site.domain}/blog/`,
      name: 'Poki2 Blog',
      description: 'Browser game guides, recommendations, and tips.',
      publisher: { '@type': 'Organization', name: 'Poki2', url: site.domain },
    }],
  };
  const html = fillBase(baseTemplate, blogIndexPage, blogIndexContent);
  write(path.join(DIST, 'blog', 'index.html'), html);
}

function buildSitemap() {
  console.log('\n[3/4] Building sitemap…');
  const now = new Date().toISOString().split('T')[0];

  const pageUrls = pages.map(p => `
  <url>
    <loc>${p.canonical || `${site.domain}/${p.outputFile}`}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.slug === 'index' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${p.slug === 'index' ? '1.0' : '0.8'}</priority>
  </url>`).join('');

  const blogIndexUrl = `
  <url>
    <loc>${site.domain}/blog/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`;

  const blogUrls = blogPosts.map(p => `
  <url>
    <loc>${site.domain}/blog/${p.slug}</loc>
    <lastmod>${p.isoDate || now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pageUrls}${blogIndexUrl}${blogUrls}
</urlset>`;

  write(path.join(DIST, 'sitemap.xml'), xml);
}

function copyAssets() {
  console.log('\n[4/4] Copying assets…');
  copyDir(CSS_SRC, path.join(DIST, 'css'));
  console.log('  copied css/');
  copyDir(PUB_SRC, DIST);
  console.log('  copied public/');
}

// ── Entry point ───────────────────────────────────────────────────────────────
function main() {
  console.log('=== Poki2 Portal Build ===');
  fs.mkdirSync(DIST, { recursive: true });
  buildPages();
  buildBlog();
  buildSitemap();
  copyAssets();
  console.log('\n✓ Build complete → dist/');
}

main();
