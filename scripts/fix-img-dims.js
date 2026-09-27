#!/usr/bin/env node
const fs = require('fs');
const T = (f) => '/Users/hou/Desktop/html5game/site-poki2-online/' + f;

// JS-injected related-card imgs in templates (literal text inside script strings)
const oldJs = '<img src="' + "' + esc(item.image) + '" + '" alt="" loading="lazy">';
const newJs = '<img src="' + "' + esc(item.image) + '" + '" alt="" loading="lazy" width="512" height="512">';
for (const f of ['src/templates/article.html', 'src/templates/base.html', 'src/templates/game.html']) {
  const p = T(f);
  let s = fs.readFileSync(p, 'utf8');
  const n = s.split(oldJs).length - 1;
  if (!n) { console.log('MISS', f); continue; }
  s = s.split(oldJs).join(newJs);
  fs.writeFileSync(p, s);
  console.log('patched', f, '(' + n + ' occurrences)');
}

// static game-frame img
{
  const p = T('src/templates/game.html');
  let s = fs.readFileSync(p, 'utf8');
  const before = '<img src="{{GAME_IMG_URL}}" alt="{{GAME_TITLE_PLAIN}}" loading="eager">';
  const after = '<img src="{{GAME_IMG_URL}}" alt="{{GAME_TITLE_PLAIN}}" loading="eager" width="512" height="512">';
  if (!s.includes(before)) { console.log('MISS game mask'); process.exit(1); }
  s = s.replace(before, after);
  fs.writeFileSync(p, s);
  console.log('patched game.html game-frame img');
}
