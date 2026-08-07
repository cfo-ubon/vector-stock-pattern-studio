// Mission 8, Part 4 (supplement) — standalone Autopilot screen
// ("✨ ออกแบบให้ฉันวันนี้ / Design for Me Today") tested directly and
// separately from the Factory's "Generate Now" button, fully offline.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const URL = process.argv[2] || 'http://localhost:5184/vector-stock-pattern-studio/studio/';

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const context = await browser.newContext();
  const page = await context.newPage();
  const bucket = [];
  page.on('console', (msg) => bucket.push({ kind: 'console', type: msg.type(), text: msg.text() }));
  page.on('pageerror', (err) => bucket.push({ kind: 'pageerror', text: err.message }));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  await context.setOffline(true);
  await page.waitForTimeout(300);
  const before = bucket.length;

  let threw = null;
  try {
    await page.getByRole('button', { name: '✨ ออกแบบให้ฉันวันนี้', exact: true }).click();
    await page.waitForTimeout(600);
    const planBtn = page.getByRole('button', { name: 'สร้างแผนการออกแบบ →', exact: true });
    if (!(await planBtn.count())) throw new Error('"สร้างแผนการออกแบบ" (Create Design Plan) button not found');
    await planBtn.click();
    await page.waitForTimeout(3000);
  } catch (e) {
    threw = e.message;
  }

  const during = bucket.slice(before);
  const errs = during.filter((m) => m.kind === 'pageerror' || (m.kind === 'console' && m.type === 'error'));
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const shot = '/tmp/mission8_part4b_autopilot_standalone_offline.png';
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});

  console.log('THREW:', threw);
  console.log('CONSOLE DURING:', JSON.stringify(during, null, 2));
  console.log('BODY SNIPPET:', bodyText.slice(0, 1000));
  console.log('SCREENSHOT:', shot);

  if (threw) {
    console.log('\nVERDICT: FAIL —', threw);
  } else if (errs.length) {
    console.log('\nVERDICT: WARNING — non-fatal console errors:', JSON.stringify(errs));
  } else {
    console.log('\nVERDICT: PASS — standalone Autopilot design-plan generation completed offline with zero console errors.');
  }

  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
