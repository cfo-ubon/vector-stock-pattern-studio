import type { PortfolioAsset } from '../catalog/domain/types';
import type { CommercialReadinessReport, CollectionCompletenessReport, CommercialRecommendation, CommercialRecommendationAction } from './domain/types';
import { DEFAULT_READINESS_THRESHOLD } from './domain/types';
import { runDecisionSync, recordDecision } from '../decisionOS/index';
import { commercialNextActionContext, COMMERCIAL_NEXT_ACTION_SOURCES } from '../decisionOS/adapters/commercialAdapter';
import { decisionTraceFrom } from '../aiCeo/decisionTrace';
import type { DecisionTrace } from '../aiCeo/domain/types';

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

/** Build 031B Hardening (Section 3) — the "what's next for this asset"
 * business decision (completeCollection > repair > finishSeo > exportReady,
 * in that priority order) is now owned by the Decision OS's
 * `commercial.completeCollectionFirst` / `commercial.repairBeforeSeo` /
 * `commercial.finishSeoBeforePackaging` / `commercial.recommendExportWhenReady`
 * policies (`decisionOS/policies/commercialPolicies.ts`) rather than this
 * local if/else-if chain. The generatorCompleted/svgExists gate stays here
 * — it is technical validation ("can this asset be reasoned about at all"),
 * not a business decision. Returns the underlying `Decision` alongside the
 * action so the caller can attach a `decisionTrace` and record it. */
function actionForBucket(report: CommercialReadinessReport, threshold: number): { action: CommercialRecommendationAction | null; decision: import('../decisionOS/domain/types').Decision | null } {
  const byId = new Map(report.checks.map((c) => [c.id, c] as const));
  if (byId.get('generatorCompleted')!.status === 'FAIL' || byId.get('svgExists')!.status === 'FAIL') return { action: null, decision: null }; // nothing actionable here — needs regeneration, out of this pipeline's scope

  const collectionAssigned = byId.get('collectionAssignment')!.status === 'PASS';
  const qaPassed = byId.get('qaPassed')!.status === 'PASS';
  const hasSeo = byId.get('metadataExists')!.status === 'PASS' && byId.get('seoExists')!.status === 'PASS';
  const context = commercialNextActionContext(report.score, threshold, report.failingChecks.length, hasSeo, collectionAssigned, qaPassed, report.assetId, report.computedAt);
  const decision = runDecisionSync(context, COMMERCIAL_NEXT_ACTION_SOURCES);
  const action = decision.recommendedAction as CommercialRecommendationAction | null;
  return { action, decision };
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
    const { action, decision } = actionForBucket(report, threshold);
    if (!action) continue;
    // Fire-and-forget: `generateCommercialRecommendations` stays
    // synchronous (its own caller renders a list directly from the
    // return value), so the Decision Timeline write does not block it.
    if (decision) void recordDecision(decision).catch(() => {});
    const decisionTrace: DecisionTrace | null = decision ? decisionTraceFrom(decision) : null;
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
      decisionTrace,
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
        // Build 031B Hardening — collection-level colorway-gap detection
        // is not yet routed through Decision OS (documented as a known
        // limitation in BUILD_031B_LOGIC_MIGRATION_AUDIT.md).
        decisionTrace: null,
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
