// Hotfix v1.0.2, Part 1 verification: New Session -> Generate -> Commercial
// Ready -> Export must PASS (BUG-001 fix: generatorVersion now populated).
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = 'http://localhost:5183/vector-stock-pattern-studio/studio/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

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

  await page.getByRole('button', { name: /^Export/ }).click();
  await page.waitForTimeout(1000);

  const dashboardText = await page.evaluate(() => document.body.innerText);
  const readyMatch = dashboardText.match(/(\d+)\s*Ready/i);
  const blockedMatch = dashboardText.match(/(\d+)\s*Blocked/i);
  console.log('=== EXPORT READINESS DASHBOARD (post-fix) ===');
  console.log('Ready count seen:', readyMatch ? readyMatch[1] : 'not found');
  console.log('Blocked count seen:', blockedMatch ? blockedMatch[1] : 'not found');

  // Now check the Commercial Package Builder's readiness checklist for a
  // freshly-produced asset specifically (select the last option -- the
  // most recently produced batch item, matching the BUG-010 fix too).
  const select = page.locator('select').first();
  const optionCount = await select.locator('option').count();
  if (optionCount > 0) {
    await select.selectOption({ index: 0 });
    await page.waitForTimeout(500);
    const checklistText = await page.evaluate(() => document.body.innerText);
    const genLine = checklistText.split('\n').find((l) => l.includes('Generator completed'));
    console.log('=== Generator completed check line ===');
    console.log(genLine ?? 'NOT FOUND');
    const scoreMatch = checklistText.match(/(\d+)% ?—? ?(READY|NEEDS_WORK|BLOCKED)/);
    console.log('=== Score/Band ===', scoreMatch ? scoreMatch[0] : 'not found');
  }

  console.log('=== CONSOLE ERRORS ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
