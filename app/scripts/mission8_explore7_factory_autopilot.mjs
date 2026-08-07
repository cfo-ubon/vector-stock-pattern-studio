// Mission 8 — one-off exploration: Factory (Today's Production) + Autopilot flows (online).
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = process.argv[2] || 'http://localhost:5183/vector-stock-pattern-studio/studio/';

async function dump(page, label) {
  await page.waitForTimeout(800);
  const headings = await page.locator('h1,h2,h3').allTextContents();
  console.log(`\n##### ${label} #####`);
  console.log('HEADINGS:', JSON.stringify(headings));
  const safeName = label.replace(/[^a-zA-Z0-9]/g, '_');
  await page.screenshot({ path: `/tmp/mission8_explore7_${safeName}.png`, fullPage: true });
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  page.on('console', (msg) => console.log(`[console:${msg.type()}]`, msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });

  // Autopilot flow
  await page.getByRole('button', { name: '✨ ออกแบบให้ฉันวันนี้', exact: true }).click();
  await dump(page, 'autopilot_landing');
  console.log('--- clicking สร้าง 5 ลาย (quick action) ---');
  await page.getByRole('button', { name: 'สร้าง 5 ลาย', exact: true }).click();
  await dump(page, 'autopilot_after_quick5');

  // Today's Production / Factory flow
  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await dump(page, 'factory_home');
  const startBtn = page.getByRole('button', { name: '▶ START FACTORY', exact: true });
  if (await startBtn.count()) {
    console.log('--- clicking START FACTORY ---');
    await startBtn.click();
    await dump(page, 'factory_after_start_immediate');
    await page.waitForTimeout(4000);
    await dump(page, 'factory_after_start_4s');
  } else {
    console.log('START FACTORY button not found at this state');
  }

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
