// Design Refinement Studio Pro, Mission 5 — live-browser verification of
// Pattern Safety: repeat preview (pre-existing), the new tile-border
// overlay toggle, and the Inspector's Pattern Safety section.
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

  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '▶ START FACTORY', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: "Approve today's production session", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '✨ Generate Now', exact: true }).click();
  console.log('Waiting for batch to complete...');
  await page.waitForTimeout(26000);

  await page.getByRole('button', { name: '📂 Portfolio', exact: true }).click();
  await page.waitForTimeout(1000);

  const cards = page.locator('.portfolio-grid button.portfolio-thumb, .portfolio-grid > button');
  await cards.first().click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: '🎨 Edit Design' }).click();
  await page.waitForTimeout(800);

  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('=== Has Pattern Safety section ===', bodyText.includes('Pattern Safety'));
  console.log('=== Has Corner Continuity row ===', bodyText.includes('Corner Continuity'));
  console.log('=== Clean-state message shown (expected for a normal fresh pattern) ===', bodyText.includes('ไม่พบความเสี่ยงรอยต่อที่มุม tile'));

  // Repeat preview (pre-existing) still works.
  await page.getByRole('button', { name: '3×3 (เช็ค seamless)' }).click();
  await page.waitForTimeout(300);
  const svgViewBoxAt3x3 = await page.locator('.preview-svg').first().getAttribute('viewBox');
  console.log('=== 3x3 repeat preview viewBox (should be 3x tile size in both dims) ===', svgViewBoxAt3x3);

  // Tile-border overlay toggle.
  const borderToggle = page.getByRole('button', { name: /แสดงเส้นขอบ Tile/ });
  console.log('=== Tile-border toggle visible ===', await borderToggle.isVisible().catch(() => false));
  await borderToggle.click();
  await page.waitForTimeout(300);
  const borderRectCount = await page.locator('.tile-border-overlay rect').count();
  console.log('=== Border rects rendered after enabling toggle at 3x3 (expect 9) ===', borderRectCount);

  await borderToggle.click();
  await page.waitForTimeout(300);
  const borderRectCountAfterOff = await page.locator('.tile-border-overlay').count();
  console.log('=== Border overlay element present after disabling toggle (expect 0) ===', borderRectCountAfterOff);

  console.log('=== CONSOLE ERRORS ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
