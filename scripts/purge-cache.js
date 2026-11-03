#!/usr/bin/env node
/**
 * Purge the Cloudflare edge cache for poki2.online after a Pages deploy.
 *
 * WHY THIS EXISTS
 * Cloudflare Pages classifies text/html as dynamic and ignores the s-maxage in
 * our `_headers` file until a zone-level Cache Rule authorises the edge to
 * honour it. Once that rule is live, HTML is served from the edge for up to
 * s-maxage (3600s) plus stale-while-revalidate (86400s) -- which means a fresh
 * `wrangler pages deploy` can keep serving the previous build for a hour.
 * That looks exactly like "my change did not publish". Purging on deploy is the
 * step that closes it.
 *
 * purge_everything instead of a URL list on purpose: the site mixes canonical
 * forms (/blog/hub/ with a slash, /blog/post without one), and a curated list
 * that misses one form leaves that page stale. Whole-zone purge is one call and
 * cannot miss. Static assets are content-hashed and re-warm cheaply, because
 * Pages keeps its own per-datacenter copy of uploaded assets for a week.
 *
 * USAGE
 *   CF_API_TOKEN=<token with Zone.Cache Purge> node scripts/purge-cache.js
 *   CF_ZONE_ID=<zone> CF_API_TOKEN=... node scripts/purge-cache.js
 *
 * A missing token is a warning, not a failure: the deploy already succeeded and
 * a stale-cache window is a lesser problem than a red build. An API error is a
 * failure, because silently leaving 1-hour-old HTML in place is the exact bug
 * this script exists to prevent.
 */

const ZONE_ID = process.env.CF_ZONE_ID || '$CF_ZONE_ID';
const TOKEN = process.env.CF_API_TOKEN;
const API = 'https://api.cloudflare.com/client/v4';

async function main() {
  if (!TOKEN) {
    console.warn('[purge] CF_API_TOKEN is not set - skipping cache purge.');
    console.warn('[purge] Deploy succeeded, but cached HTML will keep serving the');
    console.warn('[purge] previous build for up to s-maxage (3600s) if an edge');
    console.warn('[purge] Cache Rule is active on this zone.');
    return 0;
  }

  const res = await fetch(`${API}/zones/${ZONE_ID}/purge_cache`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ purge_everything: true }),
  });

  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok || !body || body.success !== true) {
    const detail = body && body.errors && body.errors.length
      ? body.errors.map((e) => `${e.code} ${e.message}`).join('; ')
      : `HTTP ${res.status}`;
    console.error(`[purge] FAILED: ${detail}`);
    console.error('[purge] The deploy itself succeeded - the site is live with the');
    console.error('[purge] new build. Only the cache invalidation failed. Purge');
    console.error('[purge] manually: dashboard > Caching > Configuration > Purge.');
    console.error('[purge] The token needs the "Cache Purge" permission on this zone.');
    return 1;
  }

  console.log(`[purge] Cache purged (zone ${ZONE_ID}).`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`[purge] Unexpected error: ${err.message}`);
    process.exit(1);
  });
