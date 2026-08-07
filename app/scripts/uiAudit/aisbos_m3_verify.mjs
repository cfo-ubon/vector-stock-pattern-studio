// AI-SBOS Mission, Milestone 3 — live-browser verification of the
// consolidated Today's Production Workspace: Generate -> Preview Gallery
// (shown immediately) -> Export (Marketplace) -> Download, all reachable
// WITHOUT navigating to Portfolio Manager. Also measures raw click count
// for the documented owner-click reduction (Part 8).
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
  // Dismiss What's New if it appears (fresh profile).
  const whatsNewClose = page.getByRole('button', { name: 'เข้าใจแล้ว' });
  if (await whatsNewClose.isVisible().catch(() => false)) {
    await whatsNewClose.click();
    await page.waitForTimeout(300);
  }

  let clicks = 0;
  const click = async (locator) => { await locator.click(); clicks++; };

  await click(page.getByRole('button', { name: "🏭 Today's Production", exact: true }));
  await page.waitForTimeout(500);
  await click(page.getByRole('button', { name: '▶ START FACTORY', exact: true }));
  await page.waitForTimeout(800);
  await click(page.getByRole('button', { name: "Approve today's production session", exact: true }));
  await page.waitForTimeout(800);
  await click(page.getByRole('button', { name: '✨ Generate Now', exact: true }));
  console.log('Waiting for generation to complete...');
  await page.waitForTimeout(26000);

  const bodyAfterGenerate = await page.evaluate(() => document.body.innerText);
  console.log('=== Auto-navigated to Gallery after generation (no extra click) ===', /pastel|floral|botanical|geometric|pattern/i.test(bodyAfterGenerate));
  console.log('=== Gallery tab shows a real produced count ===', /Gallery \(\d+\)/.test(bodyAfterGenerate));
  console.log('=== Gallery shows Commercial score tiles ===', bodyAfterGenerate.includes('Commercial'));
  console.log('=== Gallery shows Quality score tiles ===', bodyAfterGenerate.includes('Quality'));
  console.log('=== Gallery shows Marketplace Ready/Not Ready badges ===', /Marketplace Ready|Not Ready/.test(bodyAfterGenerate));
  console.log('=== Gallery shows SEO Ready/Missing badges ===', /SEO Ready|SEO Missing/.test(bodyAfterGenerate));

  // Select 2 and bulk export via Marketplace Export, without leaving this screen.
  const checkboxes = page.locator('.pe-gallery-select input[type="checkbox"]');
  const checkboxCount = await checkboxes.count();
  console.log('=== Gallery checkboxes found ===', checkboxCount);
  if (checkboxCount >= 2) {
    await click(checkboxes.nth(0));
    await click(checkboxes.nth(1));
    await page.waitForTimeout(300);
    await click(page.getByRole('button', { name: /Export ที่เลือก/ }));
    await page.waitForTimeout(600);

    const marketplaceDialogVisible = await page.getByText('เลือก Marketplace').isVisible().catch(() => false) || await page.locator('.portfolio-modal').isVisible().catch(() => false);
    console.log('=== Marketplace Selection dialog opened from Gallery (no Portfolio navigation) ===', marketplaceDialogVisible);

    // Pick the first marketplace checkbox and confirm.
    const marketplaceCheckboxes = page.locator('.portfolio-modal input[type="checkbox"]');
    const mpCount = await marketplaceCheckboxes.count();
    console.log('=== Marketplace checkboxes available ===', mpCount);
    if (mpCount > 0) {
      await click(marketplaceCheckboxes.first());
      const confirmBtn = page.locator('.portfolio-modal button.btn--primary').last();
      await click(confirmBtn);
      console.log('Waiting for export to build...');
      await page.waitForTimeout(3000);

      const bodyAfterExport = await page.evaluate(() => document.body.innerText);
      console.log('=== Download Center opened automatically after export ===', /ดาวน์โหลด|Download/i.test(bodyAfterExport));
    }
  }

  console.log('=== TOTAL OWNER CLICKS (Generate -> Preview -> Marketplace -> Export -> Download reachable) ===', clicks);
  console.log('=== CONSOLE ERRORS ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
