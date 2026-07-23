// Build 026, Phase 14 — Production Batch / Campaign grouping. The
// brief's six named grouping types ("collection, production batch,
// submission batch, seasonal campaign, marketplace batch, experimental
// batch"). Deliberately NOT the same concept as `domain/collection.ts`'s
// `Collection` (a curated grouping of finished `PortfolioAsset`s for
// browsing/export) -- a `ProductionBatch` groups `ProductionQueueItem`s,
// which may not have a finished asset yet (an `IDEA`-stage item has no
// `assetId`), so it operates one layer earlier in the pipeline. A batch
// of type `'collection'` exists so a Collection-oriented campaign can
// still be modeled here without forcing every grouping through
// `domain/collection.ts`'s own (frozen, certified) API.

export type ProductionBatchType = 'collection' | 'production-batch' | 'submission-batch' | 'seasonal-campaign' | 'marketplace-batch' | 'experimental-batch';

export const PRODUCTION_BATCH_TYPES: ProductionBatchType[] = [
  'collection',
  'production-batch',
  'submission-batch',
  'seasonal-campaign',
  'marketplace-batch',
  'experimental-batch',
];

export function isProductionBatchType(value: unknown): value is ProductionBatchType {
  return typeof value === 'string' && (PRODUCTION_BATCH_TYPES as string[]).includes(value);
}

export const PRODUCTION_BATCH_SCHEMA_VERSION = 1;

export interface ProductionBatch {
  batchId: string;
  name: string;
  batchType: ProductionBatchType;
  /** Every queue item currently assigned to this batch. A queue item's
   * own `batchId` field is the source of truth for "which batch is this
   * item in" (mirrors `Collection`/`PortfolioAsset.collectionIds`'s
   * existing two-way-reference convention) -- this array is a
   * denormalized convenience list, kept in sync by
   * `addQueueItemToBatch`/`removeQueueItemFromBatch` rather than derived
   * fresh on every read, since a caller with many batches needs fast
   * "how many items in this batch" without re-scanning every queue item. */
  queueItemIds: string[];
  notes: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

export interface CreateProductionBatchInput {
  name: string;
  batchType: ProductionBatchType;
  notes?: string;
  now?: number;
}

function generateBatchId(now: number): string {
  return `BATCH-${now}-${Math.random().toString(36).slice(2, 10)}`;
}

export class InvalidProductionBatchInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidProductionBatchInputError';
  }
}

export function createProductionBatch(input: CreateProductionBatchInput): ProductionBatch {
  if (!input.name.trim()) {
    throw new InvalidProductionBatchInputError('name cannot be empty.');
  }
  const now = input.now ?? Date.now();
  return {
    batchId: generateBatchId(now),
    name: input.name,
    batchType: input.batchType,
    queueItemIds: [],
    notes: input.notes ?? '',
    createdAt: now,
    updatedAt: now,
    schemaVersion: PRODUCTION_BATCH_SCHEMA_VERSION,
  };
}

/** Pure, idempotent: adding an already-member item is a no-op (returns an
 * equivalent batch with an unchanged `updatedAt`) rather than creating a
 * duplicate entry. */
export function addQueueItemToBatch(batch: ProductionBatch, queueItemId: string, now?: number): ProductionBatch {
  if (batch.queueItemIds.includes(queueItemId)) return batch;
  return { ...batch, queueItemIds: [...batch.queueItemIds, queueItemId], updatedAt: now ?? Date.now() };
}

/** Pure, idempotent: removing a non-member is a no-op. */
export function removeQueueItemFromBatch(batch: ProductionBatch, queueItemId: string, now?: number): ProductionBatch {
  if (!batch.queueItemIds.includes(queueItemId)) return batch;
  return { ...batch, queueItemIds: batch.queueItemIds.filter((id) => id !== queueItemId), updatedAt: now ?? Date.now() };
}

export function normalizeProductionBatch(batch: ProductionBatch): ProductionBatch {
  return {
    ...batch,
    schemaVersion: batch.schemaVersion ?? PRODUCTION_BATCH_SCHEMA_VERSION,
    batchType: isProductionBatchType(batch.batchType) ? batch.batchType : 'production-batch',
    queueItemIds: batch.queueItemIds ?? [],
    notes: batch.notes ?? '',
  };
}

export function isValidProductionBatch(value: unknown): value is ProductionBatch {
  if (!value || typeof value !== 'object') return false;
  const b = value as Partial<ProductionBatch>;
  return typeof b.batchId === 'string' && typeof b.name === 'string' && isProductionBatchType(b.batchType) && Array.isArray(b.queueItemIds);
}
