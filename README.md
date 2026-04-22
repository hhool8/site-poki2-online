# Poki2 Portal — poki2.online

> **The Ultimate Free Browser Games Network** — 1,000+ games, no download, no account, instant play on any device.

Static site powering [poki2.online](https://poki2.online/). Built with a zero-dependency Node.js build system, deployed to Cloudflare Pages.

---

## Table of Contents

- [Poki2 Portal — poki2.online](#poki2-portal--poki2online)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Project Structure](#project-structure)
  - [Development](#development)
  - [Deployment](#deployment)
  - [Adding Content](#adding-content)
    - [New static page](#new-static-page)
    - [New blog article](#new-blog-article)
  - [Ad Infrastructure](#ad-infrastructure)
  - [SEO \& Analytics](#seo--analytics)
  - [Network Sites](#network-sites)
  - [AdSense Review Checklist](#adsense-review-checklist)

---

## Overview

| Item | Value |
|------|-------|
| Domain | `https://poki2.online` |
| Hosting | Cloudflare Pages (`poki2-portal`) |
| Build | Node.js (zero npm runtime deps) |
| CSS | Single `css/style.css` (minified on build) |
| AdSense publisher | `ca-pub-6199549323873133` |
| GA4 property | `G-T69PZL0ELE` |
| Node requirement | ≥ 18 |

---

## Project Structure

```
h5games_poki2_redesign/
├── css/
│   └── style.css              # Single source stylesheet (minified into dist/)
├── public/                    # Static assets copied verbatim to dist/
│   ├── ads.txt
│   ├── robots.txt
│   ├── sitemap.xml            # Overwritten by build
│   ├── favicon.svg
│   ├── og-image.png
│   ├── _headers               # Cloudflare Pages HTTP headers (HSTS, CSP…)
│   ├── _redirects             # Cloudflare Pages URL redirects
│   ├── 404.html
│   └── google65c93755d768ab97.html  # Search Console verification
├── scripts/
│   ├── build.js               # Build script — templates + content → dist/
│   └── config.js              # Site constants, network config, page metadata, blog post list
├── src/
│   ├── templates/
│   │   ├── base.html          # Shell for all static pages (nav, footer, AdSense, GA4, cookie consent)
│   │   └── article.html       # Shell for blog articles (breadcrumbs, author bio, related posts, 3 ad units)
│   └── content/
│       ├── index.html         # Homepage body fragment
│       ├── about.html
│       ├── contact.html
│       ├── privacy.html
│       ├── terms.html
│       ├── dmca.html
│       └── blog/
│           ├── index.html     # Blog listing page (15 cards + editorial)
│           └── *.html         # 15 individual article body fragments
└── dist/                      # Build output (git-ignored) — deployed to Cloudflare Pages
```

---

## Development

**Prerequisites:** Node.js ≥ 18, no other runtime dependencies.

```bash
# Install dev tooling (only wrangler)
npm install

# Build → dist/
npm run build

# Clean build output
npm run clean
```

The build script (`scripts/build.js`) does the following in sequence:

1. **Static pages** — fills `src/templates/base.html` with each page's content fragment and metadata from `scripts/config.js`
2. **Blog articles** — fills `src/templates/article.html`, auto-injects a mid-article ad before the 2nd `<h2>`, generates related-post links, and emits `BlogPosting` + `BreadcrumbList` JSON-LD
3. **Sitemap** — generates `dist/sitemap.xml` with all 22 URLs (6 static + blog index + 15 articles)
4. **Assets** — minifies `css/style.css` (~18% smaller) and copies `public/` into `dist/`

---

## Deployment

Hosted on **Cloudflare Pages** project `poki2-portal`, branch `main`.

```bash
# Re-authenticate (token expires; run interactively to open browser)
npx wrangler login

# Deploy dist/ to Cloudflare Pages
NODE_TLS_REJECT_UNAUTHORIZED=0 npx wrangler pages deploy ./dist --project-name poki2-portal --branch main

# Or via npm script (without the TLS flag)
npm run deploy
```

> **Note:** The `NODE_TLS_REJECT_UNAUTHORIZED=0` flag is required on macOS 12 due to a wrangler compatibility issue with older system TLS. Remove it once on macOS 13+.

---

## Adding Content

### New static page

1. Add a page object to the `pages` array in `scripts/config.js`
2. Create `src/content/<slug>.html` with the body fragment
3. Add a nav/footer link in `src/templates/base.html` and `src/templates/article.html` if needed
4. Run `npm run build`

### New blog article

1. Add a post object to the `blogPosts` array in `scripts/config.js`:

```js
{
  slug:        'my-new-article',
  title:       'Article Title',
  description: 'Meta description (≤ 155 chars)',
  date:        'April 6, 2026',
  isoDate:     '2026-04-06',
  category:    'Top Lists',   // or 'Guides' / 'Reviews'
  readTime:    '7 min read',
}
```

2. Create `src/content/blog/my-new-article.html` — body fragment only (no `<html>`/`<head>`).  
   Start with a `<figure class="article-hero">` image, then headings and paragraphs.  
   Target **≥ 1 400 words** for AdSense content quality.

3. Add a `.blog-card-img--N` gradient class to `css/style.css` for the blog listing card thumbnail.

4. Add a card to `src/content/blog/index.html`.

5. Run `npm run build` then deploy.

---

## Ad Infrastructure

| Slot | Location | ID |
|------|----------|----|
| Homepage — top | Before network grid | `9902197949` |
| Homepage — mid | After network heading | `3216535942` |
| Homepage — bottom | Before blog section | `5667004696` |
| Article — top | Above article body | `9336055885` |
| Article — mid | Auto-injected before 2nd `<h2>` | `9336055885` |
| Article — bottom | Below article body | `4696703805` |
| Blog index | Leaderboard above grid | `8151800876` |
| About page | Leaderboard | `1919331375` |

**No-op override** is active while awaiting AdSense approval:

```html
<!-- TODO: remove after AdSense approval -->
<script>window.adsbygoogle = { push: function(){} };</script>
```

Remove this line from both `src/templates/base.html` and `src/templates/article.html` once the account is approved, then rebuild and deploy.

**Unfilled slot hiding:** `ins.adsbygoogle:not([data-ad-status])` is hidden via CSS so empty ad boxes never affect layout.

---

## SEO & Analytics

- **Canonical URLs** on every page
- **Open Graph + Twitter Card** meta on every page
- **JSON-LD** — `BlogPosting` + `BreadcrumbList` on every article; `Blog` schema on blog index; `WebSite` schema on homepage
- **Sitemap** auto-generated at `https://poki2.online/sitemap.xml` (22 URLs)
- **robots.txt** — `Allow: /` with sitemap reference
- **GA4** with Consent Mode v2 (`ad_storage: denied` by default until cookie consent granted)
- **Cookie Consent** — vanilla-cookieconsent v3, GDPR-compliant bar layout
- **Security headers** — HSTS, CSP, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` via `public/_headers`
- **ads.txt** — `google.com, pub-6199549323873133, DIRECT, f08c47fec0942fa0`

---

## Network Sites

| Site | URL | Status | Games |
|------|-----|--------|-------|
| Poki2 Play | [play.poki2.online](https://play.poki2.online/) | Live | 200+ |
| AZ Games | [azgames.poki2.online](https://azgames.poki2.online/) | Live | 300+ |
| Unblocked Games | [ubg66.poki2.online](https://ubg66.poki2.online/) | Live | 474+ |
| IO Arena | [io.poki2.online](https://io.poki2.online/) | Coming soon | — |
| Kids Games | [kids.poki2.online](https://kids.poki2.online/) | Coming soon | 100+ |

---

## AdSense Review Checklist

- [x] `google-adsense-account` meta tag on all pages
- [x] `ads.txt` at domain root
- [x] All ad slot IDs unique across pages
- [x] 15 blog articles ≥ 1 400 words each
- [x] Policy pages: Privacy, Terms, DMCA, About, Contact
- [x] Sitemap submitted to Google Search Console
- [x] Cookie Consent + Consent Mode v2
- [x] formsubmit.co contact form activation (reply to verification email at `contact@poki2.online`)
- [ ] AdSense review application submitted at adsense.google.com
