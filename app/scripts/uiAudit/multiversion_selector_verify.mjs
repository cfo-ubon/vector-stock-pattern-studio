// AI-SBOS Multi-Version Release — Part 16 verification: Version Selector
// navigation (Open v1 / Open v2 / Switch Version back and forth), version
// identity visible in each app's own header, and zero console errors.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const SELECTOR_URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

  // 1. Selector loads.
  await page.goto(SELECTOR_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const selectorBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Selector shows AI-SBOS + Choose Version ===', selectorBody.includes('AI-SBOS') && selectorBody.includes('Choose Version'));
  console.log('=== Selector shows both v1 and v2 cards ===', selectorBody.includes('AI-SBOS v1') && selectorBody.includes('AI-SBOS v2'));
  console.log('=== Selector shows Recommended badge ===', /recommended/i.test(selectorBody));
  console.log('=== Selector URL is /studio/ (root) ===', page.url() === SELECTOR_URL);

  // 2. Open v1.
  await page.getByRole('link', { name: 'Open v1' }).click();
  await page.waitForURL('**/studio/v1/**');
  await page.waitForTimeout(1200);
  console.log('=== Navigated to /studio/v1/ ===', page.url().includes('/studio/v1/'));
  const v1Body = await page.evaluate(() => document.body.innerText);
  console.log('=== v1 header shows AI-SBOS v1.5.0 / Stable / Legacy ===', /AI-SBOS v1\.5\.0/.test(v1Body) && v1Body.includes('Stable / Legacy'));
  console.log('=== v1 still shows original "Vector Stock Pattern Studio" heading (frozen business content) ===', v1Body.includes('Vector Stock Pattern Studio'));

  // 3. Switch Version from v1 back to selector.
  await page.getByRole('link', { name: '🔁 Switch Version' }).click();
  await page.waitForURL('**/studio/');
  await page.waitForTimeout(600);
  console.log('=== Switch Version (v1 -> selector) returns to /studio/ ===', page.url() === SELECTOR_URL);

  // 4. Open v2.
  await page.getByRole('link', { name: 'Open v2' }).click();
  await page.waitForURL('**/studio/v2/**');
  await page.waitForTimeout(1200);
  console.log('=== Navigated to /studio/v2/ ===', page.url().includes('/studio/v2/'));
  const whatsNewClose = page.getByRole('button', { name: 'เข้าใจแล้ว' });
  if (await whatsNewClose.isVisible().catch(() => false)) {
    await whatsNewClose.click();
    await page.waitForTimeout(300);
  }
  const v2Body = await page.evaluate(() => document.body.innerText);
  console.log('=== v2 header shows AI-SBOS v2.0.0 / Current ===', /AI-SBOS v2\.0\.0/.test(v2Body) && v2Body.includes('Current'));

  // 5. Switch Version from v2 back to selector.
  await page.getByRole('link', { name: '🔁 Switch Version' }).click();
  await page.waitForURL('**/studio/');
  await page.waitForTimeout(600);
  console.log('=== Switch Version (v2 -> selector) returns to /studio/ ===', page.url() === SELECTOR_URL);

  console.log('=== CONSOLE ERRORS (whole run) ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
