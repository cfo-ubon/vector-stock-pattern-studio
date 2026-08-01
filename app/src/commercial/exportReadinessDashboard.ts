import type { CommercialReadinessReport, ExportReadinessBucket, ExportReadinessBucketId, ExportReadinessDashboard } from './domain/types';
import { DEFAULT_READINESS_THRESHOLD } from './domain/types';

// Build 031A, Phase 5 — Export Readiness Dashboard. Buckets every asset
// that already has a `CommercialReadinessReport` (Phase 1) into exactly
// one of the spec's 7 buckets — every card explains why, quoting the
// underlying check's own real `detail` text rather than a generic label.
// An asset with several failing checks lands in the single most-blocking
// bucket (missing artwork first, since nothing else can be fixed until
// that is; a marketplace-profile verification note last, since it never
// blocks packaging, only a specific marketplace's package).

const BUCKET_LABELS: Record<ExportReadinessBucketId, string> = {
  ready: 'Ready Packages',
  needsSeo: 'Needs SEO',
  needsQa: 'Needs QA',
  needsMetadata: 'Needs Metadata',
  needsCollection: 'Needs Collection',
  needsMarketplaceReview: 'Needs Marketplace Review',
  blocked: 'Blocked',
};

function bucketFor(report: CommercialReadinessReport, threshold: number): { id: ExportReadinessBucketId; reason: string } {
  const byId = new Map(report.checks.map((c) => [c.id, c] as const));

  const artwork = byId.get('generatorCompleted')!;
  const svg = byId.get('svgExists')!;
  if (artwork.status === 'FAIL' || svg.status === 'FAIL') {
    return { id: 'blocked', reason: svg.status === 'FAIL' ? svg.detail : artwork.detail };
  }

  const collection = byId.get('collectionAssignment')!;
  if (collection.status !== 'PASS') return { id: 'needsCollection', reason: collection.detail };

  const qa = byId.get('qaPassed')!;
  const commercialScore = byId.get('commercialScoreAvailable')!;
  const beautyScore = byId.get('beautyScoreAvailable')!;
  if (qa.status !== 'PASS') return { id: 'needsQa', reason: qa.detail };
  if (commercialScore.status !== 'PASS') return { id: 'needsQa', reason: commercialScore.detail };
  if (beautyScore.status !== 'PASS') return { id: 'needsQa', reason: beautyScore.detail };

  const metadata = byId.get('metadataExists')!;
  if (metadata.status === 'FAIL') return { id: 'needsMetadata', reason: metadata.detail };

  const seo = byId.get('seoExists')!;
  if (seo.status !== 'PASS') return { id: 'needsSeo', reason: seo.detail };

  const marketplacePackage = byId.get('marketplacePackage')!;
  if (marketplacePackage.status !== 'PASS') return { id: 'needsMarketplaceReview', reason: marketplacePackage.detail };

  if (report.score >= threshold && report.failingChecks.length === 0) {
    return { id: 'ready', reason: `Commercial Readiness ${report.score}% — every check passed.` };
  }
  // A residual case: score below threshold from WARNING-only checks not
  // covered above (e.g. epsExists, duplicateCheckComplete, repairHistoryComplete,
  // exportValidationComplete) — honestly still not Ready, closest to a QA gap.
  return { id: 'needsQa', reason: `Commercial Readiness ${report.score}% is below the ${threshold}% threshold.` };
}

export function buildExportReadinessDashboard(reports: CommercialReadinessReport[], threshold: number = DEFAULT_READINESS_THRESHOLD, now?: number): ExportReadinessDashboard {
  const buckets = new Map<ExportReadinessBucketId, { assetIds: string[]; reasons: string[] }>();
  for (const id of Object.keys(BUCKET_LABELS) as ExportReadinessBucketId[]) buckets.set(id, { assetIds: [], reasons: [] });

  for (const report of reports) {
    const { id, reason } = bucketFor(report, threshold);
    const bucket = buckets.get(id)!;
    bucket.assetIds.push(report.assetId);
    bucket.reasons.push(reason);
  }

  const result: ExportReadinessBucket[] = (Object.keys(BUCKET_LABELS) as ExportReadinessBucketId[]).map((id) => {
    const bucket = buckets.get(id)!;
    const explanation =
      bucket.assetIds.length === 0
        ? `No assets currently in this state.`
        : bucket.reasons[0] + (bucket.assetIds.length > 1 ? ` (and ${bucket.assetIds.length - 1} more asset(s) with a similar issue.)` : '');
    return { id, label: BUCKET_LABELS[id], count: bucket.assetIds.length, assetIds: bucket.assetIds, explanation };
  });

  return { computedAt: now ?? Date.now(), totalAssets: reports.length, buckets: result };
}
