import type { SubmissionRecord } from './submissionRecord';
import type { SubmissionStatus } from './submissionStatus';

// Build 015 — Submission Search + Submission Filter. Two related but
// distinct query surfaces, both pure functions over an in-memory record
// list (no storage dependency, so both compose freely with
// `submissionStore.ts`'s `loadSubmissions()` or any already-filtered
// subset a caller has on hand): `filterSubmissions` narrows by exact
// structured criteria (marketplace/status/pattern/date range),
// `searchSubmissions` does a free-text substring match across a
// record's human-readable fields.

export interface SubmissionFilterCriteria {
  marketplaceId?: string;
  status?: SubmissionStatus;
  patternId?: string;
  /** Inclusive bounds against `createdAt`, both optional and independent. */
  createdFrom?: number;
  createdTo?: number;
}

export function filterSubmissions(records: SubmissionRecord[], criteria: SubmissionFilterCriteria): SubmissionRecord[] {
  return records.filter((r) => {
    if (criteria.marketplaceId !== undefined && r.marketplaceId !== criteria.marketplaceId) return false;
    if (criteria.status !== undefined && r.status !== criteria.status) return false;
    if (criteria.patternId !== undefined && r.patternId !== criteria.patternId) return false;
    if (criteria.createdFrom !== undefined && r.createdAt < criteria.createdFrom) return false;
    if (criteria.createdTo !== undefined && r.createdAt > criteria.createdTo) return false;
    return true;
  });
}

/** Case-insensitive substring match against title, keywords, notes, and
 * pattern id — a keyword match checks each keyword individually rather
 * than a joined string, so a query like `"flor"` matches a keyword
 * `"floral"` the same way it would match a title containing "floral". */
export function searchSubmissions(records: SubmissionRecord[], query: string): SubmissionRecord[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return records;
  return records.filter((r) => {
    if (r.titleSnapshot.toLowerCase().includes(needle)) return true;
    if (r.notes.toLowerCase().includes(needle)) return true;
    if (r.patternId.toLowerCase().includes(needle)) return true;
    if (r.keywordSnapshot.some((k) => k.toLowerCase().includes(needle))) return true;
    return false;
  });
}
