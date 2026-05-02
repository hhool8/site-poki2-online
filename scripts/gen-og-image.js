'use strict';
/**
 * Generates public/og-image.png (1200×630)
 *
 * Layout:
 *  - Dark gradient background (#0b0b18 → #1a1a2e)
 *  - P2 logo SVG rendered at 120×120, centred vertically left side (x=80)
 *  - Site name "Poki2" large text (right of logo)
 *  - Tagline below site name
 *  - Subtle cyan/purple gradient accent bar at bottom
 */

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const OUT = path.join(__dirname, '..', 'public', 'og-image.png');
const W = 1200, H = 630;

// ── SVG composition ──────────────────────────────────────────────────────────
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0b18"/>
      <stop offset="100%" stop-color="#1a1a2e"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#22d3ee"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22d3ee"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- Subtle grid lines -->
  <g stroke="#22d3ee" stroke-opacity="0.04" stroke-width="1">
    <line x1="0" y1="105" x2="${W}" y2="105"/>
    <line x1="0" y1="210" x2="${W}" y2="210"/>
    <line x1="0" y1="315" x2="${W}" y2="315"/>
    <line x1="0" y1="420" x2="${W}" y2="420"/>
    <line x1="0" y1="525" x2="${W}" y2="525"/>
    <line x1="200"  y1="0" x2="200"  y2="${H}"/>
    <line x1="400"  y1="0" x2="400"  y2="${H}"/>
    <line x1="600"  y1="0" x2="600"  y2="${H}"/>
    <line x1="800"  y1="0" x2="800"  y2="${H}"/>
    <line x1="1000" y1="0" x2="1000" y2="${H}"/>
  </g>

  <!-- P2 Logo (64×64 design scaled to 140×140, centred at x=80, y=315) -->
  <g transform="translate(60, 245) scale(2.1875)">
    <circle cx="32" cy="32" r="32" fill="url(#bg)"/>
    <circle cx="32" cy="32" r="28" fill="none" stroke="url(#glow)" stroke-width="3"/>
    <text x="32" y="41"
          font-family="Arial Black, Arial, sans-serif"
          font-weight="900"
          font-size="26"
          fill="url(#glow)"
          text-anchor="middle"
          letter-spacing="-1">P2</text>
  </g>

  <!-- Site name -->
  <text x="290" y="295"
        font-family="Arial Black, Arial, sans-serif"
        font-weight="900"
        font-size="120"
        fill="white"
        opacity="0.95"
        letter-spacing="-4">Poki2</text>

  <!-- Tagline -->
  <text x="292" y="370"
        font-family="Arial, sans-serif"
        font-weight="400"
        font-size="36"
        fill="#94a3b8"
        letter-spacing="0.5">The Ultimate Free Browser Games Network</text>

  <!-- Sub-label -->
  <text x="292" y="430"
        font-family="Arial, sans-serif"
        font-size="26"
        fill="#22d3ee"
        opacity="0.8">play.poki2.online · azgames.poki2.online · ubg66.poki2.online</text>

  <!-- Bottom accent bar -->
  <rect x="0" y="${H - 8}" width="${W}" height="8" fill="url(#bar)"/>
</svg>`;

sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(OUT)
  .then(info => console.log(`✓ og-image.png written (${info.width}×${info.height}, ${(fs.statSync(OUT).size / 1024).toFixed(1)}KB)`))
  .catch(err => { console.error('✗ gen-og-image failed:', err.message); process.exit(1); });
