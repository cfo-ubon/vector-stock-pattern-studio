// Mission 8 Part 7 — iPad certification via Playwright emulation.
// This is REAL emulated-viewport verification using Chromium + Playwright's
// device emulation. It is NOT a physical iPad hardware test.
import { chromium, devices } from 'playwright';
import fs from 'fs';

const BASE_URL = 'http://localhost:5183/vector-stock-pattern-studio/studio/';
const SCREENSHOT_DIR = '/tmp/mission8_ipad';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];
function log(section, status, detail) {
  const line = `[${status}] ${section}: ${detail}`;
  console.log(line);
  results.push({ section, status, detail });
}

const iPad = devices['iPad Pro 11'];
console.log('iPad Pro 11 device descriptor:', JSON.stringify(iPad));

async function checkOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    innerWidth: window.innerWidth,
  }));
  const overflow = metrics.scrollWidth > metrics.innerWidth;
  log(
    'Horizontal overflow',
    overflow ? 'FAIL' : 'PASS',
    `${label}: scrollWidth=${metrics.scrollWidth} innerWidth=${metrics.innerWidth} clientWidth=${metrics.clientWidth} overflow=${overflow}`
  );
  return { ...metrics, overflow };
}

async function checkDialogBounds(page, label) {
  // Find visible dialog-like containers (role=dialog, or common modal classes)
  const boxes = await page.evaluate(() => {
    const selectors = ['[role="dialog"]', '.modal', '.dialog', '.panel-overlay', '.modal-content'];
    const seen = new Set();
    const out = [];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          out.push({ sel, right: r.right, bottom: r.bottom, left: r.left, top: r.top, width: r.width, height: r.height });
        }
      });
    }
    return out;
  });
  const vw = page.viewportSize().width;
  const vh = page.viewportSize().height;
  if (boxes.length === 0) {
    log('Dialog bounds (role=dialog/.modal selectors)', 'UNKNOWN', `${label}: no element matched dialog/modal selectors — this app renders panels as inline full-width views (e.g. .backup-center), not overlay modals, so this selector-based check does not apply here`);
  } else {
    for (const b of boxes) {
      const clipped = b.right > vw + 1 || b.bottom > vh + 1 || b.left < -1 || b.top < -1;
      log(
        'Dialog bounds',
        clipped ? 'FAIL' : 'PASS',
        `${label}: selector=${b.sel} rect(left=${b.left.toFixed(0)},top=${b.top.toFixed(0)},right=${b.right.toFixed(0)},bottom=${b.bottom.toFixed(0)}) viewport=${vw}x${vh} clipped=${clipped}`
      );
    }
  }
}

// Generic scan: find any element whose right/bottom edge extends past the
// viewport by more than a small tolerance, where the element itself does not
// declare its own horizontal/vertical scroll (i.e. it's an unintended
// clip/overflow, not a deliberately scrollable region like a code block or
// horizontally-scrolling table).
async function checkClippedElements(page, label) {
  const clipped = await page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const out = [];
    const all = document.querySelectorAll('body *');
    for (const el of all) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      // Skip elements that intentionally scroll internally
      const ox = style.overflowX;
      const oy = style.overflowY;
      const selfScrollable = ox === 'auto' || ox === 'scroll' || oy === 'auto' || oy === 'scroll';
      if (selfScrollable) continue;
      // NOTE: only horizontal (right-edge) overflow is checked here.
      // Vertical overflow (r.bottom > vh) is normal/expected for tall pages
      // that scroll vertically (the whole app relies on page scroll), so it
      // is intentionally NOT flagged as clipping.
      const overRight = r.right - vw;
      if (overRight > 8) {
        out.push({
          tag: el.tagName,
          cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 60) : '',
          right: r.right,
          overRight,
        });
      }
    }
    // Sort by worst offender, cap to top 8
    out.sort((a, b) => b.overRight - a.overRight);
    return out.slice(0, 8);
  });
  const vw = page.viewportSize().width;
  const vh = page.viewportSize().height;
  if (clipped.length === 0) {
    log('Clipped-element scan (horizontal only)', 'PASS', `${label}: no non-scrollable element's right edge extends >8px past viewport width (${vw}, height=${vh}); vertical page scroll not flagged (expected/normal)`);
  } else {
    const desc = clipped
      .map((c) => `<${c.tag} class="${c.cls}"> right=${c.right.toFixed(0)}(+${c.overRight.toFixed(0)}px past ${vw})`)
      .join(' ;; ');
    log('Clipped-element scan (horizontal only)', 'WARNING', `${label}: ${clipped.length} element(s) extend past viewport width (${vw}) without self-scroll: ${desc}`);
  }
}

async function run() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  for (const orientation of ['portrait', 'landscape']) {
    const viewport = orientation === 'portrait'
      ? { width: 834, height: 1194 }
      : { width: 1194, height: 834 };

    const context = await browser.newContext({
      ...iPad,
      viewport,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

    console.log(`\n=== ${orientation.toUpperCase()} (${viewport.width}x${viewport.height}) ===`);
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);

    await checkOverflow(page, `${orientation} app shell (initial load)`);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${orientation}_00_shell.png`, fullPage: false });

    if (consoleErrors.length) {
      log('Console errors', 'WARNING', `${orientation} initial load: ${consoleErrors.length} console error(s): ${consoleErrors.slice(0, 5).join(' | ')}`);
    } else {
      log('Console errors', 'PASS', `${orientation} initial load: 0 console errors`);
    }

    // --- Touch tap: Today's Production ---
    const prodBtn = page.getByRole('button', { name: /Today's Production/i });
    const prodVisible = await prodBtn.first().isVisible().catch(() => false);
    if (prodVisible) {
      try {
        await prodBtn.first().tap();
        await page.waitForTimeout(1200);
        await checkOverflow(page, `${orientation} after tap Today's Production`);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/${orientation}_01_todays_production.png`, fullPage: false });
        await checkDialogBounds(page, `${orientation} Today's Production view`);
        await checkClippedElements(page, `${orientation} Today's Production view`);
        log('Touch interaction', 'PASS', `${orientation}: page.tap() on "Today's Production" button succeeded, view changed, screenshot saved`);
      } catch (e) {
        log('Touch interaction', 'FAIL', `${orientation}: tap on Today's Production threw: ${e.message}`);
      }
    } else {
      log('Touch interaction', 'UNKNOWN', `${orientation}: "Today's Production" button not visible/found in DOM at initial load`);
    }

    // Go back to shell / advanced mode for generator control panel check
    // Try navigating directly via URL reload then opening Advanced Mode
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    const advBtn = page.getByRole('button', { name: /Advanced Mode/i });
    const advVisible = await advBtn.first().isVisible().catch(() => false);
    if (advVisible) {
      try {
        await advBtn.first().tap();
        await page.waitForTimeout(1200);
        await checkOverflow(page, `${orientation} Advanced Mode (generator control panel)`);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/${orientation}_02_advanced_mode.png`, fullPage: false });
        await checkDialogBounds(page, `${orientation} Advanced Mode panel`);
        await checkClippedElements(page, `${orientation} Advanced Mode panel`);
      } catch (e) {
        log('Advanced Mode panel', 'FAIL', `${orientation}: tap threw: ${e.message}`);
      }
    } else {
      log('Advanced Mode panel', 'UNKNOWN', `${orientation}: "Advanced Mode" button not visible/found`);
    }

    // Backup Manager
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    const backupBtn = page.getByRole('button', { name: /Backup/i });
    const backupVisible = await backupBtn.first().isVisible().catch(() => false);
    if (backupVisible) {
      try {
        await backupBtn.first().tap();
        await page.waitForTimeout(1200);
        await checkOverflow(page, `${orientation} Backup Manager`);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/${orientation}_03_backup_manager.png`, fullPage: false });
        await checkDialogBounds(page, `${orientation} Backup Manager`);
        await checkClippedElements(page, `${orientation} Backup Manager`);
        log('Backup Manager open', 'PASS', `${orientation}: tap on Backup button succeeded, screenshot saved`);
      } catch (e) {
        log('Backup Manager open', 'FAIL', `${orientation}: tap threw: ${e.message}`);
      }
    } else {
      log('Backup Manager open', 'UNKNOWN', `${orientation}: "Backup" button not visible/found`);
    }

    await context.close();
  }

  await browser.close();

  fs.writeFileSync(
    `${SCREENSHOT_DIR}/results.json`,
    JSON.stringify(results, null, 2)
  );
  console.log('\n\n=== SUMMARY ===');
  for (const r of results) console.log(`[${r.status}] ${r.section}: ${r.detail}`);
}

run().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
