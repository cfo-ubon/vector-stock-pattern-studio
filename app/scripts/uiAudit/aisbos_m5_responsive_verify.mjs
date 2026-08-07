// AI-SBOS Mission, Milestone 5 — Part 13 device verification: Desktop,
// Laptop, iPad Portrait, iPad Landscape. Confirms the AI-SBOS header,
// Today's Production Gallery, and Portfolio tabs all render usably at
// each width, with zero console errors.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = 'http://localhost:5183/vector-stock-pattern-studio/studio/';

const DEVICES = [
  { name: 'Desktop', width: 1920, height: 1080 },
  { name: 'Laptop', width: 1366, height: 768 },
  { name: 'iPad Portrait', width: 834, height: 1112 },
  { name: 'iPad Landscape', width: 1112, height: 834 },
];

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let anyErrors = false;

  for (const device of DEVICES) {
    const context = await browser.newContext({ viewport: { width: device.width, height: device.height } });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const whatsNewClose = page.getByRole('button', { name: 'เข้าใจแล้ว' });
    if (await whatsNewClose.isVisible().catch(() => false)) {
      await whatsNewClose.click();
      await page.waitForTimeout(300);
    }

    console.log(`\n=== ${device.name} (${device.width}x${device.height}) ===`);

    // Header + identity bar visible without horizontal scroll.
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = device.width;
    console.log('No horizontal overflow:', bodyScrollWidth <= viewportWidth + 5);

    const versionBadgeVisible = await page.locator('.app-version-badge').isVisible().catch(() => false);
    console.log('Version badge visible:', versionBadgeVisible);

    // Portfolio tabs.
    await page.getByRole('button', { name: '📂 Portfolio', exact: true }).click();
    await page.waitForTimeout(600);
    const portfolioBody = await page.evaluate(() => document.body.innerText);
    console.log('Portfolio tabs visible:', portfolioBody.includes('Library & Search') && portfolioBody.includes('Analytics'));

    // Today's Production.
    await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
    await page.waitForTimeout(600);
    const prodVisible = await page.getByRole('heading', { name: "Today's Production" }).isVisible().catch(() => false);
    console.log("Today's Production screen renders:", prodVisible);

    console.log('Console errors:', JSON.stringify(consoleErrors));
    if (consoleErrors.length > 0) anyErrors = true;
    await context.close();
  }

  console.log('\n=== ANY CONSOLE ERRORS ACROSS ALL DEVICES ===', anyErrors);
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
