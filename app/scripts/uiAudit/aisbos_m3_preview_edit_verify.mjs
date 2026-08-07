// AI-SBOS Mission, Milestone 3 — verifies the Gallery's Preview and Edit
// buttons specifically (not exercised by the main M3 export-flow script).
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
  console.log('Waiting for generation to complete...');
  await page.waitForTimeout(26000);

  // --- Preview button ---
  await page.locator('.pe-gallery-card').first().getByText('👁 Preview').click();
  await page.waitForTimeout(600);
  const previewBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Preview dialog opened from Gallery ===', previewBody.includes('Commercial Score'));
  console.log('=== Preview dialog shows Export button ===', previewBody.includes('📤 Export'));
  await page.getByText('ปิด', { exact: true }).first().click();
  await page.waitForTimeout(400);

  // --- Edit button ---
  await page.locator('.pe-gallery-card').first().getByText('🎨 Edit').click();
  await page.waitForTimeout(800);
  const editBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Design Edit Mode opened from Gallery ===', editBody.includes('Edit Design'));
  console.log('=== AI Design Coach visible ===', editBody.includes('AI Design Coach'));

  console.log('=== CONSOLE ERRORS ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
