// One-off: trim 7 blog titles from 61-62 chars to <=60 (entity-decoded).
// Build appends " — Poki2 Blog" (13 chars) to blogPost titles.
const fs = require('fs');
const cfg = 'scripts/config.js';
let s = fs.readFileSync(cfg, 'utf8');

const pairs = [
  ['Best Unblocked Games for School Chromebooks 2026', 'Top Unblocked Games for School Chromebooks 2026'],   // 47+13=60
  ['Italian Brainrot Games: Guide to Every Meme Game', 'Italian Brainrot Games: Guide to All Meme Games'], // 47+13=60
  ['Best 2048 Variant Games 2026: Drop, Rogue & More', 'Best 2048 Variant Games: Drop, Rogue & More'],      // 43+13=56
  ['Top 5 Browser Game Picks for Every Type of Gamer', 'Top 5 Browser Game Picks for Every Gamer'],         // 40+13=53
  ['Best Browser Games for Your Phone (No App Needed)', 'Best Mobile Browser Games (No App Needed)'],       // 41+13=54
  ['Best Two-Player Browser Games: The Complete Guide', 'Best Two-Player Browser Games: Complete Guide'],   // 45+13=58
  ["Beginner\\'s Guide to Browser Games: Where to Start", "Beginner\\'s Guide to Browser Games: Start Here"], // 45+13=58
];

let n = 0;
for (const [from, to] of pairs) {
  // title:      '...'  (flexible spacing)
  const re = new RegExp("(title:\\s*)'" + from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "(')");
  if (!re.test(s)) { console.log('MISS:', from); continue; }
  s = s.replace(re, "$1'" + to + "$2");
  n++;
}
fs.writeFileSync(cfg, s);
console.log('patched', n, 'titles');
