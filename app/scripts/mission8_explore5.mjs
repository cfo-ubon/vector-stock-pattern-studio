// Mission 8 — one-off exploration: full (untruncated) button/heading dump
// for the classic generator (Advanced Mode ON at Mission Control root).
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = process.argv[2] || 'http://localhost:5183/vector-stock-pattern-studio/studio/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '⚙️ Advanced Mode', exact: true }).click();
  await page.waitForTimeout(800);

  const buttons = (await page.locator('button').allTextContents()).filter(Boolean);
  buttons.forEach((b, i) => console.log(i, JSON.stringify(b)));

  console.log('\n=== inputs ===');
  const inputs = await page.locator('input').all();
  for (const inp of inputs) {
    const type = await inp.getAttribute('type');
    const name = await inp.getAttribute('name');
    const id = await inp.getAttribute('id');
    console.log(JSON.stringify({ type, name, id }));
  }

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
