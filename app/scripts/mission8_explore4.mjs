// Mission 8 — one-off exploration: classic "Editor" (root generator) via
// "Back to Editor" button inside Design Workbench.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = process.argv[2] || 'http://localhost:5183/vector-stock-pattern-studio/studio/';

async function dump(page, label) {
  await page.waitForTimeout(600);
  const headings = await page.locator('h1,h2,h3').allTextContents();
  const buttons = (await page.locator('button').allTextContents()).filter(Boolean);
  console.log(`\n##### ${label} #####`);
  console.log('HEADINGS:', JSON.stringify(headings));
  console.log('BUTTONS:', JSON.stringify(buttons.slice(0, 80)));
  const safeName = label.replace(/[^a-zA-Z0-9]/g, '_');
  await page.screenshot({ path: `/tmp/mission8_explore4_${safeName}.png`, fullPage: true });
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  page.on('console', (msg) => console.log(`[console:${msg.type()}]`, msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '🎨 Pattern Studio', exact: true }).click();
  await dump(page, 'workbench');
  await page.getByRole('button', { name: '← Back to Editor', exact: true }).click();
  await dump(page, 'classic_editor');

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
