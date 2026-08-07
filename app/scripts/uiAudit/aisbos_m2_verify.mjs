// AI-SBOS Mission, Milestone 2 — live-browser verification of the What's
// New dialog: shows once on first load, "Don't show again" persists across
// reload, and a fresh localStorage profile shows it again.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = 'http://localhost:5183/vector-stock-pattern-studio/studio/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const consoleErrors = [];

  // --- Fresh profile: What's New should show on first load. ---
  const context1 = await browser.newContext();
  const page1 = await context1.newPage();
  page1.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page1.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

  await page1.goto(URL, { waitUntil: 'networkidle' });
  await page1.waitForTimeout(800);
  const body1 = await page1.evaluate(() => document.body.innerText);
  console.log("=== What's New shown on first load (fresh profile) ===", /what's new/i.test(body1));

  // Close it WITHOUT checking "don't show again".
  await page1.getByRole('button', { name: 'เข้าใจแล้ว' }).click();
  await page1.waitForTimeout(300);
  const bodyAfterClose = await page1.evaluate(() => document.body.innerText);
  console.log("=== What's New closed after clicking เข้าใจแล้ว ===", !/what's new — v/i.test(bodyAfterClose));

  // Reload -- should NOT show again (same version already marked seen).
  await page1.reload({ waitUntil: 'networkidle' });
  await page1.waitForTimeout(800);
  const bodyAfterReload = await page1.evaluate(() => document.body.innerText);
  console.log("=== What's New does NOT reappear on reload for the same version (not checked don't-show-again) ===", !/what's new — v/i.test(bodyAfterReload));

  await context1.close();

  // --- Second fresh profile: check "Don't show again" persists. ---
  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await page2.goto(URL, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(800);
  const body2 = await page2.evaluate(() => document.body.innerText);
  console.log("=== Second fresh profile also shows What's New ===", /what's new/i.test(body2));

  await page2.getByRole('checkbox').check();
  await page2.getByRole('button', { name: 'เข้าใจแล้ว' }).click();
  await page2.waitForTimeout(300);

  await page2.reload({ waitUntil: 'networkidle' });
  await page2.waitForTimeout(800);
  const bodyAfterDontShowAgain = await page2.evaluate(() => document.body.innerText);
  console.log("=== What's New stays dismissed after reload with don't-show-again checked ===", !/what's new — v/i.test(bodyAfterDontShowAgain));

  await context2.close();

  console.log('=== CONSOLE ERRORS ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
