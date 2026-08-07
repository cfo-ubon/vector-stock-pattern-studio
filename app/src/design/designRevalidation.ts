import type { PortfolioAsset } from '../catalog/domain/types';
import type { TileData } from '../engine/types';
import type { SubmissionRecord } from '../catalog/submission/submissionRecord';
import type { CommercialReadinessReport } from '../commercial/domain/types';
import { evaluateGeneratedPattern } from '../autopilot/qualityEvaluation';
import { createQualitySnapshot, putQualitySnapshot, type QualitySnapshot } from '../catalog/quality/qualitySnapshotStore';
import { putPortfolioAsset } from '../catalog/storage/portfolioStore';
import { computeCommercialReadiness } from '../commercial/readinessEngine';

// Design Refinement Studio Pro, Mission 2 — Commercial Revalidation. A
// freshly-saved Design Version is a brand-new `PortfolioAsset` with no
// `QualitySnapshot` yet (nothing generates one for it automatically), so
// without this it would sit permanently as "never evaluated" in Commercial
// Readiness — not because it's actually unready, just because nobody ran
// QA on it. This runs the exact same evaluate -> snapshot -> persist
// sequence `autopilot/generationOrchestrator.ts` already runs for every
// Factory/Autopilot-produced asset (`evaluateGeneratedPattern`,
// `createQualitySnapshot`, `putQualitySnapshot`, `putPortfolioAsset`), then
// the same `computeCommercialReadiness` (`commercial/readinessEngine.ts`)
// every other screen in the app already uses — no new scoring model, no
// new readiness logic, just re-running the real pipeline on the new asset.

export interface RevalidationResult {
  snapshot: QualitySnapshot;
  updatedAsset: PortfolioAsset;
  readiness: CommercialReadinessReport;
}

export async function revalidateDesignVersion(
  asset: PortfolioAsset,
  tileData: TileData,
  siblingAssets: PortfolioAsset[],
  submissionsForAsset: SubmissionRecord[],
): Promise<RevalidationResult> {
  const evaluation = evaluateGeneratedPattern(tileData);
  const snapshot = createQualitySnapshot({
    assetId: asset.assetId,
    beautyScore: evaluation.beautyReview.beautyScore,
    commercialScore: evaluation.commercialScore,
    thumbnailScore: evaluation.thumbnailScore,
    fragmented: evaluation.fragmented,
    deadSpace: evaluation.deadSpace,
    decision: evaluation.decision,
    generatorVersion: asset.generatorVersion ?? 'v1',
  });
  await putQualitySnapshot(snapshot);
  const updatedAsset: PortfolioAsset = { ...asset, qualitySnapshotId: snapshot.snapshotId };
  await putPortfolioAsset(updatedAsset);

  const readiness = computeCommercialReadiness({
    asset: updatedAsset,
    qualitySnapshot: snapshot,
    submissionsForAsset,
    siblingAssets: siblingAssets.filter((a) => a.assetId !== updatedAsset.assetId),
  });

  return { snapshot, updatedAsset, readiness };
}
