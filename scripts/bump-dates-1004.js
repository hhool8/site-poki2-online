// One-off: bump updated/isoUpdated for the 7 posts whose titles were trimmed on 2026-10-04.
const fs = require('fs');
const cfg = 'scripts/config.js';
let s = fs.readFileSync(cfg, 'utf8');
const slugs = [
  'unblocked-games-chromebook-guide',
  'italian-brainrot-games-guide',
  'best-2048-variant-games',
  'game-aggregator-picks',
  'best-mobile-browser-games',
  'best-2-player-games-guide',
  'beginners-guide-to-browser-games',
];
let n = 0;
for (const slug of slugs) {
  const re = new RegExp(
    "(slug:\\s*'" + slug + "'[\\s\\S]{0,500}?updated:\\s*')([^']*)(',\\s*\\n\\s*isoUpdated:\\s*')([^']*)(')"
  );
  if (!re.test(s)) { console.log('MISS:', slug); continue; }
  s = s.replace(re, (m, a, ud, mid, iso, e) => {
    n++;
    return a + 'October 4, 2026' + mid + '2026-10-04' + e;
  });
}
fs.writeFileSync(cfg, s);
console.log('bumped', n, 'blog dates');
