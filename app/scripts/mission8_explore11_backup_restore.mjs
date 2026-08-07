// Mission 8 — one-off exploration: Backup create + Restore flow (online).
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = process.argv[2] || 'http://localhost:5183/vector-stock-pattern-studio/studio/';

async function dump(page, label) {
  await page.waitForTimeout(600);
  console.log(`\n##### ${label} #####`);
  const safeName = label.replace(/[^a-zA-Z0-9]/g, '_');
  await page.screenshot({ path: `/tmp/mission8_explore11_${safeName}.png`, fullPage: true });
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  page.on('console', (msg) => console.log(`[console:${msg.type()}]`, msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '💾 Backup', exact: true }).click();
  await dump(page, 'backup_home');

  console.log('--- creating backup ---');
  await page.getByRole('button', { name: '+ สร้างไฟล์สำรองใหม่', exact: true }).click();
  await page.waitForTimeout(3000);
  await dump(page, 'backup_after_create');

  console.log('--- downloading created backup file ---');
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
  const dlBtn = page.getByRole('button', { name: /^ดาวน์โหลดไฟล์/ });
  let backupPath = null;
  if (await dlBtn.count()) {
    await dlBtn.click();
    const download = await downloadPromise;
    if (download) {
      backupPath = '/tmp/mission8_backup_test.vspsb';
      await download.saveAs(backupPath);
      console.log('BACKUP SAVED:', backupPath, 'suggested name:', download.suggestedFilename());
    } else {
      console.log('NO DOWNLOAD EVENT after clicking download button');
    }
  } else {
    console.log('download button not found');
  }

  // Restore tab
  await page.getByRole('button', { name: 'กู้คืนข้อมูล', exact: true }).click();
  await dump(page, 'restore_tab');

  if (backupPath) {
    const fileInput = page.locator('input[type=file]');
    const count = await fileInput.count();
    console.log('file inputs found on restore tab:', count);
    if (count) {
      await fileInput.first().setInputFiles(backupPath);
      await dump(page, 'restore_after_file_selected');
    }
  }

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
