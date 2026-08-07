// Mission 8, Part 10 — Playwright E2E Certification (evidence-gathering,
// read-only). Network ONLINE. Clicks through every distinct top-level
// workflow reachable from the app shell, discovered by real getByRole/
// getByText queries (not an assumed nav structure — see the mission8_explore*
// scripts in this same directory for how the map below was derived).
//
// For each screen: attaches console/pageerror/requestfailed listeners
// BEFORE navigating to it, then reports exact counts and verbatim text.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = process.argv[2] || 'http://localhost:5184/vector-stock-pattern-studio/studio/';
const results = [];

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const context = await browser.newContext();
  const page = await context.newPage();

  const allConsole = [];
  const allPageErrors = [];
  const allRequestFailed = [];
  page.on('console', (msg) => allConsole.push({ t: Date.now(), type: msg.type(), text: msg.text() }));
  page.on('pageerror', (err) => allPageErrors.push({ t: Date.now(), text: err.message }));
  page.on('requestfailed', (req) => allRequestFailed.push({ t: Date.now(), url: req.url(), failure: req.failure()?.errorText, resourceType: req.resourceType() }));

  function snapshot(label, extraNote) {
    const shot = `/tmp/mission8_part10_${label.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    return shot;
  }

  async function visit(label, action, opts = {}) {
    const cBefore = allConsole.length, pBefore = allPageErrors.length, rBefore = allRequestFailed.length;
    let threw = null;
    try {
      await action();
      await page.waitForTimeout(opts.settleMs ?? 800);
    } catch (e) {
      threw = e.message;
    }
    const consoleDuring = allConsole.slice(cBefore);
    const pageerrorsDuring = allPageErrors.slice(pBefore);
    const requestfailedDuring = allRequestFailed.slice(rBefore);
    const errorConsole = consoleDuring.filter((m) => m.type === 'error');
    const warnConsole = consoleDuring.filter((m) => m.type === 'warning');
    const shot = snapshot(label);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});

    let verdict;
    if (threw) verdict = 'FAIL (navigation/action threw)';
    else if (pageerrorsDuring.length || errorConsole.length) verdict = 'ISSUES FOUND';
    else verdict = 'CLEAN (zero console errors, zero pageerrors)';

    const entry = {
      label, threw, verdict,
      consoleErrorCount: errorConsole.length,
      consoleWarnCount: warnConsole.length,
      pageErrorCount: pageerrorsDuring.length,
      requestFailedCount: requestfailedDuring.length,
      consoleErrors: errorConsole.map((m) => m.text),
      pageErrors: pageerrorsDuring.map((m) => m.text),
      requestFailed: requestfailedDuring.map((m) => `${m.resourceType} ${m.url} :: ${m.failure}`),
      screenshot: shot,
    };
    results.push(entry);
    console.log(`\n=== [${label}] ${verdict} ===`);
    console.log(`  console errors: ${entry.consoleErrorCount}, warnings: ${entry.consoleWarnCount}, pageerrors: ${entry.pageErrorCount}, requestfailed: ${entry.requestFailedCount}`);
    if (entry.consoleErrors.length) console.log('  CONSOLE ERROR TEXT:', JSON.stringify(entry.consoleErrors));
    if (entry.pageErrors.length) console.log('  PAGEERROR TEXT:', JSON.stringify(entry.pageErrors));
    if (entry.requestFailed.length) console.log('  REQUESTFAILED:', JSON.stringify(entry.requestFailed));
    if (threw) console.log('  ACTION THREW:', threw);
  }

  // 0. Initial load
  await visit('00_initial_load_MissionControl', async () => {
    await page.goto(URL, { waitUntil: 'networkidle' });
  }, { settleMs: 1000 });

  // 1. Today's Production (Factory) — Home
  await visit('01_TodaysProduction_Home', async () => {
    await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  });

  // 1b. Today's Production sub-tabs
  for (const tab of ['Progress', 'Review', 'Export', 'Dashboard', 'Home']) {
    await visit(`01b_TodaysProduction_tab_${tab}`, async () => {
      await page.getByRole('button', { name: tab, exact: true }).click();
    });
  }

  // 2. Autopilot / Decision Engine landing
  await visit('02_Autopilot_landing', async () => {
    await page.getByRole('button', { name: '✨ ออกแบบให้ฉันวันนี้', exact: true }).click();
  });
  // 2b. Autopilot history sub-view
  await visit('02b_Autopilot_history', async () => {
    await page.getByRole('button', { name: '📜 ประวัติ', exact: true }).click();
  });

  // 3. Overview (Project Dashboard)
  await visit('03_Overview_ProjectDashboard', async () => {
    await page.getByRole('button', { name: '📊 Overview', exact: true }).click();
  });

  // 4. Pattern Studio (Design Workbench)
  await visit('04_PatternStudio_DesignWorkbench', async () => {
    await page.getByRole('button', { name: '🎨 Pattern Studio', exact: true }).click();
  });
  // 4b. Design Workbench sidebar tabs
  for (const tab of ['Inspector', 'Marketplace', 'Prompt', 'Quality', 'Critic', 'Evolution', 'Assets', 'Validation', 'Live Preview', 'History']) {
    await visit(`04b_DesignWorkbench_tab_${tab}`, async () => {
      const emojiBtn = page.locator(`button:has-text("${tab}")`).first();
      await emojiBtn.click();
    });
  }
  // 4c. Explorer / Favorites / Import-Export / Project (left toolbar)
  for (const tab of ['Explorer', 'Favorites', 'Import/Export', 'Project']) {
    await visit(`04c_DesignWorkbench_left_${tab.replace('/', '-')}`, async () => {
      await page.locator(`button:has-text("${tab}")`).first().click();
    });
  }

  // 5. Portfolio Manager
  await visit('05_Portfolio_Manager', async () => {
    await page.getByRole('button', { name: '📂 Portfolio', exact: true }).click();
  });
  for (const tab of ['ชิ้นงาน', 'คอลเลกชัน', 'ศูนย์การผลิต']) {
    await visit(`05b_Portfolio_tab_${tab}`, async () => {
      await page.getByRole('button', { name: tab, exact: true }).click();
    });
  }

  // 6. Backup Manager
  await visit('06_Backup_Manager', async () => {
    await page.getByRole('button', { name: '💾 Backup', exact: true }).click();
  });
  for (const tab of ['สำรองข้อมูล', 'กู้คืนข้อมูล', 'สำรองอัตโนมัติ', 'ประวัติการสำรอง', 'ตรวจสอบไฟล์สำรอง']) {
    await visit(`06b_Backup_tab_${tab}`, async () => {
      await page.getByRole('button', { name: tab, exact: true }).click();
    });
  }

  // 7. AI Market Advisor (Marketing Intelligence Center)
  await visit('07_AI_Market_Advisor', async () => {
    await page.getByRole('button', { name: '📈 AI Market Advisor', exact: true }).click();
  });
  for (const tab of ["Today's Mission", 'AI Market Advisor', 'Opportunity Explorer', 'Commercial Score Details', 'Keyword Intelligence', 'Seasonal Planner', 'Market Gap Finder', 'Marketplace Comparison', 'Daily Missions']) {
    await visit(`07b_MarketAdvisor_tab_${tab.replace(/[^a-zA-Z0-9]/g, '')}`, async () => {
      await page.getByRole('button', { name: tab, exact: true }).click();
    });
  }

  // 8. AI Design Director (Creative Director)
  await visit('08_AI_Design_Director', async () => {
    await page.getByRole('button', { name: '🎨 AI Design Director', exact: true }).click();
  });
  for (const tab of ['Creative Brief', 'Collection Planner', 'Roadmap', 'Completeness', 'Balance', 'Diversity', 'Art Director', 'Commercial QA', 'Portfolio Impact', 'Generator Handoff']) {
    await visit(`08b_DesignDirector_tab_${tab.replace(/[^a-zA-Z0-9]/g, '')}`, async () => {
      await page.getByRole('button', { name: tab, exact: true }).click();
    });
  }

  // 9. Advanced Mode toggle -> classic Pattern Studio generator (root)
  await visit('09_AdvancedMode_ClassicGenerator', async () => {
    await page.getByRole('button', { name: '🏠 Mission Control', exact: true }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '⚙️ Advanced Mode', exact: true }).click();
  });
  // 9b. Actually click Generate in the classic generator
  await visit('09b_ClassicGenerator_Generate', async () => {
    await page.getByRole('button', { name: 'Generate', exact: true }).click();
  });
  // 9c. Generate 9 variations
  await visit('09c_ClassicGenerator_Generate9Variations', async () => {
    await page.getByRole('button', { name: 'Generate 9 variations', exact: true }).click();
  }, { settleMs: 2500 });

  // 10. New Project flow
  await visit('10_New_Project_dialog', async () => {
    await page.getByRole('button', { name: '+ โปรเจกต์ใหม่', exact: true }).click();
  });
  // close if a dialog opened (best-effort, press Escape)
  await page.keyboard.press('Escape').catch(() => {});

  console.log('\n\n================ SUMMARY ================');
  for (const r of results) {
    console.log(`${r.verdict.padEnd(35)} | errC=${r.consoleErrorCount} warnC=${r.consoleWarnCount} pageErr=${r.pageErrorCount} reqFail=${r.requestFailedCount} | ${r.label}`);
  }

  console.log('\n\n================ FULL JSON ================');
  console.log(JSON.stringify(results, null, 2));

  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
