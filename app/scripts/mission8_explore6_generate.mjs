// Mission 8 — one-off exploration: classic generator Generate + Export flow (online).
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = process.argv[2] || 'http://localhost:5183/vector-stock-pattern-studio/studio/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  page.on('console', (msg) => console.log(`[console:${msg.type()}]`, msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '⚙️ Advanced Mode', exact: true }).click();
  await page.waitForTimeout(500);

  console.log('--- clicking Generate ---');
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/mission8_explore6_after_generate.png', fullPage: true });

  const svgCount = await page.locator('svg').count();
  console.log('svg count after generate:', svgCount);

  console.log('--- attempting export (SVG) with download listener ---');
  const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch((e) => null);
  await page.getByRole('button', { name: 'Export single tile (.svg, 3000px)', exact: true }).click();
  const download = await downloadPromise;
  if (download) {
    console.log('DOWNLOAD SUGGESTED FILENAME:', download.suggestedFilename());
    const path = '/tmp/mission8_export_test.svg';
    await download.saveAs(path);
    console.log('saved to', path);
  } else {
    console.log('NO DOWNLOAD EVENT CAPTURED within timeout');
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/mission8_explore6_after_export.png', fullPage: true });

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
