// AI-SBOS Multi-Version Release, Part 16 — device matrix (Desktop, Laptop,
// iPad Landscape, iPad Portrait) for Selector + v1 + v2, plus offline cold
// boot for all three (Selector, v1, v2), each in a fresh browser profile.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const SELECTOR_URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/';
const V1_URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/v1/';
const V2_URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/v2/';

const DEVICES = [
  { name: 'Desktop', width: 1920, height: 1080 },
  { name: 'Laptop', width: 1366, height: 768 },
  { name: 'iPad Landscape', width: 1112, height: 834 },
  { name: 'iPad Portrait', width: 834, height: 1112 },
];

async function checkDevice(browser, device) {
  const context = await browser.newContext({ viewport: { width: device.width, height: device.height } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));

  console.log(`\n=== ${device.name} (${device.width}x${device.height}) ===`);

  await page.goto(SELECTOR_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const selWidth = await page.evaluate(() => document.body.scrollWidth);
  console.log('Selector: no horizontal overflow:', selWidth <= device.width + 5);
  console.log('Selector: both cards visible:', (await page.evaluate(() => document.body.innerText)).includes('AI-SBOS v1') && (await page.evaluate(() => document.body.innerText)).includes('AI-SBOS v2'));

  await page.goto(V1_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const v1Width = await page.evaluate(() => document.body.scrollWidth);
  console.log('v1: no horizontal overflow:', v1Width <= device.width + 5);
  console.log('v1: version badge visible:', await page.locator('.app-version-badge').isVisible().catch(() => false));

  await page.goto(V2_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const whatsNewClose = page.getByRole('button', { name: 'เข้าใจแล้ว' });
  if (await whatsNewClose.isVisible().catch(() => false)) {
    await whatsNewClose.click();
    await page.waitForTimeout(300);
  }
  const v2Width = await page.evaluate(() => document.body.scrollWidth);
  console.log('v2: no horizontal overflow:', v2Width <= device.width + 5);
  console.log('v2: version badge visible:', await page.locator('.app-version-badge').isVisible().catch(() => false));

  console.log('Console errors:', JSON.stringify(errors));
  await context.close();
  return errors.length === 0;
}

async function checkOfflineColdBoot(browser, label, url, expectText) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const body = await page.evaluate(() => document.body.innerText);
  console.log(`=== ${label} offline cold boot works ===`, body.includes(expectText), '| errors:', JSON.stringify(errors));
  await context.close();
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  for (const device of DEVICES) {
    await checkDevice(browser, device);
  }

  console.log('\n=== OFFLINE COLD BOOT (fresh profile each) ===');
  await checkOfflineColdBoot(browser, 'Selector', SELECTOR_URL, 'Choose Version');
  await checkOfflineColdBoot(browser, 'v1', V1_URL, 'Vector Stock Pattern Studio');
  await checkOfflineColdBoot(browser, 'v2', V2_URL, 'AI-SBOS');

  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
