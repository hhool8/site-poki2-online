import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Extract Blog Section
blog_match = re.search(r'<!-- Blog -->\n<section>.*?</section>\n', html, re.DOTALL)
if blog_match:
    blog_section = blog_match.group(0)
    html = html.replace(blog_section, '')

# 2. Insert Blog Section before Featured Games
featured_index = html.find('<!-- Featured Games -->')
if featured_index != -1 and blog_match:
    html = html[:featured_index] + blog_section + '\n' + html[featured_index:]

# 3. Create a "Game Reviews" Section to be inserted after Blog (which means right before Featured Games)
reviews_html = """
<!-- Game Reviews (AdSense SEO High Value Content) -->
<section>
  <div class="container">
    <h2 class="section-title">Deep Dive: Editor's Game Reviews</h2>
    <p class="section-sub">Read our comprehensive, hands-on evaluations of the most popular titles. Discover pro tips, advanced strategies, and deep mechanical analysis for your next favorite browser game before you jump in.</p>

    <div class="blog-grid" style="margin-top: 1.5rem;">
      <div class="blog-card" style="gap:0.8rem">
        <span class="blog-card-cat">Puzzle & Strategy</span>
        <h3 class="blog-card-title" style="margin-bottom:0">2048: The Mathematical Masterpiece</h3>
        <p class="blog-card-desc" style="color:#cbd5e1; font-size:0.9rem; line-height:1.6">
          While it appears to be a simple sliding block puzzle, <strong>2048</strong> possesses an incredibly deep mathematical core that demands genuine strategic foresight. The objective is to merge identical numbered tiles—starting from 2s and 4s—until you reach the legendary 2048 tile. Our editors strongly recommend utilizing the "corner strategy": keep your highest-value tile locked in one specific corner (preferably the bottom-right) and only swipe in three directions to prevent smaller tiles from slipping behind your massive numbers. With its elegant interface and addictive progression loop, 2048 remains the quintessential browser game for testing spatial awareness and logic under pressure. No downloads are needed to experience this brain-teaser that will easily consume hours of your time.
        </p>
        <a href="https://azgames.poki2.online/play/2048.html" class="btn btn-secondary" style="align-self:flex-start; padding:0.5rem 1rem; font-size:0.85rem" rel="noopener">Play 2048 Now →</a>
      </div>

      <div class="blog-card" style="gap:0.8rem">
        <span class="blog-card-cat">Action & IO Multiplayer</span>
        <h3 class="blog-card-title" style="margin-bottom:0">1v1.LOL: Ultimate Battle Royale Simulation</h3>
        <p class="blog-card-desc" style="color:#cbd5e1; font-size:0.9rem; line-height:1.6">
          <strong>1v1.LOL</strong> redefines what a browser game can achieve by bringing highly complex third-person shooter mechanics directly to your Chrome or Edge tab without requiring massive installs. This game tightly bundles shooting mechanics with rapid structural building, forcing players to dynamically construct walls, ramps, and platforms to outmaneuver opponents in real-time. What makes 1v1.LOL particularly outstanding is its pure focus on combat mechanics rather than looting; you spawn directly into the action with equal loadouts, meaning every victory is purely skill-based. Whether you are practicing your quick-edits in practice mode or engaging in brutal 1v1 competitive matchmaking, this game provides the most robust architectural combat experience available on the web today.
        </p>
        <a href="https://azgames.poki2.online/play/1v1-lol.html" class="btn btn-secondary" style="align-self:flex-start; padding:0.5rem 1rem; font-size:0.85rem" rel="noopener">Play 1v1.LOL Now →</a>
      </div>

      <div class="blog-card" style="gap:0.8rem">
        <span class="blog-card-cat">Endless Runner & Skill</span>
        <h3 class="blog-card-title" style="margin-bottom:0">Slope: A Test of Pure Reflexes</h3>
        <p class="blog-card-desc" style="color:#cbd5e1; font-size:0.9rem; line-height:1.6">
          Set against a striking neon-green, wireframe cyberpunk cityscape, <strong>Slope</strong> is the ultimate minimalist endless runner. You control a single bowling ball accelerating down a randomized, continuously shifting sci-fi track. The challenge? Gravity constantly increases your speed while the course introduces randomized gaps, moving obstacles, and claustrophobic tunnels. The true brilliance of Slope lies in its flawless physics engine—the momentum feels painfully relentless. Surviving requires predictive steering and absolute focus. Because the track is procedurally generated on every run, rote memorization is impossible; you must rely entirely on twitch reflexes and hand-eye coordination. For players seeking an adrenaline-pumping, fast-paced arcade experience, Slope delivers high-stakes gameplay in the blink of an eye.
        </p>
        <a href="https://azgames.poki2.online/play/slope.html" class="btn btn-secondary" style="align-self:flex-start; padding:0.5rem 1rem; font-size:0.85rem" rel="noopener">Play Slope Now →</a>
      </div>
    </div>
  </div>
</section>

"""
html = html.replace('<!-- Featured Games -->', reviews_html + '<!-- Featured Games -->')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Updated index.html layout and added reviews!")
