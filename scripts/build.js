"use strict";

const fs   = require('fs');
const path = require('path');

const { site, pages, blogPosts, gamePosts } = require('./config.js');

// Only include non-deprecated games in frontend listings and sitemap
const visibleGames = gamePosts.filter(g => !g.deprecated);

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

// ── Template helpers ─────────────────────────────────────────────────────────
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

function withBrand(title) {
  const value = String(title || '').trim();
  if (!value) return site.name;
  return value.toLowerCase().includes(site.name.toLowerCase()) ? value : `${value} | ${site.name}`;
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
  const h2Re = /<h2[\s>]/gi;
  let match, count = 0, insertAt = -1;
  while ((match = h2Re.exec(content)) !== null) {
    count++;
    if (count === 2) { insertAt = match.index; break; }
  }
  if (insertAt === -1) insertAt = Math.floor(content.length / 2);
  return content.slice(0, insertAt) + '\n' + MID_AD_HTML + '\n' + content.slice(insertAt);
}

function extractFirstImageSrc(content) {
  const imgMatch = String(content || '').match(/<img[^>]+src=["']([^"']+)["']/i);
  return imgMatch ? String(imgMatch[1]).trim() : '';
}

function cssUrlValue(url) {
  return String(url || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function decodeBasicHtmlEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function fillBase(template, page, content) {
  const ogImage = `${site.domain}/og-image.png`;
  const brandedTitle = withBrand(page.title);
  const robotsMeta = page.indexable === false
    ? '<meta name="robots" content="noindex,follow">'
    : '<meta name="robots" content="index,follow">';
  return template
    .replace(/\{\{TITLE\}\}/g,               esc(brandedTitle))
    .replace(/\{\{DESCRIPTION\}\}/g,         esc(page.description || ''))
    .replace(/\{\{ROBOTS_META\}\}/g,         robotsMeta)
    .replace(/\{\{KEYWORDS\}\}/g,            esc(page.keywords || ''))
    .replace(/\{\{CANONICAL\}\}/g,           page.canonical || '')
    .replace(/\{\{OG_TITLE\}\}/g,            esc(brandedTitle))
    .replace(/\{\{OG_DESCRIPTION\}\}/g,      esc(page.description || ''))
    .replace(/\{\{OG_URL\}\}/g,             page.canonical || '')
    .replace(/\{\{OG_TYPE\}\}/g,            page.ogType || 'website')
    .replace(/\{\{OG_IMAGE\}\}/g,           ogImage)
    .replace(/\{\{TWITTER_TITLE\}\}/g,      esc(brandedTitle))
    .replace(/\{\{TWITTER_DESCRIPTION\}\}/g, esc(page.description || ''))
    .replace(/\{\{TWITTER_IMAGE\}\}/g,      ogImage)
    .replace(/\{\{SCHEMA\}\}/g,             schemaTag(page.schema || []))
    .replace(/\{\{BODY_CLASS\}\}/g,         page.bodyClass || '')
    .replace(/\{\{CONTENT\}\}/g,            content);
}

function fillArticle(template, post, content, relatedLinks) {
  const canonical = `${site.domain}/blog/${post.slug}`;
  const buildTs   = new Date().toISOString();
  const heroImg   = extractFirstImageSrc(content);
  const ogImage   = heroImg || `${site.domain}/og-image.png`;
  const schemaImage = heroImg
    ? { '@type': 'ImageObject', url: heroImg, width: 1200, height: 630 }
    : { '@type': 'ImageObject', url: `${site.domain}/og-image.png`, width: 1200, height: 630 };
  const schema    = [{
    '@context': 'https://schema.org',
    '@type': ['Article', 'BlogPosting'],
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    headline:    post.title,
    description: post.description,
    image:       schemaImage,
    url:         canonical,
    datePublished: post.isoDate || '2026-04-04',
    dateModified:  post.isoDate || '2026-04-04',
    author: { '@type': 'Organization', name: 'Poki2', url: site.domain },
    publisher: {
      '@type': 'Organization', name: 'Poki2', url: site.domain,
      logo: { '@type': 'ImageObject', url: `${site.domain}/favicon.svg` }
    },
  }, {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${site.domain}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${site.domain}/blog/` },
      { '@type': 'ListItem', position: 3, name: post.title, item: canonical },
    ],
  }];

  const brandedTitle = withBrand(`${post.title} — Poki2 Blog`);

  return template
    .replace(/\{\{TITLE\}\}/g,               esc(brandedTitle))
    .replace(/\{\{DESCRIPTION\}\}/g,         esc(post.description || ''))
    .replace(/\{\{ROBOTS_META\}\}/g,         '<meta name="robots" content="index,follow">')
    .replace(/\{\{CANONICAL\}\}/g,           canonical)
    .replace(/\{\{OG_TITLE\}\}/g,            esc(brandedTitle))
    .replace(/\{\{OG_DESCRIPTION\}\}/g,      esc(post.description || ''))
    .replace(/\{\{OG_URL\}\}/g,              canonical)
    .replace(/\{\{OG_IMAGE\}\}/g,           ogImage)
    .replace(/\{\{TWITTER_TITLE\}\}/g,      esc(brandedTitle))
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

function fillGame(template, game, content, relatedLinks) {
  const canonical = `${site.domain}/fgame/${game.slug}`;
  const buildTs   = new Date().toISOString();
  const schema    = [{
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    name:        game.title,
    description: game.description,
    url:         canonical,
    image:       game.imgUrl || `${site.domain}/og-image.png`,
    genre:       game.genre,
    numberOfPlayers: { '@type': 'QuantitativeValue', name: game.players },
    gameEdition: 'Browser',
    operatingSystem: 'Web Browser',
    applicationCategory: 'Game',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    publisher: { '@type': 'Organization', name: 'Poki2', url: site.domain },
    datePublished: game.isoDate || '2026-04-07',
  }, {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${site.domain}/` },
      { '@type': 'ListItem', position: 2, name: 'Games', item: `${site.domain}/fgame/` },
      { '@type': 'ListItem', position: 3, name: game.title, item: canonical },
    ],
  }];

  const brandedTitle = withBrand(`${game.title} — Play Free Online`);

  return template
    .replace(/\{\{TITLE\}\}/g,             esc(brandedTitle))
    .replace(/\{\{DESCRIPTION\}\}/g,       esc(game.description))
    .replace(/\{\{ROBOTS_META\}\}/g,       '<meta name="robots" content="index,follow">')
    .replace(/\{\{CANONICAL\}\}/g,         canonical)
    .replace(/\{\{OG_TITLE\}\}/g,          esc(brandedTitle))
    .replace(/\{\{OG_DESCRIPTION\}\}/g,    esc(game.description))
    .replace(/\{\{OG_URL\}\}/g,            canonical)
    .replace(/\{\{OG_IMAGE\}\}/g,          game.imgUrl || `${site.domain}/og-image.png`)
    .replace(/\{\{TWITTER_TITLE\}\}/g,     esc(brandedTitle))
    .replace(/\{\{TWITTER_DESCRIPTION\}\}/g, esc(game.description))
    .replace(/\{\{TWITTER_IMAGE\}\}/g,     game.imgUrl || `${site.domain}/og-image.png`)
    .replace(/\{\{SCHEMA\}\}/g,            schemaTag(schema))
    .replace(/\{\{GAME_SLUG\}\}/g,         game.slug)
    .replace(/\{\{GAME_TITLE\}\}/g,        game.title)
    .replace(/\{\{GAME_TITLE_PLAIN\}\}/g,  esc(game.title))
    .replace(/\{\{GAME_GENRE\}\}/g,        esc(game.genre))
    .replace(/\{\{GAME_PLAYERS\}\}/g,      esc(game.players))
    .replace(/\{\{GAME_CONTROLS\}\}/g,     esc(game.controls))
    .replace(/\{\{GAME_EMBED_URL\}\}/g,    game.embedUrl)
    .replace(/\{\{GAME_IMG_URL\}\}/g,      game.imgUrl || `${site.domain}/og-image.png`)
    .replace(/\{\{GAME_DATE\}\}/g,         game.date || '')
    .replace(/\{\{RELATED_GAME_LINKS\}\}/g, relatedLinks)
    .replace(/\{\{CONTENT\}\}/g,           content)
    .replace(/\{\{BUILD_TS\}\}/g,          buildTs);
}

// ── Build steps ─────────────────────────────────────────────────────────────
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
    let finalContent = content;

    // If building the homepage, inject generated featured + editor pick grids
    if (page.slug === 'index') {
      function renderFeaturedGrid(games) {
        const cards = games.slice(0, 12).map(g =>
          `<a href="/fgame/${g.slug}" class="featured-card"><img src="${g.imgUrl}" alt="${esc(g.title)}" loading="lazy" width="160" height="160"><span class="featured-card-label">${esc(g.title)}</span><span class="featured-card-src">${esc(g.category || g.genre || '')}</span></a>`
        ).join('\n      ');
        return `<div class="featured-grid" style="margin-top:1.5rem">\n      ${cards}\n    </div>`;
      }

      function renderEditorsPicks(games) {
        // 6 cards from games[6..12] – no overlap with Featured
        const picks = games.length >= 24 ? games.slice(12, 24) : games.slice(0, 12);
        const cards = picks.map(g =>
          `<a href="/fgame/${g.slug}" class="featured-card"><img src="${g.imgUrl}" alt="${esc(g.title)}" loading="lazy" width="160" height="160"><span class="featured-card-label">${esc(g.title)}</span><span class="featured-card-src">${esc(g.category || g.genre || '')}</span></a>`
        ).join('\n      ');
        return `<div class="featured-grid" style="margin-top:1.5rem">\n      ${cards}\n    </div>`;
      }

      finalContent = finalContent.replace('<!-- GENERATED_FEATURED_GRID -->', renderFeaturedGrid(visibleGames));
      finalContent = finalContent.replace('<!-- GENERATED_EDITORS_PICKS -->', renderEditorsPicks(visibleGames));
    }

    const html    = fillBase(baseTemplate, page, finalContent);
    write(path.join(DIST, page.outputFile), html);
  }
}

function buildGames() {
  console.log('\n[2/5] Building game pages…');
  const gameTemplate = read(path.join(SRC, 'templates', 'game.html'));
  const baseTemplate = read(path.join(SRC, 'templates', 'base.html'));

  // Individual game pages — only for visible games
  for (const game of visibleGames) {
    const contentFile = path.join(SRC, 'content', 'fgame', `${game.slug}.html`);
    if (!fs.existsSync(contentFile)) {
      console.warn('  SKIP (missing content):', game.slug);
      continue;
    }
    const content = read(contentFile);

    // Related games: deterministic offsets from visibleGames
    const idx  = visibleGames.indexOf(game);
    const n    = visibleGames.length;
    const offs = [2, 5, 9, 14];
    const picked = offs.map(o => visibleGames[(idx + o) % n]).filter(g => g.slug !== game.slug);
    const relatedLinks = picked.slice(0, 4).map(g =>
      `<a href="/fgame/${g.slug}" class="related-game-card"><img src="${g.imgUrl}" alt="${esc(g.title)}" loading="lazy" width="28" height="28">${esc(g.title)}</a>`
    ).join('\n          ');

    const html = fillGame(gameTemplate, game, content, relatedLinks);
    write(path.join(DIST, 'fgame', `${game.slug}.html`), html);
  }

  // Build games index page
  const baseGamesPage = {
    slug:       'games/index',
    outputFile: 'games/index.html',
    bodyClass:  'games-index-page',
    title:      'Free Browser Games — Play Instantly, No Download | Poki2',
    description:'Browse 20+ free browser games on Poki2. Play 2048, Slope, 1v1.LOL, Cookie Clicker, and more — no download, no account, instant play on any device.',
    keywords:   'free browser games, online games no download, play 2048, slope game, 1v1 lol',
    canonical:  `${site.domain}/fgame/`,
    ogType:     'website',
    schema: [{
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      url:  `${site.domain}/fgame/`,
      name: 'Free Browser Games — Poki2',
      description: 'Browse and play free browser games on Poki2. No download, no account required.',
      publisher: { '@type': 'Organization', name: 'Poki2', url: site.domain },
    }, {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${site.domain}/` },
        { '@type': 'ListItem', position: 2, name: 'Games', item: `${site.domain}/fgame/` },
      ],
    }, {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Poki2 Games List',
      itemListOrder: 'https://schema.org/ItemListUnordered',
      numberOfItems: visibleGames.length,
      itemListElement: visibleGames.slice(0, 120).map((g, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${site.domain}/fgame/${g.slug}`,
        name: g.title,
      })),
    }],
  };

  // Group visible games by category
  const CATEGORY_ORDER = ['Puzzle', 'Action & Shooter', 'Endless Runner', 'Racing', 'Platformer & Arcade', 'Sports & IO', 'Idle & Sandbox'];
  const grouped = {};
  for (const cat of CATEGORY_ORDER) grouped[cat] = [];
  for (const g of visibleGames) {
    const cat = g.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(g);
  }

  const categorySections = CATEGORY_ORDER.filter(cat => grouped[cat].length > 0).map(cat => {
    const catId = cat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    const cards = grouped[cat].map(g =>
      `<a href="/fgame/${g.slug}" class="game-index-card"><img src="${g.imgUrl}" alt="${esc(g.title)}" loading="lazy" width="120" height="120"><div class="game-index-card-body"><h3 class="game-index-card-title">${esc(g.title)}</h3><span class="game-index-card-genre">${esc(g.genre)}</span><span class="game-index-card-players">${esc(g.players)}</span></div></a>`
    ).join('');
    return `<h2 id="${catId}" class="game-cat-heading">${esc(cat)}</h2><div class="game-index-grid">${cards}</div>`;
  }).join('');

  const gamesIndexContent = `
<div class="blog-listing-wrap">
  <div class="blog-listing-header">
    <h1>Free Browser Games</h1>
    <p>Find your next game in seconds on Poki2. Browse by genre, open any game page, and start playing instantly with no download or account.</p>
  </div>
  <style>
    .game-cat-heading{font-size:1.15rem;font-weight:700;color:#f1f5f9;margin:2.25rem 0 .75rem;padding-bottom:.4rem;border-bottom:1px solid rgba(255,255,255,.08)}
    .game-index-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:1rem;margin-bottom:.25rem}
    .game-index-card{display:flex;flex-direction:column;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:10px;overflow:hidden;text-decoration:none;color:#e2e8f0;transition:transform .15s,border-color .15s}
    .game-index-card:hover{transform:translateY(-3px);border-color:rgba(99,102,241,.5)}
    .game-index-card img{width:100%;aspect-ratio:1/1;object-fit:cover}
    .game-index-card-body{padding:.6rem .75rem .75rem}
    .game-index-card-title{font-size:.95rem;font-weight:600;margin:0 0 .3rem;color:#f1f5f9}
    .game-index-card-genre,.game-index-card-players{font-size:.75rem;color:#94a3b8;display:block}
  </style>
  ${categorySections}
</div>`;

  const gamesIndexHtml = fillBase(baseTemplate, baseGamesPage, gamesIndexContent);
  write(path.join(DIST, 'fgame', 'index.html'), gamesIndexHtml);
}

function buildBlog() {
  console.log('\n[3/5] Building blog…');
  const articleTemplate = read(path.join(SRC, 'templates', 'article.html'));
  const baseTemplate    = read(path.join(SRC, 'templates', 'base.html'));

  for (const post of blogPosts) {
    const contentFile = path.join(SRC, 'content', 'blog', `${post.slug}.html`);
    if (!fs.existsSync(contentFile)) {
      console.warn('  SKIP (missing content):', post.slug);
      continue;
    }
    const rawContent = read(contentFile);
    const content = injectMidAd(rawContent);

    const allPosts = blogPosts;
    const idx = allPosts.indexOf(post);
    const n = allPosts.length;
    const offsets = [3, 6, 10, 13];
    const picked = offsets.map(o => allPosts[(idx + o) % n]).filter(p => p.slug !== post.slug);
    const usedSlugs = new Set(picked.map(p => p.slug));
    const fallback = allPosts.filter(p => p.slug !== post.slug && !usedSlugs.has(p.slug));
    while (picked.length < 4 && fallback.length) picked.push(fallback.shift());
    const relatedLinks = picked.slice(0, 4)
      .map(p => `<li><a href="/blog/${p.slug}">${esc(p.title)}</a></li>`)
      .join('\n          ');

    const html = fillArticle(articleTemplate, post, content, relatedLinks);
    write(path.join(DIST, 'blog', `${post.slug}.html`), html);
  }

  let blogIndexContent = read(path.join(SRC, 'content', 'blog', 'index.html'));
  const defaultBlogCardImage = `${site.domain}/favicon.svg`;

  const sortedBlogPosts = blogPosts
    .map((post, index) => ({ post, index, ts: Date.parse(post.isoDate || '') || 0 }))
    .sort((a, b) => (b.ts - a.ts) || (b.index - a.index))
    .map(item => item.post);

  const cardsHtml = sortedBlogPosts.map((post) => {
    const contentFile = path.join(SRC, 'content', 'blog', `${post.slug}.html`);
    const postContent = fs.existsSync(contentFile) ? read(contentFile) : '';
    const firstImage = extractFirstImageSrc(postContent) || defaultBlogCardImage;
    const imgStyle = ` style="background-image:url('${cssUrlValue(firstImage)}');background-size:cover;background-position:center;background-repeat:no-repeat"`;
    const safeTitle = esc(decodeBasicHtmlEntities(post.title));
    const safeCategory = esc(decodeBasicHtmlEntities(post.category || 'Guides'));
    const safeDescription = esc(decodeBasicHtmlEntities(post.description || ''));
    const safeDate = esc(post.date || '');
    const safeReadTime = esc(post.readTime || '');

    return `
    <article class="blog-listing-card">
      <a href="/blog/${post.slug}" class="blog-card-img-link" tabindex="-1" aria-hidden="true">
        <div class="blog-card-img" role="img" aria-label="${safeTitle}"${imgStyle}></div>
      </a>
      <div class="blog-card-body">
        <div class="blog-card-meta">
          <span class="blog-cat">${safeCategory}</span>
          <span class="blog-date">${safeDate}</span>
          <span class="blog-time">${safeReadTime}</span>
        </div>
        <h2><a href="/blog/${post.slug}">${safeTitle}</a></h2>
        <p>${safeDescription}</p>
        <a href="/blog/${post.slug}" class="read-more-link">Read article →</a>
      </div>
    </article>`;
  }).join('\n');

  blogIndexContent = blogIndexContent.replace(
    /<div class="blog-listing-grid">[\s\S]*?<\/div>\s*<div class="blog-listing-editorial/g,
    `<div class="blog-listing-grid">\n${cardsHtml}\n\n  </div>\n\n  <div class="blog-listing-editorial`
  );

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
    }, {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${site.domain}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${site.domain}/blog/` },
      ],
    }, {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Poki2 Blog Articles',
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      numberOfItems: sortedBlogPosts.length,
      itemListElement: sortedBlogPosts.slice(0, 120).map((post, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${site.domain}/blog/${post.slug}`,
        name: decodeBasicHtmlEntities(post.title),
      })),
    }],
  };
  const html = fillBase(baseTemplate, blogIndexPage, blogIndexContent);
  write(path.join(DIST, 'blog', 'index.html'), html);
}

function buildSearchIndex() {
  console.log('\n[4/6] Building search index…');

  const gameEntries = visibleGames.map((game) => ({
    type: 'game',
    title: game.title,
    description: game.description || '',
    url: `${site.domain}/fgame/${game.slug}`,
    image: game.imgUrl || '',
    tags: [game.slug, game.genre || '', game.category || '', game.players || '', game.controls || ''].join(' '),
  }));

  write(
    path.join(DIST, 'search-index.json'),
    JSON.stringify(gameEntries, null, 2)
  );
}

function buildSitemap() {
  console.log('\n[5/6] Building sitemap…');
  const now = new Date().toISOString().split('T')[0];

  const indexablePages = pages.filter((p) => p.indexable !== false);

  const pageUrls = indexablePages.map(p => `
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

  const gamesIndexUrl = `
  <url>
    <loc>${site.domain}/fgame/</loc>
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

  // Only include visible (non-deprecated) games in the sitemap
  const gameUrls = visibleGames.map(g => `
  <url>
    <loc>${site.domain}/fgame/${g.slug}</loc>
    <lastmod>${g.isoDate || now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pageUrls}${blogIndexUrl}${gamesIndexUrl}${blogUrls}${gameUrls}
</urlset>`;

  write(path.join(DIST, 'sitemap.xml'), xml);
}

function minifyCss(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')      // remove /* comments */
    .replace(/\s*([{}:;,>~+])\s*/g, '$1') // strip spaces around punctuation
    .replace(/;\s*}/g, '}')               // remove trailing semicolons before }
    .replace(/\s{2,}/g, ' ')              // collapse multiple spaces
    .replace(/^\s+|\s+$/g, '')            // trim
    .replace(/\n/g, '');                  // remove newlines
}

function copyAssets() {
  console.log('\n[6/6] Copying assets…');

  const cssDest = path.join(DIST, 'css');
  fs.mkdirSync(cssDest, { recursive: true });
  for (const entry of fs.readdirSync(CSS_SRC, { withFileTypes: true })) {
    const s = path.join(CSS_SRC, entry.name);
    const d = path.join(cssDest, entry.name);
    if (!entry.isDirectory() && entry.name === 'style.css') {
      const minified = minifyCss(fs.readFileSync(s, 'utf8'));
      fs.writeFileSync(d, minified, 'utf8');
      const saved = ((1 - minified.length / fs.statSync(s).size) * 100).toFixed(1);
      console.log(`  minified css/style.css (${saved}% smaller)`);
    } else if (!entry.isDirectory()) {
      fs.copyFileSync(s, d);
    }
  }
  console.log('  copied css/');

  copyDir(PUB_SRC, DIST);
  console.log('  copied public/');

  const staleFiles = ['test.html'];
  for (const f of staleFiles) {
    const fp = path.join(DIST, f);
    if (fs.existsSync(fp)) { fs.unlinkSync(fp); console.log('  removed stale:', f); }
  }
}

function main() {
  console.log('=== Poki2 Portal Build ===');
  // Always rebuild from a clean output directory to prevent stale pages from being deployed.
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  buildPages();
  buildGames();
  buildBlog();
  buildSearchIndex();
  buildSitemap();
  copyAssets();
  console.log('\n✓ Build complete → dist/');
}

main();
