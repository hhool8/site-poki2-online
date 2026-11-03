#!/usr/bin/env node
/**
 * Read what Bing actually knows about poki2.online.
 *
 * WHY THIS EXISTS
 * `scripts/indexnow.js` announces URLs and gets back HTTP 202. That proves the
 * key validated and the URLs were queued -- it does not prove anything was
 * crawled, let alone indexed. api.indexnow.org has no read endpoint, so the
 * only way to close that loop is Bing's own account API, which needs a key from
 * a verified Bing Webmaster Tools property.
 *
 * WHAT THIS CAN AND CANNOT ANSWER
 * There is no "indexed: true/false" field in this API. `GetUrlInfo` returns
 * DiscoveryDate, LastCrawledDate, HttpStatus, IsPage, DocumentSize,
 * AnchorCount and TotalChildUrlCount -- and nothing about indexing. So:
 *
 *   LastCrawledDate set, HttpStatus 200  -> Bing fetched it; indexing is then
 *                                           a quality decision, not a discovery one
 *   DiscoveryDate set, no LastCrawledDate -> Bing knows the URL exists but has
 *                                           not fetched it
 *   neither                               -> Bing has never heard of the URL
 *
 * The authoritative "in the index" check is URL Inspection in the web UI. This
 * script narrows 102 URLs down to the handful worth inspecting by hand, which
 * is the actual bottleneck. Do not read a green row here as "indexed".
 *
 * API NOTES (verified 2026-11-04)
 * - SOAP and POX were retired 2026-08-31; JSON/REST is the surviving protocol:
 *   https://ssl.bing.com/webmaster/api.svc/json/{Method}?apikey=...
 * - Responses are wrapped in {"d": ...}; dates arrive as /Date(ms-offset)/.
 * - The API key is per user, not per site, and only one exists per user.
 *
 * USAGE
 *   BING_API_KEY=<key> node scripts/bing-status.js sites
 *   node scripts/bing-status.js crawl
 *   node scripts/bing-status.js url https://poki2.online/blog/what-are-io-games
 *   node scripts/bing-status.js audit [--limit N] [--json out.json]
 *
 * The key is read from BING_API_KEY, otherwise from ~/.poki2-bing-key
 * (override: BING_KEY_FILE). Same convention as ~/.poki2-cf-token: a 0600 file
 * outside the repo, so no export is needed and nothing lands in git history.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITEMAP = path.join(DIST, 'sitemap.xml');
const KEY_FILE = process.env.BING_KEY_FILE || path.join(os.homedir(), '.poki2-bing-key');
const API = 'https://ssl.bing.com/webmaster/api.svc/json';
const DEFAULT_SITE = 'https://poki2.online/';

const argv = process.argv.slice(2);
const command = argv.find((a) => !a.startsWith('-')) || 'audit';
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

function fail(lines) {
  for (const l of [].concat(lines)) console.error(l);
  process.exit(1);
}

function resolveKey() {
  const fromEnv = (process.env.BING_API_KEY || '').trim();
  if (fromEnv) return { key: fromEnv, source: 'BING_API_KEY' };
  try {
    const fromFile = fs.readFileSync(KEY_FILE, 'utf8').trim();
    if (fromFile) return { key: fromFile, source: KEY_FILE };
  } catch {
    /* no file */
  }
  return { key: null, source: null };
}

const KEY = resolveKey();

if (!KEY.key) {
  fail([
    '[bing] No API key: BING_API_KEY is unset and ' + KEY_FILE + ' does not exist.',
    '',
    '[bing] One-time setup, ~4 minutes, all in a browser:',
    '  1. https://www.bing.com/webmasters -> sign in with the account that owns the site.',
    '     If the site is not listed, Add site. The fastest verification is "Import from',
    '     Google Search Console" (needs GSC access); otherwise publish the XML file or',
    '     meta tag it gives you -- the meta tag goes in src/templates/base.html and the',
    '     XML file in public/, then deploy.',
    '  2. Settings (top right) -> API Access -> accept the terms -> Generate API Key.',
    '  3. printf %s <key> > ~/.poki2-bing-key && chmod 600 ~/.poki2-bing-key',
    '',
    '[bing] Then: node scripts/bing-status.js sites',
  ]);
}

/** GET a JSON/REST method, unwrapping Bing's {"d": ...} envelope. */
async function call(method, params = {}) {
  const qs = new URLSearchParams({ apikey: KEY.key, ...params });
  const url = `${API}/${method}?${qs}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const text = await res.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }

  if (!res.ok || !body || body.ErrorCode) {
    const detail = body && body.Message ? `ErrorCode ${body.ErrorCode}: ${body.Message}` : `HTTP ${res.status}: ${text.slice(0, 200)}`;
    throw new Error(`${method} failed - ${detail}`);
  }
  return body.d === undefined ? body : body.d;
}

/** /Date(1316156400000-0700)/ -> "2026-11-04" (or null). */
function parseDate(v) {
  if (!v) return null;
  const m = String(v).match(/\/Date\((-?\d+)([+-]\d{4})?\)\//);
  if (!m) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return new Date(Number(m[1])).toISOString().slice(0, 10);
}

/**
 * Resolve the siteUrl exactly as Bing registered it. Errors here are fatal on
 * purpose: an invalid key would otherwise fail once per sitemap URL, turning a
 * one-line auth problem into 102 identical console warnings.
 */
async function pickSite() {
  const explicit = value('site');
  if (explicit) return explicit;

  const sites = await call('GetUserSites');
  const list = Array.isArray(sites) ? sites : [];
  const hit = list.find((s) => /poki2\.online/i.test(s.Url || ''));
  if (hit) {
    if (!hit.IsVerified) {
      console.warn(`[bing] "${hit.Url}" is registered but NOT verified -- most methods return empty or fail until it is.`);
    }
    return hit.Url;
  }
  if (list.length) {
    console.warn('[bing] poki2.online is not in this account. Sites this key can see:');
    for (const s of list) console.warn(`[bing]   ${s.Url}  verified=${s.IsVerified}`);
  } else {
    console.warn('[bing] The key authenticated but sees no sites. Add and verify the property first.');
  }
  return DEFAULT_SITE;
}

function sitemapUrls() {
  if (!fs.existsSync(SITEMAP)) fail(`[bing] ${SITEMAP} not found - run the build first.`);
  return [...fs.readFileSync(SITEMAP, 'utf8').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

async function cmdSites() {
  const sites = await call('GetUserSites');
  if (!Array.isArray(sites) || sites.length === 0) {
    console.log('[bing] The key authenticated but sees no sites. Add and verify the property first.');
    return;
  }
  for (const s of sites) {
    console.log(`${s.IsVerified ? 'verified  ' : 'UNVERIFIED'}  ${s.Url}`);
  }
}

async function cmdCrawl() {
  const site = await pickSite();
  const stats = await call('GetCrawlStats', { siteUrl: site });
  const rows = Array.isArray(stats) ? stats.slice(-10) : [];
  if (rows.length === 0) {
    console.log(`[bing] GetCrawlStats returned nothing for ${site} - Bing has not crawled anything yet.`);
    return;
  }
  console.log(`[bing] Bingbot activity for ${site} (last ${rows.length} reported days)`);
  console.log('  date         crawled  inLinks  errors  2xx   4xx   5xx');
  for (const r of rows) {
    console.log(
      `  ${(parseDate(r.Date) || String(r.Date)).padEnd(11)} ${String(r.CrawledPages ?? '-').padStart(6)} ` +
      `${String(r.InLinks ?? '-').padStart(8)} ${String(r.CrawlErrors ?? '-').padStart(6)} ` +
      `${String(r.Code2xx ?? '-').padStart(4)} ${String(r.Code4xx ?? '-').padStart(4)} ${String(r.Code5xx ?? '-').padStart(4)}`
    );
  }
}

async function cmdUrl() {
  const target = argv.find((a) => /^https?:\/\//.test(a));
  if (!target) fail('[bing] Pass a URL: node scripts/bing-status.js url https://poki2.online/…');
  const site = await pickSite();
  const info = await call('GetUrlInfo', { siteUrl: site, url: target });
  if (!info) {
    console.log(`[bing] ${target}\n       unknown to Bing (no discovery record)`);
    return;
  }
  const discovered = parseDate(info.DiscoveryDate);
  const crawled = parseDate(info.LastCrawledDate);
  console.log(`[bing] ${target}`);
  console.log(`       discovered   ${discovered || '-'}`);
  console.log(`       last crawled ${crawled || 'never'}`);
  console.log(`       http status  ${info.HttpStatus || '-'}`);
  console.log(`       is page      ${info.IsPage}`);
  console.log(`       size         ${info.DocumentSize ?? '-'}`);
  console.log(`       inlinks      ${info.AnchorCount ?? '-'}`);
  console.log(`       children     ${info.TotalChildUrlCount ?? '-'}`);
  console.log(`       verdict      ${crawled ? 'fetched -- indexing is now a quality call, check URL Inspection' : discovered ? 'known but never fetched' : 'not fetched'}`);
}

async function cmdAudit() {
  const site = await pickSite();
  const limit = Number(value('limit', '0')) || 0;
  const urls = sitemapUrls().slice(0, limit || undefined);
  console.log(`[bing] Auditing ${urls.length} sitemap URLs against site ${site}`);

  const rows = [];
  let i = 0;
  for (const u of urls) {
    i += 1;
    try {
      const info = await call('GetUrlInfo', { siteUrl: site, url: u });
      rows.push({
        url: u,
        discovered: info ? parseDate(info.DiscoveryDate) : null,
        crawled: info ? parseDate(info.LastCrawledDate) : null,
        status: info ? info.HttpStatus : null,
      });
    } catch (err) {
      console.warn(`[bing] ${u} -> ${err.message}`);
      rows.push({ url: u, discovered: null, crawled: null, status: null, error: true });
    }
    if (i % 20 === 0) console.log(`[bing]   … ${i}/${urls.length}`);
  }

  const crawled = rows.filter((r) => r.crawled);
  const knownOnly = rows.filter((r) => r.discovered && !r.crawled);
  const unknown = rows.filter((r) => !r.discovered && !r.error);

  console.log('');
  console.log(`  fetched by Bing      ${String(crawled.length).padStart(3)} / ${rows.length}`);
  console.log(`  known, never fetched ${String(knownOnly.length).padStart(3)} / ${rows.length}`);
  console.log(`  unknown to Bing      ${String(unknown.length).padStart(3)} / ${rows.length}`);
  if (unknown.length) {
    console.log('');
    console.log('  Unknown to Bing (these are what IndexNow submission is meant to fix):');
    for (const r of unknown.slice(0, 20)) console.log(`    ${r.url}`);
    if (unknown.length > 20) console.log(`    … and ${unknown.length - 20} more`);
  }

  const out = value('json');
  if (out) {
    fs.writeFileSync(path.resolve(out), `${JSON.stringify({ site, capturedAt: new Date().toISOString(), rows }, null, 2)}\n`);
    console.log(`\n[bing] Wrote ${out}`);
  }
}

const COMMANDS = { sites: cmdSites, crawl: cmdCrawl, url: cmdUrl, audit: cmdAudit };

(COMMANDS[command] || cmdAudit)()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`[bing] ${err.message}`);
    process.exit(1);
  });
