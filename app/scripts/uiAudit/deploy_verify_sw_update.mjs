// Deployment verification (Step 6): service worker update behavior +
// IndexedDB data persistence across reload and an offline cold start,
// against the exact shipped /studio artifact.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

  // First load: install SW, generate a real pattern (writes to IndexedDB).
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const whatsNewClose = page.getByRole('button', { name: 'เข้าใจแล้ว' });
  if (await whatsNewClose.isVisible().catch(() => false)) {
    await whatsNewClose.click();
    await page.waitForTimeout(300);
  }

  const swState1 = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg?.active?.state ?? 'none';
  });
  console.log('=== SW state after first load ===', swState1);

  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '▶ START FACTORY', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: "Approve today's production session", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '✨ Generate Now', exact: true }).click();
  console.log('Waiting for generation...');
  await page.waitForTimeout(26000);
  const galleryBody1 = await page.evaluate(() => document.body.innerText);
  const assetCountMatch = galleryBody1.match(/Gallery \((\d+)\)/);
  console.log('=== Assets generated (Gallery count) ===', assetCountMatch ? assetCountMatch[1] : 'none found');

  const idbCountBefore = await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    return dbs.map((d) => d.name);
  });
  console.log('=== IndexedDB databases present after generation ===', JSON.stringify(idbCountBefore));

  // Reload: SW should stay active (autoUpdate/skipWaiting/clientsClaim), data must survive.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const swState2 = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg?.active?.state ?? 'none';
  });
  console.log('=== SW state after reload ===', swState2);

  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.waitForTimeout(700);
  const galleryBody2 = await page.evaluate(() => document.body.innerText);
  const assetCountAfterReload = galleryBody2.match(/Gallery \((\d+)\)/);
  console.log('=== Assets still present after reload (data survived) ===', assetCountAfterReload ? assetCountAfterReload[1] : galleryBody2.slice(0, 200));

  // Offline cold start: go offline, reload, confirm shell + data still work.
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const offlineBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Offline cold start: app shell loads ===', offlineBody.includes('AI-SBOS'));

  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click().catch(() => {});
  await page.waitForTimeout(700);
  const offlineGalleryBody = await page.evaluate(() => document.body.innerText);
  const offlineAssetCount = offlineGalleryBody.match(/Gallery \((\d+)\)/);
  console.log('=== Data still present offline (user data not wiped) ===', offlineAssetCount ? offlineAssetCount[1] : offlineGalleryBody.slice(0, 200));

  console.log('=== CONSOLE ERRORS (whole run) ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
