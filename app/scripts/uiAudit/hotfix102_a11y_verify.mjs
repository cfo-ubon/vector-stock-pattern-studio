// Hotfix v1.0.2 verification: BUG-006 (Escape+focus), BUG-007 (landmarks),
// BUG-005 (nav highlight), BUG-008 (iPad workbench layout).
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = 'http://localhost:5183/vector-stock-pattern-studio/studio/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // BUG-007: landmarks
  const navCount = await page.locator('nav, [role="navigation"]').count();
  const mainCount = await page.locator('main, [role="main"]').count();
  console.log('=== NAV LANDMARK COUNT ===', navCount);
  console.log('=== MAIN LANDMARK COUNT ===', mainCount);

  // BUG-005: only one project-bar-btn should carry the primary/highlighted class
  const primaryCount = await page.locator('.project-bar-btn.btn--primary').count();
  console.log('=== project-bar-btn WITH btn--primary (should be 0 now) ===', primaryCount);

  // BUG-006: open Portfolio -> Preview dialog -> Escape
  await page.getByRole('button', { name: '📂 Portfolio', exact: true }).click();
  await page.waitForTimeout(1000);
  const firstThumb = page.locator('.portfolio-thumb').first();
  if (await firstThumb.count()) {
    await firstThumb.click();
    await page.waitForTimeout(500);
    const focusInsideDialog = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return dialog ? dialog.contains(document.activeElement) : false;
    });
    console.log('=== FOCUS MOVED INTO DIALOG ON OPEN ===', focusInsideDialog);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const dialogCountAfterEscape = await page.getByRole('dialog').count();
    console.log('=== DIALOG COUNT AFTER ESCAPE (should be 0) ===', dialogCountAfterEscape);
  } else {
    console.log('=== NO PORTFOLIO ASSETS TO TEST ===');
  }

  // BUG-008: Pattern Studio at iPad portrait
  await page.setViewportSize({ width: 834, height: 1194 });
  await page.getByRole('button', { name: '🎨 Pattern Studio', exact: true }).click();
  await page.waitForTimeout(1200);
  const overflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  console.log('=== iPad portrait overflow ===', JSON.stringify(overflow));
  await page.screenshot({ path: '/tmp/claude-0/-home-user-vector-stock-pattern-studio/89000801-5ee0-574e-8681-79d83ff64216/scratchpad/hotfix102_ipad_portrait_workbench.png', fullPage: false });
  const gridInfo = await page.evaluate(() => {
    const layout = document.querySelector('.workbench-layout');
    if (!layout) return null;
    const style = getComputedStyle(layout);
    return { gridTemplateColumns: style.gridTemplateColumns };
  });
  console.log('=== workbench-layout computed grid-template-columns at 834px ===', JSON.stringify(gridInfo));

  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
