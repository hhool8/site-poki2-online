#!/usr/bin/env node
/**
 * Download game thumbnails from azgames.io/upload/imgs/ and save to public/imgs/fgame/
 * Also updates config.js imgUrl to /imgs/fgame/{slug}.{ext}
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const DEST = path.join(__dirname, '../public/imgs/fgame');
const CONFIG_PATH = path.join(__dirname, 'config.js');

// Known azgames source filenames (from dist/play pages)
// slug => source filename on azgames.io/upload/imgs/
const KNOWN = {
  '2048':              '2048.jpg',
  'slope':             'slope.png',
  '1v1lol':            '1v1lol.png',
  'cookie-clicker':    'cookieclickerthumb.png',
  'run-3':             'run3thumb.png',
  'stickman-hook':     'stickmanhook.jpg',
  'drift-hunters':     'drifthunters.jpg',
  'shell-shockers':    'shell-shockers.jpg',
  'tetris':            'tetristhumb.png',
  'basketball-stars':  'basketballstarsgamelogo2.png',
  'crossy-road':       'crossyroad1.png',
  'pacman':            'pacman.jpg',
  'retro-bowl':        'retro-bowl.jpg',
  'geometry-dash':     'geometrydash.png',
  'smash-karts':       'smash-karts.jpg',
  'subway-surfers':    'subwaysurfers.png',
  'paper-io':          'paper-io.jpeg',
};

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return download(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      file.close();
      try { fs.unlinkSync(destPath); } catch {}
      reject(err);
    });
  });
}

async function tryDownload(slug, srcFile) {
  const ext = path.extname(srcFile); // .jpg / .png / .jpeg
  const destFile = slug + ext;
  const destPath = path.join(DEST, destFile);
  if (fs.existsSync(destPath)) {
    console.log(`  [skip] ${destFile} already exists`);
    return '/' + path.join('imgs/fgame', destFile).replace(/\\/g, '/');
  }
  const url = `https://azgames.io/upload/imgs/${srcFile}`;
  try {
    await download(url, destPath);
    const size = Math.round(fs.statSync(destPath).size / 1024);
    console.log(`  [ok]   ${destFile}  (${size} KB)  ← ${srcFile}`);
    return '/' + path.join('imgs/fgame', destFile).replace(/\\/g, '/');
  } catch (e) {
    console.log(`  [fail] ${slug}  ${e.message}`);
    return null;
  }
}

async function tryDownloadFallback(slug) {
  for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
    const srcFile = slug + ext;
    const destFile = slug + ext;
    const destPath = path.join(DEST, destFile);
    if (fs.existsSync(destPath)) {
      console.log(`  [skip] ${destFile} already exists`);
      return '/imgs/fgame/' + destFile;
    }
    const url = `https://azgames.io/upload/imgs/${srcFile}`;
    try {
      await download(url, destPath);
      const size = Math.round(fs.statSync(destPath).size / 1024);
      console.log(`  [ok]   ${destFile}  (${size} KB)`);
      return '/imgs/fgame/' + destFile;
    } catch {}
  }
  console.log(`  [miss] ${slug}  – no image found on azgames`);
  return null;
}

async function main() {
  fs.mkdirSync(DEST, { recursive: true });

  const { gamePosts } = require('./config.js');
  const seen = new Set();
  const updates = {}; // slug => new imgUrl

  for (const g of gamePosts) {
    if (seen.has(g.slug)) continue;
    seen.add(g.slug);
    if (g.deprecated) { console.log(`  [dep]  ${g.slug}`); continue; }

    let newUrl = null;
    if (KNOWN[g.slug]) {
      newUrl = await tryDownload(g.slug, KNOWN[g.slug]);
    } else {
      newUrl = await tryDownloadFallback(g.slug);
    }
    if (newUrl) updates[g.slug] = newUrl;
  }

  // Patch config.js: replace each old imgUrl with new one
  let src = fs.readFileSync(CONFIG_PATH, 'utf8');
  let changed = 0;
  for (const [slug, newUrl] of Object.entries(updates)) {
    // Find the game block and replace its imgUrl line
    // Match: imgUrl: '...anything...' within a few lines of the slug
    const pattern = new RegExp(
      `(slug:\\s*'${slug}'[\\s\\S]{0,300}?imgUrl:\\s*')([^']+)(')`,
      'g'
    );
    const before = src;
    src = src.replace(pattern, (m, pre, old, post) => {
      if (old !== newUrl) { changed++; return pre + newUrl + post; }
      return m;
    });
  }
  fs.writeFileSync(CONFIG_PATH, src, 'utf8');
  console.log(`\nPatched ${changed} imgUrl entries in config.js`);
}

main().catch(console.error);
