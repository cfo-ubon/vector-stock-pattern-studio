// AI-SBOS v3, V3-C/D golden-path verification: Keyword -> Design Brief ->
// Generate -> real thumbnails -> Vector/Seamless gate badges -> 3x3
// repeat preview. Real browser, real generation, zero console errors.
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
  await page.waitForTimeout(500);

  await page.getByPlaceholder('minimal botanical leaves').fill('minimal botanical leaves');
  await page.getByRole('button', { name: 'Analyze & Design' }).click();
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: 'Generate' }).click();
  console.log('Generating real vector concepts...');
  await page.waitForSelector('.v3-gallery-card', { timeout: 15000 });
  await page.waitForTimeout(500);

  const galleryBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Preview Gallery shows 5 concept cards ===', (await page.locator('.v3-gallery-card').count()) === 5);
  console.log('=== Cards show distinct concept labels ===', ['Airy Scattered', 'Dense All-Over', 'Elegant Line Repeat', 'Organic Toss', 'Geometric Arrangement'].every((l) => galleryBody.includes(l)));
  console.log('=== Cards show real vector/seamless gate badges ===', /VECTOR PASS|VECTOR BLOCKED/.test(galleryBody) && /SEAMLESS PASS|SEAMLESS BLOCKED/.test(galleryBody));

  const svgCount = await page.locator('.v3-tile-preview').count();
  const firstSvgHasContent = await page.locator('.v3-tile-preview').first().evaluate((el) => el.querySelectorAll('*').length > 5);
  console.log('=== Each card renders a real, non-empty SVG thumbnail (not just Pattern ID) ===', svgCount === 5 && firstSvgHasContent);

  await page.getByRole('button', { name: 'Open 3×3 preview' }).first().click();
  await page.waitForTimeout(400);
  const modalVisible = await page.locator('.v3-modal--wide').isVisible();
  const modalSvgContent = await page.locator('.v3-modal--wide .v3-tile-preview').evaluate((el) => el.querySelectorAll('*').length > 5);
  console.log('=== 3x3 repeat preview dialog opens with real rendered content ===', modalVisible && modalSvgContent);

  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '← Adjust keyword' }).click();
  await page.waitForTimeout(300);
  console.log('=== Adjust from Gallery returns to Keyword Workspace ===', await page.getByPlaceholder('minimal botanical leaves').isVisible());

  console.log('=== CONSOLE ERRORS (whole run) ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
