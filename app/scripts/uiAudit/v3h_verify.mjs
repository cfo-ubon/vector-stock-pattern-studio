// AI-SBOS v3, Milestone 22/24/23 verification (V3-H):
// (1) Offline cold-boot for all four apps (Selector, v1, v2, v3) — each in
//     a fresh browser profile, matching the same pattern Mission B's own
//     multiversion_device_offline_verify.mjs already established.
// (2) A REAL create -> backup -> wipe -> restore -> verify test for a
//     v3-approved asset, reusing v2's own Backup Manager (v3 shares the
//     same IndexedDB database/stores — no new backup UI was built for v3,
//     matching the "no isolation needed" conclusion from the architecture
//     audit). Never assumed to work — every step is checked against the
//     real IndexedDB state or real UI text.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import path from 'node:path';
const { chromium } = pkg;

const SELECTOR_URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/';
const V1_URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/v1/';
const V2_URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/v2/';
const V3_URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/v3/';
const DOWNLOAD_DIR = '/tmp/claude-0/-home-user-vector-stock-pattern-studio/89000801-5ee0-574e-8681-79d83ff64216/scratchpad';

async function checkOfflineColdBoot(browser, label, url, expectText) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const body = await page.evaluate(() => document.body.innerText);
  const ok = body.includes(expectText);
  console.log(`=== ${label} offline cold boot works === ${ok} | errors: ${JSON.stringify(errors)}`);
  await context.close();
  return ok && errors.length === 0;
}

async function assetExistsBySeedSubstring(page, substring) {
  return page.evaluate(async (needle) => {
    return await new Promise((resolve, reject) => {
      const req = indexedDB.open('vsp-db');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('portfolioAssets')) { db.close(); resolve(false); return; }
        const tx = db.transaction('portfolioAssets', 'readonly');
        const store = tx.objectStore('portfolioAssets');
        const getAll = store.getAll();
        getAll.onsuccess = () => {
          const found = getAll.result.some((a) => (a.generatorSeed || '').includes(needle));
          db.close();
          resolve(found);
        };
        getAll.onerror = () => { db.close(); reject(getAll.error); };
      };
    });
  }, substring);
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let allOk = true;

  console.log('=== PART 1: OFFLINE COLD BOOT (fresh profile each) ===');
  allOk = (await checkOfflineColdBoot(browser, 'Selector', SELECTOR_URL, 'Choose Version')) && allOk;
  allOk = (await checkOfflineColdBoot(browser, 'v1', V1_URL, 'AI-SBOS')) && allOk;
  allOk = (await checkOfflineColdBoot(browser, 'v2', V2_URL, 'AI-SBOS')) && allOk;
  allOk = (await checkOfflineColdBoot(browser, 'v3', V3_URL, 'AI-SBOS')) && allOk;

  console.log('\n=== PART 2: create (v3) -> backup (v2) -> wipe -> restore (v2) -> verify (v3 store) ===');
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

  const uniqueTag = `v3backuptest${Date.now()}`;

  console.log(`--- v3: create a real approved asset (tag: ${uniqueTag}) ---`);
  await page.goto(V3_URL, { waitUntil: 'networkidle' });
  await page.getByLabel('What do you want to create?').fill(`minimal botanical ${uniqueTag}`);
  await page.getByRole('button', { name: 'Analyze & Design' }).click();
  await page.getByRole('heading', { name: 'Design Brief' }).waitFor();
  await page.getByRole('button', { name: 'Generate' }).click();
  await page.getByRole('heading', { name: 'Preview Gallery' }).waitFor({ timeout: 30000 });
  await page.locator('.v3-gallery-card').first().getByRole('button', { name: 'Approve → Commercial QA' }).click();
  await page.waitForTimeout(3000);
  const qaBody = await page.evaluate(() => document.body.innerText);
  console.log('v3 Commercial QA modal reached:', qaBody.includes('Overall:'));

  const existsBeforeWipe = await assetExistsBySeedSubstring(page, uniqueTag);
  console.log('=== v3-approved asset is a real, persisted PortfolioAsset (found in IndexedDB before wipe) ===', existsBeforeWipe);
  if (!existsBeforeWipe) { allOk = false; }

  console.log('--- v2: create a real .vspsb backup containing that asset ---');
  await page.goto(V2_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const whatsNewClose = page.getByRole('button', { name: 'เข้าใจแล้ว' });
  if (await whatsNewClose.isVisible().catch(() => false)) {
    await whatsNewClose.click();
    await page.waitForTimeout(300);
  }
  await page.getByRole('button', { name: '💾 Backup', exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '+ สร้างไฟล์สำรองใหม่' }).click();
  console.log('Building backup archive...');
  await page.waitForTimeout(3000);

  const downloadPromise = page.waitForEvent('download');
  const downloadLink = page.getByText(/ดาวน์โหลดไฟล์/);
  await downloadLink.click();
  const download = await downloadPromise;
  const vspsbPath = path.join(DOWNLOAD_DIR, 'v3h_backup_test.vspsb');
  await download.saveAs(vspsbPath);
  console.log('=== v2 backup (containing v3 asset) downloaded ===', vspsbPath);

  console.log('--- wipe: real indexedDB.deleteDatabase (no in-app "reset all data" UI exists) ---');
  await page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('vsp-db');
    req.onsuccess = () => resolve(undefined);
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(undefined);
  }));
  await page.close();
  const page2 = await context.newPage();
  page2.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page2.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

  await page2.goto(V2_URL, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(1000);
  const existsAfterWipe = await assetExistsBySeedSubstring(page2, uniqueTag);
  console.log('=== after wipe: asset no longer present ===', !existsAfterWipe);
  if (existsAfterWipe) { allOk = false; }

  console.log('--- v2: restore the .vspsb file ---');
  const whatsNewClose2 = page2.getByRole('button', { name: 'เข้าใจแล้ว' });
  if (await whatsNewClose2.isVisible().catch(() => false)) {
    await whatsNewClose2.click();
    await page2.waitForTimeout(300);
  }
  await page2.getByRole('button', { name: '💾 Backup', exact: true }).click();
  await page2.waitForTimeout(500);
  await page2.getByRole('button', { name: 'กู้คืนข้อมูล' }).click();
  await page2.waitForTimeout(500);
  const fileInput = page2.locator('input[type="file"][accept=".vspsb"]').first();
  await fileInput.setInputFiles(vspsbPath);
  await page2.waitForTimeout(1500);
  const confirmBtn = page2.getByRole('button', { name: 'ยืนยันกู้คืนข้อมูล' });
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click();
    console.log('Restoring...');
    await page2.waitForTimeout(3000);
    const afterRestoreBody = await page2.evaluate(() => document.body.innerText);
    console.log('=== v2 reports restore success ===', afterRestoreBody.includes('กู้คืนสำเร็จ'));
  } else {
    console.log('=== FAIL: restore confirm button never appeared ===');
    allOk = false;
  }

  console.log('--- verify: the v3-approved asset exists again after restore ---');
  await page2.goto(V2_URL, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(1000);
  const existsAfterRestore = await assetExistsBySeedSubstring(page2, uniqueTag);
  console.log('=== v3-approved asset restored successfully ===', existsAfterRestore);
  if (!existsAfterRestore) { allOk = false; }

  console.log('\n=== CONSOLE ERRORS (whole v3-h run) ===', JSON.stringify(consoleErrors));
  if (consoleErrors.length > 0) allOk = false;

  await context.close();
  await browser.close();

  console.log(allOk ? '\nV3-H verification PASSED' : '\nV3-H verification FAILED');
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
