import type { SubmissionRecord } from '../submission/submissionRecord';
import { computeSeoScore } from '../seo/seoScoring';
import { analyzeKeywords } from '../seo/keywordAnalyzer';
import type { SeoContentInput } from '../seo/seoValidator';

// Build 017 — SEO Analytics: the integration point between Submission
// Center and the SEO Intelligence Engine. Neither module was modified —
// this reads each `SubmissionRecord`'s own snapshot fields
// (`titleSnapshot`/`descriptionSnapshot`/`keywordSnapshot`, already
// stored there by Build 015) and feeds them through the SEO Engine's
// existing, unmodified pure functions (`computeSeoScore`,
// `analyzeKeywords`) — the SEO Engine itself has no storage of its own
// (see `docs/seo/SEO_ARCHITECTURE.md`), so a submission's snapshot is
// the only place real per-pattern SEO content actually lives to analyze.

export interface SeoAnalytics {
  averageScore: number;
  lowestScore: number;
  highestScore: number;
  /** Submissions missing at least one of title/description/keywords/
   * category — a universal completeness check independent of any one
   * marketplace's specific bounds (which `marketplaceCompatibility`
   * below already covers). */
  missingMetadataCount: number;
  /** Average of `keywordAnalyzer.ts`'s concept-bucket `coverageScore`
   * across every submission's own keyword list. */
  averageKeywordCoverage: number;
  /** Average of `computeSeoScore`'s own `marketplaceCompatibility`
   * dimension across every submission, each scored against its own
   * `marketplaceId`. */
  averageMarketplaceCompatibility: number;
  /** Number of submissions this report was actually computed from —
   * `0` for every numeric field above is ambiguous between "empty
   * portfolio" and "everything scored zero" without this. */
  sampleSize: number;
}

function toContent(record: SubmissionRecord): SeoContentInput {
  return { title: record.titleSnapshot, description: record.descriptionSnapshot, keywords: record.keywordSnapshot };
}

function isMissingMetadata(record: SubmissionRecord): boolean {
  return !record.titleSnapshot.trim() || !record.descriptionSnapshot.trim() || record.keywordSnapshot.length === 0 || !record.category;
}

export function computeSeoAnalytics(records: SubmissionRecord[]): SeoAnalytics {
  if (records.length === 0) {
    return { averageScore: 0, lowestScore: 0, highestScore: 0, missingMetadataCount: 0, averageKeywordCoverage: 0, averageMarketplaceCompatibility: 0, sampleSize: 0 };
  }

  const scores = records.map((r) => computeSeoScore(toContent(r), r.marketplaceId));
  const overallScores = scores.map((s) => s.overall);
  const coverageScores = records.map((r) => analyzeKeywords(r.keywordSnapshot).coverage.coverageScore);
  const compatibilityScores = scores.map((s) => s.marketplaceCompatibility);
  const missingMetadataCount = records.filter(isMissingMetadata).length;

  const average = (values: number[]) => Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;

  return {
    averageScore: average(overallScores),
    lowestScore: Math.min(...overallScores),
    highestScore: Math.max(...overallScores),
    missingMetadataCount,
    averageKeywordCoverage: average(coverageScores),
    averageMarketplaceCompatibility: average(compatibilityScores),
    sampleSize: records.length,
  };
}
