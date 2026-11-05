---
id: POKI2-SOURCE-E02
title: Extended Rules
tier: 02-extended
scope: 04-source (poki2-portal)
precedence: load as needed, below 00-master and 01-basic
extends: POKI2-SOURCE-B01
language: en
version: 1
last_updated: 2026-11-05
---

# Extended Rules

Task-specific procedures for the site source repository. These never override
`00-master-rules.md` or `01-basic-rules.md`.

## A. Release chain order

`build` -> `deploy` (Cloudflare Pages) -> cache purge -> IndexNow announcement.
`scripts/deploy.js` performs the last three in that order. Never purge before
the new deployment is live, or search engines fetch the old bytes. Use
`--dry-run` to inspect the plan; `npm run indexnow:dry` to inspect the URL diff.

## B. IndexNow internals

`scripts/indexnow.js` strips the second-line `<!-- built: {{BUILD_TS}} -->`
comment before hashing, otherwise every rebuild changes every page hash and
re-announces all pages. The diff state lives in `.indexnow-state.json`
(gitignored, per machine). The key is discovered from `public/<key>.txt`: the
file name must equal its content, or the endpoint answers 403.

HTTP 202 proves only key validation and enqueueing. `scripts/bing-status.js`
uses `GetUrlInfo`, which has no indexation flag; it reports discovery date,
last crawl, HTTP status and page metrics. Never convert those into a claim of
indexation.

## C. Image and asset pipeline

`npm run build` runs lastmod, favicons, OG images and game OG images before
`build.js`. `scripts/migrate-unsplash.js` is the one-off that downloaded 18
remote images, converted them to WebP, and rewrote references; it also had to
remove two `preconnect`/`dns-prefetch` hints to make "zero remote references"
true. When moving images to relative paths, keep `extractFirstImageSrc()`
routed through `toAbsoluteUrl()` so `og:image` and `Article.image` do not
become relative.

## D. Content and schema maintenance

- `extractFaq()` parses a visible `h2` "Frequently Asked Questions" heading.
  A post with `<h2>FAQ</h2>` needs its heading changed, not a schema patch.
- `fillBase()` derives BreadcrumbList from the canonical URL; the homepage has
  a single ListItem. Embed pages and the 404 page have no breadcrumbs by design.
- `normalizeImgLoading()` enforces one eager image per page at build time, and
  `checkGameConsistency()` warns on contradictory `genre` / `players` values.
  Prefer build-time normalisation over hand-editing dozens of content files.
- Blog dates, lastmod data and titles have their own generator scripts
  (`bump-blog-dates.js`, `gen-lastmod.js`, `seo-fix-titles.js`). Use them rather
  than editing generated artifacts.

## E. Sitemap review loop

`scripts/sitemap-scope.json` carries a measured baseline and a review date for
the six apex-only exception URLs. Criteria: all six still unknown to Google ->
remove the exception; any crawled or indexed -> keep; crawled but not indexed
-> allow one more cycle. Keep `_gamesException` comments numerically accurate;
a previous comment claimed 23 -> 29 URLs when the real total was 26.

## F. Root-level public files

`robots.txt`, `llms.txt`, `ads.txt`, `app-ads.txt`, `_headers`, `_redirects`,
the IndexNow key file and the Google verification file live in `public/` and are
copied verbatim to `dist/`. Cf. master rule 4: only the protocol-mandated key
and verification files may contain public identifiers.

## G. Network and deployment diagnostics

An `UND_ERR_CONNECT_TIMEOUT` during `npm run deploy` is usually a transient
network fault, not an invalid token: check `api.cloudflare.com` with a plain
request and retry once. A first request after a new deployment can take ~25 s
from cold start; a second request is a cache HIT. `git push` can fail with a
broken pipe and succeeds on retry. Diagnose before changing credentials.

## H. Repository hygiene

- Back up with `git bundle create ... --all` before any history rewrite.
- `filter-repo --replace-text`: long path forms with a trailing slash first,
  bare forms replaced with `.`; re-add `origin` afterwards; move
  `.git/filter-repo/` aside before a second run.
- `--mailmap` must include `GitHub <noreply@github.com>` for the committer
  field of web-created commits.
- Re-set local git identity after cloning on a new machine; the global config
  is left untouched on purpose.
- `.indexnow-state.json`, `.wrangler/`, `dist/`, `node_modules/`, `seo/` and
  `.workbuddy/` are runtime state and stay out of git.

## I. Ads and review

AdSense is served on the site; the AdSense review checklist in `README.md`
applies to any change touching ad slots, policy pages or the privacy page.
`capabilities.accounts`, `capabilities.upload` and
`capabilities.third_party_login` in the sidecar's `site.config.yaml` are false
by design; flipping one requires the privacy page to be rewritten in the same
change set.
