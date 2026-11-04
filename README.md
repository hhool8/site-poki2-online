# Poki2 Portal — poki2.online

> **The Ultimate Free Browser Games Network** — 1,000+ games across the network, no download, no account, instant play on any device.

Static site powering [poki2.online](https://poki2.online/). Built with a zero-dependency Node.js build system, deployed to Cloudflare Pages.

---

## Table of Contents

- [Overview](#overview)
- [What this repo contains](#what-this-repo-contains)
- [Project Structure](#project-structure)
- [Development](#development)
- [Deployment](#deployment)
- [Adding Content](#adding-content)
  - [New static page](#new-static-page)
  - [New blog article](#new-blog-article)
  - [New game](#new-game)
- [Sitemap scope](#sitemap-scope)
- [Ad Infrastructure](#ad-infrastructure)
- [SEO \& Analytics](#seo--analytics)
- [Network Sites](#network-sites)
- [Credentials and personal identifiers](#credentials-and-personal-identifiers)
- [Analysis documents](#analysis-documents)
- [AdSense Review Checklist](#adsense-review-checklist)
- [License](#license)

---

## Overview

| Item | Value |
|------|-------|
| Domain | `https://poki2.online` |
| Hosting | Cloudflare Pages (`poki2-portal`) |
| Build | Node.js (zero npm runtime deps) |
| CSS | Single `css/style.css` (minified on build) |
| Published pages | 120 (excluding the 404 page) |
| Game pages | 70 at `/fgame/<slug>` |
| Genre pages | 7 at `/fgame/<genre>` |
| Blog posts | 27 at `/blog/<slug>` |
| Sitemap | 26 URLs at `https://poki2.online/sitemap.xml` |
| AdSense publisher | `ca-pub-5676206764686662` |
| GA4 property | `G-T69PZL0ELE` |
| Node requirement | ≥ 18 |

### Page inventory

| Type | Path | Count |
|---|---|---|
| Homepage | `/` | 1 |
| Game pages | `/fgame/<slug>` | 70 |
| Genre pages | `/fgame/<genre>` | 7 |
| Two-player hub | `/fgame/2-player-games` | 1 |
| Game index | `/fgame/` | 1 |
| Blog posts | `/blog/<slug>` | 27 |
| Blog index | `/blog/` | 1 |
| Policy & utility | `/about`, `/contact`, `/privacy`, `/terms`, `/dmca`, `/search/` | 6 |
| Embed-only shells | `/embed/<slug>` | 6 |
| **Total** | | **120** |

`/embed/<slug>` pages are minimal frames used to host a game outside the
ad-bearing page shell. They carry no canonical and are not in the sitemap.

---

## What this repo contains

This is the **apex portal** — the marketing and editorial front end for the
Poki2 network. It is one of several repositories:

| Repo | What it is |
|---|---|
| **this one** (`site-poki2-online`) | The apex site: homepage, game guides, blog, genre hubs. Deploys to `poki2.online`. |
| `site-poki2-play` | The game-catalogue host. Deploys to `play.poki2.online`. |
| `poki2-online-sidecar` | Measurement and research workspace: Search Console tooling, audits, link tracking. Not deployed. |

The apex and the play host are **two doors to the same catalogue**. Most
`/fgame/<slug>` pages on the apex duplicate a `/game/<c>/<slug>/` page on play,
and both sides self-canonical. That duplication is a known, measured problem —
see `docs/` — and is the reason only 26 URLs are advertised in the sitemap.

---

## Project Structure

```
04-source/
├── css/
│   └── style.css              # Single source stylesheet (minified into dist/)
├── data/
│   └── lastmod.json           # Committed source-file → date map for sitemap <lastmod>
├── docs/                      # Analysis documents (Markdown only — see docs/README.md)
├── infra/
│   └── cloudflare-cache-rule.json  # Zone-level Cache Rule payload (applied out-of-band)
├── public/                    # Static assets copied verbatim to dist/
│   ├── ads.txt                # Web ad sellers
│   ├── app-ads.txt            # App ad sellers (two authorized Google publishers)
│   ├── robots.txt
│   ├── llms.txt               # LLM-readable site index
│   ├── _headers               # Cloudflare Pages HTTP headers (HSTS, CSP…)
│   ├── _redirects             # Cloudflare Pages URL redirects
│   ├── favicon.svg
│   ├── og-image.png
│   ├── 404.html
│   ├── indexnow-<key>.txt     # IndexNow key file (public by design)
│   └── google65c93755d768ab97.html  # Search Console verification
├── scripts/
│   ├── build.js               # Build script — templates + content → dist/
│   ├── config.js              # Site constants + page/blog/game metadata + AdSense switch
│   ├── deploy.js              # Deploy → cache purge → IndexNow (resolves credentials)
│   ├── purge-cache.js         # Cloudflare zone cache purge
│   ├── indexnow.js            # IndexNow announcement for every published page
│   ├── sitemap-scope.json     # Which URLs the sitemap advertises (and why)
│   ├── gen-lastmod.js         # Refresh data/lastmod.json from git
│   ├── gen-favicons.js
│   ├── gen-og-image.js
│   ├── gen-game-og-images.js
│   ├── html-to-markdown.js    # One-off: legacy HTML report → Markdown
│   ├── audit-crawler.js       # On-page auditor (sitemap crawl, titles, canonical, OG…)
│   ├── audit-deep.js          # Internal-link graph, TTFB, compression, image weight
│   ├── bing-status.js         # Bing Webmaster API: discovery / crawl status per URL
│   └── gen-img-manifest.js    # Content-hashed image manifest generator
│                                 (plus one-off migration scripts kept for provenance:
│                                  recompress-images.js, migrate-unsplash.js,
│                                  download-imgs.js, fix-img-dims.js, gen-thumbs.js,
│                                  seo-fix-titles.js, bump-*.js, trim-titles-1003.js)
├── src/
│   ├── templates/
│   │   ├── base.html          # Shell for all static pages (nav, footer, AdSense, GA4, cookie consent)
│   │   ├── article.html       # Shell for blog articles (breadcrumbs, author bio, related posts, 3 ad units)
│   │   └── game.html          # Shell for individual game pages
│   └── content/
│       ├── index.html         # Homepage body fragment
│       ├── search.html
│       ├── about.html
│       ├── contact.html
│       ├── privacy.html
│       ├── terms.html
│       ├── dmca.html
│       ├── 2-player-games.html
│       ├── fgame/
│       │   └── *.html         # Individual game content fragments
│       └── blog/
│           ├── index.html     # Blog listing page
│           └── *.html         # 27 individual article body fragments
├── dist/                      # Build output (git-ignored) — deployed to Cloudflare Pages
├── LICENSE                    # MIT
└── wrangler.pages.toml        # Cloudflare Pages config (no account id)
```

---

## Development

**Prerequisites:** Node.js ≥ 18, no other runtime dependencies.

```bash
# Install dev tooling (only wrangler, sharp, to-ico)
npm install

# Build → dist/
npm run build

# Clean build output
npm run clean

# Preview the built site locally
npx wrangler pages dev dist
```

The build script (`scripts/build.js`) does the following in sequence:

1. **Static pages** — fills `src/templates/base.html` with each page's content fragment and metadata from `scripts/config.js`
2. **Genre pages** — generates `/fgame/<genre>` from the same game data as the `/fgame/` index
3. **Game pages** — fills `src/templates/game.html`, generates related-game links, and emits `VideoGame` + `BreadcrumbList` JSON-LD
4. **Blog articles** — fills `src/templates/article.html`, auto-injects a mid-article ad before the 2nd `<h2>`, generates related-post links, and emits `BlogPosting` + `BreadcrumbList` JSON-LD
5. **Search index** — generates `dist/search-index.json` for nav search suggestions and the `/search/` result page
6. **Sitemap** — generates `dist/sitemap.xml` from the scope in `scripts/sitemap-scope.json`
7. **`llms-full.txt`** — regenerates the full LLM-readable site index
8. **Assets** — minifies `css/style.css` and copies `public/` into `dist/`

---

## Deployment

Hosted on **Cloudflare Pages** project `poki2-portal`, branch `main`.

```bash
# One-time: authenticate with Cloudflare
npx wrangler login

# Build, deploy, purge the edge cache, announce to IndexNow
npm run release
```

`npm run deploy` (without the build) runs `scripts/deploy.js`, which:

1. Resolves the Cloudflare **account id** and **zone id** (see below — never committed)
2. Runs `wrangler pages deploy dist --project-name poki2-portal --branch main`
3. Runs `scripts/purge-cache.js` — clears the edge cache
4. Runs `scripts/indexnow.js` — announces every published page to IndexNow

**Step 3 is not optional.** Cloudflare Pages classifies `text/html` as dynamic
and ignores the `s-maxage` in `public/_headers` until a zone-level Cache Rule
authorises it. With that rule live, HTML is served from the edge for up to
3600s plus `stale-while-revalidate=86400`, so a fresh deploy can keep serving
the *previous* build for an hour. That looks exactly like "my change did not
publish". The purge is what closes it.

To preview the plan without touching production:

```bash
node scripts/deploy.js --dry-run
```

> **Note:** On macOS 12, `wrangler` needs `NODE_TLS_REJECT_UNAUTHORIZED=0` due
> to a TLS compatibility issue with older system libraries. Not needed on
> macOS 13+.

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

### New game

1. Create `src/content/fgame/<slug>.html` — body fragment only.
2. Add a `gamePosts` entry to `scripts/config.js`:

```js
{
  slug:        'my-game',
  title:       'My Game',
  description: 'Short description (≤ 155 chars)',
  embedUrl:    'https://...',
  imgUrl:      '/imgs/fgame/my-game.jpg',
  genre:       'Puzzle',        // must match one of GAME_GENRES in scripts/build.js
  category:    'Puzzle',
  players:     '1 Player',      // or '2 Players'
  controls:    'Mouse|Keyboard',
  isoDate:     '2026-11-04',
  date:        'November 4, 2026',
}
```

3. Generate the thumbnail and the hashed `webp` variant, then run
   `node scripts/gen-img-manifest.js` so `public/img-manifest.json` picks it up.
4. Add the slug to `scripts/sitemap-scope.json` **only** if it should be
   advertised in the sitemap (see below).
5. Run `npm run build` then deploy.

---

## Sitemap scope

The sitemap advertises **26 URLs**, not all 120 published pages. That is a
deliberate decision, and the reasoning lives in `scripts/sitemap-scope.json`.

Short version: Google crawled 112 of a previous 200-URL sitemap and indexed
one. A 200-URL sitemap on a young domain reads as a thin-content application.
Pages that are not in the sitemap are still live, still internally linked, and
still crawlable — they are simply not advertised as priorities.

The file records the measured baseline, the reason for every entry, and a
review date. Change it deliberately, not by reflex.

Two rules that are easy to get wrong:

- **A game page on the apex belongs in the sitemap only if play does not have
  it.** The apex and play are two doors to one catalogue; a game published on
  both sides has two self-canonical pages competing for one query, and Google
  has been observed picking neither.
- **Never list a URL that `_redirects` also matches.** Cloudflare Pages
  applies redirects before static assets — a redirect rule for a path that also
  has a built HTML file means the page can never render.

---

## Ad Infrastructure

| Slot | Location | ID |
|------|----------|----|
| Homepage — top | Before network grid | `9902197949` |
| Homepage — bottom | Before blog section | `5667004696` |
| Article — top | Above article body | `9336055885` |
| Article — mid | Auto-injected before 2nd `<h2>` | `9336055885` |
| Article — bottom | Below article body | `4696703805` |
| Blog index | Leaderboard above grid | `8151800876` |
| About page | Leaderboard | `1919331375` |

AdSense uses the approved publisher configuration in `scripts/config.js` and always initializes the official queue:

```js
const site = {
  // ...
  adsenseApproved: true,
};
```

The standard `window.adsbygoogle = window.adsbygoogle || []` bootstrap applies consistently to `base.html`, `article.html`, and `game.html` through the build placeholders.

**Unfilled slot hiding:** `ins.adsbygoogle:not([data-ad-status])` is hidden via CSS so empty ad boxes never affect layout.

### Authorized sellers

`public/ads.txt` declares the web publisher; `public/app-ads.txt` declares the
app publishers. Both are live and served as `text/plain` at the domain root.

```
google.com, pub-5676206764686662, DIRECT, f08c47fec0942fa0
google.com, pub-6199549323873133, DIRECT, f08c47fec0942fa0
```

---

## SEO & Analytics

- **Canonical URLs** on every page
- **Open Graph + Twitter Card** meta on every page
- **JSON-LD** — `BlogPosting` + `BreadcrumbList` on every article; `Blog` schema on blog index; `WebSite` + `Organization` + `FAQPage` on the homepage
- **Sitemap** at `https://poki2.online/sitemap.xml` (26 URLs, scoped — see above)
- **robots.txt** — `Allow: /` with sitemap reference, plus explicit AI-crawler policy
- **llms.txt** — a machine-readable index of the site for LLM crawlers
- **GA4** with Consent Mode v2 (`ad_storage: denied` by default until cookie consent granted)
- **Cookie Consent** — vanilla-cookieconsent v3, GDPR-compliant bar layout
- **Security headers** — HSTS, CSP, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` via `public/_headers`
- **IndexNow** — `scripts/indexnow.js` announces **every published page** on deploy, not just sitemap URLs. It hashes page content (with the per-build timestamp comment stripped) so unchanged pages are not re-announced, and keeps its state in the git-ignored `.indexnow-state.json`.

---

## Network Sites

| Site | URL | Status | Games |
|------|-----|--------|-------|
| Poki2 Play | [play.poki2.online](https://play.poki2.online/) | Live | 200+ |
| AZ Games | [azgames.poki2.online](https://azgames.poki2.online/) | Live | 300+ |
| Unblocked Games | [ubg66.poki2.online](https://ubg66.poki2.online/) | Live | 474+ |
| Kids Games | `kids.poki2.online` | Coming soon | 100+ |
| Racing Hub | — | Coming soon | 80+ |
| Puzzle World | — | Coming soon | 120+ |
| IO Arena | `io.poki2.online` | Coming soon | 60+ |
| Stickman Zone | — | Coming soon | 50+ |

The live/planned split is data in `scripts/config.js` (`network` array), not a
hand-maintained list.

---

## Credentials and personal identifiers

**No account id, zone id, API token, or personal email address is committed to
this repository.** That is a deliberate policy, not an accident of hygiene:

- The Cloudflare account id identifies *whose* account hosts the site. It is
  not a secret, but committing it binds the repo to one person and follows
  every fork. It also leaks into git history, where deleting the line does not
  delete the line.
- The same applies to the zone id and the cache-rule id in
  `infra/cloudflare-cache-rule.json`.

Every value is resolved at run time instead:

| Value | Environment variable | Local file (outside the repo, `0600`) |
|---|---|---|
| Cloudflare account id | `CLOUDFLARE_ACCOUNT_ID` | `~/.poki2-cf-account` |
| Cloudflare zone id | `CF_ZONE_ID` | `~/.poki2-cf-zone` |
| Cloudflare API token | `CF_API_TOKEN` | `~/.poki2-cf-token` |
| Bing Webmaster API key | `BING_API_KEY` | `~/.poki2-bing-key` |
| IndexNow key | `INDEXNOW_KEY` | discovered from `public/` |

The environment variable wins; the file is the fallback, so `npm run deploy`
works with no export. Create the files once:

```bash
umask 077
printf '%s' '<cloudflare-account-id>' > ~/.poki2-cf-account
printf '%s' '<cloudflare-zone-id>'    > ~/.poki2-cf-zone
```

`.wrangler/` is git-ignored — wrangler writes the account id of whoever ran
it into its local cache.

Two identifiers are intentionally public, because their protocols require them
to be served at the domain root: `public/indexnow-<key>.txt` and
`public/google65c93755d768ab97.html`.

---

## Analysis documents

Every intermediate analysis file lives in `docs/`, in Markdown. See
[`docs/README.md`](docs/README.md) for the index and the reasoning.

```bash
node scripts/html-to-markdown.js path/to/report.html docs/report-YYYY-MM-DD.md
```

converts a legacy HTML report. It is a one-off migration tool, not part of
the build.

---

## AdSense Review Checklist

- [x] `google-adsense-account` meta tag on all pages
- [x] `ads.txt` at domain root
- [x] `app-ads.txt` at domain root
- [x] All ad slot IDs unique across pages
- [x] 25 of 27 blog articles ≥ 1 400 words (`best-multiplayer-browser-games` 1 371, `best-sports-browser-games` 1 314 — both just under target)
- [x] Policy pages: Privacy, Terms, DMCA, About, Contact
- [x] Sitemap submitted to Google Search Console
- [x] Cookie Consent + Consent Mode v2
- [x] formsubmit.co contact form activation (reply to verification email at `contact@poki2.online`)
- [ ] AdSense review application submitted at adsense.google.com

---

## License

MIT — see [LICENSE](LICENSE).

Copyright (c) 2026 Poki2. Game content, trademarks, and embedded third-party
games remain the property of their respective owners; the MIT license covers
the site's own source code, build tooling, and configuration.
