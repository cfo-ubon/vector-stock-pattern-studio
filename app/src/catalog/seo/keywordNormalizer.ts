// Build 016 — Keyword Normalizer. The one place keyword text gets
// cleaned into a canonical comparable form — every other keyword module
// (`keywordDeduplicator.ts`, `keywordAnalyzer.ts`, `keywordCoverage.ts`)
// normalizes through these functions rather than re-implementing
// trim/case/whitespace handling, so "are two keywords the same" always
// means the same thing across this engine.

/** Trim, collapse internal whitespace runs to single spaces, lowercase —
 * the canonical comparison form. Does NOT alter the keyword's stored/
 * displayed casing anywhere else in this engine; callers that need the
 * original text keep their own copy alongside the normalized one. */
export function normalizeKeyword(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Normalizes a whole list and drops anything that normalizes to empty
 * (whitespace-only entries) — the normalized list is comparison-only;
 * see `keywordDeduplicator.ts` for the operation that actually removes
 * duplicates while preserving original casing/order. */
export function normalizeKeywords(raw: string[]): string[] {
  return raw.map(normalizeKeyword).filter((k) => k.length > 0);
}
