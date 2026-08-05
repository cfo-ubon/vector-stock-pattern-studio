import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
const URL = 'http://localhost:5183/vector-stock-pattern-studio/studio/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const downloads = [];
  page.on('download', (d) => downloads.push(d.suggestedFilename()));
  page.on('console', (msg) => { if (msg.type() === 'error') console.log('[console.error]', msg.text()); });

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
  await page.getByRole('button', { name: '📂 Portfolio', exact: true }).click();
  await page.waitForTimeout(1500);
  const checkboxes = page.locator('.portfolio-thumb-checkbox input[type="checkbox"]');
  await checkboxes.nth(0).click();
  await checkboxes.nth(1).click();
  await page.getByRole('button', { name: '📤 Export', exact: true }).click();
  await page.waitForTimeout(500);
  const dialog = page.getByRole('dialog');
  await dialog.locator('label', { hasText: 'Shutterstock' }).locator('input[type="checkbox"]').click();
  await dialog.getByRole('button', { name: /^Export ไปยัง/ }).click();
  await page.waitForTimeout(5000);

  const downloadZipBtn = page.getByRole('button', { name: 'ดาวน์โหลด ZIP' }).first();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }).catch((e) => ({ error: String(e) })),
    downloadZipBtn.click(),
  ]);
  if (download && download.suggestedFilename) {
    console.log('=== DOWNLOAD TRIGGERED ===', download.suggestedFilename());
    const path = await download.path();
    console.log('=== SAVED TO ===', path);
    const fs = await import('node:fs');
    const stat = fs.statSync(path);
    console.log('=== FILE SIZE BYTES ===', stat.size);
  } else {
    console.log('=== DOWNLOAD FAILED ===', JSON.stringify(download));
  }

  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
