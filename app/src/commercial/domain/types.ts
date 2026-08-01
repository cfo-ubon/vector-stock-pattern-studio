// Build 031A — Commercial Production Pipeline. Domain types shared by every
// module under `commercial/`. Nothing here re-derives data another engine
// already owns: a `CommercialReadinessReport` is built from real
// `PortfolioAsset`/`QualitySnapshot`/`SubmissionRecord`/`Collection` records
// loaded by the caller, and every check honestly reports PASS/WARNING/FAIL
// (never a fabricated number) — the same convention every prior AI-CEO/
// Autopilot/Dashboard module in this app already follows.

/** The result of one Commercial Readiness check. PASS = verified present/
 * correct; WARNING = present but incomplete, or "needs verification" (the
 * exact wording Phase 2 of the spec asks for when a marketplace profile
 * isn't fully verified); FAIL = missing/blocking. Never fabricated — a
 * check with nothing to inspect reports FAIL or WARNING with an honest
 * `detail`, not a guessed PASS. */
export type ReadinessCheckStatus = 'PASS' | 'WARNING' | 'FAIL';

/** The 14 required checks from the spec's Phase 1, verbatim. */
export type ReadinessCheckId =
  | 'generatorCompleted'
  | 'svgExists'
  | 'epsExists'
  | 'previewExists'
  | 'metadataExists'
  | 'seoExists'
  | 'collectionAssignment'
  | 'marketplacePackage'
  | 'qaPassed'
  | 'commercialScoreAvailable'
  | 'beautyScoreAvailable'
  | 'duplicateCheckComplete'
  | 'repairHistoryComplete'
  | 'exportValidationComplete';

export interface ReadinessCheck {
  id: ReadinessCheckId;
  label: string;
  status: ReadinessCheckStatus;
  detail: string;
}

/** The 8 weighted categories from the spec's Phase 1, summing to 100. Each
 * check above belongs to exactly one category (see `readinessEngine.ts`'s
 * `CHECK_CATEGORY` map) — the category's contribution to the 0-100 score is
 * its weight times the average PASS=1/WARNING=0.5/FAIL=0 credit across the
 * checks it owns. */
export type ReadinessCategory = 'artwork' | 'seo' | 'metadata' | 'collection' | 'marketplacePackage' | 'qa' | 'export' | 'traceability';

export const READINESS_CATEGORY_WEIGHTS: Record<ReadinessCategory, number> = {
  artwork: 20,
  seo: 15,
  metadata: 10,
  collection: 10,
  marketplacePackage: 15,
  qa: 15,
  export: 15,
  traceability: 10,
};

/** Overall band derived from the 0-100 score — `band` is a display label,
 * never a substitute for reading `checks` (the UI always shows both). */
export type CommercialReadinessBand = 'READY' | 'NEEDS_WORK' | 'BLOCKED';

export interface CommercialReadinessReport {
  assetId: string;
  computedAt: number;
  checks: ReadinessCheck[];
  /** 0-100, rounded — see `READINESS_CATEGORY_WEIGHTS`. */
  score: number;
  band: CommercialReadinessBand;
  /** Any check ids currently at FAIL, in check-declaration order — the
   * dashboard/recommendation modules read this rather than re-scanning
   * `checks` themselves. */
  failingChecks: ReadinessCheckId[];
  warningChecks: ReadinessCheckId[];
}

/** Phase 2 — one Commercial Package built for one (asset, marketplace)
 * pair. `status` mirrors the spec's "Needs verification" wording for an
 * incomplete marketplace profile, distinct from the readiness report's own
 * band (a package can be built from a READY asset yet still need
 * marketplace-profile verification). */
export type CommercialPackageStatus = 'BUILT' | 'NEEDS_VERIFICATION';

export interface CommercialPackageManifest {
  manifestVersion: number;
  builtAt: number;
  marketplaceId: string;
  marketplaceLabel: string;
  status: CommercialPackageStatus;
  readiness: {
    score: number;
    band: CommercialReadinessBand;
  };
  asset: {
    assetId: string;
    displayName: string;
    productionAssetId: string | null;
  };
  seo: {
    hasSubmission: boolean;
    title: string;
    description: string;
    keywords: string[];
  };
  collection: {
    collectionIds: string[];
    collectionNames: string[];
  };
  traceability: {
    generatorVersion: string | null;
    presetId: string | null;
    styleDna: string | null;
    generatorSeed: string | null;
    productionAssetId: string | null;
  };
  verificationNotes: string[];
}

export interface CommercialPackageResult {
  blob: Blob;
  filename: string;
  manifest: CommercialPackageManifest;
}

/** Persisted, append-only history of every Commercial Package actually
 * built — the real event log Phase 8's Business Metrics reads (see
 * `storage/commercialPackageHistoryStore.ts`). Deliberately does not store
 * the built ZIP itself (that would duplicate IndexedDB storage the asset's
 * own source files already occupy) — only the fact that a package was
 * built, when, for which asset/marketplace, at what readiness score. */
export interface CommercialPackageHistoryEntry {
  id: string;
  createdAt: number;
  assetId: string;
  marketplaceId: string;
  status: CommercialPackageStatus;
  readinessScore: number;
}

/** Phase 5 — Export Readiness Dashboard buckets, in the spec's own order.
 * An asset can only be in one bucket: the first one (in this order) whose
 * condition it fails, or `ready` if every check passes at/above the
 * configured safety threshold. */
export type ExportReadinessBucketId = 'ready' | 'needsSeo' | 'needsQa' | 'needsMetadata' | 'needsCollection' | 'needsMarketplaceReview' | 'blocked';

export interface ExportReadinessBucket {
  id: ExportReadinessBucketId;
  label: string;
  count: number;
  assetIds: string[];
  /** Why assets land here — plain-language, not a check id, since Phase 5
   * requires "every card must explain why." */
  explanation: string;
}

export interface ExportReadinessDashboard {
  computedAt: number;
  totalAssets: number;
  buckets: ExportReadinessBucket[];
}

/** Phase 4 — Collection Completeness. `PortfolioAsset` has no persisted
 * "creative role" field (hero/secondary/blender/…), so this check is
 * honest about what it can and can't verify: it looks for the spec's role
 * names inside each member asset's own `tags` (a real, freely-settable
 * field), and reports `roleTrackingAvailable: false` — not a fabricated
 * FAIL — when no member asset carries any role tag at all. */
export interface CollectionCompletenessReport {
  collectionId: string;
  collectionName: string;
  memberCount: number;
  roleTrackingAvailable: boolean;
  presentRoles: string[];
  missingRoles: string[];
  complete: boolean;
  explanation: string;
}

/** Phase 7 — AI Recommendation. Deliberately reuses the shape established
 * by `aiCeo/domain/types.ts`'s own explanation model (why/evidence/
 * confidence/risks) rather than inventing a second one — see
 * `commercialRecommendation.ts`'s header comment. */
export type CommercialRecommendationAction = 'finishSeo' | 'repair' | 'generateColorway' | 'completeCollection' | 'exportReady';

export interface CommercialRecommendation {
  id: string;
  action: CommercialRecommendationAction;
  title: string;
  assetId: string | null;
  collectionId: string | null;
  reason: string;
  evidence: string[];
  expectedImpact: string;
}

/** Phase 8 — Business Metrics. Every field here is computed from real,
 * already-persisted data (`PortfolioAsset[]`, `CommercialPackageHistoryEntry[]`)
 * — never estimated. `null` means "not enough data yet," matching this
 * app's established honest-fallback convention. */
export interface BusinessMetricsSnapshot {
  computedAt: number;
  commercialThroughputToday: number;
  packagesPerHour: number | null;
  commercialReadinessAverage: number | null;
  averageCompletionTimeMs: number | null;
  readyToday: number;
  readyThisWeek: number;
  /** Minutes of manual packaging work the app's automation replaced today,
   * estimated only from a documented, fixed per-package baseline (see
   * `businessMetrics.ts`) — always labeled as an estimate in the UI, never
   * presented as a measured fact. */
  ownerTimeSavedMinutesToday: number;
  automationPercent: number | null;
}

/** Phase 9 — Safety threshold. */
export interface SafetyThresholdConfig {
  minReadinessScore: number;
}

export const DEFAULT_READINESS_THRESHOLD = 95;
