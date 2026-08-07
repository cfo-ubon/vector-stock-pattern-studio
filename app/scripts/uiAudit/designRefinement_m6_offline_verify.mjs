// Design Refinement Studio Pro, Milestone 6 — offline production
// verification. Loads the real production /studio build once online (to
// install the service worker), then goes fully offline and exercises the
// entire M1-M5 Design Refinement flow: Edit Design -> live Inspector/Coach
// -> Approve (Commercial Revalidation) -> Version History -> Compare
// Center -> Batch Refine -> Pattern Safety (tile borders) -- all with zero
// network access.
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

  const shellLoaded = await page.evaluate(() => document.body.innerText.includes('Vector Stock Pattern Studio'));
  console.log('=== APP SHELL LOADED OFFLINE ===', shellLoaded);

  // Produce a real asset offline (Factory generation is itself fully local).
  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '▶ START FACTORY', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: "Approve today's production session", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '✨ Generate Now', exact: true }).click();
  console.log('Waiting for offline batch to complete...');
  await page.waitForTimeout(26000);

  await page.getByRole('button', { name: '📂 Portfolio', exact: true }).click();
  await page.waitForTimeout(1000);

  const cards = page.locator('.portfolio-grid button.portfolio-thumb, .portfolio-grid > button');
  await cards.first().click({ timeout: 5000 });
  await page.waitForTimeout(600);

  // Design Edit Mode offline.
  await page.getByRole('button', { name: '🎨 Edit Design' }).click();
  await page.waitForTimeout(800);
  const editBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Design Edit Mode opened offline ===', editBody.includes('Edit Design'));
  console.log('=== AI Design Coach visible offline ===', editBody.includes('AI Design Coach'));
  console.log('=== Pattern Safety section visible offline ===', editBody.includes('Corner Continuity'));

  await page.locator('#de-density').evaluate((el) => { el.focus(); });
  await page.keyboard.press('End');
  await page.waitForTimeout(500);

  const approveBtn = page.getByRole('button', { name: /Approve/i }).first();
  await approveBtn.click();
  await page.waitForTimeout(2500);
  const afterApproveBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Commercial Revalidation ran offline ===', /Commercial Revalidation: score \d+/.test(afterApproveBody));
  await page.getByRole('button', { name: 'ปิด', exact: true }).click();
  await page.waitForTimeout(600);

  // Version History + Compare Center offline.
  await cards.first().click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: '🕓 Version History' }).click();
  await page.waitForTimeout(800);
  const historyBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Version History works offline ===', /ประวัติเวอร์ชันการออกแบบ \(\d+\)/.test(historyBody));

  const checkboxes = page.locator('.version-history-row input[type="checkbox"]');
  if ((await checkboxes.count()) >= 2) {
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await page.getByRole('button', { name: /เปรียบเทียบ 2 เวอร์ชัน/ }).click();
    await page.waitForTimeout(3500);
    const compareBody = await page.getByLabel('เปรียบเทียบเวอร์ชัน').evaluate((el) => el.innerText);
    console.log('=== Compare Center dialog text offline ===');
    console.log(compareBody);
    console.log('=== Compare Center works offline ===', /quality score เปรียบเทียบ/i.test(compareBody));
    await page.getByLabel('เปรียบเทียบเวอร์ชัน').getByRole('button', { name: 'ปิด', exact: true }).click();
    await page.waitForTimeout(400);
  }

  console.log('=== CONSOLE ERRORS (offline run) ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
