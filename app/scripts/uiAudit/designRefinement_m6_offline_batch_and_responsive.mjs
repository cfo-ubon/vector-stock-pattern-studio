// Design Refinement Studio Pro, Milestone 6 — offline verification of
// Batch Refinement specifically, plus a responsive/narrow-viewport check
// of Design Edit Mode's 3-column -> 1-column collapse (built in Mission 1,
// re-verified here as part of "all devices" production verification).
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message}`));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '▶ START FACTORY', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: "Approve today's production session", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '✨ Generate Now', exact: true }).click();
  console.log('Waiting for offline batch to complete...');
  await page.waitForTimeout(26000);

  await page.getByRole('button', { name: '📂 Portfolio', exact: true }).click();
  await page.waitForTimeout(1000);

  // Batch Refinement offline.
  const checkboxes = page.locator('.portfolio-thumb-checkbox input[type="checkbox"]');
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '🎨 Batch Refine' }).click();
  await page.waitForTimeout(600);
  await page.locator('#batch-density').evaluate((el) => { el.focus(); });
  await page.keyboard.press('End');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /ใช้กับ \d+ ชิ้นงาน/ }).click();
  console.log('Waiting for offline batch refinement...');
  await page.waitForTimeout(3000);
  const batchResultBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Batch Refinement offline result ===', batchResultBody.match(/สร้างเวอร์ชันใหม่สำเร็จ: \d+/)?.[0] ?? 'NOT FOUND');
  await page.getByRole('button', { name: 'เสร็จสิ้น' }).click();
  await page.waitForTimeout(1000);

  // Responsive check: narrow viewport (iPad portrait class width).
  await page.setViewportSize({ width: 834, height: 1112 });
  await page.waitForTimeout(400);
  const cards = page.locator('.portfolio-grid button.portfolio-thumb, .portfolio-grid > button');
  await cards.first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '🎨 Edit Design' }).click();
  await page.waitForTimeout(800);

  const bodyGridCols = await page.evaluate(() => {
    const el = document.querySelector('.design-edit-body');
    return el ? getComputedStyle(el).gridTemplateColumns : 'NOT FOUND';
  });
  console.log('=== .design-edit-body grid-template-columns at 834px width ===', bodyGridCols);
  const colCount = bodyGridCols === 'NOT FOUND' ? 0 : bodyGridCols.split(' ').length;
  console.log('=== Collapsed to single column (expected 1) ===', colCount);

  console.log('=== CONSOLE ERRORS ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
