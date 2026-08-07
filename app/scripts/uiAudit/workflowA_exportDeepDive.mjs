// UI/UX Audit — deep dive: after a real Factory run, inspect the Export
// tab's asset dropdown options and check readiness for a freshly-produced
// asset specifically (not just whatever is selected by default).
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
const { chromium } = pkg;

const URL = 'http://localhost:5183/vector-stock-pattern-studio/studio/';
const OUT_DIR = '/tmp/claude-0/-home-user-vector-stock-pattern-studio/89000801-5ee0-574e-8681-79d83ff64216/scratchpad/audit_screens/workflowA';

async function dump(page, label) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT_DIR}/${label}.png`, fullPage: true });
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (msg) => { if (msg.type() === 'error') console.log('[console.error]', msg.text()); });
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.getByRole('button', { name: '▶ START FACTORY', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: "Approve today's production session", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '✨ Generate Now', exact: true }).click();
  console.log('--- waiting for generation ---');
  await page.waitForTimeout(25000);
  const skipBtn = page.getByRole('button', { name: 'Skip these and continue', exact: true });
  if (await skipBtn.count()) await skipBtn.click();
  await page.waitForTimeout(1000);
  const markCompleteBtn = page.getByRole('button', { name: 'Mark Session Complete', exact: true });
  if (await markCompleteBtn.count()) await markCompleteBtn.click();
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.waitForTimeout(1000);

  const allSelects = page.locator('select');
  const selectCount = await allSelects.count();
  console.log('=== SELECT COUNT ===', selectCount);
  for (let i = 0; i < selectCount; i++) {
    const opts = await allSelects.nth(i).locator('option').allTextContents();
    console.log(`=== SELECT[${i}] OPTIONS ===`, JSON.stringify(opts.slice(0, 5)), opts.length > 5 ? `...(${opts.length} total)` : '');
  }
  // The asset dropdown is the one whose options look like pattern slugs (contain hyphens, long, not the project-name sentinel)
  let assetSelectIndex = -1;
  let options = [];
  for (let i = 0; i < selectCount; i++) {
    const opts = await allSelects.nth(i).locator('option').allTextContents();
    if (opts.length > 1 && opts.some((o) => o.includes('-') && o.length > 20)) {
      assetSelectIndex = i;
      options = opts;
      break;
    }
  }
  console.log('=== ASSET SELECT INDEX ===', assetSelectIndex);
  const select = assetSelectIndex >= 0 ? allSelects.nth(assetSelectIndex) : allSelects.first();
  console.log('=== ASSET DROPDOWN OPTIONS ===', JSON.stringify(options, null, 2));

  // Find an option that looks like today's fresh batch (contains 'autopilot' or a recent-looking slug distinct from the default)
  const freshOption = options.find((o) => /autopilot|item2026/i.test(o)) || options[1];
  console.log('=== SELECTING ===', freshOption);
  if (freshOption) {
    await select.selectOption({ label: freshOption });
    await page.waitForTimeout(800);
    await dump(page, '11_export_fresh_asset_selected');
    const bodyText = await page.locator('body').innerText();
    const readinessMatch = bodyText.match(/Commercial Readiness \d+%[^\n]*/);
    console.log('=== READINESS LINE ===', readinessMatch ? readinessMatch[0] : 'not found');
    const checks = bodyText.match(/(Generator completed|SVG exists|EPS exists|Preview exists|Metadata exists|SEO exists|Collection assignment exists|Marketplace package exists|QA passed|Commercial score available|Beauty score available|Duplicate check complete|Repair history complete|Export validation complete):[^\n]*/g);
    console.log('=== CHECKS FOR FRESH ASSET ===', JSON.stringify(checks, null, 2));
  }

  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
