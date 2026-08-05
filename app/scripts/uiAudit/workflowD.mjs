// UI/UX Audit — Workflow D: Backup -> create -> verify -> restore -> confirm data intact.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
const { chromium } = pkg;

const URL = 'http://localhost:5183/vector-stock-pattern-studio/studio/';
const OUT_DIR = '/tmp/claude-0/-home-user-vector-stock-pattern-studio/89000801-5ee0-574e-8681-79d83ff64216/scratchpad/audit_screens/workflowD';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function dump(page, label) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT_DIR}/${label}.png`, fullPage: true });
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message}`));

  // Seed some data first (one Factory batch) so the backup is non-trivial.
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.getByRole('button', { name: '▶ START FACTORY', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: "Approve today's production session", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '✨ Generate Now', exact: true }).click();
  await page.waitForTimeout(25000);
  const skipBtn = page.getByRole('button', { name: 'Skip these and continue', exact: true });
  if (await skipBtn.count()) await skipBtn.click();
  await page.waitForTimeout(1000);
  const markCompleteBtn = page.getByRole('button', { name: 'Mark Session Complete', exact: true });
  if (await markCompleteBtn.count()) await markCompleteBtn.click();
  await page.waitForTimeout(1000);

  // Go to Backup Manager.
  await page.getByRole('button', { name: '💾 Backup', exact: true }).click();
  await page.waitForTimeout(1000);
  await dump(page, '01_backup_home');

  const createBtn = page.getByRole('button', { name: '+ สร้างไฟล์สำรองใหม่', exact: true });
  console.log('=== CREATE BACKUP BUTTON COUNT ===', await createBtn.count());
  await createBtn.click();
  console.log('--- waiting for backup build to complete ---');
  await page.waitForTimeout(3000);
  await dump(page, '02_after_create_backup');
  const downloadFileBtn = page.getByRole('button', { name: /^ดาวน์โหลดไฟล์/ });
  console.log('=== DOWNLOAD-FILE BUTTON COUNT ===', await downloadFileBtn.count());
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }).catch((e) => ({ error: String(e) })),
    downloadFileBtn.count().then((c) => (c > 0 ? downloadFileBtn.click() : null)),
  ]);

  let backupFilePath = null;
  if (download && download.suggestedFilename) {
    console.log('=== BACKUP DOWNLOADED ===', download.suggestedFilename());
    backupFilePath = await download.path();
    const stat = fs.statSync(backupFilePath);
    console.log('=== BACKUP FILE SIZE ===', stat.size, 'bytes');
  } else {
    console.log('=== BACKUP DOWNLOAD FAILED OR NOT TRIGGERED ===', JSON.stringify(download));
  }

  // Verify the backup file.
  const verifyTab = page.getByRole('button', { name: 'ตรวจสอบไฟล์สำรอง', exact: true });
  if (await verifyTab.count()) {
    await verifyTab.click();
    await page.waitForTimeout(500);
    await dump(page, '03_verify_tab');
    if (backupFilePath) {
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.count()) {
        await fileInput.setInputFiles(backupFilePath);
        await page.waitForTimeout(2000);
        await dump(page, '04_after_verify_upload');
        const bodyText = await page.locator('body').innerText();
        const verifyMatch = bodyText.match(/(PASS|WARNING|FAIL)[^\n]{0,200}/gi);
        console.log('=== VERIFY RESULT SNIPPET ===', JSON.stringify(verifyMatch?.slice(0, 10)));
      } else {
        console.log('=== NO FILE INPUT FOUND ON VERIFY TAB ===');
      }
    }
  } else {
    console.log('=== VERIFY TAB NOT FOUND ===');
  }

  // Restore flow.
  const restoreTab = page.getByRole('button', { name: 'กู้คืนข้อมูล', exact: true });
  if (await restoreTab.count() && backupFilePath) {
    await restoreTab.click();
    await page.waitForTimeout(500);
    await dump(page, '05_restore_tab');
    const restoreFileInput = page.locator('input[type="file"]').first();
    if (await restoreFileInput.count()) {
      await restoreFileInput.setInputFiles(backupFilePath);
      await page.waitForTimeout(2500);
      await dump(page, '06_after_restore_upload');
      const buttons = await page.locator('button:visible').allTextContents();
      console.log('=== BUTTONS AFTER RESTORE FILE SELECTED ===', JSON.stringify(buttons.filter(Boolean)));
    } else {
      console.log('=== NO FILE INPUT FOUND ON RESTORE TAB ===');
    }
  }

  const confirmRestoreBtn = page.getByRole('button', { name: 'ยืนยันกู้คืนข้อมูล', exact: true });
  if (await confirmRestoreBtn.count()) {
    await confirmRestoreBtn.click();
    console.log('--- waiting for restore to complete ---');
    await page.waitForTimeout(4000);
    await dump(page, '07_after_restore_confirm');
    const bodyText = await page.locator('body').innerText();
    console.log('=== BODY SNIPPET AFTER RESTORE ===', bodyText.slice(0, 600));
  }

  // Confirm data intact: revisit Portfolio.
  await page.getByRole('button', { name: '📂 Portfolio', exact: true }).click();
  await page.waitForTimeout(1500);
  await dump(page, '08_portfolio_after_restore');
  const thumbCountAfter = await page.locator('.portfolio-thumb').count().catch(() => 0);
  console.log('=== PORTFOLIO THUMB COUNT AFTER RESTORE ===', thumbCountAfter);

  console.log('=== CONSOLE ERRORS ===', JSON.stringify(consoleErrors, null, 2));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
