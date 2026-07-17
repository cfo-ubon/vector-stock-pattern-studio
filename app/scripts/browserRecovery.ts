#!/usr/bin/env -S npx tsx
// Portfolio Manager P2.5 Sprint 3 — real-browser recovery + crash
// simulation (Sections 8-9 of the brief).
//
// Drives the REAL running app in a real Chromium (via Playwright), same
// convention as Sprint 2's `uiSoak.ts`: a real dev server, a real browser,
// real IndexedDB — never `fake-indexeddb` (that's Node-only). Two modes:
//
//   tsx scripts/browserRecovery.ts cycle   Section 8: 100x open/mutate/reload/reopen/validate
//   tsx scripts/browserRecovery.ts crash   Section 9: real OS-level process kill + relaunch against the same disk profile
//
// `cycle` mode uses a normal (non-persistent) launch, same as `uiSoak.ts`
// — disk persistence isn't the point there, UI/data stability across
// repeated reloads is.
//
// `crash` mode needs something `uiSoak.ts` never needed: a REAL,
// disk-backed browser profile that survives an abrupt OS-level kill and
// can be reopened by a second, independent browser launch — proving
// actual IndexedDB durability rather than merely a clean in-process
// restart. `chromium.launchPersistentContext()` cannot do this: Playwright
// treats a persistent context as owning its own browser process
// internally and exposes no child-process handle to kill
// (`context.browser()` returns null for a persistent context). Instead
// this uses `chromium.launchServer({ args: ['--user-data-dir=...'] })`,
// which returns a `BrowserServer` whose `.process()` is a real Node
// `ChildProcess` — `.kill('SIGKILL')` is a real, uncatchable OS signal
// that Chromium (or any process) cannot intercept or gracefully flush
// around, which is exactly the "abrupt process termination" Section 9
// asks for. A second `launchServer` call against the same `--user-data-dir`
// afterwards is a genuinely independent process reopening the same disk
// state — the actual thing being verified.
import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
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
const DEV_PORT = 5188;
const BASE_PATH = '/vector-stock-pattern-studio/studio/';
const APP_URL = `http://localhost:${DEV_PORT}${BASE_PATH}`;

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

function writeJson(label: string, data: unknown): string {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const p = path.join(OUTPUT_DIR, `${label}.json`);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  return p;
}

function loadPlaywright() {
  return require('/opt/node22/lib/node_modules/playwright') as typeof import('playwright');
}

interface RawCollection {
  id: string;
  name: string;
  normalizedName: string;
  isArchived: boolean;
  coverAssetId: string | null;
  updatedAt: number;
}
interface RawAsset {
  assetId: string;
  collectionIds: string[];
}

function buildSeedDataset(seed: string, assetCount: number, collectionCount: number) {
  const config: DatasetGeneratorConfig = {
    ...DEFAULT_DATASET_CONFIG,
    seed,
    preset: 'custom',
    assetCount,
    collectionCount,
    avgMembershipsPerAsset: 0,
    emptyCollectionRatio: 0,
    archivedCollectionRatio: 0,
    collectionCoverRatio: 0,
    staleCoverRatio: 0,
    orphanedCollectionIdRatio: 0,
    duplicateCollectionIdRatio: 0,
    includeHighMembershipFixtures: false,
  };
  return generateDataset(config);
}

// Raw indexedDB seed/read helpers, executed inside the page via
// `page.evaluate` — mirrors `uiSoak.ts`'s exact schema (DB_NAME/
// DB_VERSION/store names/keyPaths from `storage/db.ts`), since the app
// itself has no seeding control and this is the browser's own real
// IndexedDB, not `fake-indexeddb`.
async function openAppDb() {
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
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

interface BrowserIntegritySummary {
  collectionCount: number;
  assetCount: number;
  membershipCount: number;
  duplicateCollectionIds: number;
  orphanedMemberships: number;
  staleCoverReferences: number;
}

/** Re-implements `validateCollectionIntegrity`'s read-only checks
 * directly against the browser's real IndexedDB — the same "the test
 * harness re-derives a read-only check independently rather than
 * importing production code into the browser context" precedent
 * `consistencyManifest.ts` already established (see its own header
 * comment on `duplicateCollectionIdAssetCount`), needed here because
 * `collectionService.ts` cannot be `import`ed into a `page.evaluate`
 * sandbox. */
function browserIntegrityCheckSource(): Promise<BrowserIntegritySummary> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('vsp-db', 5);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(['collections', 'portfolioAssets'], 'readonly');
      const colReq = tx.objectStore('collections').getAll();
      const assetReq = tx.objectStore('portfolioAssets').getAll();
      tx.oncomplete = () => {
        const collections = colReq.result as RawCollection[];
        const assets = assetReq.result as RawAsset[];
        const collectionIdSet = new Set(collections.map((c) => c.id));
        const assetIdSet = new Set(assets.map((a) => a.assetId));
        let membershipCount = 0;
        let duplicateCollectionIds = 0;
        let orphanedMemberships = 0;
        for (const a of assets) {
          membershipCount += a.collectionIds.length;
          if (new Set(a.collectionIds).size < a.collectionIds.length) duplicateCollectionIds++;
          if (a.collectionIds.some((id) => !collectionIdSet.has(id))) orphanedMemberships++;
        }
        let staleCoverReferences = 0;
        for (const c of collections) {
          if (c.coverAssetId && !assetIdSet.has(c.coverAssetId)) staleCoverReferences++;
        }
        resolve({ collectionCount: collections.length, assetCount: assets.length, membershipCount, duplicateCollectionIds, orphanedMemberships, staleCoverReferences });
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------
// Section 8: 100x open/mutate/reload/reopen/validate
// ---------------------------------------------------------------------

interface CycleResult {
  cycle: number;
  durationMs: number;
  success: boolean;
  error: string | null;
  collectionCardCount: number;
  distinctCollectionNames: number;
  integrity: BrowserIntegritySummary;
}

async function runCycleMode(): Promise<number> {
  const { chromium } = loadPlaywright();
  const CYCLES = 100;

  console.log('[browser-recovery:cycle] Building seed dataset...');
  const { collections, assets } = buildSeedDataset('p2.5-sprint3-browser-cycle', 40, 12);
  const targetCollectionId = collections[0].id;
  const targetAssetIds = assets.slice(0, 6).map((a) => a.assetId);

  console.log(`[browser-recovery:cycle] Starting dev server on port ${DEV_PORT}...`);
  const devServer = startDevServer();
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const cycles: CycleResult[] = [];

  try {
    await waitForServer(APP_URL, 30000);
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
    const page = await browser.newPage();
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    await page.evaluate(openAppDb);
    await page.evaluate(
      ({ collections, assets }) => {
        return new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('vsp-db', 5);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction(['collections', 'portfolioAssets'], 'readwrite');
            const colStore = tx.objectStore('collections');
            const assetStore = tx.objectStore('portfolioAssets');
            for (const c of collections) colStore.put(c);
            for (const a of assets) assetStore.put(a);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          };
          req.onerror = () => reject(req.error);
        });
      },
      { collections, assets },
    );
    console.log(`[browser-recovery:cycle] Seeded ${collections.length} collections, ${assets.length} assets. Running ${CYCLES} open/mutate/reload/reopen/validate cycles...`);

    for (let cycle = 0; cycle < CYCLES; cycle++) {
      const start = Date.now();
      let success = true;
      let error: string | null = null;
      try {
        // Mutate: toggle one asset's membership in the target collection —
        // alternating add/remove exercises both write paths every other
        // cycle, all through the same raw-IndexedDB mechanism `uiSoak.ts`
        // already established (real browser IndexedDB, not fake-indexeddb).
        const assetId = targetAssetIds[cycle % targetAssetIds.length];
        const adding = cycle % 2 === 0;
        await page.evaluate(
          ({ assetId, collectionId, adding }) => {
            return new Promise<void>((resolve, reject) => {
              const req = indexedDB.open('vsp-db', 5);
              req.onsuccess = () => {
                const db = req.result;
                const tx = db.transaction('portfolioAssets', 'readwrite');
                const store = tx.objectStore('portfolioAssets');
                const getReq = store.get(assetId);
                getReq.onsuccess = () => {
                  const asset = getReq.result as { assetId: string; collectionIds: string[] };
                  const has = asset.collectionIds.includes(collectionId);
                  if (adding && !has) asset.collectionIds = [...asset.collectionIds, collectionId];
                  if (!adding && has) asset.collectionIds = asset.collectionIds.filter((id) => id !== collectionId);
                  store.put(asset);
                };
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
              };
              req.onerror = () => reject(req.error);
            });
          },
          { assetId, collectionId: targetCollectionId, adding },
        );

        // Reload: a real full page reload, not an in-app navigation —
        // this is what actually exercises "does the app re-render
        // correctly from a cold IndexedDB read every time" rather than
        // relying on in-memory React state surviving between cycles.
        await page.reload({ waitUntil: 'networkidle' });

        // Reopen: navigate back into the Collections view from scratch.
        await page.getByRole('button', { name: '🗂 Portfolio Manager', exact: true }).click();
        await page.getByRole('button', { name: 'คอลเลกชัน', exact: true }).click();

        // Validate: no duplicate rows (card count matches distinct names,
        // both matching the known collection count), and a fresh raw
        // integrity scan finds no orphans/duplicates/stale covers.
        const cards = page.locator('.portfolio-grid button.collection-card .portfolio-thumb-name');
        const names = await cards.allTextContents();
        const collectionCardCount = names.length;
        const distinctCollectionNames = new Set(names).size;
        const integrity = await page.evaluate(browserIntegrityCheckSource);

        if (collectionCardCount !== collections.length) {
          success = false;
          error = `expected ${collections.length} collection cards, saw ${collectionCardCount}`;
        } else if (distinctCollectionNames !== collectionCardCount) {
          success = false;
          error = `duplicate collection row(s): ${collectionCardCount} cards but only ${distinctCollectionNames} distinct names`;
        } else if (integrity.duplicateCollectionIds > 0 || integrity.orphanedMemberships > 0 || integrity.staleCoverReferences > 0) {
          success = false;
          error = `integrity scan found corruption: ${JSON.stringify(integrity)}`;
        }

        cycles.push({ cycle, durationMs: Date.now() - start, success, error, collectionCardCount, distinctCollectionNames, integrity });
      } catch (err) {
        cycles.push({
          cycle,
          durationMs: Date.now() - start,
          success: false,
          error: err instanceof Error ? err.message : String(err),
          collectionCardCount: -1,
          distinctCollectionNames: -1,
          integrity: { collectionCount: -1, assetCount: -1, membershipCount: -1, duplicateCollectionIds: -1, orphanedMemberships: -1, staleCoverReferences: -1 },
        });
      }
      if (cycle % 20 === 0 || cycle === CYCLES - 1) console.log(`[browser-recovery:cycle] cycle ${cycle}: success=${success}`);
    }

    await browser.close();
    browser = null;
  } finally {
    devServer.kill('SIGTERM');
  }

  const failedCycles = cycles.filter((c) => !c.success);
  const report = {
    generatedAt: Date.now(),
    mode: 'cycle' as const,
    requestedCycles: CYCLES,
    completedCycles: cycles.length,
    failedCycles: failedCycles.length,
    pageErrors,
    consoleErrors,
    cycles,
  };
  const jsonPath = writeJson('browser-recovery-cycle', report);
  console.log(`[browser-recovery:cycle] Completed ${cycles.length}/${CYCLES} cycles. Failed: ${failedCycles.length}. Page errors: ${pageErrors.length}. Console errors: ${consoleErrors.length}.`);
  console.log(`Report written to: ${jsonPath}`);

  return failedCycles.length === 0 && pageErrors.length === 0 && consoleErrors.length === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------
// Section 9: real crash simulation via OS-level process kill
// ---------------------------------------------------------------------

interface CrashTrial {
  trial: number;
  committedWriteSurvived: boolean;
  inFlightWritePartial: boolean;
  inFlightWriteFullyPresent: boolean;
  inFlightWriteFullyAbsent: boolean;
  postCrashIntegrityClean: boolean;
  postCrashIntegrity: BrowserIntegritySummary;
}

/** Spawns Chromium directly (bypassing Playwright's own `launch`/
 * `launchServer` APIs) and connects to it over CDP. This is the only way
 * to get BOTH a real, disk-backed `--user-data-dir` (which
 * `launchServer` refuses — it insists on `launchPersistentContext`
 * instead) AND a genuine, killable Node `ChildProcess` handle (which
 * `launchPersistentContext`'s `BrowserContext` never exposes —
 * `context.browser()` is `null` for a persistent context, so there is no
 * process to send a real OS signal to). Spawning the binary ourselves
 * keeps both properties: `proc` is the actual OS process backing the
 * disk profile, killable with an uncatchable `SIGKILL`. */
async function launchKillableChromium(chromium: ReturnType<typeof loadPlaywright>['chromium'], userDataDir: string) {
  const proc = spawn('/opt/pw-browsers/chromium', ['--headless=new', '--disable-gpu', '--no-sandbox', `--user-data-dir=${userDataDir}`, '--remote-debugging-port=0'], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const wsEndpoint = await new Promise<string>((resolve, reject) => {
    let buf = '';
    const onData = (chunk: Buffer) => {
      buf += chunk.toString();
      const match = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        proc.stderr?.off('data', onData);
        resolve(match[1]);
      }
    };
    proc.stderr?.on('data', onData);
    proc.once('exit', (code) => reject(new Error(`Chromium exited before printing a DevTools websocket URL (code ${code})`)));
    setTimeout(() => reject(new Error('Timed out waiting for Chromium DevTools websocket URL')), 15000);
  });
  const browser = await chromium.connectOverCDP(wsEndpoint);
  return { proc, browser };
}

async function runCrashMode(): Promise<number> {
  const { chromium } = loadPlaywright();
  const TRIALS = 5;

  console.log(`[browser-recovery:crash] Starting dev server on port ${DEV_PORT}...`);
  const devServer = startDevServer();
  const trials: CrashTrial[] = [];

  try {
    await waitForServer(APP_URL, 30000);

    for (let trial = 0; trial < TRIALS; trial++) {
      const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsp-crash-'));
      console.log(`[browser-recovery:crash] Trial ${trial}: profile ${userDataDir}`);

      // --- Launch 1: seed a committed baseline write, then start (but do
      // not await) an in-flight bulk write, and kill the OS process as
      // fast as possible afterward. ---
      const { proc: proc1, browser: browser1 } = await launchKillableChromium(chromium, userDataDir);
      // `browser.newContext()` on a CDP-connected browser creates a NEW,
      // separate, in-memory incognito-style context — it does NOT write
      // to the on-disk `--user-data-dir` profile at all, regardless of
      // durability settings. The already-open DEFAULT context (index 0)
      // is the one actually backed by the disk profile Chromium was
      // launched with; using `newContext()` here would silently test
      // nothing about real disk persistence.
      const page1 = await browser1.contexts()[0].newPage();
      await page1.goto(APP_URL, { waitUntil: 'networkidle' });
      await page1.evaluate(openAppDb);

      // Committed write: fully awaited, `oncomplete` observed before
      // moving on — this is what "durability" is actually claiming
      // survives a crash. Uses the default/relaxed durability mode
      // (no explicit `durability` option) — the exact same mode
      // `collectionStore.ts`/`portfolioStore.ts` use everywhere in
      // production — so this measures the real guarantee the app
      // actually gets, not an artificially strengthened one.
      await page1.evaluate((trial) => {
        return new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('vsp-db', 5);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('collections', 'readwrite');
            tx.objectStore('collections').put({
              id: `crash-committed-${trial}`,
              name: `Crash Committed ${trial}`,
              normalizedName: `crash committed ${trial}`,
              isArchived: false,
              coverAssetId: null,
              updatedAt: Date.now(),
            });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          };
          req.onerror = () => reject(req.error);
        });
      }, trial);

      // In-flight write: issue 5 puts but deliberately do NOT await
      // completion — the promise is left pending on purpose so the
      // process can be killed while genuinely mid-transaction, not after
      // a safe, fully-settled point.
      page1
        .evaluate((trial) => {
          return new Promise<void>((resolve, reject) => {
            const req = indexedDB.open('vsp-db', 5);
            req.onsuccess = () => {
              const db = req.result;
              const tx = db.transaction('collections', 'readwrite');
              const store = tx.objectStore('collections');
              for (let i = 0; i < 5; i++) {
                store.put({
                  id: `crash-inflight-${trial}-${i}`,
                  name: `Crash In-Flight ${trial}-${i}`,
                  normalizedName: `crash in-flight ${trial}-${i}`,
                  isArchived: false,
                  coverAssetId: null,
                  updatedAt: Date.now(),
                });
              }
              tx.oncomplete = () => resolve();
              tx.onerror = () => reject(tx.error);
            };
            req.onerror = () => reject(req.error);
          });
        }, trial)
        .catch(() => {}); // the page/process may die before this ever settles — expected, not an error

      // Real, uncatchable OS-level termination — not `browser.close()`
      // (a clean shutdown Chromium can flush around), a real SIGKILL of
      // the actual child process spawned above.
      proc1.kill('SIGKILL');
      await new Promise((r) => setTimeout(r, 300));

      // --- Launch 2: a genuinely independent process reopening the same
      // on-disk profile — the actual thing being verified. ---
      const { proc: proc2, browser: browser2 } = await launchKillableChromium(chromium, userDataDir);
      const page2 = await browser2.contexts()[0].newPage();
      await page2.goto(APP_URL, { waitUntil: 'networkidle' });

      const state = await page2.evaluate((trial) => {
        return new Promise<{ committed: boolean; inFlightCount: number }>((resolve, reject) => {
          const req = indexedDB.open('vsp-db', 5);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('collections', 'readonly');
            const store = tx.objectStore('collections');
            const getCommitted = store.get(`crash-committed-${trial}`);
            const getAll = store.getAll();
            tx.oncomplete = () => {
              const all = getAll.result as { id: string }[];
              const inFlightCount = all.filter((c) => c.id.startsWith(`crash-inflight-${trial}-`)).length;
              resolve({ committed: !!getCommitted.result, inFlightCount });
            };
            tx.onerror = () => reject(tx.error);
          };
          req.onerror = () => reject(req.error);
        });
      }, trial);
      const integrity = await page2.evaluate(browserIntegrityCheckSource);

      await browser2.close();
      await new Promise<void>((resolve) => {
        proc2.once('exit', () => resolve());
        proc2.kill('SIGTERM');
      });
      // Retry cleanup briefly — on some platforms file handles release a
      // moment after process exit, not synchronously with it.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          fs.rmSync(userDataDir, { recursive: true, force: true });
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      const inFlightWriteFullyPresent = state.inFlightCount === 5;
      const inFlightWriteFullyAbsent = state.inFlightCount === 0;
      trials.push({
        trial,
        committedWriteSurvived: state.committed,
        inFlightWritePartial: !inFlightWriteFullyPresent && !inFlightWriteFullyAbsent,
        inFlightWriteFullyPresent,
        inFlightWriteFullyAbsent,
        postCrashIntegrityClean: integrity.duplicateCollectionIds === 0 && integrity.orphanedMemberships === 0 && integrity.staleCoverReferences === 0,
        postCrashIntegrity: integrity,
      });
      console.log(`[browser-recovery:crash] Trial ${trial}: committedSurvived=${state.committed} inFlightCount=${state.inFlightCount}/5 (${inFlightWriteFullyPresent ? 'fully present' : inFlightWriteFullyAbsent ? 'fully absent' : 'PARTIAL — atomicity violation'})`);
    }
  } finally {
    devServer.kill('SIGTERM');
  }

  const allCommittedSurvived = trials.every((t) => t.committedWriteSurvived);
  const anyPartial = trials.some((t) => t.inFlightWritePartial);
  const caughtInFlightAtLeastOnce = trials.some((t) => t.inFlightWriteFullyAbsent);
  const allIntegrityClean = trials.every((t) => t.postCrashIntegrityClean);

  const report = {
    generatedAt: Date.now(),
    mode: 'crash' as const,
    trials: trials.length,
    allCommittedSurvived,
    anyPartial,
    caughtInFlightAtLeastOnce,
    allIntegrityClean,
    detail: trials,
    // Honest limitation: SIGKILL timing relative to IndexedDB's internal
    // flush is not controllable from outside the process — if
    // `caughtInFlightAtLeastOnce` is false across all trials, the kill
    // never actually landed mid-transaction in this run (the in-flight
    // write always finished flushing before the process died). That is
    // NOT the same as proving durability under a genuinely interrupted
    // write — it means this run's timing did not exercise that case. The
    // one claim these trials CAN make regardless of timing luck is the
    // one that was actually checked every trial: never partial (either
    // fully present or fully absent, never some-but-not-all of the 5
    // records) — that is real evidence IndexedDB's transaction atomicity
    // held even across a real, uncatchable OS-level kill.
    note:
      'caughtInFlightAtLeastOnce=false means no trial actually caught the write mid-flight (timing-dependent, not fully controllable from outside the process) — see this field\'s doc comment in browserRecovery.ts. anyPartial=false across all trials is the real, always-checked atomicity claim regardless of timing. The committed-write transaction uses the same default/relaxed durability mode collectionStore.ts/portfolioStore.ts use in production (no explicit durability option). An earlier iteration of this harness used browser.newContext() to get each page, which silently creates a NEW, in-memory, incognito-style CDP context rather than reusing the on-disk default context tied to --user-data-dir — that bug produced a false committedWriteSurvived=false in every trial regardless of durability mode, because the write never touched the disk profile at all. Fixed by using browser.contexts()[0] (the real default context) instead; see the comment at that call site.',
  };
  const jsonPath = writeJson('browser-recovery-crash', report);
  console.log(`[browser-recovery:crash] ${trials.length} trials: allCommittedSurvived=${allCommittedSurvived} anyPartial=${anyPartial} caughtInFlightAtLeastOnce=${caughtInFlightAtLeastOnce} allIntegrityClean=${allIntegrityClean}`);
  console.log(`Report written to: ${jsonPath}`);

  return allCommittedSurvived && !anyPartial && allIntegrityClean ? 0 : 1;
}

async function main(): Promise<number> {
  const mode = process.argv[2] ?? '';
  if (mode === 'cycle') return runCycleMode();
  if (mode === 'crash') return runCrashMode();
  console.error(`Unknown mode "${mode}". Expected one of: cycle, crash.`);
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('[browserRecovery] Fatal error:', err instanceof Error ? (err.stack ?? err.message) : err);
    process.exit(1);
  });
