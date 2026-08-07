#!/usr/bin/env node
// Mission 7.5B — Part 7: Performance (measured, not estimated).
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
const BASE = 'http://localhost:5185/vector-stock-pattern-studio/studio/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const context = await browser.newContext();

  // Online visit: install SW, measure normal (network) startup for comparison.
  const onlineStart = Date.now();
  const p1 = await context.newPage();
  await p1.goto(BASE, { waitUntil: 'load', timeout: 30000 });
  const onlineLoadMs = Date.now() - onlineStart;
  await p1.evaluate(async () => { await navigator.serviceWorker.ready; });
  const onlineNavTiming = await p1.evaluate(() => {
    const [nav] = performance.getEntriesByType('navigation');
    return nav ? { domContentLoaded: nav.domContentLoadedEventEnd, loadEvent: nav.loadEventEnd, transferSize: nav.transferSize } : null;
  });
  const heapOnline = await p1.evaluate(() => performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize } : null);
  await p1.close();

  await context.setOffline(true);

  // Cold offline load timing, 3 repeated measurements.
  const offlineTimings = [];
  for (let i = 0; i < 3; i++) {
    const page = await context.newPage();
    const start = Date.now();
    await page.goto(BASE, { waitUntil: 'load', timeout: 15000 });
    const elapsed = Date.now() - start;
    const navTiming = await page.evaluate(() => {
      const [nav] = performance.getEntriesByType('navigation');
      return nav ? { domContentLoaded: nav.domContentLoadedEventEnd, loadEvent: nav.loadEventEnd, transferSize: nav.transferSize } : null;
    });
    const heap = await page.evaluate(() => performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize } : null);
    offlineTimings.push({ attempt: i + 1, wallMs: elapsed, navTiming, heap });
    await page.close();
  }

  await context.close();
  await browser.close();

  console.log('=== Mission 7.5B Part 7: Performance (measured) ===\n');
  console.log('Online (network) first load:');
  console.log(`  wall time: ${onlineLoadMs}ms`);
  console.log(`  navigation timing: ${JSON.stringify(onlineNavTiming)}`);
  console.log(`  JS heap: ${JSON.stringify(heapOnline)}`);
  console.log('\nOffline (cold, service-worker-cached) loads, 3 repeated attempts, SAME browser profile:');
  for (const t of offlineTimings) {
    console.log(`  attempt ${t.attempt}: wall=${t.wallMs}ms nav=${JSON.stringify(t.navTiming)} heap=${JSON.stringify(t.heap)}`);
  }
  const avgOffline = offlineTimings.reduce((a, t) => a + t.wallMs, 0) / offlineTimings.length;
  console.log(`\n  average offline cold-load wall time: ${avgOffline.toFixed(1)}ms`);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
