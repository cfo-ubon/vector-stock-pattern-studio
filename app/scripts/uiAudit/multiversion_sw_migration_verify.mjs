// AI-SBOS Multi-Version Release, Part 12 — the hardest real scenario:
// a returning visitor whose browser already has the OLD, pre-multi-version
// root-scoped service worker installed (it used to serve the whole v2 app
// directly from /studio/). Verifies the new kill-switch sw.js retires it
// cleanly and the visitor lands on a working Selector with v1/v2 both
// reachable — no stale shell, no redirect loop.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = pkg;

const STUDIO_DIR = '/home/user/vector-stock-pattern-studio/studio';
const OLD_BACKUP = '/tmp/claude-0/-home-user-vector-stock-pattern-studio/89000801-5ee0-574e-8681-79d83ff64216/scratchpad/studio_old/studio';
const NEW_BACKUP = '/tmp/claude-0/-home-user-vector-stock-pattern-studio/89000801-5ee0-574e-8681-79d83ff64216/scratchpad/studio_new_backup';
const URL_ROOT = 'http://localhost:8899/vector-stock-pattern-studio/studio/';

function swapTo(sourceDir) {
  fs.rmSync(STUDIO_DIR, { recursive: true, force: true });
  fs.cpSync(sourceDir, STUDIO_DIR, { recursive: true });
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

  console.log('--- Step 1: serve the OLD (pre-multi-version) build, install its root SW ---');
  swapTo(OLD_BACKUP);
  await page.goto(URL_ROOT, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const oldSwState = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return { state: reg?.active?.state ?? 'none', scope: reg?.scope ?? 'none' };
  });
  console.log('=== OLD root SW installed and activated ===', oldSwState.state === 'activated', JSON.stringify(oldSwState));
  const oldBody = await page.evaluate(() => document.body.innerText);
  console.log('=== OLD build served the pre-multiversion app at /studio/ ===', oldBody.includes('Vector Stock Pattern Studio') || oldBody.includes('AI-SBOS'));

  console.log('--- Step 2: swap disk content to the NEW multi-version structure (Selector + v1 + v2), same URL/port ---');
  swapTo(NEW_BACKUP);

  console.log('--- Step 3: same browser context reloads the Selector URL ---');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const afterSwapBody1 = await page.evaluate(() => document.body.innerText);
  console.log('=== First reload after swap shows Selector content (or is mid-transition) ===', JSON.stringify(afterSwapBody1.slice(0, 80)));

  // The browser's SW update check + activate cycle can take one more
  // navigation to fully take effect (this is real, standard SW update
  // timing, not a test artifact) — reload once more to observe the
  // settled state, matching how a real returning user's next visit would
  // look.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const settledBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Settled: Selector shows AI-SBOS + Choose Version ===', settledBody.includes('AI-SBOS') && settledBody.includes('Choose Version'));

  const newSwState = await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.map((r) => ({ scope: r.scope, state: r.active?.state ?? 'none' }));
  });
  console.log('=== Registrations after migration (should be exactly one, scope ending in /studio/) ===', JSON.stringify(newSwState));

  console.log('--- Step 4: v1 and v2 both reachable from the migrated Selector, no stale shell ---');
  await page.getByRole('link', { name: 'Open v1' }).click();
  await page.waitForURL('**/studio/v1/**', { timeout: 15000 });
  await page.waitForTimeout(1000);
  const v1Body = await page.evaluate(() => document.body.innerText);
  console.log('=== v1 reachable post-migration, correct identity ===', /AI-SBOS v1\.5\.0/.test(v1Body));

  await page.goto(URL_ROOT, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.getByRole('link', { name: 'Open v2' }).click();
  await page.waitForURL('**/studio/v2/**', { timeout: 15000 });
  await page.waitForTimeout(1000);
  const v2Body = await page.evaluate(() => document.body.innerText);
  console.log('=== v2 reachable post-migration, correct identity ===', /AI-SBOS v2\.0\.0/.test(v2Body));

  console.log('=== CONSOLE ERRORS (whole migration run) ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
