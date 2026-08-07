// Design Refinement Studio Pro, Mission 2 — live-browser verification of
// AI Design Coach + Commercial Revalidation: Portfolio -> Preview -> Edit
// Design -> confirm Coach advice renders and updates with edits -> Approve
// -> confirm Commercial Revalidation runs and reports a real score/band.
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
  console.log('Portfolio thumbnail buttons found:', await cards.count());
  await cards.first().click({ timeout: 5000 });
  await page.waitForTimeout(600);

  await page.getByRole('button', { name: '🎨 Edit Design' }).click();
  await page.waitForTimeout(800);

  const bodyBefore = await page.evaluate(() => document.body.innerText);
  console.log('=== Has AI Design Coach heading ===', bodyBefore.includes('AI Design Coach'));

  // Force a mechanical, low-jitter edit -- likely to trigger at least one
  // real detected problem/issue so the Coach has something real to say.
  await page.locator('#de-rotation').evaluate((el) => { el.focus(); });
  await page.keyboard.press('Home'); // jump to 0 (min)
  await page.waitForTimeout(150);
  await page.locator('#de-scale-jitter').evaluate((el) => { el.focus(); });
  await page.keyboard.press('Home');
  await page.waitForTimeout(600);

  const bodyAfterEdit = await page.evaluate(() => document.body.innerText);
  const coachSection = bodyAfterEdit.split('AI Design Coach')[1]?.slice(0, 800) ?? '(not found)';
  console.log('=== AI Design Coach section after low-jitter edit ===');
  console.log(coachSection);

  const approveBtn = page.getByRole('button', { name: /Approve/i }).first();
  const approveVisible = await approveBtn.isVisible().catch(() => false);
  console.log('=== Approve button visible ===', approveVisible);
  if (approveVisible) {
    await approveBtn.click();
    await page.waitForTimeout(600);
    console.log('=== Waiting for Commercial Revalidation... ===');
    await page.waitForTimeout(1500);
    const bodyAfterApprove = await page.evaluate(() => document.body.innerText);
    const revalMatch = bodyAfterApprove.match(/Commercial Revalidation[^\n]*/);
    console.log('=== Revalidation line ===', revalMatch ? revalMatch[0] : 'NOT FOUND');
    const revalError = bodyAfterApprove.match(/ตรวจสอบ Commercial Readiness[^\n]*/);
    console.log('=== Revalidation error line (should be none) ===', revalError ? revalError[0] : 'none');
  }

  console.log('=== CONSOLE ERRORS ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
