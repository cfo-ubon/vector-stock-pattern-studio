// UI/UX Audit — accessibility spot-check: dialog focus trap, Escape-to-close,
// disabled-button explanations, landmark/role presence, keyboard reachability.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
const { chromium } = pkg;

const URL = 'http://localhost:5183/vector-stock-pattern-studio/studio/';
const OUT_DIR = '/tmp/claude-0/-home-user-vector-stock-pattern-studio/89000801-5ee0-574e-8681-79d83ff64216/scratchpad/audit_screens/a11y';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function dump(page, label) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT_DIR}/${label}.png`, fullPage: true });
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Check 1: is there a <nav> or role="navigation" landmark for the top menu?
  const navLandmarkCount = await page.locator('nav, [role="navigation"]').count();
  console.log('=== NAV LANDMARK COUNT (top menu) ===', navLandmarkCount);

  // Check 2: main landmark?
  const mainLandmarkCount = await page.locator('main, [role="main"]').count();
  console.log('=== MAIN LANDMARK COUNT ===', mainLandmarkCount);

  // Check 3: Tab through from body start, record first 15 focused elements.
  await page.keyboard.press('Tab');
  const focusTrace = [];
  for (let i = 0; i < 15; i++) {
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      return { tag: el.tagName, text: (el.textContent || '').trim().slice(0, 40), ariaLabel: el.getAttribute('aria-label'), role: el.getAttribute('role') };
    });
    focusTrace.push(info);
    await page.keyboard.press('Tab');
  }
  console.log('=== FOCUS TRACE (first 15 tab stops) ===', JSON.stringify(focusTrace, null, 2));

  // Check 4: disabled buttons — do they have a title/aria-label explaining why?
  const disabledInfo = await page.evaluate(() => {
    const disabled = Array.from(document.querySelectorAll('button:disabled'));
    return disabled.map((b) => ({ text: (b.textContent || '').trim().slice(0, 40), title: b.getAttribute('title'), ariaLabel: b.getAttribute('aria-label'), ariaDisabled: b.getAttribute('aria-disabled') }));
  });
  console.log('=== DISABLED BUTTONS ON MISSION CONTROL ===', JSON.stringify(disabledInfo, null, 2));

  // Check 5: open the Asset Preview Dialog (Hotfix v1.0.1) and test focus trap + Escape.
  await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
  await page.getByRole('button', { name: '▶ START FACTORY', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: "Approve today's production session", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '✨ Generate Now', exact: true }).click();
  await page.waitForTimeout(25000);
  await page.getByRole('button', { name: '📂 Portfolio', exact: true }).click();
  await page.waitForTimeout(1500);

  const firstThumb = page.locator('.portfolio-thumb').first();
  if (await firstThumb.count()) {
    await firstThumb.click();
    await page.waitForTimeout(800);
    await dump(page, '01_preview_dialog_open');

    const dialogRoleCount = await page.getByRole('dialog').count();
    console.log('=== PREVIEW DIALOG ROLE=DIALOG COUNT ===', dialogRoleCount);
    const dialogAriaModal = await page.getByRole('dialog').first().getAttribute('aria-modal').catch(() => null);
    console.log('=== DIALOG aria-modal ===', dialogAriaModal);
    const dialogAriaLabel = await page.getByRole('dialog').first().getAttribute('aria-label').catch(() => null);
    console.log('=== DIALOG aria-label ===', dialogAriaLabel);

    // Where is focus when dialog opens? (Does it move focus into the dialog at all?)
    const focusInsideDialog = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const active = document.activeElement;
      return dialog ? dialog.contains(active) : false;
    });
    console.log('=== FOCUS MOVED INTO DIALOG ON OPEN ===', focusInsideDialog);

    // Try Escape to close.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const dialogStillOpenAfterEscape = await page.getByRole('dialog').count();
    console.log('=== DIALOG COUNT AFTER ESCAPE KEY ===', dialogStillOpenAfterEscape, '(0 = Escape closed it, >0 = Escape did NOT close it)');
    await dump(page, '02_after_escape_attempt');
  } else {
    console.log('=== NO PORTFOLIO ASSETS TO TEST PREVIEW DIALOG ===');
  }

  console.log('=== CONSOLE ERRORS ===', JSON.stringify(consoleErrors, null, 2));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
