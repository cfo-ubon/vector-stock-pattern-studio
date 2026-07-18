import type { SeoAnalytics } from './seoAnalytics';
import type { SubmissionAnalytics } from './submissionAnalytics';
import type { CollectionAnalytics } from './collectionAnalytics';

// Build 017 — Recommendation Engine. "Generate recommendations only.
// Never modify data" — every function here is pure and read-only,
// taking already-computed analytics reports as input and returning a
// plain array of suggestions. No storage, no calls into any other
// module's write path (`submissionService.ts`, `collectionService.ts`,
// etc.) — this module could not mutate anything even if it tried, since
// it never imports a single write function from anywhere.
//
// Determinism: every trigger condition below is a plain numeric
// comparison against the analytics report's own fields — no randomness,
// no wall-clock reads, no unordered-Set/Map iteration feeding the
// output order (the fixed `checks` array below is iterated in the same
// literal order every time). The same analytics input always produces
// the exact same recommendation list, satisfying "Recommendations
// deterministic."

export type RecommendationCode =
  | 'improve-seo'
  | 'complete-metadata'
  | 'move-ready-to-submission'
  | 'review-rejected'
  | 'remove-duplicates'
  | 'fill-empty-collections';

export type RecommendationPriority = 'high' | 'medium' | 'low';

export interface Recommendation {
  code: RecommendationCode;
  priority: RecommendationPriority;
  message: string;
  /** How many items this recommendation is about — a submission count,
   * a collection count, etc., depending on `code`. Always the exact
   * count already available on the relevant analytics report, never a
   * re-derived estimate. */
  relatedCount: number;
}

export interface RecommendationInputs {
  seoAnalytics: SeoAnalytics;
  submissionAnalytics: SubmissionAnalytics;
  collectionAnalytics: CollectionAnalytics;
  /** The exact count from `portfolioHealthCalculator.ts`'s exported
   * `countDuplicateConflictingSubmissions` — passed in rather than
   * re-derived from `PortfolioHealthScore.components.duplicateRisk`
   * (a rounded percentage) specifically to avoid a rounding-introduced
   * mismatch between the health score's percentage and this
   * recommendation's exact count for the same underlying fact. */
  duplicateSubmissionConflictCount: number;
}

export function generateRecommendations(inputs: RecommendationInputs): Recommendation[] {
  const { seoAnalytics, submissionAnalytics, collectionAnalytics, duplicateSubmissionConflictCount } = inputs;
  const recommendations: Recommendation[] = [];

  if (seoAnalytics.sampleSize > 0 && seoAnalytics.averageScore < 70) {
    recommendations.push({
      code: 'improve-seo',
      priority: seoAnalytics.averageScore < 50 ? 'high' : 'medium',
      message: `Average SEO score is ${seoAnalytics.averageScore}/100 across ${seoAnalytics.sampleSize} submission(s) — review titles, descriptions, and keywords for the lowest-scoring listings.`,
      relatedCount: seoAnalytics.sampleSize,
    });
  }

  if (seoAnalytics.missingMetadataCount > 0) {
    const ratio = seoAnalytics.missingMetadataCount / seoAnalytics.sampleSize;
    recommendations.push({
      code: 'complete-metadata',
      priority: ratio > 0.5 ? 'high' : 'medium',
      message: `${seoAnalytics.missingMetadataCount} submission(s) are missing a title, description, keywords, or category — complete these before marking them Ready.`,
      relatedCount: seoAnalytics.missingMetadataCount,
    });
  }

  if (submissionAnalytics.ready > 0) {
    recommendations.push({
      code: 'move-ready-to-submission',
      priority: 'medium',
      message: `${submissionAnalytics.ready} submission(s) are Ready but not yet queued — move them into the submission queue.`,
      relatedCount: submissionAnalytics.ready,
    });
  }

  if (submissionAnalytics.rejected > 0) {
    recommendations.push({
      code: 'review-rejected',
      priority: 'high',
      message: `${submissionAnalytics.rejected} submission(s) were rejected — review the marketplace's feedback and resubmit.`,
      relatedCount: submissionAnalytics.rejected,
    });
  }

  const totalDuplicateSignal = collectionAnalytics.duplicatePatternUsage.length + duplicateSubmissionConflictCount;
  if (totalDuplicateSignal > 0) {
    recommendations.push({
      code: 'remove-duplicates',
      priority: duplicateSubmissionConflictCount > 0 ? 'high' : 'low',
      message:
        collectionAnalytics.duplicatePatternUsage.length > 0 && duplicateSubmissionConflictCount > 0
          ? `${collectionAnalytics.duplicatePatternUsage.length} pattern(s) are filed in multiple collections and ${duplicateSubmissionConflictCount} submission(s) have duplicate-conflict risk — review both.`
          : collectionAnalytics.duplicatePatternUsage.length > 0
            ? `${collectionAnalytics.duplicatePatternUsage.length} pattern(s) are filed in more than one collection — confirm this is intentional.`
            : `${duplicateSubmissionConflictCount} submission(s) have a duplicate-conflict risk (same pattern/marketplace/version, or already approved/submitted) — review before submitting.`,
      relatedCount: totalDuplicateSignal,
    });
  }

  if (collectionAnalytics.emptyCollections.length > 0) {
    recommendations.push({
      code: 'fill-empty-collections',
      priority: 'low',
      message: `${collectionAnalytics.emptyCollections.length} collection(s) have no patterns assigned — add patterns or archive them.`,
      relatedCount: collectionAnalytics.emptyCollections.length,
    });
  }

  return recommendations;
}
