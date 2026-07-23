import { openDb, idbAvailable, requestAsPromise, QUALITY_SNAPSHOTS_STORE } from '../../storage/db';
import type { QualityDecision } from './qualityClassification';

// Build 026 — persisted quality classification. BUILD_026_AUDIT.md
// Section 4, item 2: no store remembers Beauty/Commercial score or
// READY/REVIEW/REJECT for an asset once a generation script exits. A
// `QualitySnapshot` is a point-in-time record (an asset can be
// re-evaluated after a generator update, producing a new snapshot rather
// than overwriting the old one) so quality-over-time is never lost.

export const QUALITY_SNAPSHOT_SCHEMA_VERSION = 1;

export interface QualitySnapshot {
  snapshotId: string;
  assetId: string;
  productionAssetId: string | null;
  beautyScore: number;
  commercialScore: number;
  thumbnailScore: number | null;
  fragmented: boolean;
  deadSpace: boolean;
  decision: QualityDecision;
  generatorVersion: string;
  createdAt: number;
  schemaVersion: number;
}

export interface CreateQualitySnapshotInput {
  assetId: string;
  productionAssetId?: string | null;
  beautyScore: number;
  commercialScore: number;
  thumbnailScore?: number | null;
  fragmented: boolean;
  deadSpace: boolean;
  decision: QualityDecision;
  generatorVersion: string;
  now?: number;
}

function generateSnapshotId(now: number): string {
  return `QS-${now}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createQualitySnapshot(input: CreateQualitySnapshotInput): QualitySnapshot {
  const now = input.now ?? Date.now();
  return {
    snapshotId: generateSnapshotId(now),
    assetId: input.assetId,
    productionAssetId: input.productionAssetId ?? null,
    beautyScore: input.beautyScore,
    commercialScore: input.commercialScore,
    thumbnailScore: input.thumbnailScore ?? null,
    fragmented: input.fragmented,
    deadSpace: input.deadSpace,
    decision: input.decision,
    generatorVersion: input.generatorVersion,
    createdAt: now,
    schemaVersion: QUALITY_SNAPSHOT_SCHEMA_VERSION,
  };
}

export function isValidQualitySnapshot(value: unknown): value is QualitySnapshot {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<QualitySnapshot>;
  return typeof s.snapshotId === 'string' && typeof s.assetId === 'string' && typeof s.decision === 'string';
}

export class QualitySnapshotStorageUnavailableError extends Error {
  constructor() {
    super('Quality snapshot tracking requires a browser with IndexedDB support.');
    this.name = 'QualitySnapshotStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new QualitySnapshotStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(QUALITY_SNAPSHOTS_STORE, mode).objectStore(QUALITY_SNAPSHOTS_STORE);
}

export async function loadQualitySnapshots(): Promise<QualitySnapshot[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<QualitySnapshot[]>);
  return items.filter(isValidQualitySnapshot);
}

export async function putQualitySnapshot(snapshot: QualitySnapshot): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(snapshot));
}

/** The most recent snapshot for a given asset — since re-evaluation
 * creates a new row rather than overwriting, "current classification"
 * means "latest by createdAt," not "the only one." */
export async function latestQualitySnapshotForAsset(assetId: string): Promise<QualitySnapshot | undefined> {
  const all = await loadQualitySnapshots();
  return all.filter((s) => s.assetId === assetId).sort((a, b) => b.createdAt - a.createdAt)[0];
}

export async function clearQualitySnapshots(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}
