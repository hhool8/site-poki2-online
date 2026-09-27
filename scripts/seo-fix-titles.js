#!/usr/bin/env node
/**
 * SEO fix pass 1 — Semrush audit findings:
 *  - titles >65 chars (24 pages)  -> rewrite to <=65 incl. brand suffix
 *  - titles <30 chars (4 legal)   -> expand
 *  - descriptions <70 / >160 (12) -> rewrite into 70-160 band
 */
const fs = require('fs');
const path = require('path');
const CONFIG = path.join(__dirname, 'config.js');
let src = fs.readFileSync(CONFIG, 'utf8');

const titleFix = {
  // pages
  'Poki 2 — Free Browser Games Network: 1000+ Games, No Download | Poki2': 'Poki 2 — 1000+ Free Browser Games, No Download | Poki2',
  'About Poki2 — Our Mission, Team & Advertising': 'About Poki2 — Mission, Team & Advertising Policy',
  'Privacy Policy — Poki2': 'Privacy Policy — Data, Cookies & Ads | Poki2',
  'Terms of Use — Poki2': 'Terms of Use — Rules & Disclaimers | Poki2',
  'Contact Us — Poki2': 'Contact Poki2 — Support, Partnerships & Press',
  'DMCA Notice — Poki2': 'DMCA Notice — Copyright Takedown Policy | Poki2',
  // blog posts
  'How to Play Unblocked Games Safely at School or Work': 'How to Play Unblocked Games Safely at School',
  '10 Best Multiplayer Browser Games You Can Play Right Now': '10 Best Multiplayer Browser Games Right Now',
  'Our Top 5 Browser Game Picks for Every Type of Gamer': "Top 5 Browser Game Picks for Every Type of Gamer",
  '10 Best 2-Player Browser Games to Play with a Friend': '10 Best 2-Player Browser Games for a Friend',
  'Best Free Racing Browser Games: Drift Hunters, Moto X3M & More': 'Best Racing Browser Games: Drift Hunters & More',
  '15 Best Free Puzzle Browser Games You Can Play Right Now': '15 Best Free Puzzle Browser Games to Play Now',
  'How to Play Browser Games Without Downloading Anything': 'How to Play Browser Games Without Downloading',
  '12 Unblocked Games That Actually Work at School in 2026': '12 Unblocked Games That Work at School in 2026',
  '8 Best Idle & Clicker Browser Games to Play in 2026': '8 Best Idle & Clicker Browser Games in 2026',
  'Best Browser Games to Play on Your Phone (No App Needed)': 'Best Browser Games for Your Phone (No App Needed)',
  '12 Best Strategy Browser Games in 2026 (Free to Play)': '12 Best Strategy Browser Games in 2026 (Free)',
  'Geometry Dash: Complete Guide to Every Level & Mechanic': 'Geometry Dash: Guide to Every Level & Mechanic',
  'Best Unblocked Games for School Chromebooks in 2026': 'Best Unblocked Games for School Chromebooks 2026',
  'Cookie Clicker Complete Guide: Grandmapocalypse, Prestige & Tips': 'Cookie Clicker Guide: Grandmapocalypse & Prestige',
  "Beginner's Guide to Browser Games: What They Are and Where to Start": "Beginner's Guide to Browser Games: Where to Start",
  'Best Sports Browser Games 2026: Basketball, Tennis, Baseball & More': 'Best Sports Browser Games 2026: Basketball & More',
  'Italian Brainrot Games: The Complete Guide to Every Meme Browser Game': 'Italian Brainrot Games: Guide to Every Meme Game',
  'Best Simulation & Adventure Browser Games 2026: Age of War, Animal Craft & More': 'Best Simulation & Adventure Browser Games 2026',
  'Best 2048 Variant Games to Play in 2026: Drop, Rogue, Italian Brainrot & More': 'Best 2048 Variant Games 2026: Drop, Rogue & More',
  'Best Shooting Browser Games 2026: Blocky Hunter, Shell Shockers, Bricky Break & More': 'Best Shooting Browser Games 2026: Top 10 Picks',
  'Best Racing & Driving Browser Games 2026: Bike Xtreme, Drift Hunters, Truck Driving & More': 'Best Racing & Driving Browser Games 2026',
};

const descFix = {
  'Poki 2 (Poki2) is a free browser games network. Explore 1000+ games across 8 specialized sites — IO, action, puzzle, racing, and more. No downloads, instant play.':
    'Poki 2 (Poki2) is a free browser games network. Explore 1000+ games across 8 specialized sites — IO, action, puzzle, racing, and more. No download needed.',
  'Whether you love puzzles, racing, action, or casual fun — we':
    "Our editors' top 5 browser game picks for every type of gamer — puzzle, racing, idle, multiplayer and more. All free, no download required.",
  'A complete guide to playing unblocked games on school Chromebooks — how game blocking works, how to find safe sites, and 10 games that work on strict school networks.':
    'Playing unblocked games on school Chromebooks, explained — how game blocking works, how to find safe sites, and 10 games that work on strict networks.',
  'Everything you need to know about Cookie Clicker — all buildings explained, the Grandmapocalypse walkthrough, golden cookie combos, and the prestige/ascension system.':
    'Cookie Clicker explained — every building, the Grandmapocalypse walkthrough, golden cookie combos, and how the prestige/ascension system works.',
  '8 two-player browser games with full controls listed — whether you':
    'The complete guide to two-player browser games — 8 top picks with full controls listed, from local same-keyboard duels to online free-for-alls.',
  'New to browser gaming? This complete beginner':
    'New to browser gaming? This complete beginner guide explains what browser games are, how they work, and the best free picks to start with.',
  'The best free sports browser games in 2026 — Basketball Stars, Retro Bowl, Arcade Tennis, Ball Orbit, Bat Smash, Arcade Volley, and Billiards Master. No download required.':
    'The best free sports browser games in 2026 — Basketball Stars, Retro Bowl, Arcade Tennis, Ball Orbit, Bat Smash and more. No download required.',
  'Your complete guide to Italian Brainrot browser games — Bombardino Crocodilo Clicker, Chicken Jockey Clicker, 2048 Italian Brainrot, Chicken Jockey Combat, and more.':
    'Your guide to Italian Brainrot browser games — Bombardino Crocodilo Clicker, Chicken Jockey Clicker, 2048 Italian Brainrot and more, all free to play.',
  'Top free simulation and adventure browser games in 2026 — Age of War, Animal Craft, Crazy Animal City, Astro Tycoon, Astro Robot Clicker, American Truck Driving, and more.':
    'Top free simulation and adventure browser games in 2026 — Age of War, Animal Craft, Crazy Animal City, Astro Tycoon, truck driving and more.',
  'Beyond the original, 2048 has spawned brilliant variants — 2048 Drop, 2048 Rogue, and 2048 Italian Brainrot. This guide covers every variant and the strategy that wins each one.':
    'Beyond the original 2048: Drop, Rogue and Italian Brainrot. This guide covers every 2048 variant and the winning strategy for each one.',
  'Top free shooting browser games in 2026 — Blocky Hunter, Chicken Jockey Combat, Bricky Break, Shell Shockers, 1v1.LOL, and more. No download, no install, just play.':
    'Top free shooting browser games in 2026 — Blocky Hunter, Chicken Jockey Combat, Shell Shockers, 1v1.LOL and more. No download, just play.',
  'Top free racing and driving browser games in 2026 — Bike Xtreme, Drift Hunters, American Truck Driving, Blocky Rider, Battle Karts, and more. Zero downloads required.':
    'Top free racing and driving browser games in 2026 — Bike Xtreme, Drift Hunters, American Truck Driving, Battle Karts and more. Zero downloads.',
};

let tCount = 0, dCount = 0;
for (const [oldT, newT] of Object.entries(titleFix)) {
  const needle = `title:      '${oldT.replace(/'/g, "\\'")}'`;
  if (!src.includes(needle)) { console.log('  [miss title]', oldT.slice(0, 50)); continue; }
  src = src.replace(needle, `title:      '${newT.replace(/'/g, "\\'")}'`);
  tCount++;
}
for (const [oldD, newD] of Object.entries(descFix)) {
  const needle = `description:'${oldD.replace(/'/g, "\\'")}'`;
  if (!src.includes(needle)) { console.log('  [miss desc]', oldD.slice(0, 50)); continue; }
  src = src.replace(needle, `description:'${newD.replace(/'/g, "\\'")}'`);
  dCount++;
}
fs.writeFileSync(CONFIG, src);
console.log(`patched ${tCount} titles, ${dCount} descriptions`);
