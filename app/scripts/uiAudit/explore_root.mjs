// UI/UX Audit — root exploration: dump the rendered home screen (Mission
// Control) structure so the systematic audit script can target real
// selectors instead of guessing. Follows the mission8_explore.mjs pattern.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = process.argv[2] || 'http://localhost:5183/vector-stock-pattern-studio/studio/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleMsgs = [];
  page.on('console', (msg) => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => consoleMsgs.push(`[pageerror] ${err.message}`));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const headings = await page.locator('h1,h2,h3').allTextContents();
  const buttons = await page.locator('button').allTextContents();
  const links = await page.locator('a').allTextContents();
  const roleTabs = await page.getByRole('tab').allTextContents().catch(() => []);
  const navText = await page.locator('nav').allTextContents().catch(() => []);
  const navButtons = await page.locator('nav button, [role="navigation"] button').allTextContents().catch(() => []);

  console.log('=== URL ===', URL);
  console.log('=== HEADINGS ===', JSON.stringify(headings, null, 2));
  console.log('=== BUTTONS ===', JSON.stringify(buttons.filter(Boolean), null, 2));
  console.log('=== LINKS ===', JSON.stringify(links.filter(Boolean), null, 2));
  console.log('=== TABS ===', JSON.stringify(roleTabs, null, 2));
  console.log('=== NAV TEXT ===', JSON.stringify(navText, null, 2));
  console.log('=== NAV BUTTONS ===', JSON.stringify(navButtons.filter(Boolean), null, 2));
  console.log('=== CONSOLE ===', JSON.stringify(consoleMsgs, null, 2));

  await page.screenshot({ path: '/tmp/uiaudit_root.png', fullPage: true });

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
