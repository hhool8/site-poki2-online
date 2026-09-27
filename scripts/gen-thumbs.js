#!/usr/bin/env node
/**
 * Generate original JPEG thumbnails (512x512) for the 6 self-hosted games.
 * Overwrites the empty placeholder files in public/imgs/fgame/.
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const DEST = path.join(__dirname, '../public/imgs/fgame');

const svgs = {
  'minesweeper': `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="#263349"/>
      ${[0,1,2,3,4,5].map(r=>[0,1,2,3,4,5].map(c=>{
        const x=28+c*80,y=28+r*80;
        const open=(r+c)%3===0, mine=r===2&&c===3, flag=r===4&&c===1;
        if(mine) return `<rect x="${x}" y="${y}" width="72" height="72" rx="8" fill="#c0392b"/><circle cx="${x+36}" cy="${y+36}" r="16" fill="#1a1a1a"/><rect x="${x+33}" y="${y+10}" width="6" height="52" fill="#1a1a1a"/>`;
        if(flag) return `<rect x="${x}" y="${y}" width="72" height="72" rx="8" fill="#3a4a66"/><path d="M${x+30} ${y+12} l28 10 -28 10 z" fill="#ff5d5d"/><rect x="${x+28}" y="${y+12}" width="5" height="46" fill="#fff"/>`;
        if(open) return `<rect x="${x}" y="${y}" width="72" height="72" rx="8" fill="#1b2431"/><text x="${x+36}" y="${y+52}" font-size="44" font-weight="800" text-anchor="middle" fill="#7dff9b" font-family="sans-serif">2</text>`;
        return `<rect x="${x}" y="${y}" width="72" height="72" rx="8" fill="#3a4a66"/>`;
      }).join('')).join('')}
    </svg>`,
  'solitaire-klondike': `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="#0b6e4f"/>
      ${[[190,80],[220,140],[250,200],[280,260]].map((p,i)=>`
        <rect x="${p[0]}" y="${p[1]}" width="160" height="224" rx="16" fill="#fff" stroke="#d0d0d0" stroke-width="3"/>
        <text x="${p[0]+28}" y="${p[1]+46}" font-size="38" font-weight="800" fill="#d32f2f" font-family="sans-serif">A</text>
        <text x="${p[0]+80}" y="${p[1]+150}" font-size="80" text-anchor="middle" fill="#d32f2f" font-family="sans-serif">${['♥','♦','♥','♦'][i]}</text>`).join('')}
      <rect x="42" y="200" width="160" height="224" rx="16" fill="#3281ff" stroke="#fff" stroke-width="5"/>
      <text x="122" y="360" font-size="90" text-anchor="middle" fill="#ffffff88" font-family="sans-serif">♠</text>
    </svg>`,
  'pong': `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="#111"/>
      <line x1="256" y1="16" x2="256" y2="496" stroke="#333" stroke-width="6" stroke-dasharray="18 22"/>
      <text x="128" y="110" font-size="72" font-weight="800" text-anchor="middle" fill="#fff" font-family="sans-serif">3</text>
      <text x="384" y="110" font-size="72" font-weight="800" text-anchor="middle" fill="#fff" font-family="sans-serif">5</text>
      <rect x="48" y="196" width="22" height="120" fill="#fff"/>
      <rect x="442" y="140" width="22" height="120" fill="#fff"/>
      <circle cx="330" cy="330" r="17" fill="#fff"/>
    </svg>`,
  'breakout': `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="#181826"/>
      ${['#ff5d5d','#ff9b4d','#ffd479','#7dff9b','#7ec8ff'].map((col,r)=>
        [0,1,2,3,4,5,6].map(c=>`<rect x="${30+c*66}" y="${56+r*54}" width="58" height="44" rx="6" fill="${col}"/>`).join('')
      ).join('')}
      <rect x="196" y="430" width="120" height="24" rx="10" fill="#e8e8f4"/>
      <circle cx="240" cy="395" r="13" fill="#e8e8f4"/>
    </svg>`,
  'snake-classic': `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="#152015"/>
      ${[0,1,2,3,4,5,6,7].map(r=>[0,1,2,3,4,5,6,7].map(c=>{
        if((r+c)%2===0) return `<rect x="${c*64}" y="${r*64}" width="64" height="64" fill="#1c2b1c"/>`;
        return '';}).join('')).join('')}
      ${[[3,2],[4,2],[5,2],[5,3],[5,4],[4,4]].map((p,i)=>`
        <rect x="${p[0]*64+6}" y="${p[1]*64+6}" width="52" height="52" rx="10" fill="${i===0?'#7dff9b':'#6ecf82'}"/>`).join('')}
      <circle cx="160" cy="160" r="24" fill="#ff5d5d"/>
      <circle cx="152" cy="154" r="5" fill="#fff"/>
      <circle cx="168" cy="154" r="5" fill="#fff"/>
    </svg>`,
  'tower-defense-classic': `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="#243447"/>
      <path d="M-20 300 H180 V120 H340 V400 H540" stroke="#5a4a3a" stroke-width="88" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="100" cy="140" r="38" fill="#7dff9b"/><circle cx="100" cy="140" r="16" fill="#243447"/>
      <circle cx="420" cy="120" r="38" fill="#ffd479"/><circle cx="420" cy="120" r="16" fill="#243447"/>
      <circle cx="260" cy="440" r="38" fill="#7ec8ff"/><circle cx="260" cy="440" r="16" fill="#243447"/>
      <circle cx="230" cy="300" r="30" fill="#ff5d5d"/>
      <circle cx="300" cy="255" r="30" fill="#ff9b4d"/>
      <rect x="205" y="262" width="50" height="8" fill="#00000088" rx="4"/>
      <rect x="205" y="262" width="30" height="8" fill="#7dff9b" rx="4"/>
      <rect x="275" y="217" width="50" height="8" fill="#00000088" rx="4"/>
      <rect x="275" y="217" width="18" height="8" fill="#7dff9b" rx="4"/>
    </svg>`
};

(async () => {
  for (const [slug, svg] of Object.entries(svgs)) {
    const out = path.join(DEST, slug + '.jpeg');
    await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(out);
    const kb = Math.round(fs.statSync(out).size / 1024);
    console.log(`  ✓ ${slug}.jpeg (${kb} KB)`);
  }
})();
