import type { PortfolioAsset } from '../domain/types';
import { loadPortfolioAssets, loadAllPortfolioFiles } from '../storage/portfolioStore';
import { computeHealthReport, duplicateAssetIdsFromReport, type HealthCheckReport } from './healthCheck';

// Sprint P1, Section 10 (Dashboard — P1 Minimum). Every number here is a
// direct count over real stored `PortfolioAsset` records — no hard-coded
// sample data, no analytics/predictions (explicitly out of scope, see
// the brief's Section 17).

export interface DashboardSummary {
  totalAssets: number;
  activeAssets: number;
  archivedAssets: number;
  readyForReview: number;
  readyToUpload: number;
  submitted: number;
  approved: number;
  rejected: number;
  missingPreview: number;
  duplicateWarnings: number;
  recentlyImported: PortfolioAsset[];
}

export function computeDashboardSummary(assets: PortfolioAsset[], healthReport: HealthCheckReport, recentLimit = 10): DashboardSummary {
  const active = assets.filter((a) => !a.isArchived);
  const duplicateAssetIds = duplicateAssetIdsFromReport(healthReport);
  const countByStatus = (status: PortfolioAsset['workflowStatus']) => active.filter((a) => a.workflowStatus === status).length;

  return {
    totalAssets: assets.length,
    activeAssets: active.length,
    archivedAssets: assets.length - active.length,
    readyForReview: countByStatus('READY_FOR_REVIEW'),
    readyToUpload: countByStatus('READY_TO_UPLOAD'),
    submitted: countByStatus('SUBMITTED'),
    approved: countByStatus('APPROVED'),
    rejected: countByStatus('REJECTED'),
    missingPreview: healthReport.missingPreviews.length,
    duplicateWarnings: duplicateAssetIds.size,
    recentlyImported: [...assets].sort((a, b) => b.importedAt - a.importedAt).slice(0, recentLimit),
  };
}

export async function loadDashboardSummary(): Promise<DashboardSummary> {
  const [assets, files] = await Promise.all([loadPortfolioAssets(), loadAllPortfolioFiles()]);
  const healthReport = computeHealthReport(assets, files);
  return computeDashboardSummary(assets, healthReport);
}
