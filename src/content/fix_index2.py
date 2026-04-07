import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Let's insert a "Game of the Day" section before "<!-- Game Reviews (AdSense SEO High Value Content) -->"
# which is located right before <!-- Featured Games --> now. Or before the Blog.
# Actually, Game of the Day below Hero would be ideal.
hero_end = '<!-- Stats -->'
if hero_end in html:
    game_of_day = """
<!-- Game of the Day (Embedded Playable Content) -->
<section style="background:var(--bg-card); padding: 3rem 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);">
  <div class="container">
    <h2 class="section-title">Play Now: Quick Session</h2>
    <p class="section-sub">Experience the seamlessness of our network instantly. Play 2048 directly in your browser without leaving this page.</p>
    <div style="max-width: 600px; margin: 2rem auto; border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow); background:#1e293b; border:1px solid var(--border)">
      <iframe src="https://azgames.poki2.online/games/2048/index.html" width="100%" height="600" style="border:none;" title="Play 2048 Embedded Game"></iframe>
    </div>
  </div>
</section>

"""
    html = html.replace(hero_end, game_of_day + hero_end)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Added embedded game to index.html!")
