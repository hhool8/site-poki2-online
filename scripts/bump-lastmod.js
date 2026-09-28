// One-off: bump sitemap lastmod signals for pages whose title/description
// were rewritten in the 2026-09-27 SEO audit pass (commit 0b4cbae) but whose
// <lastmod> still points at the pre-audit date. Stale lastmod lowers Google's
// recrawl priority when resubmitting the sitemap to GSC.
const fs = require('fs');
const path = require('path');

const BLOG_SLUGS = [
  'beginners-guide-to-browser-games', 'best-2-player-browser-games',
  'best-2048-variant-games', 'best-idle-clicker-browser-games',
  'best-mobile-browser-games', 'best-multiplayer-browser-games',
  'best-puzzle-browser-games', 'best-racing-browser-games',
  'best-racing-driving-browser-games', 'best-shooting-browser-games',
  'best-simulation-adventure-browser-games', 'best-sports-browser-games',
  'best-strategy-browser-games', 'browser-games-no-download',
  'cookie-clicker-complete-guide', 'game-aggregator-picks',
  'geometry-dash-complete-guide', 'italian-brainrot-games-guide',
  'unblocked-games-at-school-2026', 'unblocked-games-chromebook-guide',
  'unblocked-games-guide',
];
const STATIC_SLUGS = ['about', 'contact', 'dmca', 'index', 'privacy', 'terms'];
const REV = '2026-09-27';
const REV_LONG = 'September 27, 2026';

const cfgPath = path.join(__dirname, '..', 'scripts', 'config.js');
let cfg = fs.readFileSync(cfgPath, 'utf8');
let bumped = 0;
for (const slug of BLOG_SLUGS) {
  const re = new RegExp(
    "(slug:\\s*'" + slug + "'[\\s\\S]{0,600}?updated:\\s*')([^']*)(',\\s*\\n\\s*isoUpdated:\\s*')([^']*)(')"
  );
  if (!re.test(cfg)) { console.log('MISS (blog):', slug); continue; }
  cfg = cfg.replace(re, (m, a, upd, mid, iso, end) => {
    if (iso >= REV) return m; // already fresh
    bumped++;
    return a + REV_LONG + mid + REV + end;
  });
}
fs.writeFileSync(cfgPath, cfg);
console.log('blog entries bumped:', bumped);

// Static pages: lastmod = git date of src/content/<slug>.html — append a
// revision comment so the file's git date reflects the 9/27 content refresh.
for (const slug of STATIC_SLUGS) {
  const p = path.join(__dirname, '..', 'src', 'content', slug + '.html');
  if (!fs.existsSync(p)) { console.log('MISS (static):', slug); continue; }
  let s = fs.readFileSync(p, 'utf8');
  const tag = '<!-- content rev ' + REV + ': seo title/description refresh -->';
  if (s.includes('content rev')) {
    s = s.replace(/<!-- content rev [^>]*-->/, tag);
  } else {
    s += '\n' + tag + '\n';
  }
  fs.writeFileSync(p, s);
  console.log('static page touched:', slug);
}
