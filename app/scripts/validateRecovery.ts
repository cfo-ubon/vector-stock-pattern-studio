#!/usr/bin/env -S npx tsx
// Portfolio Manager P2.5 Sprint 3 — crash recovery / data integrity
// certification CLI (Sections 3-10 of the brief).
//
// Wires the 9 required `collectionService.ts` operations (createCollection,
// renameCollection, archiveCollection, unarchiveCollection, deleteCollection,
// bulkAssign, bulkRemove, coverUpdate, metadataUpdate) into the
// domain-agnostic `recoveryEngine.ts`/`durabilityEngine.ts` library, exactly
// the same layering `validateCollectionsStress.ts` used for Sprint 2's
// soak/stress orchestration on top of `soakRunner.ts`.
//
// Usage:
//   tsx scripts/validateRecovery.ts matrix        (Sections 3-4: full 9x9 failure matrix)
//   tsx scripts/validateRecovery.ts durability     (Section 5: 100 repeated recovery cycles per operation)
//   tsx scripts/validateRecovery.ts idempotency    (Section 6: repeated-recovery stability check)
//   tsx scripts/validateRecovery.ts consistency    (Section 7: before/after-failure/after-recovery/after-repeat manifests)
//   tsx scripts/validateRecovery.ts large          (Section 10: LARGE dataset — 100k assets/10k collections/500k+ memberships)
import 'fake-indexeddb/auto';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  ALL_FAILURE_INJECTION_POINTS,
  runRecoveryScenario,
  runDurabilityCycles,
  verifyIdempotentRecovery,
  generateDataset,
  DEFAULT_DATASET_CONFIG,
  largeDatasetConfig,
  validateDatasetConfig,
  persistDataset,
  resetValidationDatabase,
  captureConsistencySnapshot,
  diffConsistencySnapshots,
} from '../src/catalog/validation/index.js';
import type {
  FailureInjectionPoint,
  FailureInjectionConfig,
  IdbStoreTarget,
  RecoveryScenarioSpec,
  RecoveryScenarioResult,
  DurabilityReport,
} from '../src/catalog/validation/index.js';
import type { ConsistencySnapshot } from '../src/catalog/validation/consistencyManifest.js';
import {
  createCollectionService,
  renameCollection,
  archiveCollection,
  unarchiveCollection,
  deleteCollectionSafely,
  assignAssetsToCollections,
  removeAssetsFromCollections,
  setCollectionCoverAsset,
  updateCollectionDescription,
  validateCollectionIntegrity,
} from '../src/catalog/services/collectionService.js';
import type { CollectionIntegrityReport } from '../src/catalog/services/collectionService.js';
import { loadCollections, getCollection } from '../src/catalog/storage/collectionStore.js';
import type { Collection } from '../src/catalog/domain/collection.js';
import type { PortfolioAsset } from '../src/catalog/domain/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'validation-results', 'collections');

function gitInfo(): { commit: string | null; branch: string | null } {
  try {
    const commit = execSync('git rev-parse HEAD', { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return { commit, branch };
  } catch {
    return { commit: null, branch: null };
  }
}

function writeJson(label: string, data: unknown): string {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const p = path.join(OUTPUT_DIR, `${label}.json`);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  return p;
}

const isClean = (report: CollectionIntegrityReport) =>
  report.orphanedMemberships.length === 0 && report.invalidCoverAssetReferences.length === 0;

const deps = { captureSnapshot: captureConsistencySnapshot, scanIntegrity: validateCollectionIntegrity, isClean };

const snapshotsEqual = (a: ConsistencySnapshot, b: ConsistencySnapshot) =>
  JSON.stringify({ ...a, capturedAt: 0 }) === JSON.stringify({ ...b, capturedAt: 0 });

// ---------------------------------------------------------------------
// The 9 required operations (Section 3) — each mapped to the IndexedDB
// store its own write path actually issues `put()`/`delete()` calls
// against, so `during-transaction`/`aborted-transaction` faults target a
// call the operation genuinely makes (see `recoveryEngine.ts`'s
// `installFailureInjector` — a `put`-patching fault never fires against
// an operation that only ever calls `.delete()` on that store).
// ---------------------------------------------------------------------

export const RECOVERY_OPERATIONS = [
  'createCollection',
  'renameCollection',
  'archiveCollection',
  'unarchiveCollection',
  'deleteCollection',
  'bulkAssign',
  'bulkRemove',
  'coverUpdate',
  'metadataUpdate',
] as const;
export type RecoveryOperationName = (typeof RECOVERY_OPERATIONS)[number];

const STORE_FOR_OPERATION: Record<RecoveryOperationName, IdbStoreTarget> = {
  createCollection: 'collections',
  renameCollection: 'collections',
  archiveCollection: 'collections',
  unarchiveCollection: 'collections',
  // Cascade delete's collections-store action is a `.delete()`, which
  // `during-transaction`/`aborted-transaction` (both patch `.put()`)
  // would never observe — the cascade's *asset* writes are `.put()`
  // calls, so targeting `portfolioAssets` is what makes those two
  // points meaningful for this operation. `before-transaction` still
  // matches either store name since the cascade opens one transaction
  // spanning both stores.
  deleteCollection: 'portfolioAssets',
  bulkAssign: 'portfolioAssets',
  bulkRemove: 'portfolioAssets',
  coverUpdate: 'collections',
  metadataUpdate: 'collections',
};

interface ScenarioContext {
  collectionId: string;
  assetIds: string[];
}

/** One spec builder per operation — `run`/`retry` pairs matching the same
 * "idempotent-by-construction where the domain allows it, check-then-act
 * where it doesn't" convention `recoveryEngine.test.ts` established.
 * `createCollection`/`deleteCollection` are the two operations whose raw
 * repeat is NOT naturally idempotent (a second `createCollectionService`
 * call with the same name throws `DuplicateCollectionNameError`; a second
 * `deleteCollectionSafely` call on an already-deleted id throws
 * `CollectionNotFoundError`) — both get an explicit check-then-act retry. */
function buildSpec(op: RecoveryOperationName, ctx: ScenarioContext, config: FailureInjectionConfig, uniqueName: string): RecoveryScenarioSpec {
  switch (op) {
    case 'createCollection':
      return {
        operationName: op,
        config,
        run: () => createCollectionService({ name: uniqueName }),
        retry: async () => {
          const existing = (await loadCollections()).find((c) => c.name === uniqueName);
          return existing ?? createCollectionService({ name: uniqueName });
        },
      };
    case 'renameCollection':
      return {
        operationName: op,
        config,
        run: () => renameCollection(ctx.collectionId, `${uniqueName}-renamed`),
        retry: () => renameCollection(ctx.collectionId, `${uniqueName}-renamed`),
      };
    case 'archiveCollection':
      return {
        operationName: op,
        config,
        run: () => archiveCollection(ctx.collectionId),
        retry: () => archiveCollection(ctx.collectionId),
      };
    case 'unarchiveCollection':
      return {
        operationName: op,
        config,
        run: () => unarchiveCollection(ctx.collectionId),
        retry: () => unarchiveCollection(ctx.collectionId),
      };
    case 'deleteCollection':
      return {
        operationName: op,
        config,
        run: () => deleteCollectionSafely(ctx.collectionId),
        retry: async () => {
          const existing = await getCollection(ctx.collectionId);
          if (existing) await deleteCollectionSafely(ctx.collectionId);
        },
      };
    case 'bulkAssign':
      return {
        operationName: op,
        config,
        run: () => assignAssetsToCollections(ctx.assetIds, [ctx.collectionId]),
        retry: () => assignAssetsToCollections(ctx.assetIds, [ctx.collectionId]),
      };
    case 'bulkRemove':
      return {
        operationName: op,
        config,
        run: () => removeAssetsFromCollections(ctx.assetIds, [ctx.collectionId]),
        retry: () => removeAssetsFromCollections(ctx.assetIds, [ctx.collectionId]),
      };
    case 'coverUpdate':
      return {
        operationName: op,
        config,
        run: () => setCollectionCoverAsset(ctx.collectionId, ctx.assetIds[0] ?? null),
        retry: () => setCollectionCoverAsset(ctx.collectionId, ctx.assetIds[0] ?? null),
      };
    case 'metadataUpdate':
      return {
        operationName: op,
        config,
        run: () => updateCollectionDescription(ctx.collectionId, `Recovery description ${uniqueName}`),
        retry: () => updateCollectionDescription(ctx.collectionId, `Recovery description ${uniqueName}`),
      };
  }
}

/** Setup a single combo's fixture state (outside of any injected fault) —
 * `bulkRemove` needs pre-existing membership to remove, `unarchiveCollection`
 * needs an archived target, `deleteCollection` needs cascade-worthy
 * membership so its `portfolioAssets` writes actually happen. */
async function setupContext(op: RecoveryOperationName, ctx: ScenarioContext): Promise<void> {
  if (op === 'bulkRemove' || op === 'deleteCollection') {
    await assignAssetsToCollections(ctx.assetIds, [ctx.collectionId]);
  }
  if (op === 'unarchiveCollection') {
    await archiveCollection(ctx.collectionId);
  }
}

async function seedRecoveryDataset(seed: string, assetCount: number, collectionCount: number): Promise<{ collections: Collection[]; assets: PortfolioAsset[] }> {
  const config = {
    ...DEFAULT_DATASET_CONFIG,
    seed,
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
  validateDatasetConfig(config);
  const generated = generateDataset(config);
  await resetValidationDatabase({ confirmValidationEnvironment: true });
  await persistDataset(generated.collections, generated.assets, config.batchSize, { confirmValidationEnvironment: true });
  return { collections: generated.collections, assets: generated.assets };
}

// ---------------------------------------------------------------------
// Section 3-4: full failure-injection matrix
// ---------------------------------------------------------------------

interface MatrixEntry {
  operation: RecoveryOperationName;
  point: FailureInjectionPoint;
  store: IdbStoreTarget;
  injected: boolean;
  /** True when this (operation, point) combination is structurally unable
   * to trigger via `runRecoveryScenario`'s automatic call-counting — not a
   * defect. `before-ui-refresh`/`validation-interruption` intercept
   * `getAll()`, but `archiveCollection`/`unarchiveCollection`/`coverUpdate`/
   * `metadataUpdate`'s own write paths only ever call `.get()`/`.put()` —
   * there is no `getAll()` inside the operation itself to intercept
   * before `runRecoveryScenario` uninstalls the injector and moves on to
   * `deps.captureSnapshot()`. `installFailureInjector`'s own unit tests
   * (`recoveryEngine.test.ts`) prove both points work correctly in
   * isolation by calling `loadCollections()`/`validateCollectionIntegrity()`
   * directly while the injector is still installed — this flag documents
   * that these 8 combinations just don't have a reachable trigger point
   * through these 4 operations' call graphs, not that the points are
   * broken. */
  notApplicable: boolean;
  operationOutcome: RecoveryScenarioResult<ConsistencySnapshot, CollectionIntegrityReport>['operationOutcome'];
  retryOutcome: RecoveryScenarioResult<ConsistencySnapshot, CollectionIntegrityReport>['retryOutcome'];
  cleanBeforeFailure: boolean;
  cleanAfterFailure: boolean;
  cleanAfterRecovery: boolean;
}

/** Operations whose entire write path never calls `getAll()` — see
 * `MatrixEntry.notApplicable`'s doc comment. */
const NO_GETALL_OPERATIONS = new Set<RecoveryOperationName>(['archiveCollection', 'unarchiveCollection', 'coverUpdate', 'metadataUpdate']);
const GETALL_INTERCEPTING_POINTS = new Set<FailureInjectionPoint>(['before-ui-refresh', 'validation-interruption']);

async function runMatrixMode(): Promise<number> {
  console.log('[matrix] Seeding matrix dataset (9 operations x 9 failure points = 81 scenarios)...');
  const collectionCount = RECOVERY_OPERATIONS.length * ALL_FAILURE_INJECTION_POINTS.length + 5;
  const { collections, assets } = await seedRecoveryDataset('p2.5-sprint3-matrix', 60, collectionCount);
  const assetIds = assets.map((a) => a.assetId);

  const entries: MatrixEntry[] = [];
  let comboIndex = 0;
  for (const op of RECOVERY_OPERATIONS) {
    for (const point of ALL_FAILURE_INJECTION_POINTS) {
      const collectionId = collections[comboIndex].id;
      const ctx: ScenarioContext = { collectionId, assetIds: assetIds.slice(0, 4) };
      await setupContext(op, ctx);
      const store = STORE_FOR_OPERATION[op];
      const bulkCapable = op === 'bulkAssign' || op === 'bulkRemove' || op === 'deleteCollection';
      const triggerOnCall = bulkCapable && (point === 'during-transaction' || point === 'aborted-transaction' || point === 'rejected-promise') ? 2 : 1;
      const config: FailureInjectionConfig = { point, store, triggerOnCall };
      const spec = buildSpec(op, ctx, config, `matrix-${comboIndex}`);
      const result = await runRecoveryScenario(spec, deps);
      const notApplicable = NO_GETALL_OPERATIONS.has(op) && GETALL_INTERCEPTING_POINTS.has(point);
      entries.push({
        operation: op,
        point,
        store,
        injected: result.injected,
        notApplicable,
        operationOutcome: result.operationOutcome,
        retryOutcome: result.retryOutcome,
        cleanBeforeFailure: isClean(result.integrityBefore),
        cleanAfterFailure: isClean(result.integrityAfterFailure),
        cleanAfterRecovery: isClean(result.integrityAfterRecovery),
      });
      comboIndex++;
    }
  }

  const totalScenarios = entries.length;
  const applicableEntries = entries.filter((e) => !e.notApplicable);
  const notApplicableEntries = entries.filter((e) => e.notApplicable);
  const injectedCount = entries.filter((e) => e.injected).length;
  const recoveredCount = entries.filter((e) => e.retryOutcome === 'succeeded').length;
  const cleanCount = entries.filter((e) => e.cleanAfterRecovery).length;
  const notInjected = applicableEntries.filter((e) => !e.injected);
  const notRecovered = entries.filter((e) => e.retryOutcome !== 'succeeded');
  const unclean = entries.filter((e) => !e.cleanAfterRecovery);

  console.log(`[matrix] ${totalScenarios} scenarios run: ${injectedCount} injected, ${recoveredCount} recovered, ${cleanCount} clean after recovery (${notApplicableEntries.length} combinations structurally not applicable via this harness, see notApplicable).`);
  if (notInjected.length) console.log(`[matrix] WARNING: ${notInjected.length} applicable scenario(s) never triggered the configured fault: ${notInjected.map((e) => `${e.operation}/${e.point}`).join(', ')}`);
  if (notRecovered.length) console.log(`[matrix] WARNING: ${notRecovered.length} scenario(s) failed to recover: ${notRecovered.map((e) => `${e.operation}/${e.point}`).join(', ')}`);
  if (unclean.length) console.log(`[matrix] WARNING: ${unclean.length} scenario(s) left the integrity scanner unclean after recovery: ${unclean.map((e) => `${e.operation}/${e.point}`).join(', ')}`);

  const report = {
    generatedAt: Date.now(),
    ...gitInfo(),
    mode: 'matrix' as const,
    totalScenarios,
    notApplicableCount: notApplicableEntries.length,
    injectedCount,
    recoveredCount,
    cleanCount,
    entries,
  };
  const jsonPath = writeJson('recovery-matrix', report);
  console.log(`Report written to: ${jsonPath}`);

  await resetValidationDatabase({ confirmValidationEnvironment: true });
  return notInjected.length > 0 || notRecovered.length > 0 || unclean.length > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------
// Section 5: durability — 100 repeated recovery cycles per operation
// ---------------------------------------------------------------------

async function runDurabilityMode(): Promise<number> {
  console.log('[durability] Seeding durability dataset...');
  const { collections, assets } = await seedRecoveryDataset('p2.5-sprint3-durability', 40, 12);
  const assetIds = assets.map((a) => a.assetId);
  const cycles = 100;

  const targets: Record<Exclude<RecoveryOperationName, 'deleteCollection'>, string> = {
    createCollection: collections[0].id, // unused directly — createCollection ignores ctx.collectionId
    renameCollection: collections[1].id,
    archiveCollection: collections[2].id,
    unarchiveCollection: collections[3].id,
    bulkAssign: collections[4].id,
    bulkRemove: collections[5].id,
    coverUpdate: collections[6].id,
    metadataUpdate: collections[7].id,
  };
  await assignAssetsToCollections(assetIds.slice(0, 4), [targets.bulkRemove]);

  console.log(`[durability] Pre-creating ${cycles} temporary collections for deleteCollection cycles...`);
  const deleteTargets: string[] = [];
  for (let i = 0; i < cycles; i++) {
    const c = await createCollectionService({ name: `Durability Delete ${i}` });
    await assignAssetsToCollections(assetIds.slice(0, 3), [c.id]);
    deleteTargets.push(c.id);
  }

  const results: Record<RecoveryOperationName, DurabilityReport<ConsistencySnapshot, CollectionIntegrityReport>> = {} as never;

  results.createCollection = await runDurabilityCycles(
    () => buildSpec('createCollection', { collectionId: '', assetIds: [] }, { point: 'before-transaction', store: 'collections', triggerOnCall: 1 }, 'durability-create'),
    deps,
    cycles,
  );
  results.renameCollection = await runDurabilityCycles(
    () => buildSpec('renameCollection', { collectionId: targets.renameCollection, assetIds: [] }, { point: 'during-transaction', store: 'collections', triggerOnCall: 1 }, 'durability-rename'),
    deps,
    cycles,
  );
  results.archiveCollection = await runDurabilityCycles(
    () => buildSpec('archiveCollection', { collectionId: targets.archiveCollection, assetIds: [] }, { point: 'during-transaction', store: 'collections', triggerOnCall: 1 }, 'durability-archive'),
    deps,
    cycles,
  );
  results.unarchiveCollection = await runDurabilityCycles(
    () => buildSpec('unarchiveCollection', { collectionId: targets.unarchiveCollection, assetIds: [] }, { point: 'during-transaction', store: 'collections', triggerOnCall: 1 }, 'durability-unarchive'),
    deps,
    cycles,
  );
  results.bulkAssign = await runDurabilityCycles(
    () => buildSpec('bulkAssign', { collectionId: targets.bulkAssign, assetIds: assetIds.slice(0, 4) }, { point: 'during-transaction', store: 'portfolioAssets', triggerOnCall: 2 }, 'durability-assign'),
    deps,
    cycles,
  );
  results.bulkRemove = await runDurabilityCycles(
    () => buildSpec('bulkRemove', { collectionId: targets.bulkRemove, assetIds: assetIds.slice(0, 4) }, { point: 'during-transaction', store: 'portfolioAssets', triggerOnCall: 2 }, 'durability-remove'),
    deps,
    cycles,
  );
  results.coverUpdate = await runDurabilityCycles(
    () => buildSpec('coverUpdate', { collectionId: targets.coverUpdate, assetIds: assetIds.slice(0, 1) }, { point: 'during-transaction', store: 'collections', triggerOnCall: 1 }, 'durability-cover'),
    deps,
    cycles,
  );
  results.metadataUpdate = await runDurabilityCycles(
    () => buildSpec('metadataUpdate', { collectionId: targets.metadataUpdate, assetIds: [] }, { point: 'during-transaction', store: 'collections', triggerOnCall: 1 }, 'durability-metadata'),
    deps,
    cycles,
  );
  results.deleteCollection = await runDurabilityCycles(
    (cycleIndex) => buildSpec('deleteCollection', { collectionId: deleteTargets[cycleIndex], assetIds: [] }, { point: 'during-transaction', store: 'portfolioAssets', triggerOnCall: 2 }, `durability-delete-${cycleIndex}`),
    deps,
    cycles,
  );

  const summary = Object.entries(results).map(([op, r]) => ({
    operation: op,
    cyclesRequested: r.cyclesRequested,
    allDurable: r.allDurable,
    allClean: r.allClean,
    firstFailureCycle: r.firstFailureCycle,
  }));

  for (const s of summary) {
    console.log(`[durability] ${s.operation}: ${s.cyclesRequested} cycles — durable=${s.allDurable} clean=${s.allClean}${s.firstFailureCycle !== null ? ` firstFailureCycle=${s.firstFailureCycle}` : ''}`);
  }

  const anyFailure = summary.some((s) => !s.allDurable || !s.allClean);
  const report = {
    generatedAt: Date.now(),
    ...gitInfo(),
    mode: 'durability' as const,
    cyclesPerOperation: cycles,
    summary,
    // Full per-cycle detail is large (100 cycles x 9 ops); keep it for
    // audit but summary above is what a human reads first.
    detail: results,
  };
  const jsonPath = writeJson('recovery-durability', report);
  console.log(`Report written to: ${jsonPath}`);

  await resetValidationDatabase({ confirmValidationEnvironment: true });
  return anyFailure ? 1 : 0;
}

// ---------------------------------------------------------------------
// Section 6: idempotency — repeated-recovery stability
// ---------------------------------------------------------------------

async function runIdempotencyMode(): Promise<number> {
  console.log('[idempotency] Seeding idempotency dataset...');
  const { collections, assets } = await seedRecoveryDataset('p2.5-sprint3-idempotency', 30, 6);
  const assetIds = assets.map((a) => a.assetId);
  const repeats = 5;

  const checks: { operation: RecoveryOperationName; recover: () => Promise<unknown> }[] = [
    { operation: 'bulkAssign', recover: () => assignAssetsToCollections(assetIds.slice(0, 5), [collections[0].id]) },
    { operation: 'bulkRemove', recover: () => removeAssetsFromCollections(assetIds.slice(0, 5), [collections[1].id]) },
    { operation: 'archiveCollection', recover: () => archiveCollection(collections[2].id) },
    { operation: 'unarchiveCollection', recover: () => unarchiveCollection(collections[3].id) },
    { operation: 'metadataUpdate', recover: () => updateCollectionDescription(collections[4].id, 'Idempotency check') },
    { operation: 'coverUpdate', recover: () => setCollectionCoverAsset(collections[5].id, assetIds[0]) },
  ];
  // bulkRemove needs pre-existing membership to actually exercise a real
  // removal each repeat rather than a no-op skip on every call.
  await assignAssetsToCollections(assetIds.slice(0, 5), [collections[1].id]);

  const results: { operation: RecoveryOperationName; repeats: number; stable: boolean; firstDivergenceIndex: number | null }[] = [];
  for (const check of checks) {
    const result = await verifyIdempotentRecovery(async () => { await check.recover(); }, captureConsistencySnapshot, snapshotsEqual, repeats);
    results.push({ operation: check.operation, repeats: result.repeats, stable: result.stable, firstDivergenceIndex: result.firstDivergenceIndex });
    console.log(`[idempotency] ${check.operation}: ${repeats} repeats — stable=${result.stable}${result.firstDivergenceIndex !== null ? ` firstDivergenceIndex=${result.firstDivergenceIndex}` : ''}`);
  }

  const finalIntegrity = await validateCollectionIntegrity();
  const clean = isClean(finalIntegrity);
  console.log(`[idempotency] final integrity scan clean=${clean} (orphans=${finalIntegrity.orphanedMemberships.length}, staleCovers=${finalIntegrity.invalidCoverAssetReferences.length})`);

  const anyUnstable = results.some((r) => !r.stable);
  const report = { generatedAt: Date.now(), ...gitInfo(), mode: 'idempotency' as const, repeats, results, finalIntegrityClean: clean };
  const jsonPath = writeJson('recovery-idempotency', report);
  console.log(`Report written to: ${jsonPath}`);

  await resetValidationDatabase({ confirmValidationEnvironment: true });
  return anyUnstable || !clean ? 1 : 0;
}

// ---------------------------------------------------------------------
// Section 7: consistency manifest — Before/AfterFailure/AfterRecovery/AfterRepeat
// ---------------------------------------------------------------------

async function runConsistencyMode(): Promise<number> {
  console.log('[consistency] Seeding consistency dataset...');
  const { collections, assets } = await seedRecoveryDataset('p2.5-sprint3-consistency', 50, 10);
  const assetIds = assets.map((a) => a.assetId);
  const targetId = collections[0].id;
  const targetAssets = assetIds.slice(0, 6);

  const before = await captureConsistencySnapshot();

  const config: FailureInjectionConfig = { point: 'during-transaction', store: 'portfolioAssets', triggerOnCall: 2 };
  const spec = buildSpec('bulkAssign', { collectionId: targetId, assetIds: targetAssets }, config, 'consistency-assign');
  const result = await runRecoveryScenario(spec, deps);
  const afterFailure = result.afterFailure;
  const afterRecovery = result.afterRecovery;

  // "After Repeated Recovery" — the same recovery action retried 3 more
  // times, verifying the manifest stops changing (ties Section 6's
  // idempotency requirement directly into the consistency manifest, per
  // Section 7).
  await assignAssetsToCollections(targetAssets, [targetId]);
  await assignAssetsToCollections(targetAssets, [targetId]);
  await assignAssetsToCollections(targetAssets, [targetId]);
  const afterRepeatedRecovery = await captureConsistencySnapshot();

  const diffFailure = diffConsistencySnapshots(before, afterFailure);
  const diffRecovery = diffConsistencySnapshots(afterFailure, afterRecovery, { assetCountDelta: 0, collectionCountDelta: 0 });
  const diffRepeated = diffConsistencySnapshots(afterRecovery, afterRepeatedRecovery, { assetCountDelta: 0, collectionCountDelta: 0 });

  console.log(`[consistency] before -> afterFailure: assetDelta=${diffFailure.assetCountDelta} membershipDelta=${diffFailure.membershipCountDelta} newOrphans=${diffFailure.newOrphansIntroduced}`);
  console.log(`[consistency] afterFailure -> afterRecovery: membershipDelta=${diffRecovery.membershipCountDelta} newOrphans=${diffRecovery.newOrphansIntroduced}`);
  console.log(`[consistency] afterRecovery -> afterRepeatedRecovery: membershipDelta=${diffRepeated.membershipCountDelta} (expect 0 — idempotent retries add nothing further)`);

  const clean = !diffRecovery.newOrphansIntroduced && !diffRecovery.newStaleCoversIntroduced && diffRepeated.membershipCountDelta === 0 && !diffRepeated.newOrphansIntroduced;

  const report = {
    generatedAt: Date.now(),
    ...gitInfo(),
    mode: 'consistency' as const,
    manifests: { before, afterFailure, afterRecovery, afterRepeatedRecovery },
    diffs: { beforeToAfterFailure: diffFailure, afterFailureToAfterRecovery: diffRecovery, afterRecoveryToAfterRepeatedRecovery: diffRepeated },
    clean,
  };
  const jsonPath = writeJson('recovery-consistency', report);
  console.log(`Report written to: ${jsonPath}`);

  await resetValidationDatabase({ confirmValidationEnvironment: true });
  return clean ? 0 : 1;
}

// ---------------------------------------------------------------------
// Section 10: LARGE dataset recovery (100k assets / 10k collections / 500k+ memberships)
// ---------------------------------------------------------------------

async function runLargeMode(): Promise<number> {
  console.log('[large] Seeding LARGE dataset (100,000 assets, 10,000 collections, ~500,000 memberships)...');
  const config = largeDatasetConfig('p2.5-sprint3-large');
  validateDatasetConfig(config);
  const t0 = Date.now();
  const generated = generateDataset(config);
  console.log(`[large] Generated in ${(Date.now() - t0).toFixed(0)}ms — ${generated.manifest.membershipCount} memberships.`);
  await resetValidationDatabase({ confirmValidationEnvironment: true });
  const t1 = Date.now();
  await persistDataset(generated.collections, generated.assets, config.batchSize, { confirmValidationEnvironment: true });
  console.log(`[large] Persisted in ${(Date.now() - t1).toFixed(0)}ms.`);

  const collections = generated.collections;
  const assets = generated.assets;
  const assetIds = assets.map((a) => a.assetId);

  const scenarios: { operation: RecoveryOperationName; ctx: ScenarioContext; config: FailureInjectionConfig }[] = [
    { operation: 'bulkAssign', ctx: { collectionId: collections[0].id, assetIds: assetIds.slice(0, 200) }, config: { point: 'during-transaction', store: 'portfolioAssets', triggerOnCall: 100 } },
    { operation: 'bulkRemove', ctx: { collectionId: collections[1].id, assetIds: assetIds.slice(200, 400) }, config: { point: 'during-transaction', store: 'portfolioAssets', triggerOnCall: 100 } },
    { operation: 'renameCollection', ctx: { collectionId: collections[2].id, assetIds: [] }, config: { point: 'during-transaction', store: 'collections', triggerOnCall: 1 } },
    { operation: 'archiveCollection', ctx: { collectionId: collections[3].id, assetIds: [] }, config: { point: 'during-transaction', store: 'collections', triggerOnCall: 1 } },
  ];

  // `largeDatasetConfig` intentionally seeds pre-existing orphaned
  // memberships (2%) and stale covers (10%) as fixtures — the same
  // Sprint 1 "integrity scenario" convention `datasetPresets.ts` uses
  // everywhere else. An absolute `isClean()` check on the whole LARGE
  // dataset would therefore always report `false` regardless of whether
  // THIS recovery introduced anything new. What actually matters here is
  // the delta: did the failure+recovery cycle leave behind any NEW
  // corruption on top of what was already there before the scenario ran?
  const noNewCorruption = (before: CollectionIntegrityReport, after: CollectionIntegrityReport) =>
    after.orphanedMemberships.length <= before.orphanedMemberships.length && after.invalidCoverAssetReferences.length <= before.invalidCoverAssetReferences.length;

  const results: { operation: RecoveryOperationName; injected: boolean; operationOutcome: string; retryOutcome: string; noNewCorruptionAfterRecovery: boolean; scenarioDurationMs: number }[] = [];
  for (const s of scenarios) {
    await setupContext(s.operation, s.ctx);
    const spec = buildSpec(s.operation, s.ctx, s.config, `large-${s.operation}`);
    const t = Date.now();
    const result = await runRecoveryScenario(spec, deps);
    const scenarioDurationMs = Date.now() - t;
    const clean = noNewCorruption(result.integrityBefore, result.integrityAfterRecovery);
    results.push({
      operation: s.operation,
      injected: result.injected,
      operationOutcome: result.operationOutcome,
      retryOutcome: result.retryOutcome,
      noNewCorruptionAfterRecovery: clean,
      scenarioDurationMs,
    });
    console.log(`[large] ${s.operation}: injected=${result.injected} outcome=${result.operationOutcome} retry=${result.retryOutcome} noNewCorruption=${clean} (${scenarioDurationMs}ms)`);
  }

  const anyFailure = results.some((r) => !r.injected || r.retryOutcome !== 'succeeded' || !r.noNewCorruptionAfterRecovery);
  const report = {
    generatedAt: Date.now(),
    ...gitInfo(),
    mode: 'large' as const,
    datasetIdentity: `large-${assets.length}x${collections.length}`,
    manifest: generated.manifest,
    results,
  };
  const jsonPath = writeJson('recovery-large', report);
  console.log(`Report written to: ${jsonPath}`);

  await resetValidationDatabase({ confirmValidationEnvironment: true });
  return anyFailure ? 1 : 0;
}

async function main(): Promise<number> {
  const mode = process.argv[2] ?? '';
  if (mode === 'matrix') return runMatrixMode();
  if (mode === 'durability') return runDurabilityMode();
  if (mode === 'idempotency') return runIdempotencyMode();
  if (mode === 'consistency') return runConsistencyMode();
  if (mode === 'large') return runLargeMode();

  console.error(`Unknown mode "${mode}". Expected one of: matrix, durability, idempotency, consistency, large.`);
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('[validateRecovery] Fatal error:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
