#!/usr/bin/env node
/**
 * One-off: move the blog hero images off images.unsplash.com onto our own origin.
 *
 * Why: every article hero is a hotlinked Unsplash URL. That is a third-party
 * dependency on the most visually important element of 27 pages, and the same
 * URL is also the `Article.image` / `og:image` value — so an Unsplash outage or
 * a change to their URL policy would break display and structured data at the
 * same time. The audit flagged 46 "references"; the real number is 18 unique
 * photos referenced repeatedly (src, srcset, og, twitter, schema) across the
 * templates.
 *
 * The original crops are already the exact aspect ratios the pages use
 * (1200x630 for social cards, 1200x500 for a couple of inline figures), so the
 * download requests the same geometry and re-encodes to WebP rather than
 * re-cropping. Filenames carry the photo id and the dimensions: no hashing,
 * because the mapping has to stay readable in git.
 *
 * Writes public/imgs/blog/SOURCES.json alongside the files so the provenance of
 * every image is recorded in the repo, not in someone's shell history.
 *
 *   node scripts/migrate-unsplash.js --dry-run
 *   node scripts/migrate-unsplash.js --write
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const CONTENT = path.join(ROOT, 'src', 'content', 'blog');
const OUT_DIR = path.join(ROOT, 'public', 'imgs', 'blog');
const WRITE = process.argv.includes('--write');

const URL_RE = /https:\/\/images\.unsplash\.com\/photo-[A-Za-z0-9-]+\?[^"'\s)]*/g;

function collect() {
  const urls = new Map(); // url -> { id, w, h }
  for (const file of fs.readdirSync(CONTENT).filter((f) => f.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(CONTENT, file), 'utf8');
    for (const url of html.match(URL_RE) || []) {
      if (urls.has(url)) continue;
      const id = url.match(/photo-[A-Za-z0-9-]+/)[0];
      const w = Number((url.match(/[?&]w=(\d+)/) || [])[1] || 1200);
      const h = Number((url.match(/[?&]h=(\d+)/) || [])[1] || 630);
      urls.set(url, { id, w, h });
    }
  }
  return urls;
}

async function fetchWebp(url) {
  const res = await fetch(url, { headers: { Accept: 'image/webp,image/*;q=0.8' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const isWebp = buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
  if (isWebp) return { buf, converted: false };
  // Unsplash ignored the Accept header: re-encode locally instead.
  const out = await sharp(buf).webp({ quality: 82 }).toBuffer();
  return { buf: out, converted: true };
}

async function main() {
  const urls = collect();
  console.log(`${urls.size} unique Unsplash URLs across ${fs.readdirSync(CONTENT).filter((f) => f.endsWith('.html')).length} posts`);
  if (!WRITE) {
    for (const [url, meta] of urls) console.log(`  ${meta.id} ${meta.w}x${meta.h}  ${url.slice(0, 60)}…`);
    console.log('\n(dry run — pass --write to download and rewrite)');
    return;
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const mapping = {};
  let converted = 0;
  for (const [url, meta] of urls) {
    const name = `${meta.id.replace(/^photo-/, '')}-${meta.w}x${meta.h}.webp`;
    const { buf, converted: c } = await fetchWebp(url);
    fs.writeFileSync(path.join(OUT_DIR, name), buf);
    if (c) converted += 1;
    mapping[url] = { local: `/imgs/blog/${name}`, bytes: buf.length, source: url.split('?')[0] };
    console.log(`  ✓ ${name}  ${(buf.length / 1024).toFixed(1)} KB`);
  }

  let touched = 0;
  for (const file of fs.readdirSync(CONTENT).filter((f) => f.endsWith('.html'))) {
    const p = path.join(CONTENT, file);
    const before = fs.readFileSync(p, 'utf8');
    let after = before;
    for (const [url, meta] of Object.entries(mapping)) after = after.split(url).join(meta.local);
    if (after !== before) {
      fs.writeFileSync(p, after);
      touched += 1;
    }
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'SOURCES.json'),
    `${JSON.stringify({
      note: 'Blog hero images migrated off images.unsplash.com. Source URLs retained for provenance; Unsplash License permits commercial use without attribution, attribution recorded anyway.',
      migrated_at: new Date().toISOString(),
      images: mapping,
    }, null, 2)}\n`
  );

  console.log(`\nrewrote ${touched} content files; ${converted} decoded locally (Unsplash did not honour Accept: image/webp)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
