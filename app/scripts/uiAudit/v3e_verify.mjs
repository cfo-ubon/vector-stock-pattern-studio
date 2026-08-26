// AI-SBOS v3, V3-E golden-path verification: Refine + AI Design Coach.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const V3_URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/v3/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

  await page.goto(V3_URL, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('minimal botanical leaves').fill('minimal botanical leaves');
  await page.getByRole('button', { name: 'Analyze & Design' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Generate' }).click();
  await page.waitForSelector('.v3-gallery-card', { timeout: 15000 });

  const beforeCount = await page.locator('.v3-gallery-card').count();
  console.log('=== Gallery starts with 5 cards ===', beforeCount === 5);

  await page.getByRole('button', { name: 'Refine' }).first().click();
  await page.waitForTimeout(300);
  const refinePanelBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Refine panel opens with AI Design Coach section ===', refinePanelBody.includes('AI Design Coach'));
  console.log('=== Refine panel shows density/negative space/motif/rotation sliders ===', refinePanelBody.includes('Density:') && refinePanelBody.includes('Negative space:') && refinePanelBody.includes('Motif scale:') && refinePanelBody.includes('Rotation jitter:'));

  // Drag the density slider to a new value.
  const densitySlider = page.locator('.v3-refine-field').filter({ hasText: 'Density:' }).locator('input[type="range"]');
  await densitySlider.fill('0.9');
  await page.waitForTimeout(200);

  await page.getByRole('button', { name: 'Regenerate Version' }).click();
  await page.waitForTimeout(600);

  const afterCount = await page.locator('.v3-gallery-card').count();
  console.log('=== Regenerate Version adds a new card without removing the original (non-destructive) ===', afterCount === beforeCount + 1);

  const galleryBody = await page.evaluate(() => document.body.innerText);
  console.log('=== New version labeled "(refined)" appears alongside the original ===', galleryBody.includes('(refined)'));

  console.log('=== CONSOLE ERRORS (whole run) ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
