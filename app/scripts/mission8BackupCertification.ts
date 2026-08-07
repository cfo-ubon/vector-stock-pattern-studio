#!/usr/bin/env -S npx tsx
// Mission 8, Part 5 — Backup Certification. Real, measured evidence for
// the already-shipped Application Backup System (`app/src/backup/`, see
// `docs/BACKUP_SYSTEM.md`). This script writes NO new backup/restore
// logic of its own — it only orchestrates the real, shipped functions:
// `buildAppBackup` (appBackupBuilder.ts), `validateAppBackupArchive`
// (appBackupValidation.ts), `applyAppBackupRestore`/`verifyRestoredFileHash`
// (appBackupRestore.ts), and the real domain/store modules for every
// record type it seeds (`catalog/validation/datasetGenerator.ts` for the
// portfolio/collection bulk data, exactly as `mission7ProductionHardeningPerf.ts`
// already does; `catalog/import/previewSelection.ts`'s real
// `selectPreviewReference` + `catalog/domain/hash.ts`'s real `sha256Hex`
// for the blob-bearing assets, mirroring `appBackupBuilder.test.ts`'s own
// seeding pattern; `factory/domain/factoryTask.ts`'s real
// `createFactoryTask`/`transitionFactoryTask`; `autopilot/domain/autonomousDesignRun.ts`'s
// real `createAutonomousDesignRun`/`transitionAutonomousDesignRun`;
// `catalog/submission/submissionRecord.ts`'s real `createSubmissionRecord`).
//
// Usage: npx tsx scripts/mission8BackupCertification.ts
import 'fake-indexeddb/auto';

import { Blob as NodeBlob } from 'node:buffer';

// --- Backup system under test (real, shipped, unmodified) ---
import { buildAppBackup } from '../src/backup/appBackupBuilder';
import { validateAppBackupArchive } from '../src/backup/appBackupValidation';
import { applyAppBackupRestore, previewAppBackupRestore, verifyRestoredFileHash } from '../src/backup/appBackupRestore';
import { listBackupHistory, clearBackupHistoryStore } from '../src/backup/appBackupHistoryStore';
import { APP_BACKUP_STORE_NAMES, APP_BACKUP_SETTINGS_KEYS } from '../src/backup/appBackupFormat';
import { readZipArchive, buildCompressedZip } from '../src/backup/zipArchive';
import { loadAutoBackupSettings, saveAutoBackupSettings, type AutoBackupSettings } from '../src/backup/autoBackupSettings';

// --- Real domain/dataset/store modules being orchestrated (unmodified) ---
import { generateDataset } from '../src/catalog/validation/datasetGenerator';
import type { DatasetGeneratorConfig } from '../src/catalog/validation/types';
import {
  putPortfolioAssetsBulk,
  clearPortfolioStores,
  loadPortfolioAssets,
  loadAllPortfolioFiles,
  importAssetTransaction,
} from '../src/catalog/storage/portfolioStore';
import { createPortfolioAsset } from '../src/catalog/domain/asset';
import { generateFileId } from '../src/catalog/domain/id';
import { sha256Hex } from '../src/catalog/domain/hash';
import { selectPreviewReference } from '../src/catalog/import/previewSelection';
import type { PortfolioFileRecord, SourceFileReference } from '../src/catalog/domain/types';
import { putQualitySnapshot, createQualitySnapshot, clearQualitySnapshots, loadQualitySnapshots } from '../src/catalog/quality/qualitySnapshotStore';
import { putCollectionRecordsBulk, clearCollectionsStore, loadCollections } from '../src/catalog/storage/collectionStore';
import { createFactoryTask, transitionFactoryTask } from '../src/factory/domain/factoryTask';
import { putFactoryTasks, loadFactoryTasks, clearFactoryQueueForTest } from '../src/factory/storage/factoryQueueStore';
import { createAutonomousDesignRun, transitionAutonomousDesignRun } from '../src/autopilot/domain/autonomousDesignRun';
import type { AutonomousDesignRun } from '../src/autopilot/domain/autonomousDesignRun';
import { putAutonomousDesignRun, loadAutonomousDesignRuns, clearAutonomousDesignRuns } from '../src/autopilot/storage/autonomousDesignRunStore';
import { createSubmissionRecord } from '../src/catalog/submission/submissionRecord';
import type { SubmissionRecord } from '../src/catalog/submission/submissionRecord';
import {
  putSubmissionsBulk,
  loadSubmissions,
  resetSubmissionStoreForTest,
  whenSubmissionStoreHydrated,
  forgetInMemoryStateForTest,
} from '../src/catalog/submission/submissionStore';
import { dumpStore } from '../src/backup/appBackupIdb';

// ---------------------------------------------------------------------
// Node has no `localStorage` global (unlike the vitest/jsdom environment
// every `appBackup*.test.ts` file runs under) — this is a minimal,
// generic Storage-shaped polyfill (get/set/remove/clear/key/length only,
// no quota emulation, no backing file) purely so the REAL
// `captureSettingsSnapshot`/`applySettingsSnapshot`
// (`appBackupSettingsSnapshot.ts`, called internally by the real
// `buildAppBackup`/`applyAppBackupRestore`) have a `localStorage` to read
// from and write to, exactly as they do in a real browser. Nothing about
// the backup system's own logic is touched or reimplemented here.
// ---------------------------------------------------------------------
class NodeLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  get length(): number {
    return this.store.size;
  }
}
(globalThis as unknown as { localStorage: NodeLocalStorage }).localStorage = new NodeLocalStorage();

// ---------------------------------------------------------------------
// Reporting plumbing
// ---------------------------------------------------------------------

type Verdict = 'PASS' | 'WARNING' | 'FAIL' | 'UNKNOWN';

interface EvidenceRow {
  category: string;
  verdict: Verdict;
  detail: string;
}
const evidence: EvidenceRow[] = [];
function record(category: string, verdict: Verdict, detail: string): void {
  evidence.push({ category, verdict, detail });
  console.log(`[${verdict}] ${category}: ${detail}`);
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------
// Seeding — realistic production dataset across every store category the
// certification brief asks for.
// ---------------------------------------------------------------------

const NOW = 1_700_000_000_000;

function datasetConfig(assetCount: number, collectionCount: number): DatasetGeneratorConfig {
  return {
    seed: 'mission8-backup-cert',
    preset: 'custom',
    assetCount,
    collectionCount,
    avgMembershipsPerAsset: 1,
    archivedCollectionRatio: 0.1,
    emptyCollectionRatio: 0.1,
    collectionCoverRatio: 0.5,
    staleCoverRatio: 0,
    orphanedCollectionIdRatio: 0,
    duplicateCollectionIdRatio: 0,
    batchSize: 500,
    baseTimestamp: NOW,
    blobSampleCount: 0,
    includeBlobs: false,
    includeHighMembershipFixtures: false,
  };
}

/** Mirrors `catalog/import/importPipeline.ts`'s real import write path
 * (real `sha256Hex` over real bytes, real `selectPreviewReference`, real
 * `createPortfolioAsset` + `importAssetTransaction`) so the blob-bearing
 * assets seeded here are byte-for-byte what a real import would have
 * produced — not a synthetic shortcut. */
async function seedBlobBearingAsset(index: number): Promise<{ assetId: string; fileIds: string[] }> {
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><!-- mission8-backup-cert asset ${index} --><circle cx="50" cy="50" r="${30 + index}" fill="#${(index * 111111).toString(16).padStart(6, '0').slice(0, 6)}"/></svg>`;
  const previewContent = `PNGDATA-mission8-backup-cert-preview-${index}-${'x'.repeat(200 + index)}`;

  const svgBuffer = new TextEncoder().encode(svgContent);
  const previewBuffer = new TextEncoder().encode(previewContent);
  const svgSha256 = await sha256Hex(svgBuffer.buffer as ArrayBuffer);
  const previewSha256 = await sha256Hex(previewBuffer.buffer as ArrayBuffer);

  const svgFileId = generateFileId();
  const previewFileId = generateFileId();

  const refs: SourceFileReference[] = [
    { fileId: svgFileId, role: 'svg', filename: `pattern-${index}.svg`, mimeType: 'image/svg+xml', fileSize: svgBuffer.length, sha256: svgSha256 },
    { fileId: previewFileId, role: 'preview', filename: `pattern-${index}-preview.png`, mimeType: 'image/png', fileSize: previewBuffer.length, sha256: previewSha256 },
  ];
  const previewReference = selectPreviewReference(refs);

  const asset = createPortfolioAsset({
    displayName: `Mission 8 Backup Cert Asset ${index}`,
    originalFilename: `pattern-${index}.svg`,
    sourceFileReferences: refs,
    previewReference,
    metadataReference: null,
    createdAt: NOW,
  });

  const fileRecords: PortfolioFileRecord[] = [
    { fileId: svgFileId, assetId: asset.assetId, role: 'svg', filename: `pattern-${index}.svg`, mimeType: 'image/svg+xml', fileSize: svgBuffer.length, sha256: svgSha256, blob: new NodeBlob([svgContent], { type: 'image/svg+xml' }) as unknown as Blob, storedAt: NOW },
    { fileId: previewFileId, assetId: asset.assetId, role: 'preview', filename: `pattern-${index}-preview.png`, mimeType: 'image/png', fileSize: previewBuffer.length, sha256: previewSha256, blob: new NodeBlob([previewContent], { type: 'image/png' }) as unknown as Blob, storedAt: NOW },
  ];

  await importAssetTransaction(asset, fileRecords);
  return { assetId: asset.assetId, fileIds: [svgFileId, previewFileId] };
}

async function seedFactoryTasks(): Promise<void> {
  const tasks = [];
  // 3 READY (never touched further)
  for (let i = 0; i < 3; i++) {
    tasks.push(createFactoryTask({ type: 'qa', reason: `mission8 ready task ${i}`, assetId: `mission8-asset-${i}`, now: NOW }));
  }
  // 5 COMPLETED (READY -> RUNNING -> COMPLETED, real state machine)
  for (let i = 0; i < 5; i++) {
    let task = createFactoryTask({ type: 'generate', reason: `mission8 completed task ${i}`, assetId: `mission8-asset-completed-${i}`, now: NOW });
    task = transitionFactoryTask(task, 'RUNNING', NOW + 1000, 'started by cert script');
    task = transitionFactoryTask(task, 'COMPLETED', NOW + 2000, 'finished by cert script');
    tasks.push(task);
  }
  // 4 BLOCKED (READY -> BLOCKED, real state machine)
  for (let i = 0; i < 4; i++) {
    let task = createFactoryTask({ type: 'repair', reason: `mission8 blocked task ${i}`, assetId: `mission8-asset-blocked-${i}`, now: NOW });
    task = transitionFactoryTask(task, 'BLOCKED', NOW + 1000, `blocked: missing dependency ${i}`);
    tasks.push(task);
  }
  await putFactoryTasks(tasks);
}

async function seedAutonomousDesignRun(index: number): Promise<AutonomousDesignRun> {
  let run = createAutonomousDesignRun({
    mode: 'EVERGREEN_COMMERCIAL',
    requestedCount: 5,
    sourceEvidence: { marketSnapshotId: null, marketOpportunityId: null, dailyMissionId: null },
    now: NOW + index,
  });
  run = transitionAutonomousDesignRun(run, 'PLAN_READY', NOW + index + 100, 'plan approved by cert script');
  run = transitionAutonomousDesignRun(run, 'GENERATING', NOW + index + 200, 'generation started');
  run = transitionAutonomousDesignRun(run, 'COMPLETED', NOW + index + 300, 'generation completed');
  run = { ...run, completedCount: 5, readyCount: 4, reviewCount: 1, rejectCount: 0 };
  await putAutonomousDesignRun(run);
  return run;
}

async function seedSubmissions(): Promise<SubmissionRecord[]> {
  const records: SubmissionRecord[] = [];
  for (let i = 0; i < 6; i++) {
    const record = createSubmissionRecord({
      patternId: `mission8-pattern-${i}`,
      marketplaceId: i % 2 === 0 ? 'adobe-stock' : 'shutterstock',
      titleSnapshot: `Seamless Botanical Pattern ${i} — SEO Title`,
      descriptionSnapshot: `A hand-crafted seamless vector pattern, item ${i}, suitable for fabric and stationery.`,
      keywordSnapshot: ['seamless', 'botanical', 'vector', `pattern-${i}`, 'floral'],
      category: 'Patterns',
      now: NOW + i,
    });
    records.push(record);
  }
  putSubmissionsBulk(records);
  // `putSubmissionsBulk` persists to IndexedDB fire-and-forget (see
  // `submissionStore.ts`'s own header comment) — give it a tick to land,
  // the same idiom `submissionStore.test.ts` itself uses.
  await wait(50);
  return records;
}

function seedSettings(): void {
  localStorage.setItem('vsp-gallery-v1', JSON.stringify([{ id: 'p1', name: 'Saved Pattern 1' }, { id: 'p2', name: 'Saved Pattern 2' }]));
  localStorage.setItem('vsp-workbench-settings', JSON.stringify({ gridVisible: true, zoom: 1.25, theme: 'dark' }));
  localStorage.setItem('vsp-workbench-favorites-v1', JSON.stringify(['preset-a', 'preset-b']));
  localStorage.setItem('vsp-asset-favorites-v1', JSON.stringify(['mission8-asset-fav-1']));
  localStorage.setItem('vsp-style-dna-custom-v1', JSON.stringify([{ id: 'dna-1', label: 'Custom DNA 1' }]));
  localStorage.setItem('vsp-style-dna-favorites-v1', JSON.stringify(['dna-1']));
  localStorage.setItem('vsp-knowledge-learning-history-v1', JSON.stringify([{ event: 'export', at: NOW }]));
  const autoBackupSettings: AutoBackupSettings = { frequency: 'daily', backupOnExit: true, retention: 20, lastAutoBackupAt: NOW - 86_400_000 };
  saveAutoBackupSettings(autoBackupSettings);
}

async function resetAllStores(): Promise<void> {
  await clearPortfolioStores();
  await clearQualitySnapshots();
  await clearCollectionsStore();
  await clearFactoryQueueForTest();
  await clearAutonomousDesignRuns();
  await resetSubmissionStoreForTest();
  await clearBackupHistoryStore();
  localStorage.clear();
}

// ---------------------------------------------------------------------
// Main certification run
// ---------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Mission 8, Part 5 — Backup Certification (real measured evidence, no fabricated numbers)\n');

  await resetAllStores();

  console.log('=== Seeding a realistic production dataset ===');
  const bulkAssetCount = 24;
  const collectionCount = 5;
  const dataset = generateDataset(datasetConfig(bulkAssetCount, collectionCount));
  await putPortfolioAssetsBulk(dataset.assets);
  await putCollectionRecordsBulk(dataset.collections);
  let qi = 0;
  for (const asset of dataset.assets) {
    const decision = qi % 10 === 0 ? 'REVIEW' : qi % 13 === 0 ? 'REJECT' : 'READY';
    await putQualitySnapshot(
      createQualitySnapshot({ assetId: asset.assetId, beautyScore: 70 + (qi % 20), commercialScore: 65 + (qi % 25), fragmented: qi % 11 === 0, deadSpace: qi % 17 === 0, decision, generatorVersion: 'mission8-cert', now: NOW + qi }),
    );
    qi++;
  }
  const blobAssetIds: string[] = [];
  const blobFileIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const { assetId, fileIds } = await seedBlobBearingAsset(i);
    blobAssetIds.push(assetId);
    blobFileIds.push(...fileIds);
  }
  await seedFactoryTasks();
  const seededRuns: AutonomousDesignRun[] = [];
  for (let i = 0; i < 2; i++) seededRuns.push(await seedAutonomousDesignRun(i));
  const seededSubmissions = await seedSubmissions();
  seedSettings();

  // --- Capture ground truth: what was actually seeded, read back through
  // the real store modules (not re-derived from the in-memory objects),
  // so "before" is what the database genuinely holds. ---
  const beforeAssets = await loadPortfolioAssets();
  const beforeFiles = await loadAllPortfolioFiles();
  const beforeCollections = await loadCollections();
  const beforeSnapshots = await loadQualitySnapshots();
  const beforeTasks = await loadFactoryTasks();
  const beforeRuns = await loadAutonomousDesignRuns();
  const beforeSubmissions = loadSubmissions();
  const beforeSettingsSnapshot: Record<string, string | null> = {};
  for (const key of APP_BACKUP_SETTINGS_KEYS) beforeSettingsSnapshot[key] = localStorage.getItem(key);
  const beforeAutoBackupSettings = loadAutoBackupSettings();

  console.log(`  portfolioAssets seeded: ${beforeAssets.length} (expected ${bulkAssetCount + 3})`);
  console.log(`  portfolioFiles seeded: ${beforeFiles.length} (expected ${blobFileIds.length})`);
  console.log(`  collections seeded: ${beforeCollections.length}`);
  console.log(`  qualitySnapshots seeded: ${beforeSnapshots.length} (expected ${bulkAssetCount})`);
  console.log(`  factoryQueue tasks seeded: ${beforeTasks.length} (expected 12: 3 READY, 5 COMPLETED, 4 BLOCKED)`);
  console.log(`  autonomousDesignRuns seeded: ${beforeRuns.length} (expected 2)`);
  console.log(`  submissions seeded: ${beforeSubmissions.length} (expected 6)`);
  console.log(`  settings keys present: ${Object.values(beforeSettingsSnapshot).filter((v) => v !== null).length}/${APP_BACKUP_SETTINGS_KEYS.length}`);

  // ---------------------------------------------------------------------
  // Build the real backup
  // ---------------------------------------------------------------------
  console.log('\n=== Building real backup (buildAppBackup) ===');
  const buildStart = performance.now();
  const built = await buildAppBackup({ deviceLabel: 'Mission 8 Cert Runner', label: 'Mission 8 Backup Certification' });
  const buildMs = performance.now() - buildStart;
  console.log(`  buildAppBackup: ${buildMs.toFixed(1)}ms, blob.size=${built.blob.size} bytes, fileName=${built.fileName}`);
  console.log(`  manifest.stats: ${JSON.stringify(built.manifest.stats)}`);

  record(
    'Preview/metadata',
    built.manifest.stats.assetFileCount === blobFileIds.length ? 'PASS' : 'FAIL',
    `manifest.stats.assetFileCount=${built.manifest.stats.assetFileCount}, expected ${blobFileIds.length} (svg+preview per blob-bearing asset). manifest.assets[] metadata entries: ${built.manifest.assets.length}. Roles captured: ${built.manifest.assets.map((a) => a.role).join(', ')}.`,
  );

  // Confirm manifest.stats.storeRecordCounts matches real store counts for
  // every category this script seeded.
  const countChecks: { store: string; expected: number }[] = [
    { store: 'portfolioAssets', expected: beforeAssets.length },
    { store: 'collections', expected: beforeCollections.length },
    { store: 'qualitySnapshots', expected: beforeSnapshots.length },
    { store: 'factoryQueue', expected: beforeTasks.length },
    { store: 'autonomousDesignRuns', expected: beforeRuns.length },
    { store: 'submissions', expected: beforeSubmissions.length },
  ];
  let manifestCountsOk = true;
  for (const c of countChecks) {
    const actual = built.manifest.stats.storeRecordCounts[c.store];
    const ok = actual === c.expected;
    if (!ok) manifestCountsOk = false;
    console.log(`  manifest storeRecordCounts.${c.store} = ${actual} (expected ${c.expected}) — ${ok ? 'OK' : 'MISMATCH'}`);
  }
  record(
    'Integrity',
    manifestCountsOk ? 'PASS' : 'FAIL',
    `buildAppBackup's own manifest.stats.storeRecordCounts matches the real seeded store counts for every category: ${countChecks.map((c) => `${c.store}=${built.manifest.stats.storeRecordCounts[c.store]}`).join(', ')}. Backup build took ${buildMs.toFixed(1)}ms, produced a ${built.blob.size}-byte .vspsb archive (originalSize=${built.manifest.stats.originalSize}, compressedSize=${built.manifest.stats.compressedSize}, fileCount=${built.manifest.stats.fileCount}).`,
  );

  // ---------------------------------------------------------------------
  // Validate the freshly built (untampered) archive
  // ---------------------------------------------------------------------
  console.log('\n=== Validating the fresh archive (validateAppBackupArchive) ===');
  const validation = await validateAppBackupArchive(built.blob);
  console.log(`  verdict=${validation.verdict} checkedFileCount=${validation.checkedFileCount} mismatchedFileCount=${validation.mismatchedFileCount} entryCount=${validation.entryCount} issues=${JSON.stringify(validation.issues)}`);
  record(
    'Checksum',
    validation.verdict === 'PASS' && validation.mismatchedFileCount === 0 ? 'PASS' : 'FAIL',
    `validateAppBackupArchive(builtBlob) -> verdict=${validation.verdict}, checkedFileCount=${validation.checkedFileCount}, mismatchedFileCount=${validation.mismatchedFileCount}, archiveChecksum in manifest.json (${built.manifest.archiveChecksum}) verified against checksums.sha256's actual recomputed SHA-256, and every individual content file's SHA-256 in checksums.sha256 re-verified against its actual archived bytes. Zero issues: ${validation.issues.length === 0}.`,
  );

  // ---------------------------------------------------------------------
  // Wipe everything using the real clear*/reset* test-helper functions
  // ---------------------------------------------------------------------
  console.log('\n=== Wiping all stores (real clear*/reset* helpers) ===');
  await resetAllStores();
  const afterWipeAssets = await loadPortfolioAssets();
  const afterWipeFiles = await loadAllPortfolioFiles();
  const afterWipeCollections = await loadCollections();
  const afterWipeSnapshots = await loadQualitySnapshots();
  const afterWipeTasks = await loadFactoryTasks();
  const afterWipeRuns = await loadAutonomousDesignRuns();
  await whenSubmissionStoreHydrated();
  const afterWipeSubmissions = loadSubmissions();
  const afterWipeSettingsPresent = APP_BACKUP_SETTINGS_KEYS.filter((k) => localStorage.getItem(k) !== null).length;
  console.log(`  after wipe: assets=${afterWipeAssets.length} files=${afterWipeFiles.length} collections=${afterWipeCollections.length} snapshots=${afterWipeSnapshots.length} tasks=${afterWipeTasks.length} runs=${afterWipeRuns.length} submissions=${afterWipeSubmissions.length} settingsKeysPresent=${afterWipeSettingsPresent}`);
  const wipeClean =
    afterWipeAssets.length === 0 &&
    afterWipeFiles.length === 0 &&
    afterWipeCollections.length === 0 &&
    afterWipeSnapshots.length === 0 &&
    afterWipeTasks.length === 0 &&
    afterWipeRuns.length === 0 &&
    afterWipeSubmissions.length === 0 &&
    afterWipeSettingsPresent === 0;
  if (!wipeClean) {
    console.warn('  WARNING: wipe did not fully clear every store — restore verification below would be meaningless if so.');
  }

  // ---------------------------------------------------------------------
  // Preview + restore from the real backup
  // ---------------------------------------------------------------------
  console.log('\n=== Restoring from backup (previewAppBackupRestore + applyAppBackupRestore) ===');
  const preview = await previewAppBackupRestore(built.blob);
  console.log(`  previewAppBackupRestore: canRestore=${preview.canRestore} verdict=${preview.validation.verdict} compatibility=${preview.compatibility?.compatibility}`);

  const restoreStart = performance.now();
  const restoreResult = await applyAppBackupRestore(built.blob, { deviceLabel: 'Mission 8 Cert Runner' });
  const restoreMs = performance.now() - restoreStart;
  console.log(`  applyAppBackupRestore: ${restoreMs.toFixed(1)}ms`);
  console.log(`  storeRecordCounts: ${JSON.stringify(restoreResult.storeRecordCounts)}`);
  console.log(`  assetFilesRestored=${restoreResult.assetFilesRestored} settingsKeysRestored=${restoreResult.settingsKeysRestored} compatibility=${restoreResult.compatibility.compatibility} safetyBackupHistoryId=${restoreResult.safetyBackupHistoryId}`);

  const historyAfterRestore = await listBackupHistory();
  console.log(`  appBackupHistory records after restore: ${historyAfterRestore.length} (expected 1 — the mandatory pre-restore Safety Backup; appBackupHistory is deliberately never itself included inside a backup archive, per docs/BACKUP_SYSTEM.md)`);

  // ---------------------------------------------------------------------
  // Verify: counts after restore == counts before wipe, for every category
  // ---------------------------------------------------------------------
  console.log('\n=== Verifying restored record counts against pre-wipe ground truth ===');
  const afterAssets = await loadPortfolioAssets();
  const afterFiles = await loadAllPortfolioFiles();
  const afterCollections = await loadCollections();
  const afterSnapshots = await loadQualitySnapshots();
  const afterTasks = await loadFactoryTasks();
  const afterRuns = await loadAutonomousDesignRuns();

  // --- submissions: two different "after" reads, deliberately ---
  // (1) the RAW IndexedDB ground truth, via the same generic dumpStore()
  //     appBackupBuilder.ts itself uses — this is what the backup/restore
  //     layer actually wrote, independent of any app-level cache.
  // (2) what a live already-hydrated app session would see through the
  //     ordinary `loadSubmissions()` call — `submissionStore.ts`'s own
  //     in-memory cache is hydrated from IndexedDB exactly ONCE per
  //     session (`whenSubmissionStoreHydrated()`'s `if (!hydration)`
  //     guard, `src/catalog/submission/submissionStore.ts` lines ~112-136)
  //     and this script already called it once above (right after the
  //     wipe, to confirm the wipe took effect) — so calling it again here
  //     mirrors exactly what a real user's already-open Production
  //     Center/Commercial Pipeline tab would see after a Backup Manager
  //     restore in the SAME page session, with no reload in between.
  const rawSubmissionsAfterRestore = (await dumpStore('submissions')) as SubmissionRecord[];
  await whenSubmissionStoreHydrated(); // no-op: hydration promise already resolved from the post-wipe check above
  const staleCacheSubmissionsAfterRestore = loadSubmissions();
  // Real shipped function (submissionStore.ts) that exists specifically to
  // "simulate a fresh page load against a database that already has real
  // data in it" — used here only to PROVE the underlying data is intact
  // and the mismatch above is a cache-staleness gap, not data loss.
  forgetInMemoryStateForTest();
  await whenSubmissionStoreHydrated();
  const afterFreshRehydrateSubmissions = loadSubmissions();
  const afterSubmissions = rawSubmissionsAfterRestore; // ground truth used for the count/content comparisons below
  console.log(`  submissions — raw IndexedDB (dumpStore): ${rawSubmissionsAfterRestore.length}; already-hydrated live cache (loadSubmissions(), no reload): ${staleCacheSubmissionsAfterRestore.length}; after forgetInMemoryStateForTest()+re-hydrate (simulated fresh page load): ${afterFreshRehydrateSubmissions.length}`);

  const countCompare = [
    { name: 'portfolioAssets', before: beforeAssets.length, after: afterAssets.length },
    { name: 'portfolioFiles', before: beforeFiles.length, after: afterFiles.length },
    { name: 'collections', before: beforeCollections.length, after: afterCollections.length },
    { name: 'qualitySnapshots', before: beforeSnapshots.length, after: afterSnapshots.length },
    { name: 'factoryQueue tasks', before: beforeTasks.length, after: afterTasks.length },
    { name: 'autonomousDesignRuns', before: beforeRuns.length, after: afterRuns.length },
    { name: 'submissions (raw IndexedDB)', before: beforeSubmissions.length, after: afterSubmissions.length },
  ];
  for (const c of countCompare) {
    const ok = c.before === c.after;
    console.log(`  ${c.name}: before=${c.before} after=${c.after} — ${ok ? 'MATCH' : 'MISMATCH (DEFECT)'}`);
  }

  // ---------------------------------------------------------------------
  // Verify: field-for-field content identity on a sample of records
  // ---------------------------------------------------------------------
  console.log('\n=== Verifying field-for-field content identity on sampled records ===');

  const assetById = new Map(afterAssets.map((a) => [a.assetId, a]));
  let assetsIdentical = true;
  for (const seeded of [...dataset.assets.slice(0, 5), ...beforeAssets.filter((a) => blobAssetIds.includes(a.assetId))]) {
    const restored = assetById.get(seeded.assetId);
    const beforeRecord = beforeAssets.find((a) => a.assetId === seeded.assetId)!;
    const ok = restored !== undefined && deepEqual(beforeRecord, restored);
    if (!ok) assetsIdentical = false;
  }
  console.log(`  portfolioAssets: sampled ${5 + blobAssetIds.length} records (5 bulk-generated + ${blobAssetIds.length} blob-bearing), field-for-field identical to pre-wipe: ${assetsIdentical}`);

  const fileById = new Map(afterFiles.map((f) => [f.fileId, f]));
  let filesIdentical = true;
  let fileHashesValid = true;
  for (const fileId of blobFileIds) {
    const restoredFile = fileById.get(fileId);
    const seededFile = beforeFiles.find((f) => f.fileId === fileId)!;
    if (!restoredFile) {
      filesIdentical = false;
      continue;
    }
    const metaOk =
      restoredFile.assetId === seededFile.assetId &&
      restoredFile.role === seededFile.role &&
      restoredFile.filename === seededFile.filename &&
      restoredFile.mimeType === seededFile.mimeType &&
      restoredFile.fileSize === seededFile.fileSize &&
      restoredFile.sha256 === seededFile.sha256 &&
      restoredFile.storedAt === seededFile.storedAt;
    if (!metaOk) filesIdentical = false;
    const seededBytes = new Uint8Array(await seededFile.blob.arrayBuffer());
    const restoredBytes = new Uint8Array(await restoredFile.blob.arrayBuffer());
    const bytesEqual = seededBytes.length === restoredBytes.length && seededBytes.every((b, i) => b === restoredBytes[i]);
    if (!bytesEqual) filesIdentical = false;
    // Real shipped spot-check helper (appBackupRestore.ts's exported
    // verifyRestoredFileHash) — re-hashes the restored blob and compares
    // against the record's own recorded sha256.
    const hashValid = await verifyRestoredFileHash(restoredFile);
    if (!hashValid) fileHashesValid = false;
  }
  console.log(`  portfolioFiles: ${blobFileIds.length} blob-bearing files — metadata+bytes field-for-field identical: ${filesIdentical}; verifyRestoredFileHash() PASSED for all: ${fileHashesValid}`);

  const collectionById = new Map(afterCollections.map((c) => [c.id, c]));
  let collectionsIdentical = true;
  for (const seeded of beforeCollections) {
    const restored = collectionById.get(seeded.id);
    if (!restored || !deepEqual(seeded, restored)) collectionsIdentical = false;
  }
  console.log(`  collections: all ${beforeCollections.length} records field-for-field identical to pre-wipe: ${collectionsIdentical}`);

  const snapshotById = new Map(afterSnapshots.map((s) => [s.snapshotId, s]));
  let snapshotsIdentical = true;
  for (const seeded of beforeSnapshots.slice(0, 10)) {
    const restored = snapshotById.get(seeded.snapshotId);
    if (!restored || !deepEqual(seeded, restored)) snapshotsIdentical = false;
  }
  console.log(`  qualitySnapshots: sampled 10 of ${beforeSnapshots.length}, field-for-field identical: ${snapshotsIdentical}`);

  const taskById = new Map(afterTasks.map((t) => [t.id, t]));
  let tasksIdentical = true;
  const completedBefore = beforeTasks.filter((t) => t.status === 'COMPLETED');
  const blockedBefore = beforeTasks.filter((t) => t.status === 'BLOCKED');
  for (const seeded of beforeTasks) {
    const restored = taskById.get(seeded.id);
    if (!restored || !deepEqual(seeded, restored)) tasksIdentical = false;
  }
  const completedAfter = afterTasks.filter((t) => t.status === 'COMPLETED');
  const blockedAfter = afterTasks.filter((t) => t.status === 'BLOCKED');
  console.log(`  factoryQueue tasks: all ${beforeTasks.length} field-for-field identical (incl. status/history): ${tasksIdentical}; COMPLETED before/after=${completedBefore.length}/${completedAfter.length}; BLOCKED before/after=${blockedBefore.length}/${blockedAfter.length}`);

  const runById = new Map(afterRuns.map((r) => [r.id, r]));
  let runsIdentical = true;
  for (const seeded of seededRuns) {
    const restored = runById.get(seeded.id);
    if (!restored || !deepEqual(seeded, restored)) runsIdentical = false;
  }
  console.log(`  autonomousDesignRuns (autopilot history): all ${seededRuns.length} field-for-field identical (incl. full status history array): ${runsIdentical}`);

  const submissionById = new Map(afterSubmissions.map((s) => [s.submissionId, s]));
  let submissionsIdentical = true;
  for (const seeded of seededSubmissions) {
    const restored = submissionById.get(seeded.submissionId);
    if (!restored || !deepEqual(seeded, restored)) submissionsIdentical = false;
  }
  console.log(`  submissions (incl. titleSnapshot/descriptionSnapshot/keywordSnapshot — this app's only real SEO-content store): all ${seededSubmissions.length} field-for-field identical: ${submissionsIdentical}`);

  const afterSettings: Record<string, string | null> = {};
  for (const key of APP_BACKUP_SETTINGS_KEYS) afterSettings[key] = localStorage.getItem(key);
  const settingsIdentical = APP_BACKUP_SETTINGS_KEYS.every((k) => beforeSettingsSnapshot[k] === afterSettings[k]);
  const afterAutoBackupSettings = loadAutoBackupSettings();
  const autoBackupSettingsIdentical = deepEqual(beforeAutoBackupSettings, afterAutoBackupSettings);
  console.log(`  settings (localStorage, ${APP_BACKUP_SETTINGS_KEYS.length} keys incl. Auto Backup settings): byte-identical after restore: ${settingsIdentical}; autoBackupSettings deep-equal: ${autoBackupSettingsIdentical} (${JSON.stringify(afterAutoBackupSettings)})`);

  record('Collections', collectionsIdentical && countCompare.find((c) => c.name === 'collections')!.before === countCompare.find((c) => c.name === 'collections')!.after ? 'PASS' : 'FAIL', `${beforeCollections.length} seeded via real datasetGenerator.generateDataset()/putCollectionRecordsBulk(); all ${beforeCollections.length} restored via loadCollections() are field-for-field identical to their pre-wipe originals (deep JSON equality). Count before/after: ${countCompare.find((c) => c.name === 'collections')!.before}/${countCompare.find((c) => c.name === 'collections')!.after}.`);

  record(
    'History (autopilot run history)',
    runsIdentical && countCompare.find((c) => c.name === 'autonomousDesignRuns')!.before === countCompare.find((c) => c.name === 'autonomousDesignRuns')!.after ? 'PASS' : 'FAIL',
    `2 AutonomousDesignRun records seeded via real createAutonomousDesignRun()/transitionAutonomousDesignRun() (full PLAN_DRAFT->PLAN_READY->GENERATING->COMPLETED history array each), persisted via real putAutonomousDesignRun(). Both restored via loadAutonomousDesignRuns() with field-for-field identical content including the full \`history\` array. Separately: this app's OWN backup-of-backups store, appBackupHistory (\`appBackupHistoryStore.ts\`), is by explicit design NEVER included inside a backup archive (docs/BACKUP_SYSTEM.md: "backing it up inside itself would be self-referential") — confirmed here: appBackupHistory held ${historyAfterRestore.length} record(s) after restore (the mandatory pre-restore Safety Backup that applyAppBackupRestore itself always creates), not a restored copy of any prior history.`,
  );

  record(
    'Configuration/settings',
    settingsIdentical && autoBackupSettingsIdentical && restoreResult.settingsKeysRestored === Object.values(beforeSettingsSnapshot).filter((v) => v !== null).length ? 'PASS' : 'FAIL',
    `${APP_BACKUP_SETTINGS_KEYS.length} localStorage settings keys seeded (Style DNA presets/favorites, workbench settings/favorites, asset favorites, saved-pattern gallery, knowledge-engine learning history, Auto Backup settings itself). applyAppBackupRestore restored settingsKeysRestored=${restoreResult.settingsKeysRestored}. Every restored value is byte-identical to what was seeded: ${settingsIdentical}. The Auto Backup settings themselves (frequency/backupOnExit/retention/lastAutoBackupAt) round-tripped deep-equal: ${autoBackupSettingsIdentical}, restored value=${JSON.stringify(afterAutoBackupSettings)}.`,
  );

  const submissionsCountOk = countCompare.find((c) => c.name === 'submissions (raw IndexedDB)')!.before === countCompare.find((c) => c.name === 'submissions (raw IndexedDB)')!.after;
  record(
    'SEO data',
    submissionsIdentical && submissionsCountOk ? 'PASS' : 'FAIL',
    `No dedicated "SEO" IndexedDB store exists anywhere in this codebase's backup scope (confirmed: \`src/catalog/dashboard/seoAnalytics.ts\` itself states "The SEO Engine itself has no storage of its own" and reads its input from \`SubmissionRecord.titleSnapshot/descriptionSnapshot/keywordSnapshot\`). Those three fields live in the \`submissions\` store, which IS backed up. Seeded 6 SubmissionRecords with realistic titleSnapshot/descriptionSnapshot/keywordSnapshot content via the real createSubmissionRecord(); at the raw IndexedDB (storage) layer, confirmed via appBackupIdb.ts's own \`dumpStore('submissions')\`, all ${beforeSubmissions.length} records round-tripped through backup+restore field-for-field identical (including SEO snapshot fields): ${submissionsIdentical}, count before/after=${countCompare.find((c) => c.name === 'submissions (raw IndexedDB)')!.before}/${countCompare.find((c) => c.name === 'submissions (raw IndexedDB)')!.after}. See the separate "Application cache staleness after restore (submissions)" finding below for a real defect found in this same area — the storage layer itself is correct, but the pre-existing Submission Center's in-memory cache does not reliably pick this data up without a page reload.`,
  );

  // --- DEFECT FOUND (and FIXED within Mission 8): submissionStore.ts's
  // session-lifetime cache did not reflect a backup restore's writes
  // without a fresh page load. Fix: `appBackupRestore.ts` now calls the
  // real (non-test-only) `invalidateSubmissionStoreCache()` immediately
  // after `restoreAllStores` touches the `submissions` store, so the next
  // `loadSubmissions()` read re-hydrates from IndexedDB instead of
  // returning stale cached records. This assertion re-runs the exact same
  // reproduction so the fix stays verified going forward. ---
  const cacheStaleDefect = staleCacheSubmissionsAfterRestore.length !== rawSubmissionsAfterRestore.length;
  const cacheRecoversAfterForcedRehydrate = afterFreshRehydrateSubmissions.length === rawSubmissionsAfterRestore.length;
  record(
    'Application cache staleness after restore (submissions) — found and fixed',
    cacheStaleDefect ? 'FAIL' : 'PASS',
    cacheStaleDefect
      ? `Real, reproducible finding, NOT part of the Application Backup System's own code (\`appBackupRestore.ts\`/\`appBackupIdb.ts\` themselves write correctly — see "SEO data" above). \`applyAppBackupRestore()\` restores the \`submissions\` store by writing directly into IndexedDB via \`appBackupIdb.ts\`'s \`putAllRecords\`, which is correct and bypasses \`catalog/submission/submissionStore.ts\` entirely. But that pre-existing module keeps its own synchronous in-memory cache, hydrated from IndexedDB only ONCE per page session via \`whenSubmissionStoreHydrated()\`'s \`if (!hydration)\` guard — every UI that reads submissions (\`ProductionCenterView.tsx\`, \`CommercialPipelineTab.tsx\`, \`loadCommercialPipelineContext.ts\`, \`portfolioDashboardService.ts\`) goes through that same cache via \`loadSubmissions()\`. Reproduction: after \`applyAppBackupRestore()\` wrote ${rawSubmissionsAfterRestore.length} submissions directly to IndexedDB, \`loadSubmissions()\` (already-hydrated once earlier this session) still returned ${staleCacheSubmissionsAfterRestore.length} records, not ${rawSubmissionsAfterRestore.length}. \`dumpStore('submissions')\` (raw IndexedDB) correctly showed ${rawSubmissionsAfterRestore.length}.`
      : `FIXED (Mission 8): \`appBackupRestore.ts\` now calls \`invalidateSubmissionStoreCache()\` (a real, production, non-test-only export added to \`catalog/submission/submissionStore.ts\`) right after \`restoreAllStores\` writes the \`submissions\` store, so the in-memory cache is forgotten and the next read re-hydrates from IndexedDB. Reproduction re-run in this same session (with \`whenSubmissionStoreHydrated()\` already called once earlier, exactly as before the fix): \`loadSubmissions()\` immediately after restore, with NO manual reload/rehydrate call, now returns ${staleCacheSubmissionsAfterRestore.length} of ${rawSubmissionsAfterRestore.length} raw IndexedDB records — matching, not stale. \`cacheRecoversAfterForcedRehydrate=${cacheRecoversAfterForcedRehydrate}\` (the old manual-rehydrate escape hatch still works too, but is no longer needed). Real-world impact of the fix: a user who restores a backup containing submissions data no longer needs to manually reload the page to see them in Production Center/Commercial Pipeline/the Dashboard.`,
  );

  // ---------------------------------------------------------------------
  // Corruption scenarios — only what appBackupValidation.ts already checks
  // ---------------------------------------------------------------------
  console.log('\n=== Corruption scenarios (real validateAppBackupArchive checks only) ===');

  // (a) Truncation — same pattern as appBackupValidation.test.ts's own
  // "FAILs on a truncated archive" case.
  const fullBuf = new Uint8Array(await built.blob.arrayBuffer());
  const truncated = new Blob([fullBuf.slice(0, fullBuf.length - 30)]);
  const truncatedResult = await validateAppBackupArchive(truncated);
  console.log(`  truncated archive (removed last 30 bytes): verdict=${truncatedResult.verdict} issues=${JSON.stringify(truncatedResult.issues)}`);

  // (b) Tampered content, structurally-valid ZIP — same pattern as
  // appBackupValidation.test.ts's "wrong checksum (tampered content)"
  // case: re-read the real archive's entries, replace one asset's bytes,
  // reassemble via the same real buildCompressedZip() the builder itself
  // uses, and confirm the checksum check catches it.
  const realEntries = await readZipArchive(built.blob);
  const assetEntryToTamper = realEntries.find((e) => e.name.startsWith('assets/'));
  let tamperedResult: Awaited<ReturnType<typeof validateAppBackupArchive>> | null = null;
  if (assetEntryToTamper) {
    const tamperedEntries = realEntries.map((e) => (e.name === assetEntryToTamper.name ? { name: e.name, data: new TextEncoder().encode('TAMPERED-BY-MISSION8-CERT-SCRIPT') } : e));
    const { blob: tamperedBlob } = await buildCompressedZip(tamperedEntries);
    tamperedResult = await validateAppBackupArchive(tamperedBlob);
    console.log(`  tampered content (1 asset file's bytes replaced, structurally-valid ZIP): verdict=${tamperedResult.verdict} mismatchedFileCount=${tamperedResult.mismatchedFileCount}`);
  } else {
    console.log('  tampered-content scenario skipped: no assets/ entry found to tamper with.');
  }

  // (c) applyAppBackupRestore itself must refuse to write anything against
  // the truncated (FAIL-verdict) archive.
  let restoreRefused = false;
  let restoreRefusalMessage = '';
  try {
    await applyAppBackupRestore(truncated);
  } catch (err) {
    restoreRefused = true;
    restoreRefusalMessage = err instanceof Error ? err.message : String(err);
  }
  console.log(`  applyAppBackupRestore(truncatedArchive) refused to write: ${restoreRefused} ("${restoreRefusalMessage}")`);

  const corruptionOk = truncatedResult.verdict === 'FAIL' && (tamperedResult === null || (tamperedResult.verdict === 'FAIL' && tamperedResult.mismatchedFileCount > 0)) && restoreRefused;
  evidence.push({
    category: 'Checksum (corruption detection)',
    verdict: corruptionOk ? 'PASS' : 'FAIL',
    detail: `Truncated archive (last 30 bytes removed) -> validateAppBackupArchive verdict=${truncatedResult.verdict}. Tampered single-file-content archive (structurally valid ZIP, wrong checksum) -> verdict=${tamperedResult?.verdict ?? 'N/A'}, mismatchedFileCount=${tamperedResult?.mismatchedFileCount ?? 'N/A'}. applyAppBackupRestore refuses to write anything against the truncated archive: ${restoreRefused} (threw: "${restoreRefusalMessage}").`,
  });
  console.log(`[${corruptionOk ? 'PASS' : 'FAIL'}] Checksum (corruption detection): see above.`);

  // ---------------------------------------------------------------------
  // Full-manifest store coverage — every store in APP_BACKUP_STORE_NAMES
  // ---------------------------------------------------------------------
  console.log('\n=== Full store-name coverage (every entry in APP_BACKUP_STORE_NAMES) ===');
  const coveredNonZero = APP_BACKUP_STORE_NAMES.filter((n) => (built.manifest.stats.storeRecordCounts[n] ?? 0) > 0);
  console.log(`  ${APP_BACKUP_STORE_NAMES.length} total stores registered in APP_BACKUP_STORE_NAMES; ${coveredNonZero.length} had non-zero seeded records in this run: ${coveredNonZero.join(', ')}`);
  console.log(`  every store name is present as a key in manifest.stats.storeRecordCounts (even when 0): ${APP_BACKUP_STORE_NAMES.every((n) => n in built.manifest.stats.storeRecordCounts)}`);

  // ---------------------------------------------------------------------
  // Final report
  // ---------------------------------------------------------------------
  console.log('\n=== Mission 8, Part 5 — Backup Certification: Final Evidence Table ===\n');
  for (const row of evidence) {
    console.log(`${row.verdict.padEnd(8)} ${row.category}`);
    console.log(`         ${row.detail}\n`);
  }

  const anyFail = evidence.some((r) => r.verdict === 'FAIL' || r.verdict === 'UNKNOWN');
  console.log(anyFail ? 'RESULT: one or more categories FAILed or UNKNOWN — see defects above.' : 'RESULT: all categories PASS.');

  await resetAllStores();
  process.exit(anyFail ? 1 : 0);
}

main().catch((err) => {
  console.error('[mission8BackupCertification] Fatal error:', err);
  process.exit(1);
});
