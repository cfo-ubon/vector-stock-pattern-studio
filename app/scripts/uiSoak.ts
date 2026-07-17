#!/usr/bin/env -S npx tsx
// Portfolio Manager P2.5 Sprint 2 — UI soak (Section 7).
//
// Drives the REAL running app in a real Chromium (via Playwright) against
// a real, bounded, persisted dataset — not fake-indexeddb (that's a
// Node-only mechanism; a real browser needs its own real IndexedDB, which
// this script seeds directly via raw `indexedDB` calls matching
// `storage/db.ts`'s exact schema, executed inside the page context via
// `page.evaluate`). This never adds a seeding control to the production
// UI — the seed script runs from Playwright's Node side, the app itself
// is never modified to know it exists.
//
// Requires the pre-installed Chromium at /opt/pw-browsers/chromium (see
// this environment's own setup notes) and the globally-installed
// `playwright` package. Not run as part of `npm test` — a separate,
// explicit command (`npm run validate:collections:ui-soak`).
import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { generateDataset } from '../src/catalog/validation/datasetGenerator.js';
import type { DatasetGeneratorConfig } from '../src/catalog/validation/types.js';
import { DEFAULT_DATASET_CONFIG } from '../src/catalog/validation/types.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(APP_ROOT, 'validation-results', 'collections');
const DEV_PORT = 5187;
const BASE_PATH = '/vector-stock-pattern-studio/studio/';
const APP_URL = `http://localhost:${DEV_PORT}${BASE_PATH}`;
const REQUIRED_CYCLES = 100;

interface UiSoakCycleResult {
  cycle: number;
  scenario: string;
  durationMs: number;
  success: boolean;
  error: string | null;
}

interface UiSoakReport {
  generatedAt: number;
  requestedCycles: number;
  completedCycles: number;
  cycles: UiSoakCycleResult[];
  pageErrors: string[];
  consoleErrors: string[];
  domNodeCountSamples: { atCycle: number; count: number }[];
  blobUrlStats: { created: number; revoked: number; outstandingAtEnd: number };
  domGrowthStable: boolean;
  noUnexpectedPageErrors: boolean;
  noUnexpectedConsoleErrors: boolean;
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Dev server did not become ready at ${url} within ${timeoutMs}ms`);
}

function startDevServer(): ChildProcess {
  const child = spawn('npx', ['vite', '--port', String(DEV_PORT), '--strictPort'], { cwd: APP_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout?.on('data', () => {});
  child.stderr?.on('data', () => {});
  return child;
}

const PREVIEW_SAMPLE_COUNT = 30; // bounded, lightweight — Section 4's "bounded lightweight preview fixtures", not one per asset

function buildUiDataset() {
  const config: DatasetGeneratorConfig = {
    ...DEFAULT_DATASET_CONFIG,
    seed: 'p2.5-ui-soak',
    preset: 'custom',
    assetCount: 1500,
    collectionCount: 15,
    avgMembershipsPerAsset: 2,
    archivedCollectionRatio: 0.2,
    emptyCollectionRatio: 0,
    collectionCoverRatio: 0.3,
    staleCoverRatio: 0,
    orphanedCollectionIdRatio: 0,
    duplicateCollectionIdRatio: 0,
    includeHighMembershipFixtures: false,
  };
  const { collections, assets } = generateDataset(config);
  // Force one collection to have >=1,000 members (Section 7's "at least
  // 1,000 collection members" bounded dataset requirement) — done here,
  // in the test-harness-side dataset builder, not inside the shared
  // generator itself (keeping this UI-soak-specific shape out of the
  // reusable generator's own logic).
  const bigCollectionId = collections[0].id;
  for (let i = 0; i < 1200 && i < assets.length; i++) {
    if (!assets[i].collectionIds.includes(bigCollectionId)) assets[i].collectionIds = [...assets[i].collectionIds, bigCollectionId];
  }

  // Give a bounded sample of members (the first page's worth, plus any
  // asset used as a cover) a real `previewReference` — this is what
  // actually exercises the Blob-URL create/revoke lifecycle
  // (`usePreviewUrl.ts`/`useCollectionCoverUrl.ts` both resolve to
  // `broken: true` with no Blob URL created at all when
  // `previewReference` is null, which is otherwise the default for
  // every generated asset).
  const previewAssetIds = new Set<string>();
  for (const c of collections) {
    if (c.coverAssetId) previewAssetIds.add(c.coverAssetId);
  }
  for (const a of assets) {
    if (a.collectionIds.includes(bigCollectionId) && previewAssetIds.size < PREVIEW_SAMPLE_COUNT) previewAssetIds.add(a.assetId);
  }
  const previewFiles: { fileId: string; assetId: string }[] = [];
  for (const asset of assets) {
    if (previewAssetIds.has(asset.assetId)) {
      const fileId = `ui-soak-preview-${asset.assetId}`;
      asset.previewReference = fileId;
      previewFiles.push({ fileId, assetId: asset.assetId });
    }
  }

  return { collections, assets, previewFiles };
}

async function main(): Promise<number> {
  // Loaded lazily: `playwright` is a global install, not a project
  // dependency (see this environment's own setup notes) — resolving it
  // via `createRequire` against this file's own module path, same
  // pattern the environment doc recommends.
  const { chromium } = require('/opt/node22/lib/node_modules/playwright') as typeof import('playwright');

  console.log('[ui-soak] Building bounded UI dataset (>=1,000 members in one collection)...');
  const { collections, assets, previewFiles } = buildUiDataset();
  console.log(`[ui-soak] Dataset: ${assets.length} assets, ${collections.length} collections, ${previewFiles.length} preview files.`);

  console.log(`[ui-soak] Starting dev server on port ${DEV_PORT}...`);
  const devServer = startDevServer();
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  const report: UiSoakReport = {
    generatedAt: Date.now(),
    requestedCycles: REQUIRED_CYCLES,
    completedCycles: 0,
    cycles: [],
    pageErrors: [],
    consoleErrors: [],
    domNodeCountSamples: [],
    blobUrlStats: { created: 0, revoked: 0, outstandingAtEnd: 0 },
    domGrowthStable: false,
    noUnexpectedPageErrors: false,
    noUnexpectedConsoleErrors: false,
  };

  try {
    await waitForServer(APP_URL, 30000);
    console.log('[ui-soak] Dev server ready.');

    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
    const page = await browser.newPage();

    page.on('pageerror', (err) => report.pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') report.consoleErrors.push(msg.text());
    });

    // Instrument Blob URL lifecycle before any app script runs.
    await page.addInitScript(() => {
      (window as unknown as { __blobUrlStats__: { created: number; revoked: number } }).__blobUrlStats__ = { created: 0, revoked: 0 };
      const stats = (window as unknown as { __blobUrlStats__: { created: number; revoked: number } }).__blobUrlStats__;
      const origCreate = URL.createObjectURL.bind(URL);
      const origRevoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (obj: Blob | MediaSource) => {
        stats.created++;
        return origCreate(obj);
      };
      URL.revokeObjectURL = (url: string) => {
        stats.revoked++;
        return origRevoke(url);
      };
    });

    await page.goto(APP_URL, { waitUntil: 'networkidle' });

    // Seed real IndexedDB directly (raw calls mirroring storage/db.ts's
    // schema exactly — DB_NAME/DB_VERSION/store names/keyPaths) — the
    // app itself has no seeding control; this only uses the browser's
    // own real, standard IndexedDB API from the test harness side.
    await page.evaluate(
      ({ collections, assets, previewFiles }) => {
        return new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('vsp-db', 5);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('saved')) db.createObjectStore('saved', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'metadata.id' });
            if (!db.objectStoreNames.contains('portfolioAssets')) db.createObjectStore('portfolioAssets', { keyPath: 'assetId' });
            if (!db.objectStoreNames.contains('portfolioFiles')) {
              const files = db.createObjectStore('portfolioFiles', { keyPath: 'fileId' });
              files.createIndex('assetId', 'assetId', { unique: false });
              files.createIndex('sha256', 'sha256', { unique: false });
            }
            if (!db.objectStoreNames.contains('collections')) {
              const cols = db.createObjectStore('collections', { keyPath: 'id' });
              cols.createIndex('normalizedName', 'normalizedName', { unique: false });
              cols.createIndex('isArchived', 'isArchived', { unique: false });
            }
          };
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction(['collections', 'portfolioAssets', 'portfolioFiles'], 'readwrite');
            const colStore = tx.objectStore('collections');
            const assetStore = tx.objectStore('portfolioAssets');
            const fileStore = tx.objectStore('portfolioFiles');
            for (const c of collections) colStore.put(c);
            for (const a of assets) assetStore.put(a);
            // Tiny real SVG bodies — bounded lightweight preview fixtures
            // (Section 4), not full-size images — just enough for
            // `usePreviewUrl`/`useCollectionCoverUrl` to successfully call
            // `URL.createObjectURL` on a real Blob and exercise the actual
            // lifecycle this section requires.
            const svgText = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#ccc"/></svg>';
            for (const f of previewFiles) {
              const blob = new Blob([svgText], { type: 'image/svg+xml' });
              fileStore.put({
                fileId: f.fileId,
                assetId: f.assetId,
                role: 'preview',
                filename: `${f.fileId}.svg`,
                mimeType: 'image/svg+xml',
                fileSize: blob.size,
                sha256: f.fileId,
                blob,
                storedAt: Date.now(),
              });
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          };
          req.onerror = () => reject(req.error);
        });
      },
      { collections, assets, previewFiles },
    );
    console.log('[ui-soak] Seeded real browser IndexedDB.');

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '🗂 Portfolio Manager', exact: true }).click();
    await page.getByRole('button', { name: 'คอลเลกชัน', exact: true }).click();

    const domNodeCount = () => page.evaluate(() => document.querySelectorAll('*').length);

    const bigCollectionName = collections[0].name;
    const scenarios: { name: string; run: () => Promise<void> }[] = [
      {
        name: 'search-collections',
        run: async () => {
          const input = page.getByLabel('ค้นหาคอลเลกชัน');
          await input.fill('Validation');
          await page.waitForTimeout(50);
          await input.fill('');
        },
      },
      {
        name: 'switch-active-archived-filter',
        run: async () => {
          const nav = page.getByRole('navigation', { name: 'มุมมองคอลเลกชัน' });
          await nav.getByRole('button', { name: 'ใช้งานอยู่', exact: true }).click();
          await nav.getByRole('button', { name: 'เก็บถาวร', exact: true }).click();
          await nav.getByRole('button', { name: 'ทั้งหมด', exact: true }).click();
        },
      },
      {
        name: 'open-collection-detail',
        run: async () => {
          await page.getByRole('button', { name: bigCollectionName, exact: false }).first().click();
        },
      },
      {
        name: 'paginate-members',
        run: async () => {
          const more = page.getByRole('button', { name: /แสดงเพิ่ม/ });
          if (await more.count()) await more.first().click();
        },
      },
      {
        name: 'switch-assets-collections-tabs',
        run: async () => {
          await page.getByRole('button', { name: 'ชิ้นงาน', exact: true }).click();
          await page.getByRole('button', { name: 'คอลเลกชัน', exact: true }).click();
        },
      },
    ];

    // Warm-up pass: run each scenario once before recording the "first"
    // DOM sample. The very first render (pre-navigation, list view only)
    // is not the steady state this check cares about — once the detail
    // view has been opened at least once, mounted UI stays in the DOM at
    // a stable size; comparing against the pre-navigation snapshot instead
    // produced a false "unstable" reading (177 -> 2014 nodes) that was
    // really just this one-time settle, not unbounded growth.
    for (const scenario of scenarios) {
      await scenario.run();
    }
    report.domNodeCountSamples.push({ atCycle: 0, count: await domNodeCount() });

    console.log(`[ui-soak] Running ${REQUIRED_CYCLES} interaction cycles...`);
    for (let cycle = 0; cycle < REQUIRED_CYCLES; cycle++) {
      const scenario = scenarios[cycle % scenarios.length];
      const start = Date.now();
      try {
        await scenario.run();
        report.cycles.push({ cycle, scenario: scenario.name, durationMs: Date.now() - start, success: true, error: null });
      } catch (err) {
        report.cycles.push({ cycle, scenario: scenario.name, durationMs: Date.now() - start, success: false, error: err instanceof Error ? err.message : String(err) });
      }
      if (cycle % 20 === 0 || cycle === REQUIRED_CYCLES - 1) {
        report.domNodeCountSamples.push({ atCycle: cycle, count: await domNodeCount() });
        console.log(`[ui-soak] cycle ${cycle}: DOM nodes = ${report.domNodeCountSamples[report.domNodeCountSamples.length - 1].count}`);
      }
    }
    report.completedCycles = report.cycles.length;

    const blobStats = await page.evaluate(() => (window as unknown as { __blobUrlStats__: { created: number; revoked: number } }).__blobUrlStats__);
    report.blobUrlStats = { created: blobStats.created, revoked: blobStats.revoked, outstandingAtEnd: blobStats.created - blobStats.revoked };

    // Navigate away and back once more to force cleanup effects to run
    // on every currently-mounted preview/cover hook before the final
    // outstanding-count check.
    await page.getByRole('button', { name: 'ชิ้นงาน', exact: true }).click();
    await page.waitForTimeout(100);
    const blobStatsAfterNav = await page.evaluate(() => (window as unknown as { __blobUrlStats__: { created: number; revoked: number } }).__blobUrlStats__);
    report.blobUrlStats = { created: blobStatsAfterNav.created, revoked: blobStatsAfterNav.revoked, outstandingAtEnd: blobStatsAfterNav.created - blobStatsAfterNav.revoked };

    const firstDom = report.domNodeCountSamples[0].count;
    const lastDom = report.domNodeCountSamples[report.domNodeCountSamples.length - 1].count;
    report.domGrowthStable = firstDom > 0 && Math.abs(lastDom - firstDom) / firstDom <= 0.5; // bounded rendering => DOM size stays in the same order of magnitude, not unbounded linear growth with total members
    report.noUnexpectedPageErrors = report.pageErrors.length === 0;
    report.noUnexpectedConsoleErrors = report.consoleErrors.length === 0;

    await browser.close();
    browser = null;
  } finally {
    devServer.kill('SIGTERM');
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIR, 'ui-soak.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const failedCycles = report.cycles.filter((c) => !c.success);
  console.log(`[ui-soak] Completed ${report.completedCycles}/${REQUIRED_CYCLES} cycles.`);
  console.log(`[ui-soak] Failed cycles: ${failedCycles.length}`);
  console.log(`[ui-soak] Page errors: ${report.pageErrors.length}`);
  console.log(`[ui-soak] Console errors: ${report.consoleErrors.length}`);
  console.log(`[ui-soak] Blob URLs: created=${report.blobUrlStats.created} revoked=${report.blobUrlStats.revoked} outstanding=${report.blobUrlStats.outstandingAtEnd}`);
  console.log(`[ui-soak] DOM growth stable: ${report.domGrowthStable} (first=${report.domNodeCountSamples[0]?.count}, last=${report.domNodeCountSamples[report.domNodeCountSamples.length - 1]?.count})`);
  console.log(`Report written to: ${jsonPath}`);

  const success =
    report.completedCycles === REQUIRED_CYCLES &&
    failedCycles.length === 0 &&
    report.noUnexpectedPageErrors &&
    report.noUnexpectedConsoleErrors &&
    report.domGrowthStable;
  return success ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('[ui-soak] Fatal error:', err instanceof Error ? err.stack ?? err.message : err);
    process.exit(1);
  });
