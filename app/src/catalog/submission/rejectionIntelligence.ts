// Build 026, Phase 10 — Rejection Intelligence. Structured rejection
// taxonomy + normalization + cross-dimension analysis. No structured
// rejection reason field exists anywhere today (`SubmissionRecord` only
// has a free-text `note` on its status history) — this module adds the
// taxonomy and a keyword-based normalizer; `rejectionStore.ts` persists
// `RejectionRecord`s.

export type RejectionCategory =
  | 'technical-quality'
  | 'vector-construction'
  | 'similarity'
  | 'duplicate-content'
  | 'metadata'
  | 'trademark'
  | 'copyright'
  | 'ai-policy'
  | 'commercial-value'
  | 'composition'
  | 'color'
  | 'artifacts'
  | 'file-corruption'
  | 'unsupported-format'
  | 'keyword-issue'
  | 'category-issue'
  | 'other';

export const REJECTION_CATEGORIES: RejectionCategory[] = [
  'technical-quality',
  'vector-construction',
  'similarity',
  'duplicate-content',
  'metadata',
  'trademark',
  'copyright',
  'ai-policy',
  'commercial-value',
  'composition',
  'color',
  'artifacts',
  'file-corruption',
  'unsupported-format',
  'keyword-issue',
  'category-issue',
  'other',
];

export const REJECTION_RECORD_SCHEMA_VERSION = 1;

export interface RejectionRecord {
  rejectionId: string;
  submissionId: string;
  /** The marketplace's own rejection text, verbatim — never edited or
   * truncated, so a human can always see exactly what the marketplace said. */
  marketplaceReasonText: string;
  normalizedReason: RejectionCategory;
  /** The user's own interpretation/notes — distinct from the marketplace's
   * text and from `normalizedReason` (an automated best-guess), per the
   * brief's explicit "user interpretation" field. */
  userInterpretation: string;
  /** Set once a human confirms/corrects the automated `normalizedReason` —
   * `null` until reviewed. Downstream analysis prefers this over
   * `normalizedReason` when present. */
  correctedCategory: RejectionCategory | null;
  /** Outcome of a resubmission attempt addressing this rejection, if any. */
  resubmissionResult: 'pending' | 'approved' | 'rejected-again' | null;
  createdAt: number;
  schemaVersion: number;
}

/** Keyword-based normalizer — deliberately simple pattern matching (not a
 * trained classifier, no ML dependency) over the marketplace's own
 * rejection text. Order matters: more specific categories are checked
 * before generic ones so e.g. "duplicate of a previous submission" hits
 * `duplicate-content` rather than the more generic `similarity`. Falls
 * back to `other` rather than guessing — the brief explicitly requires
 * every rejection to land in a named category "or `other`," never
 * silently dropped. */
const KEYWORD_RULES: Array<{ category: RejectionCategory; patterns: RegExp[] }> = [
  { category: 'duplicate-content', patterns: [/duplicate/i, /already (?:in|on) (?:our|the) (?:catalog|site|portfolio)/i] },
  { category: 'trademark', patterns: [/trademark/i, /brand(?:ed)? name/i, /logo/i] },
  { category: 'copyright', patterns: [/copyright/i, /intellectual property/i, /\bIP\b/] },
  { category: 'ai-policy', patterns: [/\bAI[- ]generated\b/i, /artificial intelligence/i, /AI (?:declaration|policy)/i] },
  { category: 'similarity', patterns: [/similar to/i, /too similar/i, /near[- ]identical/i] },
  { category: 'vector-construction', patterns: [/open path/i, /unclosed path/i, /stray point/i, /vector construction/i, /not (?:properly )?vectorized/i] },
  { category: 'file-corruption', patterns: [/corrupt/i, /damaged file/i, /failed to open/i] },
  { category: 'unsupported-format', patterns: [/unsupported format/i, /wrong file type/i, /invalid format/i] },
  { category: 'keyword-issue', patterns: [/keyword/i, /tag(?:s|ging)? (?:issue|problem)/i] },
  { category: 'category-issue', patterns: [/wrong category/i, /category (?:issue|mismatch)/i] },
  { category: 'metadata', patterns: [/title/i, /description/i, /metadata/i] },
  { category: 'commercial-value', patterns: [/commercial value/i, /market(?:able|ability)/i, /limited appeal/i] },
  { category: 'composition', patterns: [/composition/i, /layout/i, /balance/i] },
  { category: 'color', patterns: [/colou?r/i] },
  { category: 'artifacts', patterns: [/artifact/i, /noise/i, /pixelat/i] },
  { category: 'technical-quality', patterns: [/(?:low|poor) quality/i, /resolution/i, /technical (?:issue|quality)/i] },
];

export function normalizeRejectionReason(marketplaceReasonText: string): RejectionCategory {
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some((p) => p.test(marketplaceReasonText))) return rule.category;
  }
  return 'other';
}

export interface CreateRejectionRecordInput {
  submissionId: string;
  marketplaceReasonText: string;
  userInterpretation?: string;
  now?: number;
}

function generateRejectionId(now: number): string {
  return `REJ-${now}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createRejectionRecord(input: CreateRejectionRecordInput): RejectionRecord {
  const now = input.now ?? Date.now();
  return {
    rejectionId: generateRejectionId(now),
    submissionId: input.submissionId,
    marketplaceReasonText: input.marketplaceReasonText,
    normalizedReason: normalizeRejectionReason(input.marketplaceReasonText),
    userInterpretation: input.userInterpretation ?? '',
    correctedCategory: null,
    resubmissionResult: null,
    createdAt: now,
    schemaVersion: REJECTION_RECORD_SCHEMA_VERSION,
  };
}

export function normalizeRejectionRecord(record: RejectionRecord): RejectionRecord {
  return {
    ...record,
    schemaVersion: record.schemaVersion ?? REJECTION_RECORD_SCHEMA_VERSION,
    userInterpretation: record.userInterpretation ?? '',
    correctedCategory: record.correctedCategory ?? null,
    resubmissionResult: record.resubmissionResult ?? null,
  };
}

export function isValidRejectionRecord(value: unknown): value is RejectionRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<RejectionRecord>;
  return typeof r.rejectionId === 'string' && typeof r.submissionId === 'string' && typeof r.marketplaceReasonText === 'string';
}

/** The category actually used for analysis — a human `correctedCategory`
 * always wins over the automated `normalizedReason`. Never treats "no
 * correction yet" as itself meaningful (i.e. never assumes the automated
 * guess is definitely right, only that it's the best available signal
 * until a human overrides it). */
export function effectiveCategory(record: RejectionRecord): RejectionCategory {
  return record.correctedCategory ?? record.normalizedReason;
}

export interface RejectionBreakdown {
  category: RejectionCategory;
  count: number;
}

/** Groups by effective category — the brief's "analysis by ... rejection
 * reason." Does NOT itself join against marketplace/styleDna/etc.
 * (callers pass in already-filtered subsets for those dimensions, e.g.
 * "rejections for luxuryFloral submissions only") — this module owns
 * only the category grouping, not cross-domain joins. */
export function breakdownByCategory(records: RejectionRecord[]): RejectionBreakdown[] {
  const counts = new Map<RejectionCategory, number>();
  for (const r of records) {
    const cat = effectiveCategory(r);
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  return [...counts.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
}
