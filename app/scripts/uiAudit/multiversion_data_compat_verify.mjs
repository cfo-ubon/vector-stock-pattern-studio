// AI-SBOS Multi-Version Release, Part 8/9/16 — real cross-version data
// test. Creates a real Project (via the actual "+ โปรเจกต์ใหม่" UI, real
// IndexedDB write through each app's own project/projectManager.ts) in
// v1, confirms v2 (same browser, same origin, same vsp-db) sees it, then
// creates a second project in v2 and confirms v1 sees THAT one too —
// proving the "safe to share" conclusion from AI_SBOS_VERSION_AUDIT.md
// with a real end-to-end round trip, not just a schema diff.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const V1_URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/v1/';
const V2_URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/v2/';

async function createProject(page, name) {
  page.once('dialog', (dialog) => dialog.accept(name));
  await page.getByRole('button', { name: '+ โปรเจกต์ใหม่' }).first().click();
  await page.waitForTimeout(500);
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

  const v1ProjectName = `V1-created-${Date.now()}`;
  const v2ProjectName = `V2-created-${Date.now()}`;

  console.log('--- v1: create a real project ---');
  await page.goto(V1_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await createProject(page, v1ProjectName);
  const v1BodyAfterCreate = await page.evaluate(() => document.body.innerText);
  console.log('=== v1 shows its own newly-created project ===', v1BodyAfterCreate.includes(v1ProjectName));

  console.log('--- v2: does it see the project v1 just created? ---');
  await page.goto(V2_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const whatsNewClose = page.getByRole('button', { name: 'เข้าใจแล้ว' });
  if (await whatsNewClose.isVisible().catch(() => false)) {
    await whatsNewClose.click();
    await page.waitForTimeout(300);
  }
  const v2BodySeesV1 = await page.evaluate(() => document.body.innerText);
  console.log('=== v2 sees the project v1 created (shared vsp-db, no isolation) ===', v2BodySeesV1.includes(v1ProjectName));

  console.log('--- v2: create a second real project ---');
  await createProject(page, v2ProjectName);
  const v2BodyAfterCreate = await page.evaluate(() => document.body.innerText);
  console.log('=== v2 shows its own newly-created project ===', v2BodyAfterCreate.includes(v2ProjectName));

  console.log('--- v1: does it see the project v2 just created? (round trip) ---');
  await page.goto(V1_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const v1BodySeesV2 = await page.evaluate(() => document.body.innerText);
  console.log('=== v1 sees the project v2 created (round trip proven) ===', v1BodySeesV2.includes(v2ProjectName));
  console.log('=== v1 still sees its own original project too (no data loss) ===', v1BodySeesV2.includes(v1ProjectName));

  console.log('=== CONSOLE ERRORS (whole data-compat run) ===', JSON.stringify(consoleErrors));
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
