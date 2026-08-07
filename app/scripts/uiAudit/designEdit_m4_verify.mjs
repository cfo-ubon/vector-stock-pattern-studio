// Design Refinement Studio Pro, Mission 4 — live-browser verification of
// Batch Refinement: Portfolio -> multi-select several patterns -> Batch
// Refine -> set a density adjustment -> apply -> confirm N new linked
// versions created and originals untouched.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = 'http://localhost:5183/vector-stock-pattern-studio/studio/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '▶ START FACTORY', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: "Approve today's production session", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '✨ Generate Now', exact: true }).click();
  console.log('Waiting for batch to complete...');
  await page.waitForTimeout(26000);

  await page.getByRole('button', { name: '📂 Portfolio', exact: true }).click();
  await page.waitForTimeout(1000);

  const bodyBefore = await page.evaluate(() => document.body.innerText);
  const totalBeforeMatch = bodyBefore.match(/ทั้งหมด\s*\n?(\d+)/);
  console.log('=== Total assets before batch refine ===', totalBeforeMatch ? totalBeforeMatch[1] : 'not found');

  // Multi-select the first 3 assets via their checkboxes.
  const checkboxes = page.locator('.portfolio-thumb-checkbox input[type="checkbox"]');
  const checkboxCount = await checkboxes.count();
  console.log('=== Multi-select checkboxes found ===', checkboxCount);
  const selectCount = Math.min(3, checkboxCount);
  for (let i = 0; i < selectCount; i++) {
    await checkboxes.nth(i).check();
  }
  await page.waitForTimeout(400);

  const bulkBarText = await page.evaluate(() => document.body.innerText);
  console.log('=== Bulk action bar shows selected count ===', bulkBarText.includes(`เลือกแล้ว ${selectCount} รายการ`));

  await page.getByRole('button', { name: '🎨 Batch Refine' }).click();
  await page.waitForTimeout(800);

  const dialogBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Batch Refine dialog opened with correct count ===', dialogBody.includes(`Batch Refine — ${selectCount} ชิ้นงาน`));

  // Set a real density adjustment via keyboard (End key on the range input).
  await page.locator('#batch-density').evaluate((el) => { el.focus(); });
  await page.keyboard.press('End'); // max +0.5
  await page.waitForTimeout(300);

  const applyBtn = page.getByRole('button', { name: /ใช้กับ \d+ ชิ้นงาน/ });
  await applyBtn.click();
  console.log('Waiting for batch refinement to process...');
  await page.waitForTimeout(4000);

  const resultBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Batch refine result section ===');
  const resultsSection = resultBody.split('ผลลัพธ์')[1]?.slice(0, 400) ?? '(not found)';
  console.log(resultsSection);

  await page.getByRole('button', { name: 'เสร็จสิ้น' }).click();
  await page.waitForTimeout(1500);

  const bodyAfter = await page.evaluate(() => document.body.innerText);
  const totalAfterMatch = bodyAfter.match(/ทั้งหมด\s*\n?(\d+)/);
  console.log('=== Total assets after batch refine ===', totalAfterMatch ? totalAfterMatch[1] : 'not found');
  const editedCountMatch = bodyAfter.match(/\(batch refined\)/g);
  console.log('=== "(batch refined)" display names found in grid text ===', editedCountMatch ? editedCountMatch.length : 0);

  console.log('=== CONSOLE ERRORS ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
