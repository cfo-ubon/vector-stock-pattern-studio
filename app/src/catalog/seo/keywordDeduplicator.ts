import { normalizeKeyword } from './keywordNormalizer';

// Build 016 — Keyword Deduplicator. Exact-duplicate removal only (case/
// whitespace-insensitive) — "very similar but not identical" keywords
// (e.g. "floral pattern" vs "florals pattern") are `keywordAnalyzer.ts`'s
// `findSimilarKeywordPairs` concern, a fuzzy, non-destructive *report*,
// not something this module silently removes. Deduplication here is a
// real mutation (produces a new, shorter list); similarity detection
// never is.

export interface RemovedDuplicate {
  keyword: string;
  /** The original-casing keyword that was kept — the first occurrence,
   * by list order. */
  duplicateOf: string;
}

export interface DeduplicationResult {
  /** Original casing and relative order preserved — only exact repeats
   * (by normalized form) are dropped. */
  unique: string[];
  duplicatesRemoved: RemovedDuplicate[];
}

export function deduplicateKeywords(keywords: string[]): DeduplicationResult {
  const seen = new Map<string, string>(); // normalized form -> first-seen original text
  const unique: string[] = [];
  const duplicatesRemoved: RemovedDuplicate[] = [];

  for (const keyword of keywords) {
    const normalized = normalizeKeyword(keyword);
    if (!normalized) continue; // whitespace-only entries are dropped silently, not reported as duplicates
    const first = seen.get(normalized);
    if (first !== undefined) {
      duplicatesRemoved.push({ keyword, duplicateOf: first });
    } else {
      seen.set(normalized, keyword);
      unique.push(keyword);
    }
  }

  return { unique, duplicatesRemoved };
}
