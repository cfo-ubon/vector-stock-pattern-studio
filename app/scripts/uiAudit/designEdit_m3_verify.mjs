// Design Refinement Studio Pro, Mission 3 — live-browser verification of
// Version Control + Compare Center: Portfolio -> Preview -> Edit Design ->
// Approve a version -> Version History shows both original + new version
// -> select 2 -> Compare Center renders scores/params diff -> rename +
// duplicate a version from History.
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

  const cards = page.locator('.portfolio-grid button.portfolio-thumb, .portfolio-grid > button');
  await cards.first().click({ timeout: 5000 });
  await page.waitForTimeout(600);

  // Track the exact asset id being edited -- the grid re-sorts by
  // most-recently-created after Approve, so `cards.first()` would pick a
  // DIFFERENT asset on a second call. Read the real Asset ID text shown in
  // the preview dialog before proceeding.
  const previewBodyBefore = await page.evaluate(() => document.body.innerText);
  const assetIdMatch = previewBodyBefore.match(/VSP-\d{8}-[A-Z0-9]+/);
  const originalAssetId = assetIdMatch ? assetIdMatch[0] : null;
  console.log('=== Tracking original asset id ===', originalAssetId);

  // Create a real second version first, via Edit Design + Approve.
  await page.getByRole('button', { name: '🎨 Edit Design' }).click();
  await page.waitForTimeout(800);
  await page.locator('#de-density').evaluate((el) => { el.focus(); });
  await page.keyboard.press('End');
  await page.waitForTimeout(500);
  const approveBtn = page.getByRole('button', { name: /Approve/i }).first();
  await approveBtn.click();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'ปิด', exact: true }).click();
  await page.waitForTimeout(600);

  // Reopen preview on the SAME (original) asset, by its tracked Asset ID
  // text, and open Version History -- the grid may have re-sorted.
  if (originalAssetId) {
    await page.locator('.portfolio-grid button', { hasText: originalAssetId }).first().click({ timeout: 5000 });
  } else {
    await cards.first().click({ timeout: 5000 });
  }
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: '🕓 Version History' }).click();
  await page.waitForTimeout(800);

  const historyBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Has Version History heading ===', historyBody.includes('ประวัติเวอร์ชันการออกแบบ'));
  const rowCountMatch = historyBody.match(/ประวัติเวอร์ชันการออกแบบ \((\d+)\)/);
  console.log('=== Version count shown ===', rowCountMatch ? rowCountMatch[1] : 'not found');

  // Select 2 versions to compare.
  const checkboxes = page.locator('.version-history-row input[type="checkbox"]');
  const checkboxCount = await checkboxes.count();
  console.log('=== Version row checkboxes found ===', checkboxCount);
  if (checkboxCount >= 2) {
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /เปรียบเทียบ 2 เวอร์ชัน/ }).click();
    await page.waitForTimeout(2500);
    const compareDialog = page.getByLabel('เปรียบเทียบเวอร์ชัน');
    const compareBody = await compareDialog.evaluate((el) => el.innerText);
    console.log('=== Compare dialog full text ===');
    console.log(compareBody);

    // Try slider overlay mode.
    const sliderModeBtn = compareDialog.getByRole('button', { name: 'Slider Overlay' });
    if (await sliderModeBtn.isVisible().catch(() => false)) {
      await sliderModeBtn.click();
      await page.waitForTimeout(400);
      const sliderInput = page.locator('.compare-slider-input');
      console.log('=== Slider overlay input visible ===', await sliderInput.isVisible().catch(() => false));
    }

    await compareDialog.getByRole('button', { name: 'ปิด', exact: true }).click();
    await page.waitForTimeout(500);
  }

  // Rename + duplicate the first version row.
  const renameBtn = page.getByRole('button', { name: '✏️ เปลี่ยนชื่อ' }).first();
  if (await renameBtn.isVisible().catch(() => false)) {
    await renameBtn.click();
    await page.waitForTimeout(300);
    const renameInput = page.locator('.version-history-rename-row input').first();
    await renameInput.fill('Renamed Test Version');
    await page.getByRole('button', { name: 'บันทึก' }).first().click();
    await page.waitForTimeout(500);
    const renamedBody = await page.evaluate(() => document.body.innerText);
    console.log('=== Rename applied ===', renamedBody.includes('Renamed Test Version'));
  }

  const duplicateBtn = page.getByRole('button', { name: /ทำสำเนา/ }).first();
  if (await duplicateBtn.isVisible().catch(() => false)) {
    await duplicateBtn.click();
    await page.waitForTimeout(2000);
    const afterDupBody = await page.evaluate(() => document.body.innerText);
    const rowCountAfterDup = afterDupBody.match(/ประวัติเวอร์ชันการออกแบบ \((\d+)\)/);
    console.log('=== Version count after duplicate ===', rowCountAfterDup ? rowCountAfterDup[1] : 'not found');
  }

  console.log('=== CONSOLE ERRORS ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
