# TODO — Poki2 Portal

## 1. Wire 18 orphan game content fragments into `config.gamePosts`

These HTML body fragments exist in `src/content/fgame/` but are NOT registered
in `scripts/config.js` → they never get built, never appear on the site, never
emit JSON-LD. Wires would grow the live game count from **50 → 68**.

For each slug below, decide:
- Should it be published (if yes) → add a config entry + image
- Should it be removed (if no) → delete the orphan HTML

| # | Slug | Genre hint | Notes |
|---|------|-----------|-------|
| 1 | `1v1lol` | shooter | known popular; high priority |
| 2 | `bonk-io` | io | popular IO title |
| 3 | `breakout` | arcade | classic — strong SEO potential |
| 4 | `card-battle-arena` | card | original title — needs embedUrl |
| 5 | `city-builder-sim` | simulation | original — needs embedUrl |
| 6 | `crossy-road` | arcade | popular; needs legit embedUrl |
| 7 | `fishing-frenzy` | arcade | original — needs embedUrl |
| 8 | `mahjong-classic` | puzzle | classic — strong SEO potential |
| 9 | `match3-gems` | puzzle | original — needs embedUrl |
| 10 | `minesweeper` | puzzle | classic — strong SEO potential |
| 11 | `pong` | arcade | classic — strong SEO potential |
| 12 | `puzzle-platformer-quest` | puzzle | original — needs embedUrl |
| 13 | `rhythm-run` | arcade | original — needs embedUrl |
| 14 | `rooftop-snipers` | shooter | popular — needs legit embedUrl |
| 15 | `snake-classic` | arcade | classic — strong SEO potential |
| 16 | `solitaire-klondike` | card | classic — strong SEO potential |
| 17 | `space-shooter` | shooter | original — needs embedUrl |
| 18 | `tower-defense-classic` | strategy | classic — strong SEO potential |

### Per-slug required config fields
```js
{
  slug:        '...',
  title:       '...',
  description: '...',  // ≤ 155 chars
  imgUrl:      '/imgs/fgame/<slug>.jpg',   // needs to exist or be generated
  embedUrl:    'https://...',             // iframe source
  genre:       'Puzzle|Shooter|Arcade|...',
  players:     '1 Player',
  controls:    'Mouse|Keyboard|...',
  isoDate:     'YYYY-MM-DD',
  date:        'Month DD, YYYY',
}
```

### Suggested execution
1. For **classic/SEO-friendly** titles (3, 8, 10, 11, 14, 15, 16, 18): high priority
   — they target high-volume search keywords.
2. For **original** titles (4, 5, 7, 9, 12, 13, 17) and titles where it's unclear
   whether a legit embed source exists (1, 2, 6): need human decision on embedUrl
   before proceeding.
3. After config entries added → run `npm run build` → audit JSON-LD on each new page.
