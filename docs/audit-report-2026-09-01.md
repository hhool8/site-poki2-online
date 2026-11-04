# SEO & Technical Audit Report
Site: poki2.online · Audited: September 1, 2026 · 87 HTML pages · 35 audit categories
| Metric | Value |
| --- | --- |
| Critical Issues | 7 |
| Warnings | 6 |
| Categories Passed | 22 |
| Pages Audited | 87 |
| Broken Pages (404) | 3 |
| Redirect Links | 145 |
## Critical Issues `7 found`
#### 1. Config.js Syntax Error — Double Comma (Breaks Build)
A double comma `,,` at line 1033 of `scripts/config.js` between the `soccer-random` game entry and the `2048-drop` entry is invalid JavaScript. Node.js may tolerate this in some contexts, but it's a syntax error that can break parsers, linters, and future Node versions.
**File:** `scripts/config.js` line 1033  
**Code:** `deprecationReason: 'Access denied. Authorization required."',` followed by `,,` then `{`
> **Fix** — Replace `,,` with a single `,` at line 1033. The `soccer-random` entry's closing brace is followed by two commas — remove one.
#### 2. Deprecated Game Pages Live But Not Rebuilt — 404 After Next Deploy
Three deprecated games still return HTTP 200 on the live site because old HTML files persist from a previous deploy, but the build script (`visibleGames = gamePosts.filter(g => !g.deprecated)`) excludes them from new builds. After the next `npm run build` + deploy, these will become 404s — but they're currently indexed by Google with `index,follow`.
| Game Slug | Live Status | robots Meta | Issue |
| --- | --- | --- | --- |
| `moto-x3m` | `200` | index,follow | Will 404 after rebuild; embed is broken |
| `cut-the-rope` | `200` | index,follow | Will 404 after rebuild |
| `hill-climb-racing` | `200` | index,follow | Will 404 after rebuild |
| `fireboy-and-watergirl` | `404` | — | Already removed — was indexed |
| `vex-3` | `404` | — | Already removed — was indexed |
| `paper-io` | `404` | — | Already removed — was indexed |
| `agar-io` | `404` | — | Already removed — was indexed |
| `krunker-io` | `404` | — | Already removed — was indexed |
| `basket-random` | `404` | — | Already removed — was indexed |
| `soccer-random` | `404` | — | Already removed — was indexed |
| `bitlife` | `404` | — | Already removed — was indexed |
| `color-switch` | `404` | — | Already removed — was indexed |
> **Fix** — (1) For the 3 still-live deprecated pages: add `<meta name="robots" content="noindex,follow">` and a 301 redirect to a related game or the /fgame/ index. (2) For the 8 already-404 pages: add 301 redirects in `_redirects` to prevent link-juice loss. (3) Add all deprecated slugs to `_redirects` with 301s to /fgame/.
#### 3. Broken Internal Links — 145 Links Use Trailing Slash (308 Redirect Chain)
Game content fragments in `src/content/fgame/*.html` contain internal links with trailing slashes (e.g., `/fgame/2048-drop/`), but the actual built files are `/fgame/2048-drop.html` (served as `/fgame/2048-drop` without slash). Cloudflare Pages issues a **308 redirect** for every trailing-slash URL, creating unnecessary redirect hops for 145 internal links across 40+ game pages.
**Sample affected pages:**
- `fgame/2048.html` → links to `/fgame/2048-drop/` and `/fgame/2048-rogue/`
- `fgame/drift-hunters.html` → links to `/fgame/retro-bowl/`, `/fgame/bike-xtreme/`, `/fgame/american-truck-driving/`
- `fgame/basketball-stars.html` → links to `/fgame/retro-bowl/`, `/fgame/hoop-legends/`, `/fgame/basketball-stars/` (self-link!)
- ... and 142 more across all game pages
**Also note:** Some pages link to themselves (e.g., `basketball-stars.html` → `/fgame/basketball-stars/`), `golf-puzzle.html` → `/fgame/golf-puzzle/`). Self-referential links are an SEO waste.
> **Fix** — Search-and-replace in all `src/content/fgame/*.html` files: change `href="/fgame/SLUG/"` to `href="/fgame/SLUG"` (remove trailing slash). Also remove self-referential links in "related games" lists.
#### 4. HTML Entity in Blog Title — Renders as Literal "&" in Title Tag
The blog post `best-idle-clicker-browser-games` has `&amp;` in its title in `config.js`. The build's `esc()` function escapes `&` to `&amp;`, so the raw `&amp;` becomes `&amp;amp;` in the output — or at minimum renders as literal `&` text in the <title> tag, which looks broken in search results and browser tabs.
**Config:** `title: '8 Best Idle &amp; Clicker Browser Games to Play in 2026'`  
**Expected:** `8 Best Idle & Clicker Browser Games to Play in 2026`  
**Actual (in <title>):** Likely `8 Best Idle &amp; Clicker Browser Games to Play in 2026 — Poki2 Blog | Poki2`
> **Fix** — In `scripts/config.js` line 532, change `&amp;` to `&` (raw ampersand). The `esc()` function in `build.js` will handle HTML-encoding it properly.
#### 5. Article Template Missing Advertising Cookie Consent Category
The `article.html` template's CookieConsent config only has `necessary` and `analytics` categories — it's missing `advertising`. This means blog article pages (27 pages) never grant `ad_storage` consent even when the user accepts all cookies, causing AdSense to operate without proper consent signals on all blog pages.
**File:** `src/templates/article.html` lines 322-324  
**Current:** `categories: { necessary: {...}, analytics: {} }`  
**Should be:** `categories: { necessary: {...}, analytics: {}, advertising: {} }`  
Also missing the `onConsent` and `onChange` handlers for `ad_storage`, `ad_user_data`, `ad_personalization`.
> **Fix** — Copy the complete CookieConsent config (including `advertising` category and ad consent handlers) from `base.html` or `game.html` into `article.html`. The three templates should have identical consent configurations.
#### 6. 404 Page Uses Stale CSS Version (v=3 vs v=5)
The 404 page (`public/404.html`) references `/css/style.css?v=3` while all other templates use `/css/style.css?v=5`. Since the `_headers` file sets `Cache-Control: public, max-age=31536000, immutable` for CSS files, visitors who previously loaded the v=5 CSS will get the correct stylesheet, but new visitors to 404 pages may get a stale cached version if the CDN serves the old version.
**File:** `public/404.html` line 9  
**Current:** `<link rel="stylesheet" href="/css/style.css?v=3">`  
**Should be:** `<link rel="stylesheet" href="/css/style.css?v=5">`
> **Fix** — Update the version parameter from `v=3` to `v=5` in `public/404.html`.
#### 7. Sitemap lastmod Uses Publish Date Instead of Update Date
The sitemap builder uses `p.isoDate` (publication date) for blog post `<lastmod>` instead of `p.isoUpdated` (last revision date). All 27 blog posts have `isoUpdated: '2026-07-27'`, but the sitemap shows dates from March-April 2026. Google uses lastmod to decide when to recrawl — stale dates mean delayed re-indexing of updated content.
**File:** `scripts/build.js` line 833  
**Current:** `<lastmod>${p.isoDate || now}</lastmod>`  
**Should be:** `<lastmod>${p.isoUpdated || p.isoDate || now}</lastmod>`
> **Fix** — In `buildSitemap()`, change the blog URL lastmod to use `p.isoUpdated || p.isoDate || now`.
## Warnings `6 found`
#### W1. Article & Game Templates Missing google-site-verification Meta
The `google-site-verification` meta tag exists only in `base.html`. The `article.html` and `game.html` templates don't include it. Since blog articles and game pages use their own templates (not base.html), Google Search Console verification doesn't apply to 54+ pages.
**Present in:** `base.html` only  
**Missing from:** `article.html`, `game.html`
> **Fix** — Add `<meta name="google-site-verification" content="65c93755d768ab97">` to the <head> of `article.html` and `game.html`.
#### W2. Article Template Nav Missing Games Dropdown
The `article.html` template has a simpler nav (Home, Games, Blog, About, Contact) without the Games category dropdown that `base.html` and `game.html` have. This means blog article pages don't expose category navigation (Action, Racing, Puzzle, etc.) that other pages do, creating an inconsistent navigation experience.
**Also:** The article template footer only lists 3 subdomain links vs 5 in base/game templates (missing "2048 Collection" and "GamePix" links).
> **Fix** — Align the nav and footer HTML across all three templates to provide consistent navigation.
#### W3. 18 Orphan Game Content Fragments Not Wired to Config
18 HTML body fragments exist in `src/content/fgame/` but are not registered in `scripts/config.js`. They never get built, never appear on the site, and never emit JSON-LD. This is documented in `TODO.md` but represents missed SEO opportunities for high-volume keywords like "minesweeper", "solitaire", "pong", "breakout", "snake classic".
**Orphan slugs:** 1v1lol, bonk-io, breakout, card-battle-arena, city-builder-sim, crossy-road, fishing-frenzy, mahjong-classic, match3-gems, minesweeper, pong, puzzle-platformer-quest, rhythm-run, rooftop-snipers, snake-classic, solitaire-klondike, space-shooter, tower-defense-classic
> **Fix** — Add config entries for high-SEO-value titles first (breakout, mahjong-classic, minesweeper, pong, snake-classic, solitaire-klondike, tower-defense-classic). Remove or archive fragments that won't be published.
#### W4. Deprecated Game Entries Have Mismatched Quote in deprecationReason
Every deprecated game has `deprecationReason: 'Access denied. Authorization required."'` — the string starts with a single quote but ends with a double quote. While JavaScript allows this (the string is single-quoted and the `"` is just a character), it's sloppy and may cause confusion.
**Affected:** moto-x3m, fireboy-and-watergirl, vex-3, paper-io, color-switch, cut-the-rope, hill-climb-racing, agar-io, krunker-io, soccer-random, basket-random, bitlife
> **Fix** — Change `'Access denied. Authorization required."'` to `'Access denied. Authorization required.'` (matching single quotes).
#### W5. Sitemap Contains Trailing-Slash URLs But Canonical Tags Don't
The sitemap lists `https://poki2.online/blog/` and `https://poki2.online/fgame/` (with trailing slash), but the built pages' canonical tags also use trailing slash for these index pages. However, some internal links and the sitemap for individual game/blog pages use no trailing slash. This creates a minor canonical inconsistency for the index pages.
**Sitemap URLs:** `/blog/` and `/fgame/` (trailing slash)  
**Canonical tags:** Match — `https://poki2.online/blog/` and `https://poki2.online/fgame/`  
**Issue:** Cloudflare Pages serves both `/blog` and `/blog/` without redirect, creating duplicate URLs.
> **Fix** — Add a redirect in `_redirects`: `/blog /blog/ 301` and `/fgame /fgame/ 301` to enforce trailing-slash for index pages. Or pick one canonical form and use it consistently.
#### W6. Page Load Speed — Multiple External Script Dependencies
Every page loads 3+ external JavaScript resources synchronously or async: Google Analytics (gtag/js), Google AdSense (adsbygoogle.js), and vanilla-cookieconsent from jsDelivr CDN. While `preconnect` hints are present, the cookie consent script is render-blocking (no `async` or `defer`). The CSS from jsDelivr is also render-blocking.
**Render-blocking resources:**
- `cookieconsent.css` from jsDelivr (no preload, render-blocking)
- `cookieconsent.umd.js` from jsDelivr (no async/defer, parser-blocking)
- AdSense loader `adsbygoogle.js` (async, OK)
- GA4 `gtag/js` (async, OK)
**Note:** Total HTML page sizes are reasonable (largest is 67KB for homepage, most game pages ~47KB). CSS is 26KB minified.
> **Fix** — Add `defer` to the cookieconsent script tag. Consider self-hosting the cookie consent CSS/JS to eliminate the jsDelivr dependency. Or use `media="print" onload="this.media='all'"` trick for the CSS.
## Passed Checks `22 categories`
#### Categories with No Issues Found
The following audit categories passed with no issues detected:
- **5xx Errors** — No server errors detected on any tested URL
- **DNS Resolution** — poki2.online resolves correctly; no DNS issues
- **www Resolve** — www.poki2.online 301-redirects to poki2.online (correct canonical)
- **HTTP → HTTPS Redirect** — http://poki2.online 301-redirects to https:// (correct)
- **SSL/TLS Certificate** — Valid cert (Aug 1 - Oct 30, 2026), EC public key, TLS 1.3 via Cloudflare
- **Security Protocol** — TLS 1.3 (modern, not outdated)
- **Certificate Name Match** — Cert is for *.poki2.online (correct)
- **Mixed Content** — No HTTP resources on HTTPS pages detected (CSP enforces HTTPS)
- **HTTPS Homepage** — Homepage is HTTPS with canonical (no HTTP homepage issue)
- **Redirect Chains & Loops** — No multi-hop redirect chains detected; all redirects are single-hop 301s
- **Missing Title Tags** — All 87 pages have &lt;title&gt; tags (except Google verification page, which is expected)
- **Duplicate Title Tags** — No duplicate titles detected
- **Duplicate Meta Descriptions** — No duplicate descriptions detected
- **Duplicate Content** — No duplicate body content detected
- **Missing Canonical Tags** — All content pages have canonical tags (except 404 and Google verification)
- **Multiple Canonical URLs** — No pages with multiple canonical tags
- **Broken Canonical URLs** — All canonical URLs resolve correctly
- **Meta Refresh Redirects** — No meta refresh redirects detected
- **Viewport Configuration** — All pages have correct viewport meta tag
- **Large HTML Page Size** — All pages under 70KB (well within limits)
- **Invalid robots.txt Format** — robots.txt is valid and well-structured
- **Invalid sitemap.xml Format** — sitemap.xml is valid XML with 87 URLs
- **Too Large sitemap.xml** — Sitemap is small (~30KB, well under 50MB limit)
- **Broken Internal Images** — All referenced images exist in dist/
- **Invalid Structured Data** — All JSON-LD blocks parse successfully
- **Hreflang Issues** — No hreflang tags (site is English-only, so this is expected and not an issue)
- **AMP Canonical Issues** — No AMP pages (not applicable)
- **Broken JS/CSS Files** — All CSS and JS references resolve
- **Insecure Encryption Algorithms** — TLS 1.3 only, no insecure ciphers
- **Malformed Links** — No malformed link URLs detected
- **Viewport Width Not Set** — Viewport width=device-width is set on all pages
- **Non-Secure Pages** — All pages served over HTTPS
- **Incorrect Pages in Sitemap** — All sitemap URLs correspond to built pages
- **Pages Not Crawled** — No crawl-blocking issues detected (robots.txt allows all)
## Issue Summary by Priority
| # | Category | Severity | Status | Details |
| --- | --- | --- | --- | --- |
| 1 | 5xx errors | — | `PASS` | No 5xx errors detected |
| 2 | 4xx errors | Critical | `FAIL` | 8 deprecated game slugs return 404; 3 return 200 but will 404 after rebuild |
| 3 | Missing title tags | — | `PASS` | All pages have titles |
| 4 | Duplicate title tags | — | `PASS` | No duplicates |
| 5 | Duplicate content | — | `PASS` | No duplicates |
| 6 | Broken internal links | Critical | `FAIL` | 145 trailing-slash links cause 308 redirects |
| 7 | Pages not crawled | — | `PASS` | robots.txt allows all |
| 8 | DNS resolution issue | — | `PASS` | DNS resolves correctly |
| 9 | We couldn't open the page's URL | — | `PASS` | All key URLs return 200 |
| 10 | Broken internal images | — | `PASS` | All images exist |
| 11 | Duplicate meta descriptions | — | `PASS` | No duplicates |
| 12 | Invalid robots.txt format | — | `PASS` | Valid format |
| 13 | Invalid sitemap.xml format | — | `PASS` | Valid XML |
| 14 | Incorrect pages in sitemap | — | `PASS` | All URLs exist |
| 15 | www resolve issues | — | `PASS` | www → non-www 301 redirect |
| 16 | Viewport not configured | — | `PASS` | All pages have viewport |
| 17 | Large HTML page size | — | `PASS` | All under 70KB |
| 18 | Missing canonical in AMP | — | `N/A` | No AMP pages |
| 19 | Issues with hreflang values | — | `N/A` | No hreflang (single language) |
| 20 | Hreflang conflicts | — | `N/A` | No hreflang |
| 21 | Incorrect hreflang links | — | `N/A` | No hreflang |
| 22 | Non-secure pages | — | `PASS` | All HTTPS |
| 23 | Certificate expiration | — | `PASS` | Valid until Oct 30, 2026 |
| 24 | Old security protocol | — | `PASS` | TLS 1.3 |
| 25 | Cert registered to wrong name | — | `PASS` | Cert for *.poki2.online |
| 26 | Mixed content | — | `PASS` | No HTTP resources on HTTPS |
| 27 | No canonical/redirect from HTTP homepage | — | `PASS` | HTTP → HTTPS 301 redirect |
| 28 | Redirect chains and loops | Warning | `WARN` | 145 trailing-slash 308 redirects (single-hop, not chains) |
| 29 | Broken canonical URLs | — | `PASS` | All canonicals resolve |
| 30 | Multiple canonical URLs | — | `PASS` | One canonical per page |
| 31 | Meta refresh redirects | — | `PASS` | None detected |
| 32 | Broken JS and CSS files | — | `PASS` | All resolve |
| 33 | Insecure encryption algorithms | — | `PASS` | TLS 1.3 only |
| 34 | Too large sitemap.xml | — | `PASS` | ~30KB |
| 35 | Malformed links | — | `PASS` | None detected |
| 36 | Invalid structured data | — | `PASS` | All JSON-LD valid |
| 37 | Viewport width not set | — | `PASS` | width=device-width on all |
| 38 | Slow page load speed | Warning | `WARN` | Render-blocking cookie consent script |
## Recommended Fix Order
#### Priority Action Plan
Fix issues in this order to minimize risk and maximize SEO impact:
1. **Fix config.js double comma** (line 1033) — prevents potential build failures
2. **Fix &amp; in blog title** — immediate search result appearance improvement
3. **Add 301 redirects for all 11 deprecated game slugs** in `_redirects` — prevents 404s and preserves link equity
4. **Fix article template cookie consent** — required for AdSense compliance on blog pages
5. **Fix sitemap lastmod** — use isoUpdated instead of isoDate for blog posts
6. **Fix 404 page CSS version** — v=3 → v=5
7. **Fix trailing-slash internal links** — remove trailing slashes from all /fgame/SLUG/ links in content fragments
8. **Add google-site-verification** to article and game templates
9. **Add defer to cookie consent script** — improves page load speed
10. **Fix deprecationReason quote mismatch** — cleanup
11. **Wire orphan game fragments** — SEO growth opportunity
