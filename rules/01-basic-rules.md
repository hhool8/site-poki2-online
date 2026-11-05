---
id: POKI2-SOURCE-B01
title: Basic Rules
tier: 01-basic
scope: 04-source (poki2-portal)
precedence: always apply, below 00-master
extends: POKI2-SOURCE-M00
language: en
version: 2
last_updated: 2026-11-05
---

# Basic Rules

Always-on rules for site source work. Task-specific procedures are in
`02-extended-rules.md`.

## 1. English only

Page copy, titles and meta descriptions, alt text, blog posts, newly created
docs, documents materially edited from 2026-11-05 onward, code comments,
script output and commit messages are English (`en-US`). The `rules/` files are
English only. Chinese is reserved for conversation with the operator. No new
file introduces Hanzi, and no file mixes languages; published pages are English
without exception. Two Chinese-language reports under `docs/` are preserved
verbatim as historical records: they are outside the scope of a rule governing
new work, not an exemption from it (see `00-master-rules.md` section 1).

Run from the `04-source/` directory to verify the rules files contain no Hanzi:

```bash
python3 -c "import pathlib,re,sys; p=pathlib.Path('rules'); bad=[(str(f),m.group()) for f in p.rglob('*.md') for m in re.finditer(r'[\u4e00-\u9fff]',f.read_text())]; print(bad or 'clean'); sys.exit(bool(bad))"
```

## 2. Resolve conflicts at the source

A known contradiction is a defect, not a caveat to carry forward.

- Measured data outranks prose. When `README.md`, a rule or a config comment
  disagrees with an inspection result, correct the text in the same change
  that cites the measurement.
- Higher rule tiers outrank lower ones; rewrite the lower rule afterwards so
  the contradiction cannot recur.
- Historical reports stay as evidence, but a disproven conclusion is removed
  from every live authority file. Never leave a "known conflict" note as a
  substitute for a fix.
- Applied 2026-11-05: `README.md` and `scripts/sitemap-scope.json` claimed that
  apex and play self-canonical pages compete and Google picks neither. The
  full 383-URL inspection measured `cross_host canonical = 0`; both texts now
  state the corrected fact and the real bottleneck (content quality and
  discovery). No mirrors or canonical redirects were introduced.

## 3. Build, then deploy

Use `npm run build` followed by `npm run deploy` (or `npm run release`). Deploy
sends `dist/`. Before a full rebuild, clear the output with
`find dist -mindepth 1 -delete`: the local Node safety shim rejects a bulk
`fs.rmSync(dist)` above 50 files. Never hand-edit `dist/`.

## 4. Redirects and headers

- Retiring a game: delete its entry in `scripts/config.js`. Do not add a
  `_redirects` rule for a path that still builds a page.
- Only three legacy paths 301 to play: `2048`, `basketball-stars`,
  `minesweeper`.
- `_headers` uses exact-path blocks. Two matching blocks concatenate
  `Cache-Control` directives; verify the live header after any edit.
- Rebuild after every root `_headers` / `_redirects` change, or the deployed
  files still carry the old rules.

## 5. Canonical and host policy

Every game page self-canonicalises. The apex `/fgame/` tree and the play
`/game/` tree are two facades of one catalogue. Do not mirror the six
apex-only two-player games into play (operator decision, 2026-11-04), and do
not add cross-host canonical redirects: the 383-URL audit measured
`cross_host canonical = 0`. A sitemap exclusion is a scope decision, not a
canonical-conflict remedy.

Three historical `canonical_mismatch` findings on play
(`/game/c/ctr/`, `/game/m/mousejump/`, `/game/s/skyrace/`) are stale crawl
snapshots. The current source self-canonicalises correctly; wait for a recrawl
rather than "fixing" live pages.

## 6. Sitemap policy

Keep 26 URLs per `scripts/sitemap-scope.json`. Do not expand the sitemap
without an explicit decision. An apex game page belongs in the sitemap only if
play does not carry that game; the six apex-only two-player games are the
current exception. Never list a URL that `_redirects` also matches.

## 7. Content accuracy

Before writing any "Top N" or "N Best" article, confirm all N titles exist in
`scripts/config.js` (or the play `games.json`). Unlinked, non-existent titles
in prose produced "crawled, currently not indexed" outcomes before. The apex
has 5 online-multiplayer games (6 including the play-only basketball-stars),
so a headline promising 10 is a defect, not a rounding choice.

## 8. Ads declaration files

Both `public/ads.txt` and `public/app-ads.txt` are published. `ads.txt` names
one publisher; `app-ads.txt` names two. Keep the pair identical across hosts
(MD5 `f08c47fec0942fa0`) and rebuild plus deploy after any edit.

## 9. Structured data follows the body

FAQPage is derived from visible `h2` "Frequently Asked Questions" plus `h3`/`p`
blocks; BreadcrumbList is derived from the canonical URL. Fix missing schema by
fixing the body, not by injecting a detached JSON-LD block that can drift.

## 10. Images and performance

Exactly one eager image per page (the hero); all body images lazy. Preload must
carry `imagesrcset` and `imagesizes`. Blog images are local WebP under
`/imgs/blog/`; `og:image` and `Article.image` stay absolute. Speculation rules
are prefetch-moderate only; no prerender on an ad-bearing site.

## 11. Credentials, identity, documents

No token, account/zone/ruleset id, personal email or absolute local path in
this public repo. Runtime values come from environment variables or `0600`
files outside the repo. Set the neutral local git identity on each machine.
Analysis documents are Markdown under `docs/`, indexed in `docs/README.md`.

## 12. Verify before reporting done

Check the built file, the deploy result and the live HTTP response. A 202 from
IndexNow is a queue acknowledgement, not indexation; a 204 from a sitemap PUT
is acceptance, not discovery.
