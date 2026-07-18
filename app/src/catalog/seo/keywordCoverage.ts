import { normalizeKeywords } from './keywordNormalizer';

// Build 016 — Keyword Coverage. A well-covered stock listing touches
// several distinct *concepts* a buyer might search by, not just many
// keywords about the same one thing. 5 broad concept buckets, the same
// shape (if not the same exact terms) as this repo's own
// `metadata/submissionCenter.ts` precedent — deliberately not imported
// from there (this engine stays decoupled, see `seoProfile.ts`'s module
// header), but the concept is worth reusing rather than reinventing.

export type CoverageConcept = 'technique' | 'subject' | 'color' | 'useCase' | 'format';

export const COVERAGE_CONCEPTS: CoverageConcept[] = ['technique', 'subject', 'color', 'useCase', 'format'];

/** Seed term lists per concept — intentionally not exhaustive. A keyword
 * counts toward a concept if it *contains* one of these terms as a
 * substring (post-normalization), so "seamless floral pattern" still
 * matches `technique` via "seamless" and `subject` via "floral" even
 * though the full keyword is a 3-word phrase. */
const COVERAGE_CONCEPT_TERMS: Record<CoverageConcept, string[]> = {
  technique: ['seamless', 'vector', 'repeat', 'tileable', 'pattern', 'illustration', 'hand drawn', 'digital'],
  subject: ['floral', 'botanical', 'geometric', 'animal', 'abstract', 'tropical', 'nature', 'leaf', 'flower', 'mandala', 'stripe', 'dot', 'plaid'],
  color: ['pastel', 'bright', 'monochrome', 'colorful', 'neutral', 'vibrant', 'black and white', 'gold'],
  useCase: ['fabric', 'wallpaper', 'textile', 'packaging', 'stationery', 'wrapping paper', 'apparel', 'gift wrap', 'upholstery', 'home decor'],
  format: ['editable', 'eps', 'svg', 'flat', 'print', 'digital paper'],
};

export interface KeywordCoverageReport {
  coveredConcepts: CoverageConcept[];
  missingConcepts: CoverageConcept[];
  /** `coveredConcepts.length / COVERAGE_CONCEPTS.length * 100`, rounded. */
  coverageScore: number;
}

export function analyzeKeywordCoverage(keywords: string[]): KeywordCoverageReport {
  const normalized = normalizeKeywords(keywords);
  const coveredConcepts = COVERAGE_CONCEPTS.filter((concept) =>
    COVERAGE_CONCEPT_TERMS[concept].some((term) => normalized.some((keyword) => keyword.includes(term))),
  );
  const missingConcepts = COVERAGE_CONCEPTS.filter((concept) => !coveredConcepts.includes(concept));
  return {
    coveredConcepts,
    missingConcepts,
    coverageScore: Math.round((coveredConcepts.length / COVERAGE_CONCEPTS.length) * 100),
  };
}
