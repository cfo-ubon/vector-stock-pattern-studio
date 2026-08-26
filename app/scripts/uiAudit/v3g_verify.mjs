// V3-G live verification: Collection Mode (10) + Production Mode (30) +
// Similarity Safety banner + measured elapsed-time readout, in a real
// browser, zero console errors.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const BASE = 'http://localhost:8899/vector-stock-pattern-studio/studio/v3/';
const errors = [];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));

async function runBatch(keyword, radioLabel, expectedCount) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByLabel('What do you want to create?').fill(keyword);
  await page.getByRole('button', { name: 'Analyze & Design' }).click();
  await page.getByRole('heading', { name: 'Design Brief' }).waitFor();
  if (radioLabel) {
    await page.getByRole('radio', { name: radioLabel }).check();
  }
  const start = Date.now();
  await page.getByRole('button', { name: 'Generate' }).click();
  await page.getByRole('heading', { name: 'Preview Gallery' }).waitFor({ timeout: 30000 });
  const wallMs = Date.now() - start;
  const cards = await page.locator('.v3-gallery-card').count();
  const elapsedText = await page.locator('.v3-hint', { hasText: 'Generated' }).first().textContent().catch(() => null);
  const banner = await page.locator('.v3-similarity-banner').count();
  const bannerText = banner > 0 ? await page.locator('.v3-similarity-banner').first().textContent() : null;
  console.log(`[${keyword} / ${radioLabel ?? 'default 5'}] cards=${cards} expected=${expectedCount} wallMs=${wallMs} elapsedReadout="${elapsedText}" similarityBanner=${banner > 0 ? bannerText : 'none'}`);
  if (cards !== expectedCount) throw new Error(`Expected ${expectedCount} gallery cards, got ${cards}`);
  return { cards, wallMs, elapsedText, bannerText };
}

// Default 5-concept mode (regression check — must still work unchanged).
await runBatch('minimal botanical leaves', null, 5);

// Collection Mode (10).
await runBatch('minimal botanical leaves', '10 (Collection Mode)', 10);

// Production Mode (30).
await runBatch('christmas candy', '30 (Production Mode)', 30);

console.log(`Console/page errors: ${errors.length}`);
if (errors.length > 0) {
  console.log(errors.join('\n'));
}

await browser.close();

if (errors.length > 0) {
  console.error('FAIL: console errors detected');
  process.exit(1);
}
console.log('V3-G verification PASSED');
