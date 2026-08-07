// Deployment verification (continued): generates a real pattern via
// Today's Production, then confirms the Design Refinement entry point
// ("Edit" -> Design Edit Mode) and Marketplace Export dialog are both
// reachable from the shipped /studio artifact, exactly as a real owner
// would use them.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const whatsNewClose = page.getByRole('button', { name: 'เข้าใจแล้ว' });
  if (await whatsNewClose.isVisible().catch(() => false)) {
    await whatsNewClose.click();
    await page.waitForTimeout(300);
  }

  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '▶ START FACTORY', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: "Approve today's production session", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '✨ Generate Now', exact: true }).click();
  console.log('Waiting for generation...');
  await page.waitForTimeout(26000);

  const galleryBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Gallery shown after generation ===', /Gallery \(\d+\)/.test(galleryBody));

  // Design Refinement entry point: the per-card "Edit" button in the Gallery.
  const editButtons = page.getByRole('button', { name: /Edit/ });
  const editCount = await editButtons.count();
  console.log('=== Gallery Edit buttons found ===', editCount);
  if (editCount > 0) {
    await editButtons.first().click();
    await page.waitForTimeout(1000);
    const editBody = await page.evaluate(() => document.body.innerText);
    console.log('=== Design Edit Mode opened (Design Refinement entry point) ===', /Design Inspector|Quality Score|Approve/i.test(editBody));
    // Close back out.
    const backBtn = page.getByRole('button', { name: /กลับ|Back|ปิด/ }).first();
    await backBtn.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // Marketplace export UX from the Gallery.
  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click().catch(() => {});
  await page.waitForTimeout(500);
  const checkboxes = page.locator('.pe-gallery-select input[type="checkbox"]');
  const checkboxCount = await checkboxes.count();
  console.log('=== Gallery checkboxes available for marketplace export ===', checkboxCount);
  if (checkboxCount > 0) {
    await checkboxes.first().check();
    await page.waitForTimeout(300);
    const exportBtn = page.getByRole('button', { name: /Export ที่เลือก/ });
    await exportBtn.click().catch(() => {});
    await page.waitForTimeout(600);
    const marketplaceDialogVisible = await page.locator('.portfolio-modal').isVisible().catch(() => false);
    console.log('=== Marketplace selection dialog opened ===', marketplaceDialogVisible);
    const marketplaceNames = await page.evaluate(() => document.body.innerText);
    console.log('=== Named marketplaces present (Shutterstock/Adobe Stock/Freepik/Getty/Etsy) ===',
      ['Shutterstock', 'Adobe Stock', 'Freepik', 'Getty', 'Etsy'].every((m) => marketplaceNames.includes(m)));
  }

  console.log('=== CONSOLE ERRORS ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
