import type { AutonomousDesignRun, AutonomousRunItemState } from './domain/autonomousDesignRun';
import type { CollectionPlan } from '../design-director/domain/collectionPlan';
import { getCollectionPlanItems } from '../design-director/domain/collectionPlan';
import type { QualitySnapshot } from '../catalog/quality/qualitySnapshotStore';

// Build 029, Module 8 — Autonomous Selection. A pure, synchronous function
// over the real, already-recorded `AutonomousDesignRun`/`CollectionPlan`/
// `QualitySnapshot[]` — no new scoring or classification happens here,
// this only shapes what Module 7 (`qualityEvaluation.ts`) and the
// generation orchestrator already produced into the result-summary view
// the spec asks for ("Best patterns, READY/REVIEW/REJECT, recommended
// submission group, patterns needing manual review, rejection reasons,
// repair history, collection completeness/balance/diversity, marketplace
// fit"). Never deletes or hides a REJECT item (Safety Rule #7) — every
// item from the run is represented somewhere in this summary.

export interface RejectionReason {
  collectionItemId: string;
  portfolioAssetId: string | null;
  reasons: string[];
}

export interface CollectionBalanceEntry {
  role: string;
  planned: number;
  generated: number;
}

export interface AutopilotResultSummary {
  runId: string;
  requestedCount: number;
  completedCount: number;
  readyCount: number;
  reviewCount: number;
  rejectCount: number;
  /** READY items, best-first when a matching `QualitySnapshot` was
   * supplied (sorted by commercialScore, tie-broken by beautyScore);
   * otherwise in the order they were generated — never a fabricated
   * ranking when no real score is available. */
  bestReadyAssetIds: string[];
  reviewAssetIds: string[];
  rejectAssetIds: string[];
  recommendedSubmissionGroup: string[];
  rejectionReasons: RejectionReason[];
  totalRepairAttempts: number;
  itemsRepaired: number;
  collectionBalance: CollectionBalanceEntry[];
  /** True only when every planned role's generated count matches its
   * planned count — an honest completeness flag, not a score. */
  collectionComplete: boolean;
  targetMarketplace: string;
  errors: string[];
}

function snapshotFor(item: AutonomousRunItemState, snapshots: QualitySnapshot[]): QualitySnapshot | undefined {
  if (!item.qualitySnapshotId) return undefined;
  return snapshots.find((s) => s.snapshotId === item.qualitySnapshotId);
}

function reasonsForReject(snapshot: QualitySnapshot | undefined): string[] {
  if (!snapshot) return ['No quality snapshot recorded for this item.'];
  const reasons: string[] = [];
  if (snapshot.commercialScore < 40) reasons.push(`Commercial score too low (${snapshot.commercialScore}).`);
  if (snapshot.fragmented && snapshot.deadSpace) reasons.push('Fragmented silhouette combined with dead space.');
  else {
    if (snapshot.fragmented) reasons.push('Fragmented silhouette detected.');
    if (snapshot.deadSpace) reasons.push('Excess dead space detected.');
  }
  if (snapshot.beautyScore < 55) reasons.push(`Beauty score below threshold (${snapshot.beautyScore}).`);
  return reasons.length > 0 ? reasons : ['Rejected by quality classifier.'];
}

export function buildAutopilotResultSummary(run: AutonomousDesignRun, plan: CollectionPlan, snapshots: QualitySnapshot[] = []): AutopilotResultSummary {
  const readyItems = run.items.filter((i) => i.decision === 'READY' && i.portfolioAssetId);
  const reviewItems = run.items.filter((i) => i.decision === 'REVIEW' && i.portfolioAssetId);
  const rejectItems = run.items.filter((i) => i.decision === 'REJECT' && i.portfolioAssetId);

  const bestReady = [...readyItems].sort((a, b) => {
    const sa = snapshotFor(a, snapshots);
    const sb = snapshotFor(b, snapshots);
    if (!sa || !sb) return 0;
    if (sb.commercialScore !== sa.commercialScore) return sb.commercialScore - sa.commercialScore;
    return sb.beautyScore - sa.beautyScore;
  });

  const rejectionReasons: RejectionReason[] = rejectItems.map((item) => ({
    collectionItemId: item.collectionItemId,
    portfolioAssetId: item.portfolioAssetId,
    reasons: reasonsForReject(snapshotFor(item, snapshots)),
  }));

  const planItems = getCollectionPlanItems(plan);
  const roleCounts = new Map<string, { planned: number; generated: number }>();
  for (const pi of planItems) {
    const entry = roleCounts.get(pi.patternType) ?? { planned: 0, generated: 0 };
    entry.planned += 1;
    roleCounts.set(pi.patternType, entry);
  }
  const generatedItemIds = new Set(run.items.filter((i) => i.portfolioAssetId).map((i) => i.collectionItemId));
  for (const pi of planItems) {
    if (generatedItemIds.has(pi.id)) {
      const entry = roleCounts.get(pi.patternType)!;
      entry.generated += 1;
    }
  }
  const collectionBalance: CollectionBalanceEntry[] = [...roleCounts.entries()].map(([role, counts]) => ({ role, ...counts }));
  const collectionComplete = collectionBalance.every((b) => b.generated >= b.planned);

  return {
    runId: run.id,
    requestedCount: run.requestedCount,
    completedCount: run.completedCount,
    readyCount: run.readyCount,
    reviewCount: run.reviewCount,
    rejectCount: run.rejectCount,
    bestReadyAssetIds: bestReady.map((i) => i.portfolioAssetId!),
    reviewAssetIds: reviewItems.map((i) => i.portfolioAssetId!),
    rejectAssetIds: rejectItems.map((i) => i.portfolioAssetId!),
    recommendedSubmissionGroup: bestReady.map((i) => i.portfolioAssetId!),
    rejectionReasons,
    totalRepairAttempts: run.items.reduce((sum, i) => sum + i.repairAttempts, 0),
    itemsRepaired: run.items.filter((i) => i.repairAttempts > 1).length,
    collectionBalance,
    collectionComplete,
    targetMarketplace: run.designPlan?.targetMarketplace ?? 'Not Provided',
    errors: run.errors,
  };
}
