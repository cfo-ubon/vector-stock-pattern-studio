// UI/UX Audit — Workflow E: offline cold start -> production -> preview -> export -> download.
// Uses the real production build (/studio) served statically, since the
// service worker (offline capability) is only active in the built PWA,
// not the Vite dev server.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
const { chromium } = pkg;

const URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/';
const OUT_DIR = '/tmp/claude-0/-home-user-vector-stock-pattern-studio/89000801-5ee0-574e-8681-79d83ff64216/scratchpad/audit_screens/workflowE';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function dump(page, label) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT_DIR}/${label}.png`, fullPage: true });
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message}`));

  // Phase 1: online first visit, let the service worker install & precache.
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const swState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'no-sw-api';
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? (reg.active ? 'active' : 'registered-not-active') : 'not-registered';
  });
  console.log('=== SERVICE WORKER STATE (online, first visit) ===', swState);
  await page.waitForTimeout(3000); // give it more time to finish precaching
  const swState2 = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? (reg.active ? 'active' : 'registered-not-active') : 'not-registered';
  });
  console.log('=== SERVICE WORKER STATE (after wait) ===', swState2);

  // Phase 2: reload once more online to ensure SW is controlling the page.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Phase 3: go offline.
  await context.setOffline(true);
  console.log('=== NOW OFFLINE ===');

  // Cold start: reload the page while offline.
  try {
    await page.reload({ waitUntil: 'load', timeout: 15000 });
  } catch (e) {
    console.log('=== RELOAD WHILE OFFLINE ERROR ===', String(e));
  }
  await page.waitForTimeout(2000);
  await dump(page, '01_offline_cold_start');
  const bodyText1 = await page.locator('body').innerText().catch(() => '<no body text>');
  console.log('=== BODY AFTER OFFLINE RELOAD (first 500 chars) ===', bodyText1.slice(0, 500));

  // Attempt the golden path offline: Start Factory -> Generate -> Export.
  const prodBtn = page.getByRole('button', { name: "🏭 Today's Production", exact: true });
  if (await prodBtn.count()) {
    await prodBtn.click();
    await page.waitForTimeout(1000);
    await dump(page, '02_offline_todays_production');
    const startBtn = page.getByRole('button', { name: '▶ START FACTORY', exact: true });
    if (await startBtn.count()) {
      await startBtn.click();
      await page.waitForTimeout(800);
      const approveBtn = page.getByRole('button', { name: "Approve today's production session", exact: true });
      if (await approveBtn.count()) await approveBtn.click();
      await page.waitForTimeout(800);
      const genNowBtn = page.getByRole('button', { name: '✨ Generate Now', exact: true });
      if (await genNowBtn.count()) {
        await genNowBtn.click();
        console.log('--- waiting for offline generation ---');
        await page.waitForTimeout(25000);
        await dump(page, '03_offline_after_generate');
      }
    }
  } else {
    console.log('=== Today\'s Production nav button not found offline — app shell may not have loaded ===');
  }

  const bodyText2 = await page.locator('body').innerText().catch(() => '<no body text>');
  console.log('=== BODY AFTER OFFLINE PRODUCTION ATTEMPT (first 800 chars) ===', bodyText2.slice(0, 800));

  console.log('=== CONSOLE ERRORS (offline phase) ===', JSON.stringify(consoleErrors, null, 2));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
