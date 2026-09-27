#!/usr/bin/env node
/**
 * Semrush-style DEEP audit — round 2 dimensions:
 *  1. Crawl efficiency: TTFB, compression, cache headers, page weight
 *  2. Internal linking: click depth from home, orphan pages, nofollow internal links
 *  3. Image weight: largest images referenced by pages
 *  4. Core Web Vitals: PageSpeed Insights API (mobile) on key pages
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ORIGIN = 'https://poki2.online';
const UA = 'Mozilla/5.0 (compatible; SiteAuditor/1.0)';

function fetch(url, { method = 'GET', headers = {}, depth = 0, maxBody = Infinity } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? require('http') : https;
    const req = lib.get(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, br', ...headers }, timeout: 25000 }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && depth < 5) {
        const next = new URL(res.headers.location, url).href;
        res.resume();
        return fetch(next, { method, headers, depth: depth + 1, maxBody }).then((r) =>
          resolve({ ...r, chain: [url, ...(r.chain || [])], ttfb: Date.now() - started })
        );
      }
      const chunks = [];
      let size = 0;
      res.on('data', (c) => { size += c.length; if (size <= maxBody) chunks.push(c); else res.destroy(); });
      res.on('end', () => {
        let body = Buffer.concat(chunks);
        const enc = (res.headers['content-encoding'] || '').toLowerCase();
        try {
          if (enc === 'br') body = require('zlib').brotliDecompressSync(body);
          else if (enc === 'gzip') body = require('zlib').gunzipSync(body);
          else if (enc === 'deflate') body = require('zlib').inflateSync(body);
        } catch {}
        resolve({
          status: res.statusCode, headers: res.headers,
          body: method === 'HEAD' ? null : body.toString('utf8'),
          byteSize: size, ttfb: Date.now() - started, chain: depth ? [url] : [],
        });
      });
      res.on('error', () => resolve({ status: res.statusCode || 0, headers: {}, body: null, byteSize: size, ttfb: Date.now() - started, chain: [] }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, headers: {}, body: null, byteSize: 0, ttfb: 99999, chain: [] }); });
    req.on('error', () => resolve({ status: 0, headers: {}, body: null, byteSize: 0, ttfb: 99999, chain: [] }));
  });
}

async function pool(items, worker, n) {
  const ret = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const idx = i++; ret[idx] = await worker(items[idx]); }
  }));
  return ret;
}

async function psi(url) {
  const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance`;
  const res = await fetch(api, { headers: { 'User-Agent': UA } });
  if (res.status !== 200) return { url, error: 'PSI HTTP ' + res.status };
  try {
    const j = JSON.parse(res.body);
    const lh = j.lighthouseResult || {};
    const aud = lh.audits || {};
    const out = {
      url,
      perfScore: Math.round((lh.categories?.performance?.score ?? 0) * 100),
      fcp: aud['first-contentful-paint']?.displayValue,
      lcp: aud['largest-contentful-paint']?.displayValue,
      tbt: aud['total-blocking-time']?.displayValue,
      cls: aud['cumulative-layout-shift']?.displayValue,
      si: aud['speed-index']?.displayValue,
      // top opportunities
      opps: ['render-blocking-resources', 'unused-css-rules', 'unused-javascript', 'modern-image-formats', 'offscreens-images', 'uses-responsive-images']
        .filter(k => aud[k] && aud[k].details && aud[k].details.overallSavingsMs > 50)
        .map(k => `${k}: ${aud[k].displayValue} (save ${Math.round(aud[k].details.overallSavingsMs)}ms)`),
    };
    const le = j.loadingExperience;
    if (le && le.metrics) out.field = Object.fromEntries(Object.entries(le.metrics).map(([k, v]) => [k, v.percentile + ' (' + v.category + ')']));
    return out;
  } catch (e) { return { url, error: e.message }; }
}

(async () => {
  // ── 1. crawl graph from homepage (BFS) ──────────────────────────────
  console.log('[1] BFS crawl from homepage...');
  const sm = await fetch(ORIGIN + '/sitemap.xml');
  const sitemapUrls = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x => x[1].replace(/\/$/, ''));
  const sitemapSet = new Set(sitemapUrls);

  const seen = new Map(); // url -> {depth, nofollowIn, pages linking}
  const queue = [{ url: ORIGIN + '/', depth: 0 }];
  seen.set(ORIGIN + '/', { depth: 0 });
  const edgePages = []; // page-level audit data
  const nofollowInternal = [];
  const maxDepth = 6;

  while (queue.length) {
    const { url, depth } = queue.shift();
    if (depth > maxDepth) continue;
    const res = await fetch(url, { maxBody: 3_000_000 });
    const page = { url, depth, status: res.status, ttfb: res.ttfb, byteSize: res.byteSize,
      encoding: res.headers['content-encoding'] || 'none',
      cacheControl: res.headers['cache-control'] || 'none',
      htmlKB: Math.round(res.byteSize / 1024) };
    edgePages.push(page);
    if (res.status !== 200 || !res.body) continue;
    const linkRe = /<a\s[^>]*href=["']([^"'#]+)["'][^>]*>/gi;
    let m;
    while ((m = linkRe.exec(res.body))) {
      const attrs = m[0];
      let href = m[1];
      let u2; try { u2 = new URL(href, url); } catch { continue; }
      if (u2.hostname !== 'poki2.online') continue;
      const norm = u2.origin + u2.pathname.replace(/\/$/, '');
      if (norm === url) continue;
      const nofollow = /rel=["'][^"']*nofollow/i.test(attrs);
      if (nofollow) nofollowInternal.push(norm);
      if (!seen.has(norm)) {
        seen.set(norm, { depth: depth + 1 });
        if (depth + 1 <= maxDepth) queue.push({ url: norm, depth: depth + 1 });
      }
    }
  }

  // ── 2. sitemap hygiene: orphans (in sitemap but unreachable from home) ──
  const orphans = sitemapUrls.filter(u => !seen.has(u));
  const notInSitemap = [...seen.keys()].filter(u => !sitemapSet.has(u) && u !== ORIGIN + '/');
  const deep = [...seen.entries()].filter(([, v]) => v.depth >= 5).map(([u]) => u);

  // ── 3. image weight on sample pages ─────────────────────────────────
  console.log('[2] image weight sample...');
  const sampleForImgs = edgePages.filter(p => p.status === 200 && (p.url.match(/fgame|blog\//)));
  const imgSample = sampleForImgs.slice(0, 12);
  const imgSet = new Set();
  for (const p of imgSample) {
    const res = await fetch(p.url, { maxBody: 3_000_000 });
    if (!res.body) continue;
    const imgs = [...res.body.matchAll(/<img[^>]*src=["']([^"']+)["']/gi)].map(x => x[1]);
    for (let src of imgs) {
      try { const u = new URL(src, p.url); if (u.hostname === 'poki2.online') imgSet.add(u.pathname); } catch {}
    }
  }
  const imgSizes = await pool([...imgSet], async (p) => {
    const r = await fetch(ORIGIN + p, { method: 'HEAD' });
    return { path: p, kb: Math.round((+r.headers['content-length'] || 0) / 1024), type: r.headers['content-type'] || '?' };
  }, 8);
  const heavyImgs = imgSizes.filter(i => i.kb > 150).sort((a, b) => b.kb - a.kb);

  // ── 4. Core Web Vitals via PSI on key page types ────────────────────
  console.log('[3] PageSpeed Insights (mobile) on 4 key pages...');
  const psiTargets = [
    ORIGIN + '/',
    ORIGIN + '/fgame/',
    ORIGIN + '/fgame/retro-bowl',
    ORIGIN + '/blog/best-browser-games-2026',
  ];
  const psiResults = [];
  for (const t of psiTargets) {
    console.log('    PSI:', t);
    psiResults.push(await psi(t));
  }

  // ── summary ─────────────────────────────────────────────────────────
  const slow = edgePages.filter(p => p.ttfb > 1200 && p.status === 200);
  const uncompressed = edgePages.filter(p => p.status === 200 && p.encoding === 'none' && p.byteSize > 20000);
  const noCache = edgePages.filter(p => p.status === 200 && p.cacheControl === 'none');
  const heavyHtml = edgePages.filter(p => p.htmlKB > 150);

  console.log('\n==== DEEP AUDIT SUMMARY ====');
  console.log(`reachable: ${seen.size} pages (sitemap: ${sitemapUrls.length})`);
  console.log(`[ORPHANS in sitemap, unreachable from home]: ${orphans.length}${orphans.length ? '\n  ' + orphans.slice(0, 15).join('\n  ') : ''}`);
  console.log(`[reachable but NOT in sitemap]: ${notInSitemap.length}${notInSitemap.length ? '\n  ' + notInSitemap.slice(0, 15).join('\n  ') : ''}`);
  console.log(`[click depth >=5]: ${deep.length}${deep.length ? '\n  ' + deep.slice(0, 10).join('\n  ') : ''}`);
  console.log(`[internal nofollow links]: ${new Set(nofollowInternal).size}${nofollowInternal.length ? '\n  ' + [...new Set(nofollowInternal)].slice(0, 10).join('\n  ') : ''}`);
  console.log(`[TTFB >1200ms]: ${slow.length}${slow.length ? '\n  ' + slow.slice(0, 8).map(p => `${p.ttfb}ms ${p.url}`).join('\n  ') : ''}`);
  console.log(`[uncompressed >20KB]: ${uncompressed.length}${uncompressed.length ? '\n  ' + uncompressed.slice(0, 5).map(p => `${p.encoding} ${p.htmlKB}KB ${p.url}`).join('\n  ') : ''}`);
  console.log(`[no cache-control]: ${noCache.length} (CF default policy — informational)`);
  console.log(`[HTML >150KB]: ${heavyHtml.length}${heavyHtml.length ? '\n  ' + heavyHtml.slice(0, 5).map(p => `${p.htmlKB}KB ${p.url}`).join('\n  ') : ''}`);
  console.log(`[images >150KB sampled ${imgSizes.length}]: ${heavyImgs.length}${heavyImgs.length ? '\n  ' + heavyImgs.slice(0, 12).map(i => `${i.kb}KB ${i.path}`).join('\n  ') : ''}`);
  console.log('\n[PSI mobile]');
  for (const p of psiResults) {
    if (p.error) { console.log(`  ${p.url}: ${p.error}`); continue; }
    console.log(`  ${p.url}\n    perf=${p.perfScore} LCP=${p.lcp} CLS=${p.cls} TBT=${p.tbt} FCP=${p.fcp}`);
    if (p.field) console.log('    field: ' + JSON.stringify(p.field));
    if (p.opps.length) console.log('    opportunities: ' + p.opps.join(' | '));
  }

  fs.writeFileSync(path.join(__dirname, '../.workbuddy/audit-deep-raw.json'),
    JSON.stringify({ edgePages, orphans, notInSitemap, deep, nofollowInternal: [...new Set(nofollowInternal)], heavyImgs, imgSampleCount: imgSizes.length, psiResults }, null, 1));
})();
