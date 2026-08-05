// Hotfix v1.0.2, BUG-006 verification: Escape-to-close + focus-into-dialog
// on AssetPreviewDialog (one of the 6 dialogs that previously lacked it).
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = 'http://localhost:5183/vector-stock-pattern-studio/studio/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '▶ START FACTORY', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: "Approve today's production session", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '✨ Generate Now', exact: true }).click();
  await page.waitForTimeout(26000);

  await page.getByRole('button', { name: '📂 Portfolio', exact: true }).click();
  await page.waitForTimeout(1200);

  const firstThumb = page.locator('.portfolio-thumb').first();
  console.log('=== portfolio thumb count ===', await firstThumb.count());
  await firstThumb.click();
  await page.waitForTimeout(500);

  const dialogCount = await page.getByRole('dialog').count();
  console.log('=== dialog open ===', dialogCount);

  const focusInsideDialog = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return dialog ? dialog.contains(document.activeElement) : false;
  });
  console.log('=== FOCUS MOVED INTO DIALOG ON OPEN (BUG-006) ===', focusInsideDialog);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const dialogCountAfterEscape = await page.getByRole('dialog').count();
  console.log('=== DIALOG COUNT AFTER ESCAPE (should be 0) ===', dialogCountAfterEscape);

  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
