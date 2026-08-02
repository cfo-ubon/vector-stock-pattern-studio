// Mission 8 — one-off exploration: "Generate Now" full run inside Factory (online).
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = process.argv[2] || 'http://localhost:5183/vector-stock-pattern-studio/studio/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  page.on('console', (msg) => console.log(`[console:${msg.type()}]`, msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.getByRole('button', { name: '▶ START FACTORY', exact: true }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: "Approve today's production session", exact: true }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: '✨ Generate Now', exact: true }).click();

  console.log('--- Generate Now clicked, polling for 40s ---');
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(2000);
    const tabsState = await page.locator('button:has-text("Running"), button:has-text("QA"), button:has-text("Packaging"), button:has-text("Completed")').evaluateAll(
      (els) => els.map((e) => ({ text: e.textContent, active: e.className.includes('active') || e.getAttribute('aria-current') }))
    );
    const bodyText = await page.locator('body').innerText();
    console.log(`poll ${i}: snippet:`, bodyText.slice(0, 400).replace(/\n/g, ' | '));
  }
  await page.screenshot({ path: '/tmp/mission8_explore9_final.png', fullPage: true });

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
