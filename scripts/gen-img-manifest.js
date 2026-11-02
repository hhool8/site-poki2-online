#!/usr/bin/env node
/**
 * gen-img-manifest.js  —  LOCAL-ONLY dev tool (NOT run during CF deploy)
 *
 * Scans public/imgs/fgame/*.{png,jpg,jpeg}, produces content-hashed,
 * fingerprinted copies in public/imgs/fgame/h/ as:
 *   - <slug>.<hash>.<ext>     (lossless copy of the original, for <img> fallback)
 *   - <slug>.<hash>.webp      (cwebp -q 82, full resolution, for <picture> <source>)
 *   - <slug>.<hash>.256.webp  (cwebp -q 82 -resize 256 0, for responsive srcset)
 * and writes public/img-manifest.json:
 *   { "<slug>": { webp, png, orig, w, w256 } }
 * where `w` is the intrinsic source width (for width descriptors) and `w256`
 * is the 256px-wide webp path.
 *
 * Why fingerprinting? So build.js can emit /imgs/fgame/h/* URLs that are safe
 * to serve with `Cache-Control: immutable` (filename changes when bytes change).
 *
 * cwebp must be installed locally (/usr/local/bin/cwebp). The Cloudflare Pages
 * build never runs this script — it only consumes the committed manifest and the
 * pre-generated /h/ files, so no image tooling is required at deploy time.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const FGAMEDIR = path.join(__dirname, "..", "public", "imgs", "fgame");
const HDIR = path.join(FGAMEDIR, "h");
const MANIFEST = path.join(__dirname, "..", "public", "img-manifest.json");
const WEBP_QUALITY = 82;
const WEBP_SMALL_W = 256;

function sha256OfFile(file) {
  const buf = fs.readFileSync(file);
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 12);
}

// Best-effort intrinsic width for width descriptors. PNG (IHDR) and JPEG (SOF0/2)
// are parsed directly; anything else falls back to 512.
function imageWidth(file) {
  try {
    const buf = fs.readFileSync(file);
    if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      return buf.readUInt32BE(16); // PNG IHDR width
    }
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        // SOF markers (exclude DHT 0xC4, DAC 0xCC, 0xC8)
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return buf.readUInt16BE(i + 7); // JPEG width follows height
        }
        if (i + 4 > buf.length) break;
        const len = buf.readUInt16BE(i + 2);
        i += 2 + len;
      }
    }
  } catch { /* fall through */ }
  return 512;
}

function main() {
  if (!fs.existsSync(FGAMEDIR)) {
    console.error("No public/imgs/fgame directory — nothing to do.");
    process.exit(0);
  }
  // Clean any previously generated /h/ output so re-runs don't leave orphaned
  // files behind when an image's hash changes.
  fs.rmSync(HDIR, { recursive: true, force: true });
  fs.mkdirSync(HDIR, { recursive: true });

  const files = fs
    .readdirSync(FGAMEDIR)
    .filter((n) => /\.(png|jpe?g)$/i.test(n))
    .filter((n) => n !== "h"); // skip the h/ subdir itself

  const manifest = {};
  let generated = 0;

  for (const name of files) {
    const rawExt = path.extname(name).toLowerCase(); // ".png" | ".jpg" | ".jpeg"
    const outExt = rawExt === ".jpeg" ? "jpg" : rawExt.slice(1); // png | jpg
    const slug = path.basename(name, rawExt); // strip real extension
    const src = path.join(FGAMEDIR, name);
    const hash = sha256OfFile(src);

    const pngOut = path.join(HDIR, `${slug}.${hash}.${outExt}`);
    const webpOut = path.join(HDIR, `${slug}.${hash}.webp`);
    const webpSmallOut = path.join(HDIR, `${slug}.${hash}.256.webp`);

    // WebP via cwebp (local only). Skip files we can't transcode (e.g. a
    // 0-byte / corrupt source) so no phantom URL enters the manifest.
    try {
      execFileSync("cwebp", ["-q", String(WEBP_QUALITY), src, "-o", webpOut], {
        stdio: ["ignore", "ignore", "ignore"],
      });
      // Responsive variant: cap width at 256px, preserve aspect ratio.
      execFileSync("cwebp", ["-q", String(WEBP_QUALITY), "-resize", String(WEBP_SMALL_W), "0", src, "-o", webpSmallOut], {
        stdio: ["ignore", "ignore", "ignore"],
      });
    } catch (err) {
      console.warn(`  SKIP (cwebp failed, leaving original): ${name}`);
      // Remove any partial webp so we don't ship a broken file
      for (const f of [webpOut, webpSmallOut]) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
      continue;
    }
    generated++;

    // Lossless copy for <img> fallback (identical bytes → git dedups vs original)
    fs.copyFileSync(src, pngOut);

    manifest[slug] = {
      webp: `/imgs/fgame/h/${slug}.${hash}.webp`,
      png: `/imgs/fgame/h/${slug}.${hash}.${outExt}`,
      orig: `/imgs/fgame/${slug}${rawExt}`,
      w: imageWidth(src),
      w256: `/imgs/fgame/h/${slug}.${hash}.256.webp`,
    };
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(
    `✓ ${files.length} source images → ${generated} webp (+ ${generated} @256w) generated; manifest: ${Object.keys(manifest).length} entries → ${path.relative(path.join(__dirname, ".."), MANIFEST)}`
  );
}

main();
