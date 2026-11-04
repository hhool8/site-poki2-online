#!/usr/bin/env node
/**
 * Deploy dist/ to Cloudflare Pages, then purge the edge cache and announce to
 * IndexNow -- the full publish chain, in one command.
 *
 * WHY THE ACCOUNT ID IS NOT IN package.json
 * The Cloudflare account id used to be hardcoded in the `deploy` npm script:
 *
 *     "deploy": "CLOUDFLARE_ACCOUNT_ID=b403... wrangler pages deploy ..."
 *
 * That id identifies a personal Cloudflare account. It is not a secret in the
 * cryptographic sense -- it is a public identifier, it appears in every API
 * request -- but committing it does two things nobody wants:
 *
 *   1. It binds the repository to one person's account. Anyone who clones the
 *      repo learns which account hosts the site, and any fork inherits a
 *      deploy target that is not theirs.
 *   2. It is one more place a personal identifier lives in git history, where
 *      deleting the line does not delete the line.
 *
 * So the id moved out of the repo and into the same convention already used
 * for the API token: an environment variable first, a 0600 file outside the
 * repository second. Nothing personal is committed, and `npm run deploy`
 * still works with no export.
 *
 * USAGE
 *   node scripts/deploy.js
 *   node scripts/deploy.js --dry-run    # resolve credentials, print the plan, deploy nothing
 *   CLOUDFLARE_ACCOUNT_ID=<id> node scripts/deploy.js
 *
 * The account id is read from, in order:
 *   1. $CLOUDFLARE_ACCOUNT_ID
 *   2. ~/.poki2-cf-account   (override the path with $CF_ACCOUNT_FILE)
 *
 * The zone id (needed for the cache purge) is read the same way:
 *   1. $CF_ZONE_ID
 *   2. ~/.poki2-cf-zone      (override the path with $CF_ZONE_FILE)
 *
 * The API token is read by scripts/purge-cache.js:
 *   1. $CF_API_TOKEN
 *   2. ~/.poki2-cf-token     (override the path with $CF_TOKEN_FILE)
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const PROJECT = 'poki2-portal';
const BRANCH = 'main';

const ACCOUNT_FILE = process.env.CF_ACCOUNT_FILE || path.join(os.homedir(), '.poki2-cf-account');
const ZONE_FILE = process.env.CF_ZONE_FILE || path.join(os.homedir(), '.poki2-cf-zone');

/** Read a secret-ish value from the environment, then from a local file. */
function resolveValue(envName, file, label) {
  const fromEnv = (process.env[envName] || '').trim();
  if (fromEnv) return { value: fromEnv, source: envName };

  try {
    const fromFile = fs.readFileSync(file, 'utf8').trim();
    if (fromFile) return { value: fromFile, source: file };
  } catch {
    /* not present */
  }

  console.error(`[deploy] Missing ${label}.`);
  console.error(`[deploy] Set ${envName} or create ${file} containing the value.`);
  return { value: null, source: null };
}

function wranglerBinary() {
  const local = path.join(ROOT, 'node_modules', '.bin', 'wrangler');
  return fs.existsSync(local) ? local : 'npx';
}

function run(command, args, env) {
  console.log(`[deploy] ${path.basename(command)} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  return result.status === 0;
}

function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!dryRun && !fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
    console.error('[deploy] dist/ is missing or empty. Run `npm run build` first.');
    return 1;
  }

  const account = resolveValue('CLOUDFLARE_ACCOUNT_ID', ACCOUNT_FILE, 'Cloudflare account id');
  if (!account.value) return 1;

  const zone = resolveValue('CF_ZONE_ID', ZONE_FILE, 'Cloudflare zone id');
  if (!zone.value) return 1;

  const env = {
    CLOUDFLARE_ACCOUNT_ID: account.value,
    CF_ZONE_ID: zone.value,
  };
  console.log(`[deploy] account from ${account.source}, zone from ${zone.source}`);

  const steps = [
    // --branch main is safe here: the Cloudflare Pages project's
    // production_branch was verified as "main" via the Projects API on
    // 2026-11-04. A deployment to the production branch is a production
    // deployment. If that ever changes, this flag would silently turn
    // deploys into previews -- so it is stated here rather than implied.
    [wranglerBinary(), ['pages', 'deploy', 'dist', '--project-name', PROJECT, '--branch', BRANCH, '--commit-dirty=true']],
    [process.execPath, [path.join(ROOT, 'scripts', 'purge-cache.js')]],
    [process.execPath, [path.join(ROOT, 'scripts', 'indexnow.js')]],
  ];

  if (dryRun) {
    console.log('[deploy] --dry-run: nothing will be executed. Planned steps:');
    for (const [cmd, args] of steps) console.log(`[deploy]   ${path.basename(cmd)} ${args.join(' ')}`);
    return 0;
  }

  const ok = run(steps[0][0], steps[0][1], env);
  if (!ok) {
    console.error('[deploy] Cloudflare Pages deploy FAILED. Nothing else was run.');
    return 1;
  }

  // The deploy succeeded. Cache purge and IndexNow are follow-ups: a failure
  // in either is a stale-cache window or a delayed announcement, not a broken
  // site, so they warn rather than abort.
  console.log('[deploy] Deployed. Purging edge cache...');
  const purged = run(steps[1][0], steps[1][1], env);
  if (!purged) {
    console.warn('[deploy] Cache purge failed. The site is live; the edge may serve');
    console.warn('[deploy] the previous build for up to an hour. Purge from the dashboard.');
  }

  console.log('[deploy] Announcing to IndexNow...');
  const announced = run(steps[2][0], steps[2][1], env);
  if (!announced) {
    console.warn('[deploy] IndexNow announcement failed. URLs are still discoverable');
    console.warn('[deploy] via the sitemap; this only delays the ping.');
  }

  console.log('[deploy] Done.');
  return 0;
}

process.exit(main());
