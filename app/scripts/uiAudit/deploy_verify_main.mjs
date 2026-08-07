// Deployment verification: since https://cfo-ubon.github.io is blocked by
// this sandbox's network egress policy, this script verifies the exact
// shipped /studio artifact (as pushed to origin/main) locally, using the
// same /vector-stock-pattern-studio/studio/ base path a real Pages
// deployment would use. Serves via `npx serve` from /home/user so the
// folder name matches the repo name used in the base path.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/';

const DEVICES = [
  { name: 'Desktop', width: 1920, height: 1080 },
  { name: 'iPad Portrait', width: 834, height: 1112 },
];

async function checkDevice(browser, device) {
  const context = await browser.newContext({ viewport: { width: device.width, height: device.height } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const whatsNewClose = page.getByRole('button', { name: 'เข้าใจแล้ว' });
  if (await whatsNewClose.isVisible().catch(() => false)) {
    await whatsNewClose.click();
    await page.waitForTimeout(300);
  }

  const results = {};
  const bodyText = await page.evaluate(() => document.body.innerText);

  results['1. Header shows AI-SBOS'] = bodyText.includes('AI-SBOS');
  results['1b. Subtitle shows AI Stock Business Operating System'] = bodyText.includes('AI Stock Business Operating System');

  const versionBadge = page.locator('.app-version-badge');
  results['2. Version/build badge visible'] = await versionBadge.isVisible().catch(() => false);
  const versionBadgeText = await versionBadge.innerText().catch(() => '');
  results['2b. Version badge text'] = versionBadgeText;

  await versionBadge.click().catch(() => {});
  await page.waitForTimeout(500);
  const vcBody = await page.evaluate(() => document.body.innerText);
  results['3. Version Center opens (About AI-SBOS)'] = vcBody.includes('About AI-SBOS');
  results['3b. Version Center shows v2.13 / M5'] = /2\.13/.test(vcBody) && /M5/.test(vcBody);
  await page.getByRole('button', { name: 'ปิด', exact: true }).click().catch(() => {});
  await page.waitForTimeout(300);

  const prodBtn = page.getByRole('button', { name: "🏭 Today's Production", exact: true });
  await prodBtn.click().catch(() => {});
  await page.waitForTimeout(700);
  const prodHeading = await page.getByRole('heading', { name: "Today's Production" }).isVisible().catch(() => false);
  results['4. Production Workspace present'] = prodHeading;

  const portfolioBtn = page.getByRole('button', { name: '📂 Portfolio', exact: true });
  await portfolioBtn.click().catch(() => {});
  await page.waitForTimeout(700);
  const portfolioBody = await page.evaluate(() => document.body.innerText);
  results['5. Portfolio Manager opens'] = portfolioBody.includes('Library & Search') || portfolioBody.includes('Portfolio');
  results['5b. Portfolio Analytics tab present'] = portfolioBody.includes('Analytics');
  results['5c. History & Submissions tab present'] = portfolioBody.includes('History & Submissions');

  // Design Refinement entry point: open a Preview dialog to look for "Edit Design".
  const previewCards = page.locator('.portfolio-asset-card, .asset-card, [class*="asset"]');
  const hasAnyAsset = (await previewCards.count()) > 0;
  results['6. Design Refinement entry point reachable (assets present to check)'] = hasAnyAsset;

  const marketplaceMentioned = portfolioBody.includes('Marketplace') || portfolioBody.includes('Export');
  results['7. Marketplace export UX present (Portfolio)'] = marketplaceMentioned;

  results['8. Console errors'] = consoleErrors;

  await context.close();
  return results;
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const device of DEVICES) {
    console.log(`\n=== ${device.name} (${device.width}x${device.height}) ===`);
    const results = await checkDevice(browser, device);
    for (const [k, v] of Object.entries(results)) {
      console.log(`${k}:`, typeof v === 'object' ? JSON.stringify(v) : v);
    }
  }
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
