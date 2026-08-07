// UI/UX Audit — visits each top-level nav destination from a fresh page
// load (IndexedDB cleared), captures DOM structure (headings/buttons/
// tabs/links), console errors, and a full-page screenshot. Reused by the
// Playwright audit — see FULL_UI_UX_AUDIT_REPORT.md for how this data
// was assembled into the control inventory.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
const { chromium } = pkg;

const URL = 'http://localhost:5183/vector-stock-pattern-studio/studio/';
const OUT_DIR = '/tmp/claude-0/-home-user-vector-stock-pattern-studio/89000801-5ee0-574e-8681-79d83ff64216/scratchpad/audit_screens';

const SCREENS = [
  { key: 'mission_control', label: '🏠 Mission Control' },
  { key: 'todays_production', label: "🏭 Today's Production" },
  { key: 'design_for_me_today', label: '✨ ออกแบบให้ฉันวันนี้' },
  { key: 'overview', label: '📊 Overview' },
  { key: 'pattern_studio', label: '🎨 Pattern Studio' },
  { key: 'portfolio', label: '📂 Portfolio' },
  { key: 'backup', label: '💾 Backup' },
  { key: 'ai_market_advisor', label: '📈 AI Market Advisor' },
  { key: 'ai_design_director', label: '🎨 AI Design Director' },
  { key: 'advanced_mode', label: '⚙️ Advanced Mode' },
];

async function capture(page, key) {
  await page.waitForTimeout(1200);
  const headings = await page.locator('h1,h2,h3').allTextContents();
  const buttons = await page.locator('button:visible').allTextContents();
  const links = await page.locator('a:visible').allTextContents();
  const tabs = await page.getByRole('tab').allTextContents().catch(() => []);
  const dialogs = await page.getByRole('dialog').count();
  const disabledButtons = await page.locator('button:disabled').allTextContents();
  const inputs = await page.locator('input:visible, select:visible, textarea:visible').count();
  return { key, headings, buttons: buttons.filter(Boolean), links: links.filter(Boolean), tabs, dialogCount: dialogs, disabledButtons: disabledButtons.filter(Boolean), inputCount: inputs };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const results = [];

  for (const screen of SCREENS) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const consoleMsgs = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleMsgs.push(`[console.error] ${msg.text()}`); });
    page.on('pageerror', (err) => consoleMsgs.push(`[pageerror] ${err.message}`));
    let entry = { key: screen.key, navLabel: screen.label, ok: false };
    try {
      await page.goto(URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      const navButton = page.locator('button', { hasText: screen.label }).first();
      const navCount = await navButton.count();
      if (navCount === 0) {
        entry.error = 'nav button not found on fresh load';
      } else {
        await navButton.click();
        await page.waitForTimeout(1200);
        const captured = await capture(page, screen.key);
        entry = { ...entry, ...captured, ok: true };
        await page.screenshot({ path: `${OUT_DIR}/${screen.key}_desktop.png`, fullPage: true });
      }
    } catch (e) {
      entry.error = String(e);
    }
    entry.consoleErrors = consoleMsgs;
    results.push(entry);
    await context.close();
  }

  fs.writeFileSync(`${OUT_DIR}/crawl_results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.map((r) => ({ key: r.key, ok: r.ok, error: r.error, headingCount: r.headings?.length, buttonCount: r.buttons?.length, consoleErrors: r.consoleErrors?.length })), null, 2));

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
