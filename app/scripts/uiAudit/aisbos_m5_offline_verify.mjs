// AI-SBOS Mission, Milestone 5 — Part 11 offline verification. Loads the
// real production /studio build once online (installs the service
// worker), goes fully offline, then exercises AI-SBOS branding, Version
// Center, Today's Production Workspace (Gallery/Export/Download), and
// Portfolio's new tabs -- all with zero network access.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message}`));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const swState = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg?.active?.state ?? 'none';
  });
  console.log('=== SERVICE WORKER STATE (online) ===', swState);

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const shellBody = await page.evaluate(() => document.body.innerText);
  console.log('=== APP SHELL LOADED OFFLINE ===', shellBody.includes('AI-SBOS'));
  console.log('=== AI-SBOS branding visible offline ===', shellBody.includes('AI Stock Business Operating System'));

  const whatsNewClose = page.getByRole('button', { name: 'เข้าใจแล้ว' });
  if (await whatsNewClose.isVisible().catch(() => false)) {
    console.log('=== What\'s New dialog works offline ===', true);
    await whatsNewClose.click();
    await page.waitForTimeout(300);
  }

  // Version Center offline.
  await page.locator('.app-version-badge').click();
  await page.waitForTimeout(500);
  const vcBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Version Center opens offline ===', vcBody.includes('About AI-SBOS'));
  console.log('=== Offline Status correctly shows Offline ===', /🔴 Offline/.test(vcBody));
  await page.getByRole('button', { name: 'ปิด', exact: true }).click();
  await page.waitForTimeout(300);

  // Today's Production Workspace offline: full Generate -> Gallery -> Export -> Download.
  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '▶ START FACTORY', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: "Approve today's production session", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '✨ Generate Now', exact: true }).click();
  console.log('Waiting for offline generation...');
  await page.waitForTimeout(26000);

  const galleryBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Preview Gallery auto-shown offline ===', /Gallery \(\d+\)/.test(galleryBody));

  const checkboxes = page.locator('.pe-gallery-select input[type="checkbox"]');
  if ((await checkboxes.count()) >= 1) {
    await checkboxes.nth(0).check();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Export ที่เลือก/ }).click();
    await page.waitForTimeout(600);
    const marketplaceCheckboxes = page.locator('.portfolio-modal input[type="checkbox"]');
    if ((await marketplaceCheckboxes.count()) > 0) {
      await marketplaceCheckboxes.first().check();
      await page.locator('.portfolio-modal button.btn--primary').last().click();
      console.log('Waiting for offline export...');
      await page.waitForTimeout(3000);
      const afterExportBody = await page.evaluate(() => document.body.innerText);
      console.log('=== Marketplace Export + Download Center work offline ===', /ดาวน์โหลด|Download/i.test(afterExportBody));

      const downloadCenterCloseBtn = page.getByRole('dialog', { name: 'Download Center' }).getByRole('button', { name: 'ปิด' });
      if (await downloadCenterCloseBtn.isVisible().catch(() => false)) {
        await downloadCenterCloseBtn.click();
        await page.waitForTimeout(300);
      }
    }
  }

  // Portfolio's new Analytics tab offline.
  await page.getByRole('button', { name: '📂 Portfolio', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '📊 Analytics' }).click();
  await page.waitForTimeout(500);
  const analyticsBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Portfolio Analytics tab works offline ===', analyticsBody.includes('ทั้งหมด'));

  console.log('=== CONSOLE ERRORS (offline run) ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
