// UI/UX Audit — Workflow B: existing unfinished work -> Continue Yesterday
// -> complete -> review -> export.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
const { chromium } = pkg;

const URL = 'http://localhost:5183/vector-stock-pattern-studio/studio/';
const OUT_DIR = '/tmp/claude-0/-home-user-vector-stock-pattern-studio/89000801-5ee0-574e-8681-79d83ff64216/scratchpad/audit_screens/workflowB';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function dump(page, label) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT_DIR}/${label}.png`, fullPage: true });
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message}`));

  // Phase 1: start a Factory session but leave it incomplete (stop right after "Start Factory" + approve, no generate).
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.getByRole('button', { name: '▶ START FACTORY', exact: true }).click();
  await page.waitForTimeout(800);
  const approveBtn = page.getByRole('button', { name: "Approve today's production session", exact: true });
  if (await approveBtn.count()) await approveBtn.click();
  await page.waitForTimeout(800);
  const genNowBtn = page.getByRole('button', { name: '✨ Generate Now', exact: true });
  if (await genNowBtn.count()) await genNowBtn.click();
  // Interrupt mid-batch (don't wait for the ~20-30s generation to finish) to leave real incomplete FactoryTask records.
  await page.waitForTimeout(3000);
  await dump(page, '01_session_left_incomplete_midgen');
  console.log('=== interrupted mid-generation, now reloading fresh page (simulating return visit) ===');

  // Phase 2: reload fresh (new page/context but SAME browser -> same IndexedDB origin) and check for Continue Yesterday.
  await page.close();
  const page2 = await context.newPage();
  page2.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page2.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message}`));
  await page2.goto(URL, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(1500);
  await dump(page2, '02_mission_control_after_reload');

  await page2.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page2.waitForTimeout(1000);
  await dump(page2, '03_todays_production_home_after_reload');

  const continueBtn = page2.getByRole('button', { name: /Continue Yesterday/i });
  const continueCount = await continueBtn.count();
  console.log('=== CONTINUE YESTERDAY BUTTON COUNT ===', continueCount);
  if (continueCount > 0) {
    const btnText = await continueBtn.first().innerText();
    console.log('=== BUTTON TEXT ===', btnText);
    await continueBtn.first().click();
    await page2.waitForTimeout(1200);
    await dump(page2, '04_after_click_continue_yesterday');
    const headings = await page2.locator('h1,h2,h3').allTextContents();
    const buttons = await page2.locator('button:visible').allTextContents();
    console.log('=== HEADINGS AFTER CONTINUE ===', JSON.stringify(headings));
    console.log('=== BUTTONS AFTER CONTINUE ===', JSON.stringify(buttons.filter(Boolean)));
  } else {
    console.log('=== Continue Yesterday NOT FOUND on Today\'s Production home ===');
    const bodyText = await page2.locator('body').innerText();
    console.log('=== BODY SNIPPET ===', bodyText.slice(0, 800));
  }

  console.log('=== CONSOLE ERRORS ===', JSON.stringify(consoleErrors, null, 2));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
