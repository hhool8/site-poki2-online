#!/usr/bin/env node
/**
 * Recompress oversized images in public/imgs/fgame in place.
 * - PNG: resize to max 512px inside, palette quantization quality 80
 * - JPEG: re-encode quality 82 progressive if >150KB
 * Git history is the backup.
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '../public/imgs/fgame');
const THRESHOLD = 150 * 1024;

(async () => {
  const files = fs.readdirSync(DIR).filter(f => /\.(png|jpe?g)$/i.test(f));
  let saved = 0, changed = 0;
  for (const f of files) {
    const p = path.join(DIR, f);
    const before = fs.statSync(p).size;
    if (before <= THRESHOLD) continue;
    const buf = fs.readFileSync(p);
    const meta = await sharp(buf).metadata();
    let out;
    if (/\.png$/i.test(f)) {
      out = await sharp(buf)
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .png({ palette: true, quality: 80, effort: 8 })
        .toBuffer();
    } else {
      out = await sharp(buf)
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82, progressive: true, mozjpeg: true })
        .toBuffer();
    }
    if (out.length < before * 0.9) {
      fs.writeFileSync(p, out);
      saved += before - out.length;
      changed++;
      console.log(`  ✓ ${f}: ${Math.round(before / 1024)}KB → ${Math.round(out.length / 1024)}KB (${meta.width}x${meta.height})`);
    } else {
      console.log(`  ~ ${f}: kept (${Math.round(before / 1024)}KB, best already)`);
    }
  }
  console.log(`\n${changed} images recompressed, ${Math.round(saved / 1024)}KB total saved`);
})();
