// UI/UX Audit — Workflow A: fresh user -> open app -> create/select project
// -> Start Factory -> complete production -> review -> export -> download ZIP.
// Real Playwright interaction, real console monitoring, real screenshots.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
const { chromium } = pkg;

const URL = 'http://localhost:5183/vector-stock-pattern-studio/studio/';
const OUT_DIR = '/tmp/claude-0/-home-user-vector-stock-pattern-studio/89000801-5ee0-574e-8681-79d83ff64216/scratchpad/audit_screens/workflowA';
fs.mkdirSync(OUT_DIR, { recursive: true });

const log = [];
function record(step, extra = {}) {
  log.push({ step, t: Date.now(), ...extra });
  console.log(`[STEP] ${step}`, JSON.stringify(extra));
}

async function dump(page, label) {
  await page.waitForTimeout(400);
  const safeName = label.replace(/[^a-zA-Z0-9]/g, '_');
  await page.screenshot({ path: `${OUT_DIR}/${safeName}.png`, fullPage: true });
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  let clickCount = 0;
  const click = async (locator, label) => {
    await locator.click();
    clickCount++;
    record(`click: ${label}`, { clickCount });
  };

  await page.goto(URL, { waitUntil: 'networkidle' });
  await dump(page, '01_home_mission_control');
  record('page loaded', { url: URL });

  // Step: navigate to Today's Production
  await click(page.getByRole('button', { name: "🏭 Today's Production", exact: true }), "🏭 Today's Production");
  await dump(page, '02_todays_production');

  // Step: Start Factory
  const startBtn = page.getByRole('button', { name: '▶ START FACTORY', exact: true });
  if (await startBtn.count()) {
    await click(startBtn, '▶ START FACTORY');
    await dump(page, '03_after_start_factory');
  } else {
    record('START FACTORY button not found', { fatal: true });
  }

  // Step: Approve session (if prompted)
  const approveBtn = page.getByRole('button', { name: "Approve today's production session", exact: true });
  if (await approveBtn.count()) {
    await click(approveBtn, "Approve today's production session");
    await dump(page, '04_after_approve');
  } else {
    record('approve button not present (may not be required)');
  }

  // Step: Generate Now (if prompted)
  const genNowBtn = page.getByRole('button', { name: '✨ Generate Now', exact: true });
  if (await genNowBtn.count()) {
    await click(genNowBtn, '✨ Generate Now');
    record('waiting for generation to settle...');
    await page.waitForTimeout(25000);
    await dump(page, '05_after_generate_now_wait25s');
  } else {
    record('Generate Now button not present after approve');
    await dump(page, '05b_state_after_approve_no_generate_btn');
  }

  // Step: Skip QA items if prompted
  const skipBtn = page.getByRole('button', { name: 'Skip these and continue', exact: true });
  if (await skipBtn.count()) {
    await click(skipBtn, 'Skip these and continue');
    await dump(page, '06_after_skip');
  }

  // Step: Mark Session Complete if present
  const markCompleteBtn = page.getByRole('button', { name: 'Mark Session Complete', exact: true });
  if (await markCompleteBtn.count()) {
    await click(markCompleteBtn, 'Mark Session Complete');
    await dump(page, '07_after_mark_complete');
  }

  // Step: Review tab
  const reviewTab = page.getByRole('button', { name: /^Review/, exact: false });
  if (await reviewTab.count()) {
    await click(reviewTab.first(), 'Review tab');
    await dump(page, '08_review_tab');
    const reviewButtons = await page.locator('button:visible').allTextContents();
    record('review tab buttons', { buttons: reviewButtons.filter(Boolean) });
  } else {
    record('Review tab not found', { problem: true });
  }

  // Step: Export tab
  const exportTab = page.getByRole('button', { name: 'Export', exact: true });
  if (await exportTab.count()) {
    await click(exportTab, 'Export tab');
    await dump(page, '09_export_tab');
    const exportButtons = await page.locator('button:visible').allTextContents();
    record('export tab buttons', { buttons: exportButtons.filter(Boolean) });
  } else {
    record('Export tab not found', { problem: true });
  }

  // Step: Dashboard tab
  const dashTab = page.getByRole('button', { name: 'Dashboard', exact: true });
  if (await dashTab.count()) {
    await click(dashTab, 'Dashboard tab');
    await dump(page, '10_dashboard_tab');
  }

  record('DONE', { totalClicks: clickCount, consoleErrorCount: consoleErrors.length, pageErrorCount: pageErrors.length });

  fs.writeFileSync(`${OUT_DIR}/workflowA_log.json`, JSON.stringify({ log, consoleErrors, pageErrors, totalClicks: clickCount }, null, 2));
  console.log('=== CONSOLE ERRORS ===', JSON.stringify(consoleErrors, null, 2));
  console.log('=== PAGE ERRORS ===', JSON.stringify(pageErrors, null, 2));
  console.log('=== TOTAL CLICKS ===', clickCount);

  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
