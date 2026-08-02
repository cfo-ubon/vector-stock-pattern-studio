// Mission 8 — quick comparison: does the "OFFLINE AUTOPILOT" label depend on
// actual network state, or just on absence of a saved Market Snapshot?
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = process.argv[2] || 'http://localhost:5184/vector-stock-pattern-studio/studio/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '✨ ออกแบบให้ฉันวันนี้', exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'สร้างแผนการออกแบบ →', exact: true }).click();
  await page.waitForTimeout(2000);
  const bodyText = await page.locator('body').innerText();
  console.log('ONLINE run body snippet:', bodyText.slice(0, 600));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
