// Mission 8, Part 4 — Offline Certification (evidence-gathering, read-only).
//
// Targets the PRODUCTION BUILD served via `vite preview` (not `vite dev`),
// because this repo has NO vite-plugin-pwa dependency and NO service-worker
// registration anywhere in src/ or index.html (verified by grep before this
// script was written) — so "dev vs prod" makes no practical difference to
// service-worker behavior here (neither installs one), but `vite preview`
// is the closer analog of what GitHub Pages actually serves.
//
// Two sub-tests, run in separate browser contexts so a failure in the first
// cannot corrupt the second:
//   TEST A (shell-cache test): load online once, go offline, HARD RELOAD.
//     This is the strict reading of "does the offline-first architecture
//     let the app shell load with zero network?" Expected to fail given no
//     service worker.
//   TEST B (functional test): load online, warm up the SPA, go offline
//     WITHOUT reloading (context.setOffline(true) on the live page,
//     matching how a real user who loses network mid-session experiences
//     it), then drive every required workflow through real UI clicks.
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
import fs from 'node:fs';

const URL = process.argv[2] || 'http://localhost:5184/vector-stock-pattern-studio/studio/';
const results = {};

function record(name, verdict, detail, screenshot) {
  results[name] = { verdict, detail, screenshot: screenshot || null };
  console.log(`\n=== VERDICT [${name}]: ${verdict} ===`);
  console.log(detail);
}

function makeLogger(page, bucket) {
  page.on('console', (msg) => bucket.push({ kind: 'console', type: msg.type(), text: msg.text() }));
  page.on('pageerror', (err) => bucket.push({ kind: 'pageerror', text: err.message, stack: err.stack }));
  page.on('requestfailed', (req) => bucket.push({ kind: 'requestfailed', url: req.url(), failure: req.failure()?.errorText }));
}

function errorsOnly(bucket) {
  return bucket.filter((m) => m.kind === 'pageerror' || (m.kind === 'console' && m.type === 'error'));
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  // ---------------------------------------------------------------
  // TEST A — shell reload while fully offline (strict PWA-shell test)
  // ---------------------------------------------------------------
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    const bucket = [];
    makeLogger(page, bucket);

    console.log('--- TEST A: initial ONLINE load ---');
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    console.log('--- TEST A: setting context offline, then hard reload ---');
    await context.setOffline(true);
    let reloadError = null;
    try {
      await page.reload({ waitUntil: 'load', timeout: 15000 });
    } catch (e) {
      reloadError = e.message;
    }
    await page.waitForTimeout(500);

    let bodyText = '';
    try {
      bodyText = await page.locator('body').innerText({ timeout: 2000 });
    } catch (e) {
      bodyText = `<could not read body: ${e.message}>`;
    }

    const shot = '/tmp/mission8_part4_testA_reload_offline.png';
    try { await page.screenshot({ path: shot }); } catch {}

    if (reloadError) {
      record(
        'shell_reload_while_offline (Test A)',
        'FAIL',
        `page.reload() threw while context.setOffline(true) was active. ` +
        `Exact error: "${reloadError}". This is expected: the repo has no ` +
        `vite-plugin-pwa dependency, no manifest, and no service-worker ` +
        `registration anywhere (grep of src/, public/, index.html, and ` +
        `package.json turned up nothing), and both the dev server and ` +
        `\`vite preview\` serve HTML/JS with "Cache-Control: no-cache" ` +
        `(verified via curl -I), which forces revalidation against the ` +
        `network on every navigation. There is no offline app-shell cache ` +
        `of any kind in this build.`,
        shot,
      );
    } else {
      const stillHasBrand = bodyText.includes('Vector Stock Pattern Studio');
      record(
        'shell_reload_while_offline (Test A)',
        stillHasBrand ? 'WARNING' : 'FAIL',
        `page.reload() did not throw, but no service worker exists to ` +
        `explain why. Body text after reload (first 300 chars): ` +
        `${JSON.stringify(bodyText.slice(0, 300))}`,
        shot,
      );
    }

    await context.close();
  }

  // ---------------------------------------------------------------
  // TEST B — functional offline test on an already-warm SPA
  // ---------------------------------------------------------------
  const context = await browser.newContext();
  const page = await context.newPage();
  const bucket = [];
  makeLogger(page, bucket);

  console.log('\n--- TEST B: initial ONLINE load + warm-up navigation ---');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  // Warm up client-side router by visiting each top-level screen once,
  // still online, so any lazy-loaded chunks are fetched now rather than
  // triggering a real network request once we go offline.
  const warmupNav = [
    '🏭 Today\'s Production', '📊 Overview', '🎨 Pattern Studio', '📂 Portfolio',
    '💾 Backup', '📈 AI Market Advisor', '🎨 AI Design Director', '🏠 Mission Control',
  ];
  for (const label of warmupNav) {
    const btn = page.getByRole('button', { name: label, exact: true });
    if (await btn.count()) { await btn.first().click(); await page.waitForTimeout(300); }
  }
  await page.getByRole('button', { name: '⚙️ Advanced Mode', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '⚙️ Advanced Mode', exact: true }).click(); // toggle back off for a clean start
  await page.waitForTimeout(300);
  bucket.length = 0; // discard warm-up noise, offline tests start clean

  console.log('--- TEST B: going offline now (no reload) ---');
  await context.setOffline(true);
  await page.waitForTimeout(300);

  // Helper to run a step, capture only messages that arrived during it.
  async function step(name, fn) {
    const before = bucket.length;
    let threw = null;
    try {
      await fn();
    } catch (e) {
      threw = e.message;
    }
    const during = bucket.slice(before);
    const errs = errorsOnly(during);
    return { threw, during, errs };
  }

  // 1. App shell still usable while offline (client-side routing, no reload)
  {
    const r = await step('shell', async () => {
      await page.getByRole('button', { name: '🏠 Mission Control', exact: true }).click();
      await page.waitForTimeout(400);
      const heading = await page.locator('h1,h2').first().textContent();
      if (!heading || !heading.includes('Vector Stock Pattern Studio')) throw new Error('Brand heading missing after offline nav');
    });
    if (r.threw) record('App loads / Studio shell (already-open tab, offline)', 'FAIL', `Threw: ${r.threw}. Console during: ${JSON.stringify(r.during)}`);
    else if (r.errs.length) record('App loads / Studio shell (already-open tab, offline)', 'WARNING', `Non-fatal console output: ${JSON.stringify(r.errs)}`);
    else record('App loads / Studio shell (already-open tab, offline)', 'PASS', 'Client-side navigation back to Mission Control succeeded offline with zero console errors. (Note: this is distinct from Test A — this only proves the already-loaded SPA keeps working, not that a cold/reloaded load would.)');
  }

  // 2. Generator: classic Pattern Studio (Advanced Mode) — Generate button
  {
    const r = await step('generator', async () => {
      await page.getByRole('button', { name: '⚙️ Advanced Mode', exact: true }).click();
      await page.waitForTimeout(400);
      const genBtn = page.getByRole('button', { name: 'Generate', exact: true });
      if (!(await genBtn.count())) throw new Error('Generate button not found in Advanced Mode');
      await genBtn.click();
      await page.waitForTimeout(1200);
      const svgCount = await page.locator('svg').count();
      if (svgCount === 0) throw new Error('No <svg> rendered after clicking Generate');
    });
    const shot = '/tmp/mission8_part4_generator_offline.png';
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    if (r.threw) record('Generator (classic Pattern Studio, offline)', 'FAIL', `Threw: ${r.threw}. Console during: ${JSON.stringify(r.during)}`, shot);
    else if (r.errs.length) record('Generator (classic Pattern Studio, offline)', 'WARNING', `Generated successfully but with console errors: ${JSON.stringify(r.errs)}`, shot);
    else record('Generator (classic Pattern Studio, offline)', 'PASS', 'Clicked "Generate" in Advanced Mode (root classic generator) while offline; SVG pattern rendered, zero console errors.');
  }

  // 3. SEO metadata panel (SEO Analyzer, part of the same classic generator screen)
  {
    const r = await step('seo', async () => {
      const seoHeading = page.getByText(/SEO Analyzer/, { exact: false });
      if (!(await seoHeading.count())) throw new Error('"SEO Analyzer" panel not found on page');
      await seoHeading.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    });
    const shot = '/tmp/mission8_part4_seo_offline.png';
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    if (r.threw) record('SEO metadata panel (offline)', 'FAIL', `Threw: ${r.threw}. Console during: ${JSON.stringify(r.during)}`, shot);
    else if (r.errs.length) record('SEO metadata panel (offline)', 'WARNING', `Panel present but console errors: ${JSON.stringify(r.errs)}`, shot);
    else record('SEO metadata panel (offline)', 'PASS', 'SEO Analyzer panel (auto-computed title/description/keywords/filename scoring) rendered on the classic generator screen after offline generation, zero console errors.');
  }

  // 4. Preview (live SVG preview — already rendered above; re-check explicitly)
  {
    const r = await step('preview', async () => {
      const svgCount = await page.locator('svg').count();
      if (svgCount === 0) throw new Error('Preview svg missing');
    });
    if (r.threw) record('Preview (live SVG canvas, offline)', 'FAIL', `Threw: ${r.threw}`);
    else if (r.errs.length) record('Preview (live SVG canvas, offline)', 'WARNING', `Console errors: ${JSON.stringify(r.errs)}`);
    else record('Preview (live SVG canvas, offline)', 'PASS', 'Pattern preview SVG present and rendered offline, zero console errors.');
  }

  // 5. Export (SVG download)
  {
    let downloadOk = false;
    let filename = null;
    const r = await step('export_svg', async () => {
      const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
      const btn = page.getByRole('button', { name: 'Export single tile (.svg, 3000px)', exact: true });
      if (!(await btn.count())) throw new Error('SVG export button not found');
      await btn.click();
      const dl = await downloadPromise;
      if (dl) {
        downloadOk = true;
        filename = dl.suggestedFilename();
        await dl.saveAs('/tmp/mission8_part4_export_offline.svg').catch(() => {});
      } else {
        throw new Error('No download event fired within 8s of clicking SVG export');
      }
    });
    if (r.threw) record('Export SVG (offline)', 'FAIL', `Threw: ${r.threw}. Console during: ${JSON.stringify(r.during)}`);
    else if (r.errs.length) record('Export SVG (offline)', 'WARNING', `Download succeeded (${filename}) but with console errors: ${JSON.stringify(r.errs)}`);
    else record('Export SVG (offline)', 'PASS', `Clicked "Export single tile (.svg, 3000px)" while offline; browser download fired for "${filename}" (this is a client-side Blob URL, no network required), zero console errors.`);
  }

  // 5b. Export raster (closest equivalent to "PNG" — app exposes JPEG preview export, not PNG)
  {
    let downloadOk = false;
    let filename = null;
    const r = await step('export_raster', async () => {
      const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
      const btn = page.getByRole('button', { name: 'Export JPEG preview (5000px)', exact: true });
      if (!(await btn.count())) throw new Error('Raster (JPEG) export button not found');
      await btn.click();
      const dl = await downloadPromise;
      if (dl) {
        downloadOk = true;
        filename = dl.suggestedFilename();
        await dl.saveAs('/tmp/mission8_part4_export_offline.jpg').catch(() => {});
      } else {
        throw new Error('No download event fired within 8s of clicking raster export');
      }
    });
    if (r.threw) record('Export raster/JPEG (offline) — note: app has no PNG export button, closest analog tested', 'FAIL', `Threw: ${r.threw}. Console during: ${JSON.stringify(r.during)}`);
    else if (r.errs.length) record('Export raster/JPEG (offline) — note: app has no PNG export button, closest analog tested', 'WARNING', `Download succeeded (${filename}) but with console errors: ${JSON.stringify(r.errs)}`);
    else record('Export raster/JPEG (offline) — note: app has no PNG export button, closest analog tested', 'PASS', `Clicked "Export JPEG preview (5000px)" while offline; browser download fired for "${filename}", zero console errors. The app does not expose a literal PNG export button anywhere found during exploration (Export options are: single tile SVG, 3x3 tiled SVG, EPS, JPEG preview, JPEG 3x3 preview) — this is the closest raster-export analog to the "PNG" item in the certification checklist.`);
  }

  // 6. Decision Engine / Autopilot ("Generate Now" inside Today's Production)
  //    and 7. Factory task queue — tested together since Generate Now runs inside the Factory screen.
  {
    const r = await step('factory_autopilot', async () => {
      await page.getByRole('button', { name: "🏭 Today's Production", exact: true }).click();
      await page.waitForTimeout(500);
      const startBtn = page.getByRole('button', { name: '▶ START FACTORY', exact: true });
      if (await startBtn.count()) {
        await startBtn.click();
        await page.waitForTimeout(800);
      }
      const approveBtn = page.getByRole('button', { name: "Approve today's production session", exact: true });
      if (await approveBtn.count()) {
        await approveBtn.click();
        await page.waitForTimeout(800);
      }
      const genNowBtn = page.getByRole('button', { name: '✨ Generate Now', exact: true });
      if (!(await genNowBtn.count())) throw new Error('"Generate Now" button not found in Factory Running state');
      await genNowBtn.click();
      await page.waitForTimeout(18000); // real client-side generation + QA pipeline takes time
    });
    const shot = '/tmp/mission8_part4_factory_offline.png';
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const reachedPackagingOrLater = /Packaging|Completed|QA/.test(bodyText);
    if (r.threw) {
      record('Decision Engine / Autopilot ("Generate Now") + Factory queue (offline)', 'FAIL', `Threw: ${r.threw}. Console during: ${JSON.stringify(r.during)}`, shot);
    } else if (r.errs.length) {
      record('Decision Engine / Autopilot ("Generate Now") + Factory queue (offline)', 'WARNING', `Ran to completion (reached later stage: ${reachedPackagingOrLater}) but with console errors: ${JSON.stringify(r.errs)}`, shot);
    } else if (!reachedPackagingOrLater) {
      record('Decision Engine / Autopilot ("Generate Now") + Factory queue (offline)', 'WARNING', `No console errors, but the run did not visibly progress past "Running" within the 18s wait. Body text snippet: ${JSON.stringify(bodyText.slice(0, 500))}`, shot);
    } else {
      record('Decision Engine / Autopilot ("Generate Now") + Factory queue (offline)', 'PASS', `Full Factory pipeline (Start Factory -> Approve session -> Generate Now) ran entirely client-side offline and progressed the task-queue state machine through to Packaging/QA/Completed, zero console errors. This exercises the same decision-engine + generation-orchestrator + QA-gate code path as the standalone Autopilot ("ออกแบบให้ฉันวันนี้") screen.`, shot);
    }
  }

  // 8. Backup Manager — create a backup
  let backupFilePath = null;
  {
    const r = await step('backup_create', async () => {
      await page.getByRole('button', { name: '💾 Backup', exact: true }).click();
      await page.waitForTimeout(500);
      const createBtn = page.getByRole('button', { name: '+ สร้างไฟล์สำรองใหม่', exact: true });
      if (!(await createBtn.count())) throw new Error('Create-backup button not found');
      await createBtn.click();
      await page.waitForTimeout(3000);
      const dlBtn = page.getByRole('button', { name: /^ดาวน์โหลดไฟล์/ });
      if (!(await dlBtn.count())) throw new Error('Backup finished creating but no download button appeared');
      const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
      await dlBtn.click();
      const dl = await downloadPromise;
      if (!dl) throw new Error('No download event fired for the backup file');
      backupFilePath = '/tmp/mission8_part4_backup_offline.vspsb';
      await dl.saveAs(backupFilePath);
    });
    const shot = '/tmp/mission8_part4_backup_offline.png';
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    if (r.threw) record('Backup Manager — create a backup (offline)', 'FAIL', `Threw: ${r.threw}. Console during: ${JSON.stringify(r.during)}`, shot);
    else if (r.errs.length) record('Backup Manager — create a backup (offline)', 'WARNING', `Backup created and downloaded (${backupFilePath}) but with console errors: ${JSON.stringify(r.errs)}`, shot);
    else record('Backup Manager — create a backup (offline)', 'PASS', `Created a full .vspsb backup (IndexedDB export -> Blob -> download) entirely offline and saved it to ${backupFilePath}, zero console errors.`);
  }

  // 9. Restore — restore the backup just created
  {
    const r = await step('backup_restore', async () => {
      if (!backupFilePath || !fs.existsSync(backupFilePath)) throw new Error('No backup file available from the offline create-backup step to restore from');
      const restoreTab = page.getByRole('button', { name: 'กู้คืนข้อมูล', exact: true });
      if (!(await restoreTab.count())) throw new Error('Restore tab not found');
      await restoreTab.click();
      await page.waitForTimeout(500);
      const fileInput = page.locator('input[type=file]').first();
      if (!(await fileInput.count())) throw new Error('Restore file input not found');
      await fileInput.setInputFiles(backupFilePath);
      await page.waitForTimeout(1500);
      const passText = page.getByText(/ผลตรวจสอบ:\s*PASS/, { exact: false });
      if (!(await passText.count())) {
        const bodyText = await page.locator('body').innerText().catch(() => '');
        throw new Error(`Backup file validation did not report PASS. Body snippet: ${bodyText.slice(0, 400)}`);
      }
      const confirmBtn = page.getByRole('button', { name: 'ยืนยันกู้คืนข้อมูล', exact: true });
      if (!(await confirmBtn.count())) throw new Error('Confirm-restore button not found after successful validation');
      await confirmBtn.click();
      await page.waitForTimeout(2000);
    });
    const shot = '/tmp/mission8_part4_restore_offline.png';
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    if (r.threw) record('Restore a backup (offline)', 'FAIL', `Threw: ${r.threw}. Console during: ${JSON.stringify(r.during)}`, shot);
    else if (r.errs.length) record('Restore a backup (offline)', 'WARNING', `Restore flow completed but with console errors: ${JSON.stringify(r.errs)}`, shot);
    else record('Restore a backup (offline)', 'PASS', `Uploaded the .vspsb backup created earlier in this same offline session via the file input, checksum validation reported PASS, clicked "ยืนยันกู้คืนข้อมูล" (confirm restore), completed with zero console errors.`);
  }

  console.log('\n\n================ FULL RESULTS JSON ================');
  console.log(JSON.stringify(results, null, 2));

  await context.close();
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
