import type { PortfolioAsset } from '../domain/types';
import type { SubmissionRecord } from '../submission/submissionRecord';
import type { SalesEvent } from '../submission/salesRevenue';
import type { RejectionRecord } from '../submission/rejectionIntelligence';
import { effectiveCategory, type RejectionCategory } from '../submission/rejectionIntelligence';

// Build 026, Phase 12 — Commercial Feedback Engine. Explicitly distinct
// from `dashboard/recommendationEngine.ts` (Build 017's workflow-hygiene
// recommender — missing titles, stale drafts, duplicate risk; never
// looks at real marketplace outcomes) and from the generation-time
// Beauty/Commercial Score computed by the pattern generator's own
// quality critic (`qualityClassification.ts`'s `classifyQuality`,
// persisted per-evaluation in `QualitySnapshot`). This engine reads
// ONLY real recorded outcomes — submission approvals/rejections, sales
// revenue/downloads, structured rejection categories — and NEVER reads,
// writes, or overrides any `QualitySnapshot`, `beautyScore`, or
// `commercialScore` field; it produces a separate report object with its
// own confidence-gated insights, nothing more.
//
// "Confidence-aware, must refuse high confidence claims below a
// documented minimum sample size" (brief): every insight's `confidence`
// is capped by `decidedCount` (approved + rejected submissions actually
// attributable to that dimension value) regardless of how large the
// observed effect looks — a 100% approval rate on 2 submissions is
// reported at `'low'` confidence, never `'high'`, because 2 is below
// `MIN_SAMPLE_SIZE_MODERATE_CONFIDENCE`. The two thresholds are named
// constants (not magic numbers) so the documented policy and the code
// enforcing it can never drift apart.

export const MIN_SAMPLE_SIZE_MODERATE_CONFIDENCE = 5;
export const MIN_SAMPLE_SIZE_HIGH_CONFIDENCE = 10;

export type CommercialConfidenceLevel = 'high' | 'moderate' | 'low';

export type CommercialDimension = 'presetId' | 'styleDna' | 'compositionType' | 'patternType';

export const COMMERCIAL_FEEDBACK_DIMENSIONS: CommercialDimension[] = ['presetId', 'styleDna', 'compositionType', 'patternType'];

export interface DimensionRejectionBreakdown {
  category: RejectionCategory;
  count: number;
}

export interface CommercialDimensionOutcome {
  dimension: CommercialDimension;
  value: string;
  /** Every submission attributable to this dimension value, regardless
   * of status (includes DRAFT/READY/SUBMITTED, not just decided ones). */
  sampleSize: number;
  /** Submissions actually APPROVED or REJECTED — the only ones an
   * approval-rate claim can be based on; the sample size the confidence
   * gate is keyed on. */
  decidedCount: number;
  approvedCount: number;
  rejectedCount: number;
  /** `null` when `decidedCount` is 0 — there is no rate to report, not
   * even at low confidence. */
  approvalRate: number | null;
  netRevenue: number;
  downloads: number;
  /** Up to 3 most common rejection categories among this value's
   * rejected submissions, most frequent first. */
  topRejectionCategories: DimensionRejectionBreakdown[];
  confidence: CommercialConfidenceLevel;
  /** Always states the exact sample size and, when confidence is capped,
   * exactly how many more decided submissions would be needed to raise
   * it — every insight explains itself, per the brief's "explainable"
   * requirement. */
  explanation: string;
}

export interface CommercialFeedbackReport {
  generatedAt: number;
  portfolioDecidedCount: number;
  portfolioApprovalRate: number | null;
  dimensions: CommercialDimensionOutcome[];
}

export interface GenerateCommercialFeedbackInput {
  assets: PortfolioAsset[];
  submissions: SubmissionRecord[];
  salesEvents: SalesEvent[];
  rejectionRecords: RejectionRecord[];
  /** Injectable clock for deterministic tests, mirroring this repo's
   * `now?: number` convention elsewhere (e.g. `dashboardSnapshot.ts`). */
  now?: number;
}

function confidenceFor(decidedCount: number): CommercialConfidenceLevel {
  if (decidedCount >= MIN_SAMPLE_SIZE_HIGH_CONFIDENCE) return 'high';
  if (decidedCount >= MIN_SAMPLE_SIZE_MODERATE_CONFIDENCE) return 'moderate';
  return 'low';
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function buildExplanation(
  dimension: CommercialDimension,
  value: string,
  decidedCount: number,
  approvedCount: number,
  rejectedCount: number,
  approvalRate: number | null,
  portfolioApprovalRate: number | null,
  portfolioDecidedCount: number,
  confidence: CommercialConfidenceLevel,
): string {
  if (decidedCount === 0) {
    return `No approved or rejected submissions exist yet for ${dimension} "${value}" — nothing to report.`;
  }
  const base = `Based on ${decidedCount} decided submission${decidedCount === 1 ? '' : 's'} (${approvedCount} approved, ${rejectedCount} rejected), ${dimension} "${value}" has a ${pct(approvalRate ?? 0)} approval rate` +
    (portfolioApprovalRate !== null ? ` vs the portfolio baseline of ${pct(portfolioApprovalRate)} (${portfolioDecidedCount} decided submissions overall).` : '.');

  if (confidence === 'high') {
    return `${base} Sample size is at least ${MIN_SAMPLE_SIZE_HIGH_CONFIDENCE}, so this is reported at high confidence.`;
  }
  if (confidence === 'moderate') {
    const needed = MIN_SAMPLE_SIZE_HIGH_CONFIDENCE - decidedCount;
    return `${base} Sample size is below the ${MIN_SAMPLE_SIZE_HIGH_CONFIDENCE}-submission bar for high confidence (${needed} more decided submission${needed === 1 ? '' : 's'} needed), so this is reported at moderate confidence.`;
  }
  const needed = MIN_SAMPLE_SIZE_MODERATE_CONFIDENCE - decidedCount;
  return `${base} Sample size is below the ${MIN_SAMPLE_SIZE_MODERATE_CONFIDENCE}-submission bar for moderate confidence (${needed} more decided submission${needed === 1 ? '' : 's'} needed), so this is reported at low confidence — treat it as a hint, not a proven trend.`;
}

function dimensionValueOf(asset: PortfolioAsset, dimension: CommercialDimension): string | null {
  const raw = asset[dimension];
  return raw && raw.trim() ? raw : null;
}

/** Pure function: given already-loaded assets/submissions/sales/rejection
 * records, produces one confidence-gated, explainable report. Never
 * mutates any input, never touches `QualitySnapshot`/Beauty/Commercial
 * Score, and never claims high confidence below
 * `MIN_SAMPLE_SIZE_HIGH_CONFIDENCE` decided submissions for a dimension
 * value regardless of how strong the observed signal looks. */
export function generateCommercialFeedback(input: GenerateCommercialFeedbackInput): CommercialFeedbackReport {
  const { assets, submissions, salesEvents, rejectionRecords, now } = input;
  const assetById = new Map(assets.map((a) => [a.assetId, a]));
  const rejectionsBySubmissionId = new Map<string, RejectionRecord[]>();
  for (const r of rejectionRecords) {
    const list = rejectionsBySubmissionId.get(r.submissionId) ?? [];
    list.push(r);
    rejectionsBySubmissionId.set(r.submissionId, list);
  }
  const revenueByProductionAssetId = new Map<string, { netRevenue: number; downloads: number }>();
  for (const e of salesEvents) {
    const existing = revenueByProductionAssetId.get(e.productionAssetId) ?? { netRevenue: 0, downloads: 0 };
    existing.netRevenue += e.netRevenue;
    existing.downloads += e.downloads;
    revenueByProductionAssetId.set(e.productionAssetId, existing);
  }

  const decidedSubmissions = submissions.filter((s) => s.status === 'APPROVED' || s.status === 'REJECTED');
  const portfolioApprovedCount = decidedSubmissions.filter((s) => s.status === 'APPROVED').length;
  const portfolioDecidedCount = decidedSubmissions.length;
  const portfolioApprovalRate = portfolioDecidedCount > 0 ? portfolioApprovedCount / portfolioDecidedCount : null;

  const dimensions: CommercialDimensionOutcome[] = [];

  for (const dimension of COMMERCIAL_FEEDBACK_DIMENSIONS) {
    const byValue = new Map<string, SubmissionRecord[]>();
    for (const submission of submissions) {
      const asset = assetById.get(submission.patternId);
      if (!asset) continue;
      const value = dimensionValueOf(asset, dimension);
      if (!value) continue;
      const list = byValue.get(value) ?? [];
      list.push(submission);
      byValue.set(value, list);
    }

    for (const [value, groupSubmissions] of byValue) {
      const approved = groupSubmissions.filter((s) => s.status === 'APPROVED');
      const rejected = groupSubmissions.filter((s) => s.status === 'REJECTED');
      const decidedCount = approved.length + rejected.length;
      const approvalRate = decidedCount > 0 ? approved.length / decidedCount : null;

      let netRevenue = 0;
      let downloads = 0;
      for (const submission of groupSubmissions) {
        const asset = assetById.get(submission.patternId);
        if (!asset?.productionAssetId) continue;
        const rev = revenueByProductionAssetId.get(asset.productionAssetId);
        if (rev) {
          netRevenue += rev.netRevenue;
          downloads += rev.downloads;
        }
      }

      const rejectionRecordsForGroup = rejected.flatMap((s) => rejectionsBySubmissionId.get(s.submissionId) ?? []);
      const categoryCounts = new Map<RejectionCategory, number>();
      for (const r of rejectionRecordsForGroup) {
        const cat = effectiveCategory(r);
        categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
      }
      const topRejectionCategories = [...categoryCounts.entries()]
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      const confidence = confidenceFor(decidedCount);
      const explanation = buildExplanation(
        dimension,
        value,
        decidedCount,
        approved.length,
        rejected.length,
        approvalRate,
        portfolioApprovalRate,
        portfolioDecidedCount,
        confidence,
      );

      dimensions.push({
        dimension,
        value,
        sampleSize: groupSubmissions.length,
        decidedCount,
        approvedCount: approved.length,
        rejectedCount: rejected.length,
        approvalRate,
        netRevenue,
        downloads,
        topRejectionCategories,
        confidence,
        explanation,
      });
    }
  }

  dimensions.sort((a, b) => b.decidedCount - a.decidedCount);

  return {
    generatedAt: now ?? Date.now(),
    portfolioDecidedCount,
    portfolioApprovalRate,
    dimensions,
  };
}
