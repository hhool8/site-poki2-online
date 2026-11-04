# Analysis Documents

Every intermediate analysis file for this project lives here, in Markdown.

## Why Markdown, not HTML

These documents used to be standalone HTML reports. That was the wrong format
for three reasons:

1. **HTML reads as a finished deliverable.** A styled report looks authoritative,
   so nobody re-checks whether its numbers are still true.
2. **HTML cannot be reviewed in a diff.** A reviewer sees one changed blob,
   not "the warning count moved from 6 to 9".
3. **The styling hides the content.** A colour-coded card conveys severity in
   one glance to a browser, and conveys nothing at all to `grep`, to an agent
   reading the repo, or to anyone on a terminal.

Markdown in the repo is greppable, diffable, and honest about its age. A
report's date is part of its filename, so a stale report is obvious.

If a report genuinely needs to be rendered (a client-facing deliverable),
generate it from the Markdown — do not store the rendered artefact as the
source of truth.

## Documents

| File | Date | What it covers |
|---|---|---|
| [`audit-report-2026-09-01.md`](audit-report-2026-09-01.md) | 2026-09-01 | Full SEO & technical audit — 35 categories, 7 critical issues, redirect chains, orphan fragments |
| [`backlink-plan-2026-09-27.md`](backlink-plan-2026-09-27.md) | 2026-09-27 | Off-page link research: no-registration directories, game-niche platforms, and the anti-spam-policy guardrails |
| [`seo-audit-2026-09-27.md`](seo-audit-2026-09-27.md) | 2026-09-27 | Semrush-style crawl: on-page checks, internal-linking graph, image weight, TTFB, compression |
| [`gsc-coverage-2026-10-14.md`](gsc-coverage-2026-10-14.md) | 2026-10-14 | Search Console coverage diagnosis — why 1,415 known pages yielded exactly 1 indexed URL |

## Live measurement

Static reports go stale. Current numbers come from the measurement tooling in
the sidecar repo (`SEXTANT/sites/poki2-online/07-measure/`), not from here.

| Script | Question it answers |
|---|---|
| `07-measure/tools/gsc_inspect.py` | What does Google actually know about each of the 383 canonical URLs? |
| `07-measure/tools/gsc_write_check.py` | Do we still have write scope on the GSC property? Can we resubmit the sitemap? |
| `04-source/scripts/bing-status.js` | What has Bing discovered, crawled, and dated for each URL? |
| `04-source/scripts/audit-crawler.js` | On-page checks on every sitemap URL (title, description, canonical, H1, OG, JSON-LD). |
| `04-source/scripts/audit-deep.js` | Internal-link graph (orphans, click depth, nofollow), TTFB, compression, image weight. |

Both audit scripts write JSON to `.workbuddy/` (git-ignored) and print a
summary. Any report worth keeping is written up here by hand, in Markdown.

## Converting a legacy HTML report

```bash
node scripts/html-to-markdown.js path/to/report.html docs/report-YYYY-MM-DD.md
```

The converter is dependency-free and preserves headings, tables, lists, inline
code, and hard line breaks. It is a one-off migration tool — it is not part of
the build.
