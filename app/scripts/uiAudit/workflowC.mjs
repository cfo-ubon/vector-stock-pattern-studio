// UI/UX Audit — Workflow C: Portfolio -> select multiple assets -> preview
// -> choose multiple marketplaces -> export -> download all packages.
// Real click-through of the Hotfix v1.0.1 Commercial Export UX.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
const { chromium } = pkg;

const URL = 'http://localhost:5183/vector-stock-pattern-studio/studio/';
const OUT_DIR = '/tmp/claude-0/-home-user-vector-stock-pattern-studio/89000801-5ee0-574e-8681-79d83ff64216/scratchpad/audit_screens/workflowC';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function dump(page, label) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT_DIR}/${label}.png`, fullPage: true });
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message}`));
  const downloads = [];
  page.on('download', (d) => downloads.push(d.suggestedFilename()));

  // Produce a batch first so Portfolio has real assets.
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.getByRole('button', { name: '▶ START FACTORY', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: "Approve today's production session", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '✨ Generate Now', exact: true }).click();
  console.log('--- waiting for generation to settle ---');
  await page.waitForTimeout(25000);
  const skipBtn = page.getByRole('button', { name: 'Skip these and continue', exact: true });
  if (await skipBtn.count()) await skipBtn.click();
  await page.waitForTimeout(1000);
  const markCompleteBtn = page.getByRole('button', { name: 'Mark Session Complete', exact: true });
  if (await markCompleteBtn.count()) await markCompleteBtn.click();
  await page.waitForTimeout(1000);

  // Navigate to Portfolio.
  await page.getByRole('button', { name: '📂 Portfolio', exact: true }).click();
  await page.waitForTimeout(1500);
  await dump(page, '01_portfolio_after_factory_run');

  const thumbCount = await page.locator('.portfolio-thumb').count().catch(() => 0);
  console.log('=== PORTFOLIO THUMB COUNT ===', thumbCount);

  if (thumbCount === 0) {
    console.log('=== NO ASSETS IN PORTFOLIO — factory output may not auto-promote. Aborting workflow C at this checkpoint. ===');
    console.log('=== CONSOLE ERRORS ===', JSON.stringify(consoleErrors));
    await browser.close();
    return;
  }

  // Select up to 10 assets via their checkboxes.
  const checkboxes = page.locator('.portfolio-thumb-checkbox input[type="checkbox"]');
  const checkboxCount = await checkboxes.count();
  const selectN = Math.min(10, checkboxCount);
  console.log('=== SELECTING', selectN, 'of', checkboxCount, 'ASSETS ===');
  for (let i = 0; i < selectN; i++) {
    await checkboxes.nth(i).click();
  }
  await dump(page, '02_assets_selected');

  // Click the Export button in the bulk action bar.
  const exportBtn = page.getByRole('button', { name: '📤 Export', exact: true });
  const exportCount = await exportBtn.count();
  console.log('=== BULK EXPORT BUTTON COUNT ===', exportCount);
  if (exportCount === 0) {
    console.log('=== Bulk Export button not found — checking page state ===');
    const buttons = await page.locator('button:visible').allTextContents();
    console.log('=== VISIBLE BUTTONS ===', JSON.stringify(buttons.filter(Boolean)));
    await browser.close();
    return;
  }
  await exportBtn.click();
  await dump(page, '03_marketplace_selection_dialog');

  // Select multiple marketplaces (Shutterstock + Etsy).
  const dialog = page.getByRole('dialog');
  const shutterstockCheckbox = dialog.locator('label', { hasText: 'Shutterstock' }).locator('input[type="checkbox"]');
  const etsyCheckbox = dialog.locator('label', { hasText: 'Etsy' }).locator('input[type="checkbox"]');
  if (await shutterstockCheckbox.count()) await shutterstockCheckbox.click();
  if (await etsyCheckbox.count()) await etsyCheckbox.click();
  await dump(page, '04_marketplaces_checked');

  const exportConfirmBtn = dialog.getByRole('button', { name: /^Export ไปยัง/ });
  console.log('=== EXPORT CONFIRM BUTTON TEXT ===', await exportConfirmBtn.textContent().catch(() => 'NOT FOUND'));
  await exportConfirmBtn.click();
  console.log('--- waiting for bulk export to build packages ---');
  await page.waitForTimeout(8000);
  await dump(page, '05_after_export_confirm');

  const bodyText = await page.locator('body').innerText();
  console.log('=== BODY SNIPPET AFTER EXPORT ===', bodyText.slice(0, 1500));

  // Check Download Center.
  const downloadCenterBtn = page.getByRole('button', { name: /Download Center/ });
  if (await downloadCenterBtn.count()) {
    await downloadCenterBtn.click();
    await dump(page, '06_download_center');
    const dcButtons = await page.locator('button:visible').allTextContents();
    console.log('=== DOWNLOAD CENTER BUTTONS ===', JSON.stringify(dcButtons.filter(Boolean)));
  }

  console.log('=== DOWNLOADS TRIGGERED ===', JSON.stringify(downloads));
  console.log('=== CONSOLE ERRORS ===', JSON.stringify(consoleErrors, null, 2));

  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
