#!/usr/bin/env node
// Mission 7.5B — Part 9: Browser verification, offline only, desktop + iPad
// (portrait + landscape), zero console errors expected.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium, devices } = pkg;
const BASE = 'http://localhost:5185/vector-stock-pattern-studio/studio/';

async function verify(browser, label, contextOptions) {
  const context = await browser.newContext(contextOptions);
  const bootPage = await context.newPage();
  await bootPage.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await bootPage.evaluate(async () => { await navigator.serviceWorker.ready; });
  await bootPage.close();

  await context.setOffline(true);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));
  const failedRequests = [];
  page.on('requestfailed', (req) => failedRequests.push(`${req.method()} ${req.url()} -> ${req.failure()?.errorText}`));

  let navError = null;
  try {
    await page.goto(BASE, { waitUntil: 'load', timeout: 15000 });
  } catch (e) {
    navError = e.message;
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).catch(() => null);
  const bodyText = await page.textContent('body').catch(() => '');
  await page.screenshot({ path: `/tmp/mission75b_browser_${label}.png`, fullPage: false }).catch(() => {});
  await context.close();

  console.log(`\n--- ${label} ---`);
  console.log(`  navError: ${navError ?? 'none'}`);
  console.log(`  bodyLength: ${bodyText.length}`);
  console.log(`  horizontalOverflowPx: ${overflow}`);
  console.log(`  consoleErrors: ${JSON.stringify(consoleErrors)}`);
  console.log(`  failedRequests: ${JSON.stringify(failedRequests)}`);
  return { label, navError, bodyLength: bodyText.length, overflow, consoleErrors, failedRequests };
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const results = [];
  results.push(await verify(browser, 'desktop-1400x900', { viewport: { width: 1400, height: 900 } }));
  const ipad = devices['iPad Pro 11'];
  results.push(await verify(browser, 'ipad-portrait', { ...ipad, viewport: { width: 834, height: 1194 }, hasTouch: true, isMobile: true }));
  results.push(await verify(browser, 'ipad-landscape', { ...ipad, viewport: { width: 1194, height: 834 }, hasTouch: true, isMobile: true }));
  await browser.close();

  const allPass = results.every((r) => !r.navError && r.bodyLength > 100 && r.overflow <= 0 && r.consoleErrors.length === 0 && r.failedRequests.length === 0);
  console.log(`\n=== RESULT: ${allPass ? 'PASS' : 'FAIL'} ===`);
  process.exit(allPass ? 0 : 1);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
