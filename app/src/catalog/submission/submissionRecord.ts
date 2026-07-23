import type { SubmissionStatus } from './submissionStatus';

// Build 015 — the Submission Record domain model: one (pattern,
// marketplace) listing attempt. `patternId` is a plain, opaque string
// deliberately NOT typed against `catalog/domain/types.ts`'s
// `PortfolioAsset` — the Submission Center is a decoupled planning/
// tracking layer that can reference a pattern from Portfolio Manager,
// the pattern generator's own saved-patterns library, or any future
// source, without importing (and so without any risk of coupling to,
// or needing to modify) the frozen Collection API. Callers resolve
// `patternId` to whatever "the pattern" means in their own context.

export const SUBMISSION_SCHEMA_VERSION = 2;

/** Build 026, schema v2 — additive fields the brief's Submission Tracker
 * (Phase 5) and Rejection Intelligence (Phase 10) sections ask for, none
 * of which existed in v1. Every field is optional on the interface and
 * defaulted in `normalizeSubmissionRecord` so a v1 record loaded from
 * storage never crashes; `productionAssetId` is the one field that
 * connects a submission back to Build 026's content-derived identity
 * (`domain/productionAssetId.ts`), letting duplicate-submission checks
 * work across renamed/copied files (see `submissionDuplicateDetection.ts`). */
export type AiDeclarationStatus = 'not-ai-generated' | 'ai-assisted' | 'ai-generated' | 'not-declared';
export type EditorialDesignation = 'commercial' | 'editorial';

/** One entry in a record's own append-only status log — this *is* "Submission
 * History" (see `submissionHistory.ts`): rather than a separate history
 * store that could drift from the record it describes, each transition
 * appends here in the same write, so a record's history can never be
 * inconsistent with its own current `status`. */
export interface SubmissionStatusEvent {
  status: SubmissionStatus;
  changedAt: number;
  note?: string;
}

export interface SubmissionRecord {
  submissionId: string;
  patternId: string;
  marketplaceId: string;
  status: SubmissionStatus;
  createdAt: number;
  submittedAt: number | null;
  updatedAt: number;
  /** Starts at 1; a fresh submission created after a prior attempt for
   * the same (pattern, marketplace) was rejected/archived is expected to
   * increment this — see `submissionDuplicateDetection.ts`'s "same
   * version" rule and `SUBMISSION_WORKFLOW.md`'s "Resubmitting after
   * rejection" section. */
  version: number;
  titleSnapshot: string;
  /** Beyond the brief's literal field list, added because
   * `submissionValidation.ts`'s required "Description exists" check has
   * nowhere else to read from — a submission's description is
   * per-marketplace-listing text, not a property of the pattern itself,
   * so it belongs on the record next to `titleSnapshot`/`keywordSnapshot`,
   * not derived from anywhere else. */
  descriptionSnapshot: string;
  keywordSnapshot: string[];
  /** Same rationale as `descriptionSnapshot` — required by validation's
   * "Category assigned" check, `null` until set. */
  category: string | null;
  notes: string;
  statusHistory: SubmissionStatusEvent[];
  schemaVersion: number;

  // --- Build 026, schema v2 (all additive, all optional-with-defaults) ---
  /** Links back to `domain/productionAssetId.ts`'s content-derived
   * identity — `null` when the caller didn't supply one (e.g. a pre-
   * Build-026 record, or a `patternId` source that hasn't computed one). */
  productionAssetId: string | null;
  contributorAccountLabel: string;
  submittedFilename: string | null;
  submittedFileTypes: string[];
  editorialDesignation: EditorialDesignation | null;
  aiDeclaration: AiDeclarationStatus;
  submissionBatchId: string | null;
  reviewDate: number | null;
  approvedDate: number | null;
  rejectionDate: number | null;
  /** Links to a `RejectionRecord` (`rejectionIntelligence.ts`) with the
   * full structured reason — this field is only the pointer. */
  rejectionRecordId: string | null;
  resubmissionAllowed: boolean;
  resubmissionDate: number | null;
  marketplaceAssetId: string | null;
  marketplaceUrl: string | null;
  /** Distinct from `notes` (the brief's original free-text field, kept
   * as-is for backward compatibility) — `reviewerNotes` is specifically
   * what a marketplace reviewer said, `userNotes` is the contributor's
   * own annotation. Neither replaces `notes`. */
  reviewerNotes: string;
  userNotes: string;
}

/** `SUB-YYYYMMDD-XXXXXX` — same date-stamped + 6-char base36 suffix shape
 * as `domain/id.ts`'s `generateAssetId`/`generateCollectionId`, but
 * defined locally rather than imported from `domain/id.ts`: the
 * Submission Center is a new, isolated subsystem (own storage, own
 * domain types) that must not require any edit to existing Collection-
 * module files, including shared utilities, to stay unambiguously
 * outside the "do not modify the certified Collection API" boundary. */
function generateSubmissionId(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0');
  return `SUB-${y}${m}${d}-${suffix}`;
}

const SUBMISSION_ID_PATTERN = /^SUB-\d{8}-[0-9A-Z]{6}$/;

export function isValidSubmissionId(value: unknown): value is string {
  return typeof value === 'string' && SUBMISSION_ID_PATTERN.test(value);
}

export interface CreateSubmissionInput {
  patternId: string;
  marketplaceId: string;
  titleSnapshot?: string;
  descriptionSnapshot?: string;
  keywordSnapshot?: string[];
  category?: string | null;
  notes?: string;
  version?: number;
  /** Injectable clock for deterministic tests, mirroring
   * `createCollection`'s `now` parameter. */
  now?: number;
  productionAssetId?: string | null;
  contributorAccountLabel?: string;
  editorialDesignation?: EditorialDesignation | null;
  aiDeclaration?: AiDeclarationStatus;
}

export class InvalidSubmissionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSubmissionInputError';
  }
}

/** New submissions always start at `DRAFT` with a single `DRAFT` history
 * entry — there is no "create directly into Ready/Queued" path, matching
 * the validation-gated `READY` transition documented in
 * `submissionStatus.ts`. */
export function createSubmissionRecord(input: CreateSubmissionInput): SubmissionRecord {
  if (!input.patternId.trim()) {
    throw new InvalidSubmissionInputError('patternId cannot be empty.');
  }
  if (!input.marketplaceId.trim()) {
    throw new InvalidSubmissionInputError('marketplaceId cannot be empty.');
  }
  const now = input.now ?? Date.now();
  return {
    submissionId: generateSubmissionId(new Date(now)),
    patternId: input.patternId,
    marketplaceId: input.marketplaceId,
    status: 'DRAFT',
    createdAt: now,
    submittedAt: null,
    updatedAt: now,
    version: input.version ?? 1,
    titleSnapshot: input.titleSnapshot ?? '',
    descriptionSnapshot: input.descriptionSnapshot ?? '',
    keywordSnapshot: input.keywordSnapshot ?? [],
    category: input.category ?? null,
    notes: input.notes ?? '',
    statusHistory: [{ status: 'DRAFT', changedAt: now }],
    schemaVersion: SUBMISSION_SCHEMA_VERSION,
    productionAssetId: input.productionAssetId ?? null,
    contributorAccountLabel: input.contributorAccountLabel ?? '',
    submittedFilename: null,
    submittedFileTypes: [],
    editorialDesignation: input.editorialDesignation ?? null,
    aiDeclaration: input.aiDeclaration ?? 'not-declared',
    submissionBatchId: null,
    reviewDate: null,
    approvedDate: null,
    rejectionDate: null,
    rejectionRecordId: null,
    resubmissionAllowed: true,
    resubmissionDate: null,
    marketplaceAssetId: null,
    marketplaceUrl: null,
    reviewerNotes: '',
    userNotes: '',
  };
}

/** Defensive normalization for records loaded from storage, mirroring
 * `domain/collection.ts`'s `normalizeCollection` — every field falls
 * back to a safe default so a future schema addition never crashes on an
 * older stored record. */
export function normalizeSubmissionRecord(record: SubmissionRecord): SubmissionRecord {
  return {
    ...record,
    schemaVersion: record.schemaVersion ?? SUBMISSION_SCHEMA_VERSION,
    submittedAt: record.submittedAt ?? null,
    version: record.version ?? 1,
    titleSnapshot: record.titleSnapshot ?? '',
    descriptionSnapshot: record.descriptionSnapshot ?? '',
    keywordSnapshot: record.keywordSnapshot ?? [],
    category: record.category ?? null,
    notes: record.notes ?? '',
    statusHistory: record.statusHistory ?? [],
    productionAssetId: record.productionAssetId ?? null,
    contributorAccountLabel: record.contributorAccountLabel ?? '',
    submittedFilename: record.submittedFilename ?? null,
    submittedFileTypes: record.submittedFileTypes ?? [],
    editorialDesignation: record.editorialDesignation ?? null,
    aiDeclaration: record.aiDeclaration ?? 'not-declared',
    submissionBatchId: record.submissionBatchId ?? null,
    reviewDate: record.reviewDate ?? null,
    approvedDate: record.approvedDate ?? null,
    rejectionDate: record.rejectionDate ?? null,
    rejectionRecordId: record.rejectionRecordId ?? null,
    resubmissionAllowed: record.resubmissionAllowed ?? true,
    resubmissionDate: record.resubmissionDate ?? null,
    marketplaceAssetId: record.marketplaceAssetId ?? null,
    marketplaceUrl: record.marketplaceUrl ?? null,
    reviewerNotes: record.reviewerNotes ?? '',
    userNotes: record.userNotes ?? '',
  };
}

export function isValidSubmissionRecord(value: unknown): value is SubmissionRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<SubmissionRecord>;
  return (
    typeof r.submissionId === 'string' &&
    typeof r.patternId === 'string' &&
    typeof r.marketplaceId === 'string' &&
    typeof r.status === 'string' &&
    typeof r.createdAt === 'number' &&
    typeof r.updatedAt === 'number' &&
    typeof r.version === 'number' &&
    Array.isArray(r.keywordSnapshot)
  );
}
