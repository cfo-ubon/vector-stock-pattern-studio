// Hotfix v1.0.2, Part 9: offline re-verification against the real
// production /studio build (service worker must already be installed from
// a prior online visit; then go offline and confirm the Factory pipeline
// still runs, with BUG-001's fix producing a real generatorVersion).
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

  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '▶ START FACTORY', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: "Approve today's production session", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '✨ Generate Now', exact: true }).click();
  console.log('Waiting for offline batch to complete...');
  await page.waitForTimeout(26000);

  await page.getByRole('button', { name: /^Export/ }).click();
  await page.waitForTimeout(1000);
  const select = page.locator('select').first();
  if (await select.locator('option').count() > 0) {
    await select.selectOption({ index: 0 });
    await page.waitForTimeout(500);
    const text = await page.evaluate(() => document.body.innerText);
    const genLine = text.split('\n').find((l) => l.includes('Generator completed'));
    console.log('=== Generator completed check line (offline) ===', genLine ?? 'NOT FOUND');
  }

  console.log('=== CONSOLE ERRORS (offline run) ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
