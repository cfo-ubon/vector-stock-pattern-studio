import type { PortfolioAsset } from '../catalog/domain/types';
import type { CommercialReadinessReport, CollectionCompletenessReport, CommercialRecommendation, CommercialRecommendationAction } from './domain/types';
import { DEFAULT_READINESS_THRESHOLD } from './domain/types';

// Build 031A, Phase 7 — AI Recommendation. Deliberately reuses the same
// "why/evidence" shape `aiCeo/domain/types.ts`'s `AiCeoExplanation` already
// established (see `commercial/domain/types.ts`'s header comment) rather
// than inventing a second explanation model, and — like every AI CEO
// recommendation in this app — never auto-acts: this module only ranks
// and explains, the caller always routes the chosen action through an
// existing, user-approved screen (Repair/SEO/Collection/Export), matching
// the app-wide Initiative Rules (Build 030 Part 2, Module 9).
//
// "Highest commercial value" is defined honestly and narrowly: an asset
// already at READY is the highest-value action (zero remaining work,
// immediate package), and among not-yet-ready assets, the one closest to
// READY (highest readiness score) is next — fixing it unlocks a
// commercial package with the least remaining effort. This is a stated
// heuristic, not a claimed prediction of actual revenue impact.

function actionForBucket(report: CommercialReadinessReport, threshold: number): CommercialRecommendationAction | null {
  const byId = new Map(report.checks.map((c) => [c.id, c] as const));
  if (byId.get('generatorCompleted')!.status === 'FAIL' || byId.get('svgExists')!.status === 'FAIL') return null; // nothing actionable here — needs regeneration, out of this pipeline's scope
  if (byId.get('collectionAssignment')!.status !== 'PASS') return 'completeCollection';
  if (byId.get('qaPassed')!.status !== 'PASS') return 'repair';
  if (byId.get('metadataExists')!.status !== 'PASS' || byId.get('seoExists')!.status !== 'PASS') return 'finishSeo';
  if (report.score >= threshold && report.failingChecks.length === 0) return 'exportReady';
  return null; // e.g. only a marketplace-review or export-validation WARNING remains — not one of the 5 named actions
}

function titleFor(action: CommercialRecommendationAction, assetName: string): string {
  switch (action) {
    case 'exportReady':
      return `Export "${assetName}" — it's ready`;
    case 'finishSeo':
      return `Finish SEO for "${assetName}"`;
    case 'repair':
      return `Repair "${assetName}"`;
    case 'completeCollection':
      return `Assign "${assetName}" to a collection`;
    case 'generateColorway':
      return `Generate a missing colorway`;
  }
}

export interface CommercialRecommendationInput {
  reports: CommercialReadinessReport[];
  assetsById: Map<string, PortfolioAsset>;
  collectionCompleteness?: CollectionCompletenessReport[];
  threshold?: number;
  limit?: number;
}

export function generateCommercialRecommendations(input: CommercialRecommendationInput): CommercialRecommendation[] {
  const { reports, assetsById, collectionCompleteness = [], threshold = DEFAULT_READINESS_THRESHOLD, limit = 5 } = input;
  const recommendations: CommercialRecommendation[] = [];

  for (const report of reports) {
    const action = actionForBucket(report, threshold);
    if (!action) continue;
    const asset = assetsById.get(report.assetId);
    const assetName = asset?.displayName ?? report.assetId;
    const firstIssue = report.checks.find((c) => c.status !== 'PASS');
    recommendations.push({
      id: `${action}-${report.assetId}`,
      action,
      title: titleFor(action, assetName),
      assetId: report.assetId,
      collectionId: null,
      reason: action === 'exportReady' ? `Commercial Readiness ${report.score}% — every check passed.` : (firstIssue?.detail ?? 'Not yet ready.'),
      evidence: report.checks.filter((c) => c.status !== 'PASS').map((c) => `${c.label}: ${c.detail}`),
      expectedImpact: action === 'exportReady' ? 'Zero remaining work — can become a Commercial Package now.' : `Currently at ${report.score}% readiness — closest to unlocking a package.`,
    });
  }

  for (const completeness of collectionCompleteness) {
    if (completeness.roleTrackingAvailable && completeness.missingRoles.includes('colorway')) {
      recommendations.push({
        id: `generateColorway-${completeness.collectionId}`,
        action: 'generateColorway',
        title: titleFor('generateColorway', completeness.collectionName),
        assetId: null,
        collectionId: completeness.collectionId,
        reason: `"${completeness.collectionName}" has no asset tagged "colorway".`,
        evidence: [completeness.explanation],
        expectedImpact: 'Completes the collection\'s tracked role coverage.',
      });
    }
  }

  recommendations.sort((a, b) => {
    if (a.action === 'exportReady' && b.action !== 'exportReady') return -1;
    if (b.action === 'exportReady' && a.action !== 'exportReady') return 1;
    const scoreA = reports.find((r) => r.assetId === a.assetId)?.score ?? 0;
    const scoreB = reports.find((r) => r.assetId === b.assetId)?.score ?? 0;
    return scoreB - scoreA;
  });

  return recommendations.slice(0, limit);
}
