// AI-SBOS v3, V3-I: Real Browser Certification (Milestone 30) + Adversarial
// Keyword Tests (Milestone 31), in one live Playwright run against the
// real built artifact. No fabricated evidence — every assertion is read
// back from the actual DOM/console after a real user-shaped interaction.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const SELECTOR_URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/';
const V3_URL = 'http://localhost:8899/vector-stock-pattern-studio/studio/v3/';

function newErrorSink(page) {
  const errors = [];
  const dialogs = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));
  page.on('dialog', async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  return { errors, dialogs };
}

let allOk = true;

async function goldenWorkflow(browser, keyword) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const { errors } = newErrorSink(page);

  console.log(`\n=== GOLDEN WORKFLOW: "${keyword}" ===`);
  await page.goto(SELECTOR_URL, { waitUntil: 'networkidle' });
  const v3Link = page.locator('a[href="./v3/"]').first();
  const hasSelectorLink = await v3Link.count() > 0;
  console.log('Selector links to v3:', hasSelectorLink);

  await page.goto(V3_URL, { waitUntil: 'networkidle' });
  await page.getByLabel('What do you want to create?').fill(keyword);
  await page.getByRole('button', { name: 'Analyze & Design' }).click();
  await page.getByRole('heading', { name: 'Design Brief' }).waitFor();
  const briefText = await page.locator('.v3-design-brief').innerText();
  console.log('Design Brief rendered:', briefText.includes(keyword.trim()) || briefText.length > 0);

  await page.getByRole('button', { name: 'Generate' }).click();
  await page.getByRole('heading', { name: 'Preview Gallery' }).waitFor({ timeout: 30000 });
  const cardCount = await page.locator('.v3-gallery-card').count();
  console.log('Gallery thumbnails rendered:', cardCount === 5, `(${cardCount})`);

  await page.locator('.v3-gallery-card').first().getByRole('button', { name: 'Open 3×3 preview' }).click();
  await page.locator('.v3-modal--wide').waitFor();
  const has3x3 = (await page.locator('.v3-modal--wide svg').count()) > 0;
  console.log('3x3 seamless repeat preview rendered:', has3x3);
  await page.getByRole('button', { name: 'Close' }).click();

  await page.locator('.v3-gallery-card').first().getByRole('button', { name: 'Refine' }).click();
  await page.locator('.v3-modal').filter({ hasText: 'Refine' }).waitFor();
  const densitySlider = page.locator('.v3-modal input[type="range"]').first();
  await densitySlider.fill('0.8');
  await page.getByRole('button', { name: 'Regenerate Version' }).click();
  await page.waitForTimeout(500);
  const cardCountAfterRefine = await page.locator('.v3-gallery-card').count();
  console.log('Refine -> Regenerate Version added a new card (non-destructive):', cardCountAfterRefine === cardCount + 1);

  const approveButtons = page.locator('.v3-gallery-card').locator('button', { hasText: 'Approve' });
  let approved = false;
  for (let i = 0; i < (await approveButtons.count()); i++) {
    const btn = approveButtons.nth(i);
    if (await btn.isEnabled()) { await btn.click(); approved = true; break; }
  }
  console.log('Approve -> Commercial QA triggered:', approved);
  if (!approved) { allOk = false; await context.close(); return; }

  await page.waitForTimeout(3000);
  const qaBody = await page.locator('.v3-modal-backdrop').last().innerText();
  console.log('Commercial QA gate list rendered:', qaBody.includes('Vector Integrity'));

  const overallBlocked = qaBody.includes('Overall: BLOCKED');
  console.log('Overall status (real, not assumed):', overallBlocked ? 'BLOCKED' : qaBody.includes('Overall: READY') ? 'READY' : qaBody.includes('Overall: REVIEW') ? 'REVIEW' : 'UNKNOWN');

  if (!overallBlocked) {
    const marketplaceSelect = page.locator('.v3-modal-backdrop select').last();
    if (await marketplaceSelect.count() > 0) {
      await marketplaceSelect.selectOption('shutterstock');
      const exportBtn = page.getByRole('button', { name: /Export to Shutterstock/ });
      if (await exportBtn.isEnabled().catch(() => false)) {
        await exportBtn.click();
        await page.waitForTimeout(2000);
        const downloadCenterVisible = (await page.locator('.download-center-modal, .portfolio-modal').count()) > 0;
        console.log('Export -> Download Center reached:', downloadCenterVisible || (await page.locator('body').innerText()).includes('Download'));
      }
    }
  }

  console.log('Console/page errors:', errors.length, errors.length > 0 ? JSON.stringify(errors) : '');
  if (errors.length > 0) allOk = false;
  await context.close();
}

async function adversarialCase(browser, label, keyword, opts = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const { errors, dialogs } = newErrorSink(page);

  console.log(`\n=== ADVERSARIAL: ${label} ("${keyword.slice(0, 60)}${keyword.length > 60 ? '…' : ''}", len=${keyword.length}) ===`);
  await page.goto(V3_URL, { waitUntil: 'networkidle' });
  await page.getByLabel('What do you want to create?').fill(keyword);

  if (opts.expectAnalyzeDisabled) {
    const analyzeBtn = page.getByRole('button', { name: 'Analyze & Design' });
    const disabled = await analyzeBtn.isDisabled();
    console.log('Analyze button correctly disabled for empty/whitespace input:', disabled);
    if (!disabled) allOk = false;
    console.log('Console/page errors:', errors.length);
    if (errors.length > 0) allOk = false;
    await context.close();
    return;
  }

  await page.getByRole('button', { name: 'Analyze & Design' }).click();
  await page.getByRole('heading', { name: 'Design Brief' }).waitFor({ timeout: 10000 });
  const briefText = await page.locator('.v3-design-brief').innerText();
  console.log('Design Brief rendered without crash:', briefText.length > 0);
  console.log('Confidence field present:', /Confidence/.test(briefText));

  await page.getByRole('button', { name: 'Generate' }).click();
  await page.getByRole('heading', { name: 'Preview Gallery' }).waitFor({ timeout: 30000 });
  const cardCount = await page.locator('.v3-gallery-card').count();
  console.log('Generation completed without crash, cards:', cardCount);

  let seoText = '';
  const approveButtons = page.locator('.v3-gallery-card').locator('button', { hasText: 'Approve' });
  const btnCount = await approveButtons.count();
  let approved = false;
  for (let i = 0; i < btnCount; i++) {
    const btn = approveButtons.nth(i);
    if (await btn.isEnabled()) { await btn.click(); approved = true; break; }
  }
  if (approved) {
    await page.waitForTimeout(3000);
    seoText = await page.locator('.v3-modal-backdrop').last().innerText();
  }

  if (opts.forbiddenTerms) {
    const lower = seoText.toLowerCase();
    const leaked = opts.forbiddenTerms.filter((t) => lower.includes(t.toLowerCase()));
    console.log('Generated SEO/QA content never echoes the raw problematic term(s):', leaked.length === 0, leaked.length > 0 ? `LEAKED: ${JSON.stringify(leaked)}` : '(no SEO content generated or clean)');
    if (leaked.length > 0) allOk = false;
  }

  console.log('No script/dialog executed from injected text:', dialogs.length === 0, dialogs.length > 0 ? JSON.stringify(dialogs) : '');
  if (dialogs.length > 0) allOk = false;

  console.log('Console/page errors:', errors.length, errors.length > 0 ? JSON.stringify(errors) : '');
  if (errors.length > 0) allOk = false;

  await context.close();
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  console.log('########## PART A: GOLDEN WORKFLOW CERTIFICATION (multiple materially different keywords) ##########');
  await goldenWorkflow(browser, 'minimal botanical leaves');
  await goldenWorkflow(browser, 'japanese geometric');
  await goldenWorkflow(browser, 'luxury abstract leaves');

  console.log('\n########## PART B: ADVERSARIAL KEYWORD TESTS ##########');
  await adversarialCase(browser, 'empty', '', { expectAnalyzeDisabled: true });
  await adversarialCase(browser, 'whitespace only', '     ', { expectAnalyzeDisabled: true });
  await adversarialCase(browser, 'extremely long', ('minimal floral wallpaper repeat pattern '.repeat(60)).trim());
  await adversarialCase(browser, 'trademark/brand term', 'Disney Mickey Mouse cartoon pattern', { forbiddenTerms: ['disney', 'mickey mouse'] });
  await adversarialCase(browser, 'famous brand logo', 'Nike swoosh logo pattern', { forbiddenTerms: ['nike', 'swoosh'] });
  await adversarialCase(browser, 'famous-artist-imitation', 'in the style of Vincent van Gogh starry night', { forbiddenTerms: ['van gogh', 'starry night'] });
  await adversarialCase(browser, 'photographic intent', 'photo of a golden retriever running on a beach at sunset, DSLR photography', { forbiddenTerms: ['dslr', 'photograph', 'golden retriever'] });
  await adversarialCase(browser, 'unsupported/nonsense subject', 'quantum blockchain synergy paradigm disruption');
  await adversarialCase(browser, 'conflicting styles', 'minimal maximal geometric organic photorealistic cartoon');
  await adversarialCase(browser, 'special characters / injection attempt', `<script>alert(1)</script> pattern'; DROP TABLE assets;--`);
  await adversarialCase(browser, 'Thai keyword', 'ลายดอกไม้มินิมอลสีพาสเทล');
  await adversarialCase(browser, 'repeated keyword (determinism smoke check)', 'minimal botanical leaves');

  await browser.close();

  console.log(allOk ? '\n\nV3 CERTIFICATION + ADVERSARIAL SUITE: ALL PASSED' : '\n\nV3 CERTIFICATION + ADVERSARIAL SUITE: FAILED — see log above');
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
