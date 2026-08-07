// Mission 8 — one-off exploration: continue factory run to completion, check Review/Export tabs (online).
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = process.argv[2] || 'http://localhost:5183/vector-stock-pattern-studio/studio/';

async function dump(page, label) {
  await page.waitForTimeout(600);
  console.log(`\n##### ${label} #####`);
  const safeName = label.replace(/[^a-zA-Z0-9]/g, '_');
  await page.screenshot({ path: `/tmp/mission8_explore10_${safeName}.png`, fullPage: true });
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  page.on('console', (msg) => console.log(`[console:${msg.type()}]`, msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.getByRole('button', { name: '▶ START FACTORY', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: "Approve today's production session", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '✨ Generate Now', exact: true }).click();
  console.log('--- waiting for generation to settle (packaging state) ---');
  await page.waitForTimeout(20000);
  await dump(page, 'packaging_state');

  const skipBtn = page.getByRole('button', { name: 'Skip these and continue', exact: true });
  if (await skipBtn.count()) {
    await skipBtn.click();
    await page.waitForTimeout(1000);
    await dump(page, 'after_skip');
  }
  const markCompleteBtn = page.getByRole('button', { name: 'Mark Session Complete', exact: true });
  if (await markCompleteBtn.count()) {
    await markCompleteBtn.click();
    await page.waitForTimeout(1000);
    await dump(page, 'after_mark_complete');
  }

  // Review tab
  const reviewTab = page.getByRole('button', { name: /^Review/, exact: false });
  if (await reviewTab.count()) {
    await reviewTab.first().click();
    await dump(page, 'review_tab');
  }
  // Export tab
  const exportTab = page.getByRole('button', { name: 'Export', exact: true });
  if (await exportTab.count()) {
    await exportTab.click();
    await dump(page, 'export_tab');
  }
  // Dashboard tab
  const dashTab = page.getByRole('button', { name: 'Dashboard', exact: true });
  if (await dashTab.count()) {
    await dashTab.click();
    await dump(page, 'dashboard_tab');
  }

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
