// Mission 8 — one-off exploration script (not part of any suite): click
// each top-level nav button and dump headings/buttons for that screen, to
// map real workflows before scripting the certification passes.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = process.argv[2] || 'http://localhost:5183/vector-stock-pattern-studio/studio/';
const navButtons = [
  '🏠 Mission Control',
  '🏭 Today\'s Production',
  '📊 Overview',
  '🎨 Pattern Studio',
  '📂 Portfolio',
  '💾 Backup',
  '📈 AI Market Advisor',
  '🎨 AI Design Director',
];

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  page.on('console', (msg) => console.log(`[console:${msg.type()}]`, msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  for (const label of navButtons) {
    try {
      const btn = page.getByRole('button', { name: label, exact: true });
      const count = await btn.count();
      if (count === 0) {
        console.log(`\n##### NAV "${label}" NOT FOUND #####`);
        continue;
      }
      await btn.first().click();
      await page.waitForTimeout(600);
      const headings = await page.locator('h1,h2,h3').allTextContents();
      const buttons = (await page.locator('button').allTextContents()).filter(Boolean);
      console.log(`\n##### NAV "${label}" #####`);
      console.log('HEADINGS:', JSON.stringify(headings));
      console.log('BUTTONS:', JSON.stringify(buttons.slice(0, 60)));
      const safeName = label.replace(/[^a-zA-Z0-9]/g, '_');
      await page.screenshot({ path: `/tmp/mission8_nav_${safeName}.png`, fullPage: true });
    } catch (e) {
      console.log(`\n##### NAV "${label}" ERROR: ${e.message} #####`);
    }
  }

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
