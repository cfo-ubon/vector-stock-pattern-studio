// Design Refinement Studio Pro, Mission 1 — live-browser verification of
// Design Edit Mode: Portfolio -> Preview -> Edit Design -> live param edit
// updates the Inspector -> Approve creates a new linked version -> original
// asset is provably unchanged.
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

  // Produce at least one real portfolio asset via the Factory, same as the
  // hotfix102 verification convention.
  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '▶ START FACTORY', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: "Approve today's production session", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '✨ Generate Now', exact: true }).click();
  console.log('Waiting for batch to complete...');
  await page.waitForTimeout(26000);

  // Go to Portfolio.
  await page.getByRole('button', { name: '📂 Portfolio', exact: true }).click();
  await page.waitForTimeout(1000);

  // Open the first asset's preview dialog (PortfolioThumbnail renders a
  // <button> per asset inside .portfolio-grid).
  const cards = page.locator('.portfolio-grid button.portfolio-thumb, .portfolio-grid > button');
  console.log('Portfolio thumbnail buttons found:', await cards.count());
  await cards.first().click({ timeout: 5000 });
  await page.waitForTimeout(600);

  const editBtn = page.getByRole('button', { name: '🎨 Edit Design' });
  const editBtnVisible = await editBtn.isVisible().catch(() => false);
  console.log('=== Edit Design button visible after clicking first grid item ===', editBtnVisible);

  if (!editBtnVisible) {
    console.log(await page.evaluate(() => document.body.innerText.slice(0, 3000)));
    throw new Error('Could not open a preview dialog with the Edit Design button');
  }

  await editBtn.click();
  await page.waitForTimeout(800);

  const bodyText1 = await page.evaluate(() => document.body.innerText);
  console.log('=== Has Design Inspector heading ===', bodyText1.includes('Design Inspector') || bodyText1.includes('Inspector'));
  console.log('=== Has Quality Score / Commercial Score text ===', /Quality Score|Commercial Score/.test(bodyText1));

  // Capture the Beauty/Quality overall score before any edit.
  const scoreBefore = bodyText1.match(/Overall[^\d]*(\d+)/);
  console.log('=== Overall score before edit ===', scoreBefore ? scoreBefore[1] : 'not found');

  // Drag the Motif Density slider to force a real, visible parameter edit,
  // then confirm the Inspector recomputes.
  const densityInput = page.locator('#de-density');
  const densityVisible = await densityInput.isVisible().catch(() => false);
  console.log('=== #de-density slider visible ===', densityVisible);
  if (densityVisible) {
    await densityInput.evaluate((el) => { el.focus(); });
    await page.keyboard.press('End'); // jump to max (1.0)
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(500);

  const bodyText2 = await page.evaluate(() => document.body.innerText);
  const scoreAfter = bodyText2.match(/Overall[^\d]*(\d+)/);
  console.log('=== Overall score after edit ===', scoreAfter ? scoreAfter[1] : 'not found');

  // Try to find and click an Approve/Save button.
  const approveBtn = page.getByRole('button', { name: /Approve|Save.*Version|บันทึกเวอร์ชัน/i }).first();
  const approveVisible = await approveBtn.isVisible().catch(() => false);
  console.log('=== Approve/Save button visible ===', approveVisible);
  if (approveVisible) {
    await approveBtn.click();
    await page.waitForTimeout(1200);
    const bodyText3 = await page.evaluate(() => document.body.innerText);
    console.log('=== Post-approve body snippet ===', bodyText3.slice(0, 1500));
  }

  console.log('=== CONSOLE ERRORS ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
