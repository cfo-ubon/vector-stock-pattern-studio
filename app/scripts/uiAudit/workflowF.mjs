// UI/UX Audit — Workflow F: iPad portrait/landscape across main screens.
// Checks for horizontal overflow and captures screenshots.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
const { chromium } = pkg;

const URL = 'http://localhost:5183/vector-stock-pattern-studio/studio/';
const OUT_DIR = '/tmp/claude-0/-home-user-vector-stock-pattern-studio/89000801-5ee0-574e-8681-79d83ff64216/scratchpad/audit_screens/workflowF';
fs.mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: 'ipad_portrait', width: 834, height: 1194 },
  { name: 'ipad_landscape', width: 1194, height: 834 },
];

const SCREENS = [
  { key: 'mission_control', label: '🏠 Mission Control' },
  { key: 'todays_production', label: "🏭 Today's Production" },
  { key: 'portfolio', label: '📂 Portfolio' },
  { key: 'pattern_studio', label: '🎨 Pattern Studio' },
  { key: 'backup', label: '💾 Backup' },
];

async function checkOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, overflowPx: doc.scrollWidth - doc.clientWidth };
  });
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const results = [];

  for (const vp of VIEWPORTS) {
    for (const screen of SCREENS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: false });
      const page = await context.newPage();
      const consoleErrors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message}`));
      let entry = { viewport: vp.name, screen: screen.key };
      try {
        await page.goto(URL, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        const navBtn = page.getByRole('button', { name: screen.label, exact: true });
        if (await navBtn.count()) {
          await navBtn.click();
          await page.waitForTimeout(1200);
        }
        const overflow = await checkOverflow(page);
        entry.overflow = overflow;
        await page.screenshot({ path: `${OUT_DIR}/${vp.name}_${screen.key}.png`, fullPage: false });
        // Also check nav bar itself for overflow/clipping.
        const navOverflow = await page.evaluate(() => {
          const navButtons = Array.from(document.querySelectorAll('button'));
          const offscreen = navButtons.filter((b) => {
            const r = b.getBoundingClientRect();
            return r.right > window.innerWidth + 2 || r.left < -2;
          });
          return offscreen.length;
        });
        entry.buttonsPartiallyOffscreen = navOverflow;
      } catch (e) {
        entry.error = String(e);
      }
      entry.consoleErrors = consoleErrors;
      results.push(entry);
      await context.close();
    }
  }

  fs.writeFileSync(`${OUT_DIR}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
