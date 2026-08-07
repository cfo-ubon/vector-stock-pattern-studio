// AI-SBOS Mission, Milestone 1 — live-browser verification of Product
// Identity + Consistent Header + Version Center.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = 'http://localhost:5183/vector-stock-pattern-studio/studio/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  console.log('=== Page title ===', await page.title());

  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('=== Header shows AI-SBOS ===', bodyText.includes('AI-SBOS'));
  console.log('=== Header shows subtitle ===', bodyText.includes('AI Stock Business Operating System'));
  console.log('=== Header shows module name ===', bodyText.includes('Vector Stock Pattern Studio module'));
  const envBadgeText = await page.locator('.app-env-badge').first().textContent();
  console.log('=== Env badge text (dev server should be Development) ===', envBadgeText);

  const versionBadge = page.locator('.app-version-badge');
  console.log('=== Version badge visible ===', await versionBadge.isVisible().catch(() => false));
  console.log('=== Version badge text ===', await versionBadge.textContent());

  // Check the header is present on multiple different views, not just Mission Control.
  await page.getByRole('button', { name: '📂 Portfolio', exact: true }).click();
  await page.waitForTimeout(600);
  const portfolioBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Header still shows AI-SBOS on Portfolio view ===', portfolioBody.includes('AI-SBOS'));
  console.log('=== Version badge still visible on Portfolio view ===', await versionBadge.isVisible().catch(() => false));

  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.waitForTimeout(600);
  const prodBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Header still shows AI-SBOS on Production view ===', prodBody.includes('AI-SBOS'));

  // Open Version Center.
  await versionBadge.click();
  await page.waitForTimeout(500);
  const vcBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Version Center opened ===', vcBody.includes('About AI-SBOS'));
  console.log('=== Version Center shows Commit ===', vcBody.includes('Commit'));
  console.log('=== Version Center shows Offline Status ===', vcBody.includes('Offline Status'));
  console.log('=== Version Center shows Commercial Certification ===', vcBody.includes('Commercial Certification'));
  console.log('=== Version Center shows Regression Result ===', vcBody.includes('Regression Result'));
  console.log('=== Version Center shows Latest Changes ===', /latest changes/i.test(vcBody));

  await page.getByRole('button', { name: 'ปิด', exact: true }).click();
  await page.waitForTimeout(300);
  const afterCloseBody = await page.evaluate(() => document.body.innerText);
  console.log('=== Version Center closed ===', !afterCloseBody.includes('About AI-SBOS'));

  console.log('=== CONSOLE ERRORS ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
