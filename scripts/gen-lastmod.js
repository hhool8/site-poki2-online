// Generates data/lastmod.json — a committed map of source file -> last git
// commit date (YYYY-MM-DD), used by build.js for sitemap <lastmod>.
//
// Why a committed map instead of live `git log` at build time:
// Cloudflare Pages builds from a shallow clone, so `git log -- <file>`
// returns nothing for files not touched by the newest commit and the sitemap
// falls back to the build date. That made lastmod jump to "today" on every
// deploy for unchanged pages (homepage, legal pages, blog index), which
// erodes Google's trust in the signal.
//
// Rules:
//   - git date available  -> use it
//   - git date unavailable -> keep the value already committed in the map
//   - no git, no existing value -> fall back to today
// The file is only rewritten when something actually changes, so it stays
// stable across builds.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC_CONTENT = path.join(ROOT, 'src', 'content');
const MAP_FILE = path.join(ROOT, 'data', 'lastmod.json');

function today() {
  return new Date().toISOString().split('T')[0];
}

function gitDate(relPath) {
  try {
    const out = execSync(
      `git log -1 --format=%ad --date=short -- ${JSON.stringify(relPath)}`,
      { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
  } catch {
    return null;
  }
}

function walkHtml(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkHtml(p, out);
    else if (entry.endsWith('.html')) out.push(p);
  }
  return out;
}

let existing = {};
if (fs.existsSync(MAP_FILE)) {
  try { existing = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8')); } catch { existing = {}; }
}

const next = {};
let fromGit = 0, kept = 0, fallback = 0;
for (const abs of walkHtml(SRC_CONTENT)) {
  const rel = path.relative(ROOT, abs).split(path.sep).join('/');
  const g = gitDate(rel);
  if (g) { next[rel] = g; fromGit++; }
  else if (existing[rel]) { next[rel] = existing[rel]; kept++; }
  else { next[rel] = today(); fallback++; }
}

const sorted = {};
for (const k of Object.keys(next).sort()) sorted[k] = next[k];
const serialized = JSON.stringify(sorted, null, 2) + '\n';
const changed = !fs.existsSync(MAP_FILE) || fs.readFileSync(MAP_FILE, 'utf8') !== serialized;
if (changed) {
  fs.mkdirSync(path.dirname(MAP_FILE), { recursive: true });
  fs.writeFileSync(MAP_FILE, serialized, 'utf8');
}
console.log(`lastmod map: ${Object.keys(sorted).length} files (git ${fromGit}, kept ${kept}, fallback ${fallback})${changed ? ' — updated' : ' — unchanged'}`);
