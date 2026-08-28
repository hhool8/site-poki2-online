'use strict';

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { gamePosts } = require('./config.js');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(PUBLIC, 'social');
const WIDTH = 1200;
const HEIGHT = 630;

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function renderGameCard(game) {
  const imagePath = path.join(PUBLIC, game.imgUrl.replace(/^\/+/, ''));
  const gameIcon = await sharp(imagePath)
    .resize(430, 430, { fit: 'cover' })
    .png()
    .toBuffer();
  const logo = await sharp(fs.readFileSync(path.join(PUBLIC, 'favicon.svg')))
    .resize(92, 92)
    .png()
    .toBuffer();
  const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0b0b18"/>
        <stop offset="100%" stop-color="#1a1a2e"/>
      </linearGradient>
      <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#22d3ee"/>
        <stop offset="100%" stop-color="#a855f7"/>
      </linearGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
    <rect x="50" y="100" width="430" height="430" rx="28" fill="#111827" stroke="#334155" stroke-width="3"/>
    <text x="550" y="245" font-family="Arial Black, Arial, sans-serif" font-size="62" font-weight="900" fill="#fff">${esc(game.title)}</text>
    <text x="550" y="320" font-family="Arial, sans-serif" font-size="32" fill="#94a3b8">Play free online on Poki2</text>
    <text x="550" y="390" font-family="Arial, sans-serif" font-size="28" fill="#22d3ee">poki2.online/fgame/${esc(game.slug)}</text>
    <rect y="${HEIGHT - 8}" width="${WIDTH}" height="8" fill="url(#bar)"/>
  </svg>`);

  await sharp(background)
    .composite([
      { input: gameIcon, left: 50, top: 100 },
      { input: logo, left: 550, top: 105 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, `${game.slug}.png`));
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const game of gamePosts.filter((item) => !item.deprecated)) {
    await renderGameCard(game);
  }
  console.log(`  ✓ generated ${gamePosts.filter((item) => !item.deprecated).length} game social images`);
}

main().catch((error) => {
  console.error('✗ gen-game-og-images failed:', error.message);
  process.exit(1);
});
