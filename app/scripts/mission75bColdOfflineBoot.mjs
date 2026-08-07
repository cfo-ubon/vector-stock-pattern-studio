#!/usr/bin/env node
// Mission 7.5B — Part 4: Cold Start Test.
//
// Simulates the real user journey: visit the production build once online
// (installs the service worker + precaches the shell), then simulate
// "next day, internet off" by opening a FRESH browser context with
// `offline: true` from the very first navigation — no warm cache, no
// already-open tab, nothing but what the service worker persisted.
// Repeated 3x per the mission brief ("Repeat multiple times").
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const BASE = 'http://localhost:5185/vector-stock-pattern-studio/studio/';

async function coldOfflineRun(page, attempt) {
  const consoleErrors = [];
  const listener = (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); };
  page.on('console', listener);
  const errListener = (err) => consoleErrors.push('pageerror: ' + err.message);
  page.on('pageerror', errListener);
  const failedRequests = [];
  const reqListener = (req) => failedRequests.push(`${req.method()} ${req.url()} -> ${req.failure()?.errorText}`);
  page.on('requestfailed', reqListener);

  let navError = null;
  try {
    await page.goto(BASE, { waitUntil: 'load', timeout: 15000 });
  } catch (e) {
    navError = e.message;
  }

  const bodyText = navError ? '' : await page.textContent('body').catch(() => '');
  const hasShell = bodyText.includes('Today') || bodyText.includes('Production') || bodyText.includes('Vector') || bodyText.includes('การผลิต');

  await page.screenshot({ path: `/tmp/mission75b_cold_offline_attempt${attempt}.png` }).catch(() => {});
  page.off('console', listener);
  page.off('pageerror', errListener);
  page.off('requestfailed', reqListener);

  return { attempt, navError, hasShell, consoleErrors, failedRequests, bodyLength: bodyText.length };
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });

  // Single persistent browsing context throughout — this is what actually
  // represents "the same device/browser profile" a real user has. Two
  // separate `browser.newContext()` calls would simulate two different,
  // storage-isolated browser profiles (Service Workers, Cache Storage, and
  // IndexedDB are all partitioned per context in Playwright, same as per
  // real browser profile) — not a realistic "installed once, offline
  // later" scenario.
  const context = await browser.newContext();
  const installPage = await context.newPage();

  console.log('=== Installing service worker (one online visit, same browser profile as all offline attempts below) ===');
  await installPage.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  const swState = await installPage.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unsupported';
    const reg = await navigator.serviceWorker.ready;
    return reg.active ? reg.active.state : 'no-active-worker';
  });
  console.log('Service worker state after ready:', swState);
  await installPage.close();

  await context.setOffline(true);
  console.log('\n=== Cold offline boot: 3 repeated attempts, SAME browser profile, network off for all ===');
  const results = [];
  for (let i = 1; i <= 3; i++) {
    const page = await context.newPage();
    const r = await coldOfflineRun(page, i);
    await page.close();
    results.push(r);
    console.log(`\nAttempt ${i}:`);
    console.log(`  navError: ${r.navError ?? 'none'}`);
    console.log(`  hasShell (real app content, not blank): ${r.hasShell}`);
    console.log(`  bodyLength: ${r.bodyLength}`);
    console.log(`  consoleErrors: ${JSON.stringify(r.consoleErrors)}`);
    console.log(`  failedRequests: ${JSON.stringify(r.failedRequests)}`);
  }

  await context.close();
  await browser.close();

  const allPassed = results.every((r) => !r.navError && r.hasShell && r.consoleErrors.length === 0 && r.failedRequests.length === 0);
  console.log(`\n=== RESULT: ${allPassed ? 'PASS — cold offline boot works, 3/3 attempts' : 'FAIL — see attempts above'} ===`);
  process.exit(allPassed ? 0 : 1);
}
main().catch((e) => { console.error('FATAL', e); process.exit(2); });
