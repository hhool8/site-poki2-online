#!/usr/bin/env node
/**
 * gen-img-manifest.js  —  LOCAL-ONLY dev tool (NOT run during CF deploy)
 *
 * Scans public/imgs/fgame/*.{png,jpg,jpeg}, produces content-hashed,
 * fingerprinted copies in public/imgs/fgame/h/ as both:
 *   - <slug>.<hash>.<ext>   (lossless copy of the original, for <img> fallback)
 *   - <slug>.<hash>.webp    (cwebp -q 82, for <picture> <source>)
 * and writes public/img-manifest.json:
 *   { "<slug>": { webp, png, orig } }
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

function sha256OfFile(file) {
  const buf = fs.readFileSync(file);
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 12);
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

    // WebP via cwebp (local only). Skip files we can't transcode (e.g. the
    // pre-existing 0-byte mahjong-classic.jpeg) so no phantom URL enters the manifest.
    try {
      execFileSync("cwebp", ["-q", String(WEBP_QUALITY), src, "-o", webpOut], {
        stdio: ["ignore", "ignore", "ignore"],
      });
    } catch (err) {
      console.warn(`  SKIP (cwebp failed, leaving original): ${name}`);
      // Remove any partial webp so we don't ship a broken file
      if (fs.existsSync(webpOut)) fs.unlinkSync(webpOut);
      continue;
    }
    generated++;

    // Lossless copy for <img> fallback (identical bytes → git dedups vs original)
    fs.copyFileSync(src, pngOut);

    manifest[slug] = {
      webp: `/imgs/fgame/h/${slug}.${hash}.webp`,
      png: `/imgs/fgame/h/${slug}.${hash}.${outExt}`,
      orig: `/imgs/fgame/${slug}${rawExt}`,
    };
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(
    `✓ ${files.length} source images → ${generated} webp generated; manifest: ${Object.keys(manifest).length} entries → ${path.relative(path.join(__dirname, ".."), MANIFEST)}`
  );
}

main();
