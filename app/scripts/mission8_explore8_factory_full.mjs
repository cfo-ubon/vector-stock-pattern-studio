// Mission 8 — one-off exploration: full Factory run (Start -> Approve -> wait for completion), online.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = process.argv[2] || 'http://localhost:5183/vector-stock-pattern-studio/studio/';

async function dump(page, label) {
  await page.waitForTimeout(500);
  const headings = await page.locator('h1,h2,h3').allTextContents();
  console.log(`\n##### ${label} #####`);
  console.log('HEADINGS:', JSON.stringify(headings));
  const safeName = label.replace(/[^a-zA-Z0-9]/g, '_');
  await page.screenshot({ path: `/tmp/mission8_explore8_${safeName}.png`, fullPage: true });
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  page.on('console', (msg) => console.log(`[console:${msg.type()}]`, msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.getByRole('button', { name: '▶ START FACTORY', exact: true }).click();
  await page.waitForTimeout(1500);
  await dump(page, 'waiting_approval');

  const approveBtn = page.getByRole('button', { name: "Approve today's production session", exact: true });
  if (await approveBtn.count()) {
    await approveBtn.click();
    console.log('--- approved, polling for up to 30s ---');
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(2000);
      const headings = await page.locator('h1,h2,h3').allTextContents();
      const bodyText = await page.locator('body').innerText();
      console.log(`poll ${i}:`, JSON.stringify(headings), '| snippet:', bodyText.slice(0, 200).replace(/\n/g, ' '));
    }
  }
  await dump(page, 'factory_final_state');

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
