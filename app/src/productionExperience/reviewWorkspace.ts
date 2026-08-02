import type { PortfolioAsset } from '../catalog/domain/types';
import type { QualitySnapshot } from '../catalog/quality/qualitySnapshotStore';

// Mission 6, Part 5 — Review Workspace. Shows only assets whose latest
// real quality classification (`catalog/quality/qualityClassification.ts`'s
// `QualityDecision`, Build 026) is `REVIEW` — READY items stay hidden,
// exactly as the spec requires. No new scoring model: this module only
// picks the most recent snapshot per asset (real `createdAt` max) and
// filters by its already-computed `decision`.

export interface ReviewWorkspaceItem {
  asset: PortfolioAsset;
  snapshot: QualitySnapshot;
}

/** The real latest snapshot per assetId — max by `createdAt`, never guessed. */
export function latestQualitySnapshotsByAsset(snapshots: QualitySnapshot[]): Map<string, QualitySnapshot> {
  const byAsset = new Map<string, QualitySnapshot>();
  for (const snapshot of snapshots) {
    const existing = byAsset.get(snapshot.assetId);
    if (!existing || snapshot.createdAt > existing.createdAt) byAsset.set(snapshot.assetId, snapshot);
  }
  return byAsset;
}

export function buildReviewWorkspaceItems(assets: PortfolioAsset[], snapshots: QualitySnapshot[]): ReviewWorkspaceItem[] {
  const latest = latestQualitySnapshotsByAsset(snapshots);
  const items: ReviewWorkspaceItem[] = [];
  for (const asset of assets) {
    if (asset.isArchived) continue;
    const snapshot = latest.get(asset.assetId);
    if (snapshot && snapshot.decision === 'REVIEW') items.push({ asset, snapshot });
  }
  return items;
}

export function countReviewWaiting(assets: PortfolioAsset[], snapshots: QualitySnapshot[]): number {
  return buildReviewWorkspaceItems(assets, snapshots).length;
}
