// Mission 8 — one-off exploration: Advanced Mode toggle + Design Workbench
// tabs (Marketplace/SEO, Live Preview) + Autopilot entry points.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = process.argv[2] || 'http://localhost:5183/vector-stock-pattern-studio/studio/';

async function dump(page, label) {
  await page.waitForTimeout(500);
  const headings = await page.locator('h1,h2,h3').allTextContents();
  const buttons = (await page.locator('button').allTextContents()).filter(Boolean);
  console.log(`\n##### ${label} #####`);
  console.log('HEADINGS:', JSON.stringify(headings));
  console.log('BUTTONS:', JSON.stringify(buttons.slice(0, 80)));
  const safeName = label.replace(/[^a-zA-Z0-9]/g, '_');
  await page.screenshot({ path: `/tmp/mission8_explore3_${safeName}.png`, fullPage: true });
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  page.on('console', (msg) => console.log(`[console:${msg.type()}]`, msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await dump(page, 'root');

  // Toggle Advanced Mode
  await page.getByRole('button', { name: '⚙️ Advanced Mode', exact: true }).click();
  await dump(page, 'AdvancedMode_ON');

  // Go to Pattern Studio (Design Workbench)
  await page.getByRole('button', { name: '🎨 Pattern Studio', exact: true }).click();
  await dump(page, 'PatternStudio_afterAdvanced');

  // Try Marketplace tab (SEO?)
  const marketplaceTab = page.getByRole('button', { name: '🏬 Marketplace', exact: true });
  if (await marketplaceTab.count()) {
    await marketplaceTab.click();
    await dump(page, 'PatternStudio_Marketplace_tab');
  }

  // Try Live Preview tab
  const previewTab = page.getByRole('button', { name: '🖼 Live Preview', exact: true });
  if (await previewTab.count()) {
    await previewTab.click();
    await dump(page, 'PatternStudio_LivePreview_tab');
  }

  // Back to Mission Control, try Autopilot entry
  await page.getByRole('button', { name: '🏠 Mission Control', exact: true }).click();
  await dump(page, 'MissionControl_afterAdvanced');

  const autopilotBtn = page.getByRole('button', { name: '✨ ออกแบบให้ฉันวันนี้', exact: true });
  if (await autopilotBtn.count()) {
    await autopilotBtn.click();
    await dump(page, 'Autopilot_afterClick');
  }

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
