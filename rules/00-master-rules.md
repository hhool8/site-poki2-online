---
id: POKI2-SOURCE-M00
title: Master Rules
tier: 00-master
scope: 04-source (poki2-portal, Cloudflare Pages project poki2-portal)
precedence: highest
language: en
version: 2
last_updated: 2026-11-05
---

# Master Rules

Supreme rules for the site source repository. They govern every template,
content file, script and deployment action here. The tiers are ordered
`00-master-rules.md` > `01-basic-rules.md` > `02-extended-rules.md`; a lower
tier may implement but never override a higher one.

The parent sidecar has its own `rules/` set for measurement and research. When
the task is about site code, content or deployment, this set governs.

## 1. English is the working language

All `rules/` files, and every document created or materially edited from
2026-11-05 onward in this repository, are English: docs, code comments,
commit messages, metadata and all site-facing copy. The audience is `en-US`.
Chinese is used only when speaking with the operator. No new file introduces
Hanzi, and no file mixes languages.

Two Chinese-language reports under `docs/` (`gsc-coverage-2026-10-14.md` and
`backlink-plan-2026-09-27.md`) are preserved verbatim as historical records.
They are outside the scope of a rule that governs new work, not an exemption
from it, and are not rewritten for language alone. Rule 1 of
`01-basic-rules.md` gives the operational form and verification command.

## 2. The build is the truth

- Only `dist/` is deployed. A source file that was not rebuilt is not live.
- Page inventory is "built pages", not config entries: 120 published pages
  (70 game, 7 genre, 1 two-player hub, 1 game index, 27 blog posts, 1 blog
  index, 6 policy/utility, 6 embed, plus the homepage).
- `scripts/config.js` holds 84 `gamePosts` entries; 11 are deprecated and 3
  visible entries are 301 redirects, which is why 73 visible entries build 70
  pages.
- `scripts/sitemap-scope.json` is the authority for the sitemap. The sitemap
  advertises 26 URLs by decision, not all 120 pages.

## 3. Cloudflare Pages constraints are hard

- `_redirects` is evaluated before static assets. A redirect rule whose path
  also has a built HTML file makes that page unrenderable. Retire a game by
  deleting its config entry; never add a redirect for its live path.
- `_headers` matches by request path, and two matching blocks concatenate
  values (observed as a doubled `s-maxage`). Use exact-path blocks, not broad
  `/*.html` patterns.
- After editing any root `_headers` or `_redirects`, run a full build before
  deploying. Deploy `dist/`, never the repository root.

## 4. No personal identifiers in this public repository

No account id, zone id, cache-rule id, API token, personal email, real name or
absolute local path is committed. Resolve such values at run time from
`$CLOUDFLARE_ACCOUNT_ID` / `$CF_ZONE_ID` / `$CF_API_TOKEN` or the `0600` files
`~/.poki2-cf-token`, `~/.poki2-cf-account`, `~/.poki2-cf-zone`. `.wrangler/` is
gitignored because it records the account id of whoever ran wrangler.

Protocol-mandated public files are the only exception and must remain at the web
root: `public/<indexnow-key>.txt` and `public/google65c93755d768ab97.html`.
`site.config.yaml`'s `deploy.indexnow_key` is public by design.

Commit author and committer identity are part of this rule: set the local
identity `Poki2 <poki2@users.noreply.github.com>` in this repo on every new
machine.

## 5. Change control

- One repository per commit. The sidecar is separate and gitignores `04-source/`.
- Analysis documents are Markdown under `docs/`, indexed in `docs/README.md`;
  build output and generated assets are not hand-edited.
- Before claiming a change is live, verify the built file and the HTTP response.
  A successful deploy command alone is not proof.
- Nothing here authorises a deployment, purge or external submission without an
  explicit instruction in the current task.

## 6. Evidence over assumptions

The 383-URL audit found `cross_host canonical = 0`: Google consistently chose
each page's own canonical. Do not introduce mirrors or canonical redirects to
"resolve competition" between the apex and play hosts. The bottleneck is
content quality and discovery, not canonical conflicts.

## 7. Resolve conflicts at the source

A known contradiction is a defect, not a caveat to carry forward.

1. Measured data outranks prose. When `README.md`, a rule or a config comment
   disagrees with an inspection result, correct the text in the same change
   that cites the measurement.
2. Higher rule tiers outrank lower ones; rewrite the lower tier afterwards.
3. Historical reports stay as evidence, but a disproven conclusion is removed
   from every live authority file. Do not leave a "known conflict" note as a
   substitute for a fix.
4. Applied 2026-11-05: `README.md` and `scripts/sitemap-scope.json` claimed
   that self-canonical pages on apex and play compete and Google picks
   neither. The 383-URL inspection measured `cross_host canonical = 0`; both
   texts now state the corrected fact and the real bottleneck (content
   quality and discovery). Rule 2 of `01-basic-rules.md` is the operational
   form.

## Scope note

Established 2026-11-05. These are project rules for the site repository, not
SEXTANT package rules; the `R-<digits>` numbering and bilingual mirror
convention under `SEXTANT/repos/*/rules/` does not apply here.
