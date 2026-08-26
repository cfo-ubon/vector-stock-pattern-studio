// AI-SBOS v3, Milestone 27 (Responsive UX) + Milestone 28 (Accessibility)
// live verification. Real Playwright, real viewport sizes, real keyboard
// interaction — not assumed from the shared CSS/hook being reused.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const V3_URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/v3/';

const DEVICES = [
  { name: 'Desktop', width: 1920, height: 1080 },
  { name: 'Laptop', width: 1366, height: 768 },
  { name: 'iPad Landscape', width: 1112, height: 834 },
  { name: 'iPad Portrait', width: 834, height: 1112 },
];

let allOk = true;

async function checkDevice(browser, device) {
  const context = await browser.newContext({ viewport: { width: device.width, height: device.height } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));

  console.log(`\n=== ${device.name} (${device.width}x${device.height}) ===`);
  await page.goto(V3_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  let overflow = (await page.evaluate(() => document.body.scrollWidth)) <= device.width + 5;
  console.log('Workspace: no horizontal overflow:', overflow);

  await page.getByLabel('What do you want to create?').fill('minimal botanical leaves');
  await page.getByRole('button', { name: 'Analyze & Design' }).click();
  await page.getByRole('heading', { name: 'Design Brief' }).waitFor();
  await page.waitForTimeout(300);
  const briefOverflow = (await page.evaluate(() => document.body.scrollWidth)) <= device.width + 5;
  console.log('Design Brief: no horizontal overflow:', briefOverflow);

  await page.getByRole('button', { name: 'Generate' }).click();
  await page.getByRole('heading', { name: 'Preview Gallery' }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(300);
  const galleryOverflow = (await page.evaluate(() => document.body.scrollWidth)) <= device.width + 5;
  console.log('Gallery: no horizontal overflow:', galleryOverflow);

  const ok = overflow && briefOverflow && galleryOverflow && errors.length === 0;
  console.log('Console errors:', errors.length);
  await context.close();
  return ok;
}

async function checkModalAccessibility(browser) {
  console.log('\n=== ACCESSIBILITY: Escape-to-close + focus-into-dialog on all 3 v3 modals ===');
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));

  await page.goto(V3_URL, { waitUntil: 'networkidle' });
  await page.getByLabel('What do you want to create?').fill('minimal botanical leaves');
  await page.getByRole('button', { name: 'Analyze & Design' }).click();
  await page.getByRole('heading', { name: 'Design Brief' }).waitFor();
  await page.getByRole('button', { name: 'Generate' }).click();
  await page.getByRole('heading', { name: 'Preview Gallery' }).waitFor({ timeout: 30000 });

  // 3x3 preview modal.
  await page.locator('.v3-gallery-card').first().getByRole('button', { name: 'Open 3×3 preview' }).click();
  await page.locator('.v3-modal--wide').waitFor();
  const previewFocused = await page.evaluate(() => document.activeElement?.classList.contains('v3-modal-backdrop'));
  console.log('3x3 preview modal: focus moved into dialog on open:', previewFocused);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const previewClosed = (await page.locator('.v3-modal--wide').count()) === 0;
  console.log('3x3 preview modal: Escape closes it:', previewClosed);
  if (!previewFocused || !previewClosed) allOk = false;

  // Refine modal.
  await page.locator('.v3-gallery-card').first().getByRole('button', { name: 'Refine' }).click();
  await page.locator('.v3-modal').filter({ hasText: 'Refine' }).waitFor();
  const refineFocused = await page.evaluate(() => document.activeElement?.classList.contains('v3-modal-backdrop'));
  console.log('Refine modal: focus moved into dialog on open:', refineFocused);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const refineClosed = (await page.locator('.v3-modal').filter({ hasText: 'Refine' }).count()) === 0;
  console.log('Refine modal: Escape closes it:', refineClosed);
  if (!refineFocused || !refineClosed) allOk = false;

  // Commercial QA modal.
  const approveButtons = page.locator('.v3-gallery-card').locator('button', { hasText: 'Approve' });
  for (let i = 0; i < (await approveButtons.count()); i++) {
    const btn = approveButtons.nth(i);
    if (await btn.isEnabled()) { await btn.click(); break; }
  }
  await page.locator('.v3-modal-backdrop[aria-label="Commercial QA"]').waitFor();
  const qaFocused = await page.evaluate(() => document.activeElement?.classList.contains('v3-modal-backdrop'));
  console.log('Commercial QA modal: focus moved into dialog on open:', qaFocused);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const qaClosed = (await page.locator('.v3-modal-backdrop[aria-label="Commercial QA"]').count()) === 0;
  console.log('Commercial QA modal: Escape closes it:', qaClosed);
  if (!qaFocused || !qaClosed) allOk = false;

  console.log('Console errors (accessibility run):', errors.length);
  if (errors.length > 0) allOk = false;
  await context.close();
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  for (const device of DEVICES) {
    const ok = await checkDevice(browser, device);
    if (!ok) allOk = false;
  }

  await checkModalAccessibility(browser);

  await browser.close();
  console.log(allOk ? '\nV3 RESPONSIVE + ACCESSIBILITY VERIFICATION: ALL PASSED' : '\nV3 RESPONSIVE + ACCESSIBILITY VERIFICATION: FAILED');
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
