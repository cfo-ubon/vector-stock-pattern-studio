import { idbAvailable, DB_NAME } from '../../storage/db';
import { putCollectionRecordsBulk, clearCollectionsStore } from '../storage/collectionStore';
import { putPortfolioAssetsBulk, clearPortfolioStores } from '../storage/portfolioStore';
import type { Collection } from '../domain/collection';
import type { PortfolioAsset } from '../domain/types';

// Portfolio Manager P2.5 Sprint 1 — real-IndexedDB persistence for the
// validation dataset generator (Section 3, capability 2/3).
//
// Database isolation, honestly stated: `storage/db.ts`'s `openDb()` has
// no way to open a differently-*named* database — every store/service
// function it backs (`collectionStore.ts`, `portfolioStore.ts`,
// `collectionService.ts`) hardcodes `openDb()` with no arguments, which
// always opens the single constant `DB_NAME` ('vsp-db'). Adding a
// `dbName` parameter and threading it through every one of those already-
// approved functions was considered and rejected for Sprint 1: it would
// touch the stable, already-shipped Stage 1/Stage 2 storage and service
// APIs (this sprint's brief explicitly forbids that without a documented
// blocker), for isolation this sprint does not actually need.
//
// The real isolation mechanism instead: every validation entry point
// (`app/scripts/validateCollections.ts`) runs as a plain Node process via
// `tsx`, and every vitest test file runs under jsdom with
// `fake-indexeddb/auto` (`src/testSetup.ts`) — in both cases `indexedDB`
// is `fake-indexeddb`, a from-scratch, in-memory-only reimplementation
// with no file, socket, or address-space connection to a real browser's
// actual per-origin storage. Opening the literal string `'vsp-db'`
// through `fake-indexeddb` in a throwaway Node/vitest process can never
// read, write, or collide with a real user's browser profile — there is
// no shared backing store for the name to collide *in*. This is the same
// mechanism every existing Portfolio Manager/Collection test already
// relies on (`collectionService.performance.test.ts` et al.).
//
// This does NOT satisfy the literal "use a distinct database name
// string" phrasing some validation tooling conventions expect — that
// requires touching `openDb()`'s signature, deliberately deferred (see
// `docs/portfolio/TECHNICAL_DEBT_REGISTER.md`'s P2.5-1 entry and
// `P2_5_VALIDATION_ARCHITECTURE.md`'s "Database isolation" section for
// the full reasoning and the Sprint 2 recommendation to revisit it if a
// browser-hosted (non-Node) validation runner is ever built). As defense
// in depth, every write/reset function below requires an explicit
// `confirmValidationEnvironment: true` — a caller cannot trigger a bulk
// write or a store-clear by accident.

export class ValidationDatabaseUnavailableError extends Error {
  constructor() {
    super('No IndexedDB implementation is available in this environment. Run via the validation CLI (which installs fake-indexeddb) or under vitest (src/testSetup.ts already installs it).');
    this.name = 'ValidationDatabaseUnavailableError';
  }
}

export class ValidationEnvironmentNotConfirmedError extends Error {
  constructor() {
    super('Refusing to write/clear the validation database: pass { confirmValidationEnvironment: true } to acknowledge this call targets an isolated validation store, not production data.');
    this.name = 'ValidationEnvironmentNotConfirmedError';
  }
}

export interface ValidationDbOptions {
  confirmValidationEnvironment: true;
}

export interface PersistDatasetResult {
  collectionsWritten: number;
  assetsWritten: number;
  collectionBatches: number;
  assetBatches: number;
  durationMs: number;
  databaseName: string;
}

function assertReady(options: ValidationDbOptions): void {
  if (!options?.confirmValidationEnvironment) throw new ValidationEnvironmentNotConfirmedError();
  if (!idbAvailable()) throw new ValidationDatabaseUnavailableError();
}

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Writes a generated dataset via the same bulk storage primitives
 * `collectionService.ts` itself uses (`putCollectionRecordsBulk`,
 * `putPortfolioAssetsBulk`) — no parallel write path, no direct
 * `indexedDB` access of its own. Collections are written before assets
 * so that, if a caller inspects state mid-write, no asset ever
 * temporarily references a collection id that isn't there yet. */
export async function persistDataset(
  collections: Collection[],
  assets: PortfolioAsset[],
  batchSize: number,
  options: ValidationDbOptions,
): Promise<PersistDatasetResult> {
  assertReady(options);
  const start = performance.now();
  const collectionBatches = chunk(collections, batchSize);
  const assetBatches = chunk(assets, batchSize);
  for (const batch of collectionBatches) await putCollectionRecordsBulk(batch);
  for (const batch of assetBatches) await putPortfolioAssetsBulk(batch);
  return {
    collectionsWritten: collections.length,
    assetsWritten: assets.length,
    collectionBatches: collectionBatches.length,
    assetBatches: assetBatches.length,
    durationMs: performance.now() - start,
    databaseName: DB_NAME,
  };
}

/** Clears both Collection-related stores via the existing, approved
 * test/reset-only primitives (`clearCollectionsStore`,
 * `clearPortfolioStores`) — never a raw `indexedDB.deleteDatabase(...)`,
 * so this can never remove a store this module doesn't know about. */
export async function resetValidationDatabase(options: ValidationDbOptions): Promise<{ durationMs: number }> {
  assertReady(options);
  const start = performance.now();
  await clearCollectionsStore();
  await clearPortfolioStores();
  return { durationMs: performance.now() - start };
}
