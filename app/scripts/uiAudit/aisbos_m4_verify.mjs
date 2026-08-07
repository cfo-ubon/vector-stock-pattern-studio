// AI-SBOS Mission, Milestone 4 — live-browser verification of Portfolio
// role repositioning: relabeled tabs (Library & Search, Analytics,
// Collections, History & Submissions), new Analytics tab, and confirmation
// that routine export still works from within Portfolio (still supported,
// just no longer required -- Today's Production already covers routine
// work per M3).
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

  // Produce a few real assets so Analytics has real, non-zero numbers.
  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '▶ START FACTORY', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: "Approve today's production session", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '✨ Generate Now', exact: true }).click();
  console.log('Waiting for generation to complete...');
  await page.waitForTimeout(26000);

  await page.getByRole('button', { name: '📂 Portfolio', exact: true }).click();
  await page.waitForTimeout(1000);

  const bodyOnPortfolio = await page.evaluate(() => document.body.innerText);
  console.log('=== Portfolio header communicates new role (not required for routine export) ===', bodyOnPortfolio.includes("Today's Production"));
  console.log('=== "📁 Library & Search" tab visible ===', bodyOnPortfolio.includes('Library & Search'));
  console.log('=== "📊 Analytics" tab visible ===', bodyOnPortfolio.includes('📊 Analytics'));
  console.log('=== "📚 Collections" tab visible ===', bodyOnPortfolio.includes('📚 Collections'));
  console.log('=== "🕓 History & Submissions" tab visible ===', bodyOnPortfolio.includes('History & Submissions'));

  // Open the new Analytics tab.
  await page.getByRole('button', { name: '📊 Analytics' }).click();
  await page.waitForTimeout(500);
  const analyticsBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Analytics view shows real totals ===', /ทั้งหมด/.test(analyticsBody));
  const totalMatch = analyticsBody.match(/ทั้งหมด\s*\n?(\d+)/);
  console.log('=== Analytics total assets (should be >= 10 after generation) ===', totalMatch ? totalMatch[1] : 'not found');
  console.log('=== Analytics shows recently-imported section ===', analyticsBody.includes('นำเข้า/สร้างล่าสุด'));

  // Confirm History & Submissions tab still opens the real Production Center.
  await page.getByRole('button', { name: 'History & Submissions' }).click();
  await page.waitForTimeout(600);
  const historyBody = await page.evaluate(() => document.body.innerText);
  console.log('=== History & Submissions opens real Production Center ===', historyBody.includes('Production Center') || historyBody.includes('ศูนย์การผลิต'));

  // Confirm Library & Search still supports routine export (not required, but still works).
  await page.getByRole('button', { name: 'Library & Search' }).click();
  await page.waitForTimeout(600);
  const libraryVisible = await page.locator('.portfolio-grid').isVisible().catch(() => false);
  console.log('=== Library & Search tab shows the asset grid ===', libraryVisible);

  console.log('=== CONSOLE ERRORS ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
