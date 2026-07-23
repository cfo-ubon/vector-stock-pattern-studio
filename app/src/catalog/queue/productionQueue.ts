// Build 026, Phase 14 — Production Queue. A per-idea/per-asset pipeline
// stage tracker, deliberately distinct from two existing status concepts
// in this codebase: `PortfolioAsset.workflowStatus`
// (DRAFT/READY_FOR_REVIEW/READY_TO_UPLOAD/SUBMITTED/APPROVED/REJECTED/
// NEEDS_REVISION -- an asset-level production-readiness flag) and
// `SubmissionStatus` (marketplace-specific, one per (pattern,
// marketplace) listing attempt). Neither of those has a stage BEFORE an
// asset exists at all -- the brief's queue starts at `IDEA`, before
// generation has even happened, which is a concept neither existing enum
// can represent. `status` (not `stage`) is the field name because
// `storage/db.ts`'s `productionQueueItems` object store already indexes
// on `status`/`batchId` (added ahead of this file, Build 026's DB_VERSION
// 5->6 migration) -- keeping the field name matched to that index avoids
// creating a useless index on a nonexistent property.

export type ProductionQueueStatus =
  | 'IDEA'
  | 'GENERATED'
  | 'QUALITY_REVIEW'
  | 'READY'
  | 'PACKAGE_PREPARED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'PERFORMANCE_TRACKING';

export const PRODUCTION_QUEUE_STATUSES: ProductionQueueStatus[] = [
  'IDEA',
  'GENERATED',
  'QUALITY_REVIEW',
  'READY',
  'PACKAGE_PREPARED',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'PERFORMANCE_TRACKING',
];

export function isProductionQueueStatus(value: unknown): value is ProductionQueueStatus {
  return typeof value === 'string' && (PRODUCTION_QUEUE_STATUSES as string[]).includes(value);
}

/** Valid forward transitions. `QUALITY_REVIEW -> GENERATED` is the
 * regenerate-on-failure loop (mirrors the pattern generator's own Hero
 * Detector regenerate-on-failure convention, Build 003 Section 7 --
 * quality review can fail and send an item back to regeneration rather
 * than dead-ending). `REJECTED -> IDEA` and `REJECTED -> GENERATED` are
 * the rework/resubmission path -- a rejected item can start over from
 * either "needs a new idea entirely" or "just needs a fresh generation
 * attempt of the same idea," per `SUBMISSION_WORKFLOW.md`'s existing
 * "resubmitting after rejection" convention. `PERFORMANCE_TRACKING` is
 * terminal -- once an approved asset is tracked for sales, there is no
 * further queue stage (revenue tracking itself lives in
 * `submission/salesRevenue.ts`, not here). */
export const PRODUCTION_QUEUE_TRANSITIONS: Record<ProductionQueueStatus, ProductionQueueStatus[]> = {
  IDEA: ['GENERATED'],
  GENERATED: ['QUALITY_REVIEW'],
  QUALITY_REVIEW: ['READY', 'GENERATED'],
  READY: ['PACKAGE_PREPARED'],
  PACKAGE_PREPARED: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['PERFORMANCE_TRACKING'],
  REJECTED: ['IDEA', 'GENERATED'],
  PERFORMANCE_TRACKING: [],
};

export function canTransitionProductionQueueStatus(from: ProductionQueueStatus, to: ProductionQueueStatus): boolean {
  return PRODUCTION_QUEUE_TRANSITIONS[from].includes(to);
}

export class InvalidProductionQueueTransitionError extends Error {
  constructor(from: ProductionQueueStatus, to: ProductionQueueStatus) {
    super(`Cannot transition a production queue item from "${from}" to "${to}".`);
    this.name = 'InvalidProductionQueueTransitionError';
  }
}

export interface ProductionQueueStatusEvent {
  status: ProductionQueueStatus;
  changedAt: number;
  note?: string;
}

export const PRODUCTION_QUEUE_ITEM_SCHEMA_VERSION = 1;

export interface ProductionQueueItem {
  queueItemId: string;
  status: ProductionQueueStatus;
  /** Free-text description of the idea -- always present, even after an
   * asset exists, so the original intent is never lost as the item
   * moves through the pipeline. */
  ideaNote: string;
  /** Set once the idea reaches `GENERATED` or later; `null` at `IDEA`. */
  assetId: string | null;
  productionAssetId: string | null;
  /** Every submission created for this item, across every marketplace it
   * was ever submitted to -- appended to, never replaced, so a
   * REJECTED -> resubmit -> APPROVED cycle keeps its full history. */
  submissionIds: string[];
  batchId: string | null;
  createdAt: number;
  updatedAt: number;
  statusHistory: ProductionQueueStatusEvent[];
  schemaVersion: number;
}

export interface CreateProductionQueueItemInput {
  ideaNote: string;
  assetId?: string | null;
  productionAssetId?: string | null;
  batchId?: string | null;
  now?: number;
}

function generateQueueItemId(now: number): string {
  return `QI-${now}-${Math.random().toString(36).slice(2, 10)}`;
}

/** New queue items always start at `IDEA`, mirroring
 * `submissionRecord.ts`'s "new submissions always start at DRAFT"
 * convention -- there is no "create directly into a later stage" path. */
export function createProductionQueueItem(input: CreateProductionQueueItemInput): ProductionQueueItem {
  const now = input.now ?? Date.now();
  return {
    queueItemId: generateQueueItemId(now),
    status: 'IDEA',
    ideaNote: input.ideaNote,
    assetId: input.assetId ?? null,
    productionAssetId: input.productionAssetId ?? null,
    submissionIds: [],
    batchId: input.batchId ?? null,
    createdAt: now,
    updatedAt: now,
    statusHistory: [{ status: 'IDEA', changedAt: now }],
    schemaVersion: PRODUCTION_QUEUE_ITEM_SCHEMA_VERSION,
  };
}

/** Pure transition: returns a new item with `status` advanced and one new
 * `statusHistory` entry appended, or throws
 * `InvalidProductionQueueTransitionError` for a disallowed transition --
 * mirrors `submissionStatus.ts`'s `assertValidSubmissionTransition`
 * pattern. Never mutates the input. */
export function transitionProductionQueueItem(item: ProductionQueueItem, to: ProductionQueueStatus, now?: number, note?: string): ProductionQueueItem {
  if (!canTransitionProductionQueueStatus(item.status, to)) {
    throw new InvalidProductionQueueTransitionError(item.status, to);
  }
  const changedAt = now ?? Date.now();
  return {
    ...item,
    status: to,
    updatedAt: changedAt,
    statusHistory: [...item.statusHistory, { status: to, changedAt, ...(note ? { note } : {}) }],
  };
}

export function normalizeProductionQueueItem(item: ProductionQueueItem): ProductionQueueItem {
  return {
    ...item,
    schemaVersion: item.schemaVersion ?? PRODUCTION_QUEUE_ITEM_SCHEMA_VERSION,
    status: isProductionQueueStatus(item.status) ? item.status : 'IDEA',
    ideaNote: item.ideaNote ?? '',
    assetId: item.assetId ?? null,
    productionAssetId: item.productionAssetId ?? null,
    submissionIds: item.submissionIds ?? [],
    batchId: item.batchId ?? null,
    statusHistory: item.statusHistory ?? [],
  };
}

export function isValidProductionQueueItem(value: unknown): value is ProductionQueueItem {
  if (!value || typeof value !== 'object') return false;
  const q = value as Partial<ProductionQueueItem>;
  return typeof q.queueItemId === 'string' && isProductionQueueStatus(q.status) && typeof q.createdAt === 'number';
}
