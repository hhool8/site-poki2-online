// Bump updated/isoUpdated for the three blog posts that gained contextual
// internal links to the 6 self-hosted game pages on 2026-10-03.
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'scripts', 'config.js');
let cfg = fs.readFileSync(p, 'utf8');
const slugs = ['best-strategy-browser-games', 'best-browser-games-2026', 'best-puzzle-browser-games'];
const REV = '2026-10-03';
const REV_LONG = 'October 3, 2026';
let n = 0;
for (const slug of slugs) {
  const re = new RegExp("(slug:\\s*'" + slug + "'[\\s\\S]{0,600}?updated:\\s*')([^']*)(',\\s*\\n\\s*isoUpdated:\\s*')([^']*)(')");
  const m = cfg.match(re);
  if (!m) { console.log('MISS', slug); continue; }
  if (m[4] >= REV) { console.log('already fresh', slug, m[4]); continue; }
  cfg = cfg.replace(re, (_all, a, _u, mid, _i, end) => a + REV_LONG + mid + REV + end);
  n++;
}
fs.writeFileSync(p, cfg);
console.log('bumped', n, 'of', slugs.length);
