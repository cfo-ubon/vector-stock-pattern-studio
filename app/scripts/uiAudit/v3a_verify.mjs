// AI-SBOS v3, Milestone 30-style real-browser check for the V3-A/B slice
// (Version Shell + Keyword Workspace + Keyword Intent + Design Brief).
// Also confirms v1 and v2 remain fully launchable and unaffected — the
// mission's explicit "v3 deployment must not break v1 or v2" requirement.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const SELECTOR_URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/';
const V1_URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/v1/';
const V2_URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/v2/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

  console.log('--- Selector shows v3 card (New) ---');
  await page.goto(SELECTOR_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const selectorBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Selector shows AI-SBOS v3 card ===', selectorBody.includes('AI-SBOS v3'));
  console.log('=== v3 marked New ===', /New/.test(selectorBody));

  console.log('--- Open v3 from Selector ---');
  await page.getByRole('link', { name: 'Open v3' }).click();
  await page.waitForURL('**/studio/v3/**');
  await page.waitForTimeout(800);
  console.log('=== Navigated to /studio/v3/ ===', page.url().includes('/studio/v3/'));

  const v3Body = await page.evaluate(() => document.body.innerText);
  console.log('=== v3 header shows AI-SBOS v3 + tagline ===', v3Body.includes('AI-SBOS v3') && v3Body.includes('Keyword-to-Vector Seamless Factory'));
  console.log('=== Keyword Workspace prompt visible ===', v3Body.includes('What do you want to create?'));

  // Golden workflow: enter keyword -> Analyze & Design -> Design Brief.
  await page.getByPlaceholder('minimal botanical leaves').fill('minimal botanical leaves');
  await page.getByRole('button', { name: 'Analyze & Design' }).click();
  await page.waitForTimeout(300);
  const briefBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Design Brief shown after Analyze ===', briefBody.includes('Design Brief'));
  console.log('=== Design Brief shows the real keyword ===', briefBody.includes('minimal botanical leaves'));
  console.log('=== Design Brief shows a real matched style (Minimal Botanical) ===', briefBody.includes('Minimal Botanical'));
  console.log('=== Design Brief shows non-zero confidence ===', /Confidence/.test(briefBody) && !briefBody.includes('0% ('));

  // Adjust returns to workspace with keyword preserved.
  await page.getByRole('button', { name: 'Adjust' }).click();
  await page.waitForTimeout(300);
  const afterAdjustValue = await page.locator('.v3-keyword-input').inputValue();
  console.log('=== Adjust returns to workspace, keyword preserved ===', afterAdjustValue === 'minimal botanical leaves');

  // Example chip fills the input.
  await page.getByRole('button', { name: 'christmas candy' }).click();
  const afterChip = await page.locator('.v3-keyword-input').inputValue();
  console.log('=== Example chip fills keyword input ===', afterChip === 'christmas candy');

  // Version Center opens and shows required fields.
  await page.locator('.v3-version-badge').click();
  await page.waitForTimeout(300);
  const vcBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Version Center shows Product/Version/Build/Release Date/Commit/Status/What\'s New ===',
    vcBody.includes('Product') && vcBody.includes('Product Version') && vcBody.includes('Build') && vcBody.includes('Release Date') && vcBody.includes('Commit') && vcBody.includes('Status') && vcBody.includes("What's New"));
  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(300);

  // Switch Version returns to Selector.
  await page.getByRole('link', { name: '🔁 Switch Version' }).click();
  await page.waitForURL('**/studio/');
  console.log('=== Switch Version (v3 -> selector) works ===', page.url() === SELECTOR_URL);

  console.log('--- Confirm v1 still fully launchable, unaffected by v3 ---');
  await page.goto(V1_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const v1Body = await page.evaluate(() => document.body.innerText);
  console.log('=== v1 still shows Vector Stock Pattern Studio + v1.5.0 badge ===', v1Body.includes('Vector Stock Pattern Studio') && v1Body.includes('v1.5.0'));

  console.log('--- Confirm v2 still fully launchable, unaffected by v3 ---');
  await page.goto(V2_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const whatsNewClose = page.getByRole('button', { name: 'เข้าใจแล้ว' });
  if (await whatsNewClose.isVisible().catch(() => false)) {
    await whatsNewClose.click();
    await page.waitForTimeout(300);
  }
  const v2Body = await page.evaluate(() => document.body.innerText);
  console.log('=== v2 still shows AI-SBOS branding + version badge ===', v2Body.includes('AI-SBOS') && /AI-SBOS v2\.\d/.test(v2Body));

  console.log('=== CONSOLE ERRORS (whole run) ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
