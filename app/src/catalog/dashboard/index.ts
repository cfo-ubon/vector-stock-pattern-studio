// Build 017 — Portfolio Dashboard & Analytics Foundation public barrel,
// mirroring `catalog/submission/index.ts` and `catalog/seo/index.ts`'s
// convention so a future consumer (a Build 018 UI, most likely) has one
// import path instead of reaching into individual files.

export type { CollectionSummary, CollectionAnalytics } from './collectionAnalytics';
export { computeCollectionAnalytics } from './collectionAnalytics';

export type { SubmissionAnalytics } from './submissionAnalytics';
export { computeSubmissionAnalytics } from './submissionAnalytics';

export type { SeoAnalytics } from './seoAnalytics';
export { computeSeoAnalytics } from './seoAnalytics';

export type { MarketplaceAnalyticsEntry } from './marketplaceAnalytics';
export { computeMarketplaceAnalytics } from './marketplaceAnalytics';

export type { ReadinessAnalytics } from './readinessAnalytics';
export { computeReadinessAnalytics } from './readinessAnalytics';

export type { PortfolioHealthComponents, PortfolioHealthScore } from './portfolioHealthCalculator';
export { computePortfolioHealth, countDuplicateConflictingSubmissions } from './portfolioHealthCalculator';

export type { RecommendationCode, RecommendationPriority, Recommendation, RecommendationInputs } from './recommendationEngine';
export { generateRecommendations } from './recommendationEngine';

export type { DashboardSnapshot, DashboardSnapshotInput } from './dashboardSnapshot';
export { buildDashboardSnapshot } from './dashboardSnapshot';

export { loadDashboardSnapshot } from './portfolioDashboardService';
