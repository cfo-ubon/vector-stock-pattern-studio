// AI-SBOS Multi-Version Release, Part 11/16 — real .vspsb backup
// compatibility test. Creates a real backup archive in v1 via the actual
// Backup Manager UI (downloads a real .vspsb file), then restores that
// exact file into v2 via its own Restore tab, and confirms v2 now
// contains the project that only existed in v1 before the restore.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import path from 'node:path';
const { chromium } = pkg;

const V1_URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/v1/';
const V2_URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/v2/';
const DOWNLOAD_DIR = '/tmp/claude-0/-home-user-vector-stock-pattern-studio/89000801-5ee0-574e-8681-79d83ff64216/scratchpad';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

  const uniqueProjectName = `BackupTest-${Date.now()}`;

  console.log('--- v1: create a project, then a real .vspsb backup containing it ---');
  await page.goto(V1_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  page.once('dialog', (dialog) => dialog.accept(uniqueProjectName));
  await page.getByRole('button', { name: '+ โปรเจกต์ใหม่' }).first().click();
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: '💾 Backup', exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '+ สร้างไฟล์สำรองใหม่' }).click();
  console.log('Building backup archive...');
  await page.waitForTimeout(3000);

  const downloadPromise = page.waitForEvent('download');
  const downloadLink = page.getByText(/ดาวน์โหลดไฟล์/);
  await downloadLink.click();
  const download = await downloadPromise;
  const vspsbPath = path.join(DOWNLOAD_DIR, 'multiversion_backup_test.vspsb');
  await download.saveAs(vspsbPath);
  console.log('=== v1 backup downloaded ===', vspsbPath);

  console.log('--- v2: restore that exact .vspsb file ---');
  await page.goto(V2_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const whatsNewClose = page.getByRole('button', { name: 'เข้าใจแล้ว' });
  if (await whatsNewClose.isVisible().catch(() => false)) {
    await whatsNewClose.click();
    await page.waitForTimeout(300);
  }
  await page.getByRole('button', { name: '💾 Backup', exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'กู้คืนข้อมูล' }).click();
  await page.waitForTimeout(500);

  const fileInput = page.locator('input[type="file"][accept=".vspsb"]').first();
  await fileInput.setInputFiles(vspsbPath);
  await page.waitForTimeout(1500);
  const previewBody = await page.evaluate(() => document.body.innerText);
  console.log('=== v2 accepted the v1-produced .vspsb file (validation passed) ===', !previewBody.includes('ตรวจสอบไม่ผ่าน') && !previewBody.includes('ไม่สามารถ'));

  const confirmBtn = page.getByRole('button', { name: 'ยืนยันกู้คืนข้อมูล' });
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click();
    console.log('Restoring...');
    await page.waitForTimeout(3000);
    const afterRestoreBody = await page.evaluate(() => document.body.innerText);
    console.log('=== v2 reports restore success ===', afterRestoreBody.includes('กู้คืนสำเร็จ'));
  }

  console.log('--- v2: confirm the v1-created project now exists in v2 after restore ---');
  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click().catch(() => {});
  await page.waitForTimeout(500);
  await page.goto(V2_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const finalBody = await page.evaluate(() => document.body.innerText);
  console.log('=== v2 now shows the project that was created (and only existed) in v1 ===', finalBody.includes(uniqueProjectName));

  console.log('=== CONSOLE ERRORS (whole backup-compat run) ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
