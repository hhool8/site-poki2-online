#!/usr/bin/env node
/**
 * Semrush-style site audit crawler for poki2.online
 * Checks: sitemap crawlability, HTTPS, redirects/chains, titles, meta descriptions,
 * canonical, robots meta, h1, images (alt/size), og tags, viewport, lang,
 * structured data, internal links (broken/mixed), mixed content.
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ORIGIN = 'https://poki2.online';
const UA = 'Mozilla/5.0 (compatible; SiteAuditor/1.0)';
const CONCURRENCY = 8;

function fetchPage(url, method = 'GET', depth = 0) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.get(url, { headers: { 'User-Agent': UA }, timeout: 20000 }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && depth < 5) {
        const next = new URL(res.headers.location, url).href;
        res.resume();
        return fetchPage(next, method, depth + 1).then((r) =>
          resolve({ ...r, redirectChain: [url, ...(r.redirectChain || [])] })
        );
      }
      if (method === 'HEAD') { res.resume(); return resolve({ status: res.statusCode, headers: res.headers, redirectChain: depth ? [url] : [] }); }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers, redirectChain: depth ? [url] : [] }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout', redirectChain: [] }); });
    req.on('error', (e) => resolve({ status: 0, error: e.message, redirectChain: [] }));
  });
}

function m(re, s) { const x = s.match(re); return x ? x[1] : null; }
function count(re, s) { return (s.match(re) || []).length; }

function analyze(url, body) {
  const r = {};
  r.url = url;
  r.status = 200;
  r.title = m(/<title[^>]*>([^<]*)<\/title>/i, body);
  r.titleLen = r.title ? r.title.trim().length : 0;
  const md = body.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) ||
             body.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i);
  r.desc = md ? md[1].trim() : null;
  r.descLen = r.desc ? r.desc.length : 0;
  r.canonical = m(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i, body);
  const robotsMeta = m(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i, body);
  r.robotsMeta = robotsMeta;
  r.h1s = count(/<h1[\s>]/gi, body);
  r.h1Text = m(/<h1[^>]*>([\s\S]*?)<\/h1>/i, body);
  if (r.h1Text) r.h1Text = r.h1Text.replace(/<[^>]+>/g, '').trim().slice(0, 100);
  r.h2s = count(/<h2[\s>]/gi, body);
  r.imgs = count(/<img[\s>]/gi, body);
  r.imgsNoAlt = count(/<img(?![^>]*\balt=)[^>]*>/gi, body);
  r.imgsEmptyAlt = count(/<img[^>]*\balt=["']["'][^>]*>/gi, body);
  r.ogTitle = /<meta\s+property=["']og:title["']/i.test(body) ? true : false;
  r.ogDesc = /<meta\s+property=["']og:description["']/i.test(body) ? true : false;
  r.ogImage = m(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i, body);
  r.viewport = /<meta\s+name=["']viewport["']/i.test(body) ? true : false;
  r.lang = m(/<html[^>]*\slang=["']([^"']+)["']/i, body);
  r.schema = count(/application\/ld\+json/gi, body);
  r.relNext = m(/<link\s+rel=["'](next|prev)["']/i, body) ? true : false;
  r.sizeKB = Math.round(Buffer.byteLength(body) / 1024);
  r.mixedContent = count(/(?:src|href)=["']http:\/\/(?!poki2\.online)/gi, body);
  // internal links
  r.links = [];
  const linkRe = /<a\s[^>]*href=["']([^"'#]+)["']/gi;
  let lm;
  while ((lm = linkRe.exec(body))) {
    try {
      const u = new URL(lm[1], url);
      if (u.hostname === 'poki2.online') r.links.push(u.origin + u.pathname.replace(/\/$/, ''));
    } catch {}
  }
  r.links = [...new Set(r.links)];
  return r;
}

async function pool(items, worker, n) {
  const ret = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++;
      ret[idx] = await worker(items[idx]);
    }
  }));
  return ret;
}

(async () => {
  console.log('Fetching sitemap...');
  const sm = await fetchPage(ORIGIN + '/sitemap.xml');
  const urls = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1]);
  console.log(`  ${urls.length} URLs in sitemap`);

  // 1. crawl all sitemap pages
  const results = await pool(urls, async (u) => {
    const res = await fetchPage(u);
    if (res.status !== 200) return { url: u, status: res.status, redirectChain: res.redirectChain, error: res.error };
    return analyze(u, res.body);
  }, CONCURRENCY);

  console.log(`  crawled results: ${results.length}`);
  // 2. collect internal links not in sitemap, HEAD-check them
  const sitemapSet = new Set(urls.map((u) => u.replace(/\/$/, '')));
  const crawled = new Set(urls.map((u) => u.replace(/\/$/, '')));
  const extra = new Set();
  for (const p of results) if (p.links) for (const l of p.links) if (!crawled.has(l)) { extra.add(l); crawled.add(l); }
  console.log(`  ${extra.size} internal links outside sitemap — checking...`);
  const extraChecks = await pool([...extra], async (u) => {
    const res = await fetchPage(u, 'HEAD');
    return { url: u, status: res.status, finalUrl: res.redirectChain && res.redirectChain.length ? res.redirectChain[res.redirectChain.length - 1] : u, chain: res.redirectChain };
  }, 8);

  // 3. sitemap URL HEAD verification of referenced static assets (sample: images on pages)
  const assetIssues = new Set();
  for (const p of results) {
    if (!p.ogImage) continue;
    let img = p.ogImage;
    if (img.startsWith('/')) img = ORIGIN + img;
    if (!img.startsWith('http')) continue;
    if (!img.includes('poki2.online')) continue;
    const res = await fetchPage(img, 'HEAD');
    if (res.status !== 200) assetIssues.add(img + ' -> ' + res.status);
  }

  // 4. robots.txt + 404 behaviour + www variant + http variant
  const robots = await fetchPage(ORIGIN + '/robots.txt');
  const notFound = await fetchPage(ORIGIN + '/definitely-not-a-page-xyz123', 'HEAD');
  const www = await fetchPage('https://www.poki2.online/', 'HEAD');
  const httpV = await fetchPage('http://poki2.online/', 'HEAD');

  const report = { generatedAt: new Date().toISOString(), pages: results, extraLinks: extraChecks, assetIssues: [...assetIssues],
    tech: {
      robotsStatus: robots.status, robotsBody: robots.body ? robots.body.slice(0, 500) : null,
      custom404Status: notFound.status, wwwStatus: www.status, wwwRedirect: www.redirectChain,
      httpStatus: httpV.status, httpRedirect: httpV.redirectChain,
    } };
  fs.writeFileSync(path.join(__dirname, '../.workbuddy/audit-raw.json'), JSON.stringify(report, null, 1));

  // summary
  const ok = results.filter((r) => r.status === 200 && r.title);
  const errs = results.filter((r) => r.status !== 200);
  const issues = [];
  const add = (sev, name, cnt, sample) => issues.push({ sev, name, cnt, sample });

  if (errs.length) add('error', 'Sitemap pages not 200', errs.length, errs.map((e) => `${e.url} -> ${e.status}`).join(', '));
  const noTitle = results.filter((r) => r.status === 200 && !r.title);
  if (noTitle.length) add('error', 'Missing title', noTitle.length, noTitle.map((r) => r.url).join(', '));
  const longT = results.filter((r) => r.titleLen > 60);
  const shortT = results.filter((r) => r.status === 200 && r.title && r.titleLen < 30);
  if (shortT.length) add('warning', 'Short title (<30 chars)', shortT.length, shortT.slice(0, 5).map((r) => `${r.url} (${r.titleLen})`).join(', '));
  if (longT.length) add('warning', 'Long title (>60 chars)', longT.length, longT.slice(0, 5).map((r) => `${r.url} (${r.titleLen})`).join(', '));
  const noDesc = results.filter((r) => r.status === 200 && !r.desc);
  if (noDesc.length) add('warning', 'Missing meta description', noDesc.length, noDesc.map((r) => r.url).join(', '));
  const shortD = results.filter((r) => r.status === 200 && r.desc && r.descLen < 70);
  if (shortD.length) add('warning', 'Short meta description (<70)', shortD.length, shortD.slice(0, 5).map((r) => `${r.url} (${r.descLen})`).join(', '));
  const longD = results.filter((r) => r.status === 200 && r.desc && r.descLen > 160);
  if (longD.length) add('warning', 'Long meta description (>160)', longD.length, longD.slice(0, 5).map((r) => `${r.url} (${r.descLen})`).join(', '));
  const noCanon = results.filter((r) => r.status === 200 && !r.canonical);
  if (noCanon.length) add('error', 'Missing canonical', noCanon.length, noCanon.map((r) => r.url).join(', '));
  const wrongCanon = results.filter((r) => r.canonical && r.canonical.replace(/\/$/, '') !== r.url.replace(/\/$/, ''));
  if (wrongCanon.length) add('warning', 'Canonical mismatch', wrongCanon.length, wrongCanon.slice(0, 5).map((r) => `${r.url} -> ${r.canonical}`).join(', '));
  const multiH1 = results.filter((r) => r.h1s > 1);
  if (multiH1.length) add('warning', 'Multiple H1', multiH1.length, multiH1.slice(0, 5).map((r) => `${r.url} (${r.h1s})`).join(', '));
  const zeroH1 = results.filter((r) => r.status === 200 && r.h1s === 0);
  if (zeroH1.length) add('warning', 'No H1', zeroH1.length, zeroH1.map((r) => r.url).join(', '));
  const noAlt = results.filter((r) => r.imgsNoAlt > 0);
  if (noAlt.length) add('warning', 'Images missing alt', noAlt.length, noAlt.slice(0, 8).map((r) => `${r.url} (${r.imgsNoAlt})`).join(', '));
  const noOg = results.filter((r) => r.status === 200 && !r.ogTitle);
  if (noOg.length) add('warning', 'Missing og:title', noOg.length, noOg.map((r) => r.url).join(', '));
  const noOgImg = results.filter((r) => r.status === 200 && !r.ogImage);
  if (noOgImg.length) add('warning', 'Missing og:image', noOgImg.length, noOgImg.map((r) => r.url).join(', '));
  const noViewport = results.filter((r) => r.status === 200 && !r.viewport);
  if (noViewport.length) add('error', 'Missing viewport', noViewport.length, noViewport.map((r) => r.url).join(', '));
  const noLang = results.filter((r) => r.status === 200 && !r.lang);
  if (noLang.length) add('warning', 'Missing html lang', noLang.length, noLang.map((r) => r.url).join(', '));
  const noSchema = results.filter((r) => r.status === 200 && r.schema === 0);
  if (noSchema.length) add('warning', 'No structured data', noSchema.length, noSchema.map((r) => r.url).join(', '));
  const mixed = results.filter((r) => r.mixedContent > 0);
  if (mixed.length) add('error', 'Mixed content (http://)', mixed.length, mixed.map((r) => r.url).join(', '));
  const broken = extraChecks.filter((e) => e.status !== 200);
  if (broken.length) add('error', 'Broken internal links', broken.length, broken.slice(0, 10).map((e) => `${e.url} -> ${e.status}`).join(', '));
  const chainy = extraChecks.filter((e) => e.chain && e.chain.length > 1);
  if (chainy.length) add('warning', 'Redirect chains in links', chainy.length, chainy.slice(0, 5).map((e) => e.url).join(', '));
  if (assetIssues.size) add('error', 'Broken og:image assets', assetIssues.size, [...assetIssues].slice(0, 5).join(', '));

  console.log('\n==== AUDIT SUMMARY ====');
  console.log(`Pages crawled OK: ${ok.length}/${urls.length}`);
  for (const i of issues.sort((a, b) => (a.sev === 'error' ? -1 : 1)))
    console.log(`[${i.sev.toUpperCase()}] ${i.name}: ${i.cnt}\n   ${String(i.sample).slice(0, 300)}`);
  console.log('\nTech:', JSON.stringify(report.tech, null, 1).slice(0, 600));
})();
