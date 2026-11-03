#!/usr/bin/env node
/**
 * Tell IndexNow about pages that actually changed, after a deploy.
 *
 * WHY THIS EXISTS
 * poki2.online has had a live IndexNow key file since the first deploy and
 * nothing ever sent a URL to it. That left the site waiting on Google's own
 * crawl schedule: the 2026-11-02 GSC snapshot showed 102 submitted URLs, 1
 * indexed, 42 crawled-not-indexed and 59 that Google had never crawled at all.
 * A sitemap is a hint; IndexNow is the one push channel that does not require
 * anyone's Search Console account, and Bing feeds it to every participating
 * engine from a single endpoint.
 *
 * WHAT IT SUBMITS
 * Not the whole sitemap on every deploy. Search engines treat a site that
 * re-announces 102 unchanged URLs on every push as noise, and the signal that
 * matters is "this URL's bytes changed". So each page in dist/ is fingerprinted
 * and diffed against .indexnow-state.json; only new and changed URLs are sent.
 * Deleted URLs are not sent at all -- IndexNow has no removal verb, and a 404
 * from the sitemap drop is the correct way to retire a page.
 *
 * The fingerprint is the page HTML with the `<!-- built: ... -->` comment
 * stripped. That comment is on line 2 of every article and game page and
 * changes on every build, so hashing the raw file would mark all 102 pages
 * dirty every single time and defeat the whole filter.
 *
 * USAGE
 *   node scripts/indexnow.js --dry-run    # show what would be sent, send nothing
 *   node scripts/indexnow.js              # send changed URLs
 *   node scripts/indexnow.js --all        # ignore state, announce every URL
 *
 * The key is not an environment variable: it is discovered from public/, which
 * is the same directory Cloudflare Pages serves it from. If the file name and
 * its contents disagree the script refuses to run, because that mismatch is
 * exactly the failure that returns 403 from the endpoint and looks like
 * "IndexNow is broken" when it is really "your key file is wrong".
 *
 * A failed ping does not undo the deploy, but it does fail the command. The
 * previous state of this site was an unused key sitting in public/ for months;
 * silent success is how that happens.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PUBLIC = path.join(ROOT, 'public');
const SITEMAP = path.join(DIST, 'sitemap.xml');
const STATE_FILE = process.env.INDEXNOW_STATE || path.join(ROOT, '.indexnow-state.json');

const ENDPOINT = 'https://api.indexnow.org/indexnow';
const KEY_RE = /^[0-9a-f]{32}$/; // IndexNow spec: 8-128 hex chars
const MAX_URLS_PER_REQUEST = 10000; // protocol limit

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const SEND_ALL = argv.includes('--all');

/** Locate the key file in public/ and verify name === contents. */
function resolveKey() {
  const envKey = (process.env.INDEXNOW_KEY || '').trim();
  if (envKey) return { key: envKey, file: null, source: 'INDEXNOW_KEY' };

  if (!fs.existsSync(PUBLIC)) return { error: `missing ${PUBLIC}` };

  const candidates = fs.readdirSync(PUBLIC).filter((f) => {
    const base = f.replace(/\.txt$/, '');
    return f.endsWith('.txt') && KEY_RE.test(base);
  });

  if (candidates.length === 0) {
    return { error: `no <32-hex>.txt key file in public/ (IndexNow rejects keys shorter than 8 or longer than 128 hex characters)` };
  }
  if (candidates.length > 1) {
    return { error: `found ${candidates.length} candidate key files in public/ (${candidates.join(', ')}); keep exactly one` };
  }

  const file = path.join(PUBLIC, candidates[0]);
  const key = candidates[0].replace(/\.txt$/, '');
  const body = fs.readFileSync(file, 'utf8').trim();
  if (body !== key) {
    return {
      error: `key file ${candidates[0]} contains "${body.slice(0, 40)}" instead of its own name. IndexNow compares the two and returns 403 when they differ.`,
    };
  }
  return { key, file, source: candidates[0] };
}

/** Map an absolute sitemap URL to its file in dist/. */
function locToFile(loc, host) {
  const prefix = `https://${host}`;
  if (!loc.startsWith(prefix)) return null;
  let rel = loc.slice(prefix.length) || '/';
  rel = rel.split('#')[0].split('?')[0];

  const attempts = [];
  if (rel === '/') attempts.push('index.html');
  else if (rel.endsWith('/')) attempts.push(path.join(rel, 'index.html'));
  else attempts.push(`${rel}.html`, path.join(rel, 'index.html'));

  for (const a of attempts) {
    const p = path.join(DIST, a);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

/** Page identity that survives a rebuild: strip the per-build comment. */
function fingerprint(file) {
  const html = fs.readFileSync(file, 'utf8').replace(/[ \t]*<!--\s*built:[^>]*?-->\s*/g, '');
  return crypto.createHash('sha256').update(html).digest('hex');
}

function readState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return s && typeof s.pages === 'object' ? s : { pages: {} };
  } catch {
    return { pages: {} };
  }
}

function writeState(pages) {
  const body = {
    note: 'Content fingerprints of the URLs last announced to IndexNow. Machine-local, not committed: losing it only causes a full re-announce, which is harmless.',
    updatedAt: new Date().toISOString(),
    pages,
  };
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(body, null, 2)}\n`);
}

function parseSitemap(xml) {
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  return [...new Set(locs)];
}

async function send(payload) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });
  return { status: res.status, text: (await res.text()).slice(0, 300) };
}

const STATUS_HELP = {
  200: 'OK',
  202: 'Accepted (key validated, URLs queued)',
  400: 'Bad request - the JSON payload was malformed',
  403: 'Forbidden - key file not reachable at keyLocation, or its contents do not match the key',
  422: 'Unprocessable - URLs do not belong to the declared host, or the key does not match',
  429: 'Too many requests - the engine is rate limiting this host',
};

async function main() {
  if (!fs.existsSync(SITEMAP)) {
    console.error(`[indexnow] ${SITEMAP} not found - run the build first.`);
    return 1;
  }

  const keyInfo = resolveKey();
  if (keyInfo.error) {
    console.error(`[indexnow] ${keyInfo.error}`);
    return 1;
  }
  const { key } = keyInfo;

  const locs = parseSitemap(fs.readFileSync(SITEMAP, 'utf8'));
  if (locs.length === 0) {
    console.error('[indexnow] sitemap contains no <loc> entries.');
    return 1;
  }

  const hosts = new Set(locs.map((u) => u.replace(/^https?:\/\//, '').split('/')[0]));
  if (hosts.size !== 1) {
    console.error(`[indexnow] sitemap mixes hosts (${[...hosts].join(', ')}); IndexNow accepts one host per request.`);
    return 1;
  }
  const host = [...hosts][0];

  const state = readState();
  const nextPages = {};
  const changed = [];
  const unchanged = [];
  const unmapped = [];

  for (const loc of locs) {
    const file = locToFile(loc, host);
    if (!file) {
      unmapped.push(loc);
      continue;
    }
    const fp = fingerprint(file);
    nextPages[loc] = fp;
    if (SEND_ALL || !state.pages[loc] || state.pages[loc] !== fp) changed.push(loc);
    else unchanged.push(loc);
  }

  if (unmapped.length) {
    console.warn(`[indexnow] ${unmapped.length} sitemap URL(s) have no file in dist/ and will not be announced:`);
    for (const u of unmapped.slice(0, 10)) console.warn(`[indexnow]   ${u}`);
  }

  console.log(`[indexnow] host=${host} key=${key.slice(0, 6)}…  sitemap=${locs.length}  changed=${changed.length}  unchanged=${unchanged.length}`);
  if (changed.length === 0) {
    console.log('[indexnow] Nothing changed since the last announce. Skipping.');
    return 0;
  }
  for (const u of changed.slice(0, 15)) console.log(`[indexnow]   + ${u}`);
  if (changed.length > 15) console.log(`[indexnow]   … and ${changed.length - 15} more`);

  if (DRY_RUN) {
    console.log('[indexnow] --dry-run: nothing sent, state file untouched.');
    return 0;
  }

  const keyLocation = `https://${host}/${key}.txt`;
  let sent = 0;

  for (let i = 0; i < changed.length; i += MAX_URLS_PER_REQUEST) {
    const urlList = changed.slice(i, i + MAX_URLS_PER_REQUEST);
    const payload = { host, key, keyLocation, urlList };

    let last = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        last = await send(payload);
      } catch (err) {
        last = { status: 0, text: err.message };
      }
      if (last.status === 200 || last.status === 202) break;
      if (attempt < 3) {
        const wait = 1500 * attempt;
        console.warn(`[indexnow] attempt ${attempt} got ${last.status || 'network error'} (${last.text}); retrying in ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }

    if (last.status !== 200 && last.status !== 202) {
      const help = STATUS_HELP[last.status] || 'Unexpected response';
      console.error(`[indexnow] FAILED: HTTP ${last.status} - ${help}`);
      if (last.text) console.error(`[indexnow]   response: ${last.text}`);
      console.error(`[indexnow] The deploy succeeded; only the announcement failed. ${changed.length - sent} URL(s) were not sent.`);
      console.error(`[indexnow] Re-run: node scripts/indexnow.js   (state is only written on success)`);
      if (last.status === 403 || last.status === 422) {
        console.error(`[indexnow] Verify the key is live: curl -s ${keyLocation}`);
      }
      return 1;
    }

    sent += urlList.length;
    console.log(`[indexnow] ${last.status} ${STATUS_HELP[last.status]} - ${urlList.length} URL(s) announced.`);
  }

  writeState(nextPages);
  console.log(`[indexnow] Done: ${sent} URL(s) sent via ${ENDPOINT}; state written to ${path.relative(ROOT, STATE_FILE)}.`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`[indexnow] Unexpected error: ${err.stack || err.message}`);
    process.exit(1);
  });
