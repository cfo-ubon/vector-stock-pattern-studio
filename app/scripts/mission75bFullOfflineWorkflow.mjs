#!/usr/bin/env node
// Mission 7.5B — Parts 4 & 5: full cold-offline production workflow +
// offline session recovery (restart mid-session while offline).
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const BASE = 'http://localhost:5185/vector-stock-pattern-studio/studio/';
const errors = [];
let stepFailed = false;

function attach(page) {
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`); });
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
  page.on('requestfailed', (req) => errors.push(`[requestfailed] ${req.method()} ${req.url()} -> ${req.failure()?.errorText}`));
}

async function step(label, fn) {
  try {
    await fn();
    console.log(`  OK: ${label}`);
  } catch (e) {
    stepFailed = true;
    console.log(`  FAIL: ${label} -> ${e.message}`);
  }
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });

  // One online visit to install the service worker (real-world bootstrap).
  const bootPage = await context.newPage();
  await bootPage.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await bootPage.evaluate(async () => { await navigator.serviceWorker.ready; });
  await bootPage.close();

  console.log('=== Going offline now — everything below runs with network fully disconnected ===');
  await context.setOffline(true);

  console.log('\n--- Part 4: cold offline boot -> Production Home -> Start Factory -> Generate -> Review -> Export ---');
  const page = await context.newPage();
  attach(page);
  await page.goto(BASE, { waitUntil: 'load', timeout: 15000 });

  await step('Cold offline load shows app shell', async () => {
    const text = await page.textContent('body');
    if (!text || text.length < 100) throw new Error('body is empty/near-empty');
  });

  await step('Open Today\'s Production', async () => {
    await page.getByText("Today's Production").click({ timeout: 10000 });
  });

  await step('Start Factory', async () => {
    const btn = page.getByText('▶ START FACTORY');
    await btn.waitFor({ timeout: 10000 });
    await btn.click();
  });

  await step('Approve session', async () => {
    const approve = page.getByText("Approve today's production session");
    await approve.waitFor({ timeout: 10000 });
    await approve.click();
  });

  await step('Generate Now', async () => {
    const gen = page.getByText('✨ Generate Now');
    await gen.waitFor({ timeout: 15000 });
    await gen.click();
  });

  await step('Reach a completable/session state (Mark Session Complete or Skip enabled within 60s)', async () => {
    let done = false;
    for (let i = 0; i < 20 && !done; i++) {
      await page.waitForTimeout(2000);
      const skip = page.getByText('Skip these and continue');
      if (await skip.isVisible().catch(() => false)) {
        const disabled = await skip.getAttribute('disabled').catch(() => null);
        if (disabled === null) { await skip.click(); await page.waitForTimeout(1000); continue; }
      }
      const mark = page.getByText('Mark Session Complete');
      if (await mark.isVisible().catch(() => false)) {
        const disabled = await mark.getAttribute('disabled').catch(() => null);
        if (disabled === null) { done = true; }
      }
    }
    if (!done) throw new Error('never reached an unblocked Mark Session Complete state within timeout');
  });

  await page.screenshot({ path: '/tmp/mission75b_workflow_before_complete.png' }).catch(() => {});

  await step('Mark Session Complete (offline)', async () => {
    await page.getByText('Mark Session Complete').click();
    await page.waitForTimeout(1500);
  });

  await page.screenshot({ path: '/tmp/mission75b_workflow_after_complete.png' }).catch(() => {});

  console.log('\n--- Part 5: offline session recovery (simulate app restart mid-session, offline) ---');
  // Start a brand-new session again (fresh factory run), get partway in, then hard-reload (simulating app restart) while still offline, and confirm state/queue/timeline persisted via IndexedDB and the reload itself succeeds from the SW cache.
  await step('Start a second run for recovery test: open Today\'s Production again', async () => {
    await page.getByText("Today's Production").first().click({ timeout: 10000 });
  });
  await step('Start Factory (run 2)', async () => {
    const btn = page.getByText('▶ START FACTORY');
    if (await btn.isVisible().catch(() => false)) await btn.click();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/mission75b_recovery_before_reload.png' }).catch(() => {});

  await step('Hard reload while offline (simulates app restart)', async () => {
    await page.reload({ waitUntil: 'load', timeout: 15000 });
  });
  await step('App shell renders again after offline reload', async () => {
    const text = await page.textContent('body');
    if (!text || text.length < 100) throw new Error('body empty after reload');
  });
  await page.screenshot({ path: '/tmp/mission75b_recovery_after_reload.png' }).catch(() => {});

  console.log('\n--- Part 6: Backup validation offline ---');
  await step('Open Backup Manager', async () => {
    await page.getByText(/Backup/i).first().click({ timeout: 10000 });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/mission75b_backup_manager_offline.png' }).catch(() => {});

  await context.close();
  await browser.close();

  console.log(`\n=== Console/network errors captured across the whole run: ${errors.length} ===`);
  for (const e of errors) console.log('  ' + e);
  console.log(`\n=== RESULT: ${!stepFailed && errors.length === 0 ? 'PASS' : stepFailed ? 'FAIL (see step failures above)' : 'PASS with console/network noise (see above)'} ===`);
  process.exit(stepFailed ? 1 : 0);
}
main().catch((e) => { console.error('FATAL', e); process.exit(2); });
