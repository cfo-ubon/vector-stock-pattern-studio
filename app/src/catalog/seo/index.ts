// Build 016 — SEO Intelligence Engine public barrel, mirroring
// `catalog/submission/index.ts`'s convention so a future consumer has
// one import path instead of reaching into individual files.

export type { SeoProfile } from './seoProfile';
export {
  BUILT_IN_SEO_PROFILES,
  registerSeoProfile,
  getSeoProfile,
  isKnownSeoMarketplace,
  listSeoProfiles,
  resetSeoProfileRegistry,
  DuplicateSeoProfileError,
} from './seoProfile';

export { normalizeKeyword, normalizeKeywords } from './keywordNormalizer';

export type { RemovedDuplicate, DeduplicationResult } from './keywordDeduplicator';
export { deduplicateKeywords } from './keywordDeduplicator';

export type { CoverageConcept, KeywordCoverageReport } from './keywordCoverage';
export { COVERAGE_CONCEPTS, analyzeKeywordCoverage } from './keywordCoverage';

export type { SimilarKeywordPair, PluralConflictPair, KeywordAnalysisReport } from './keywordAnalyzer';
export { analyzeKeywords } from './keywordAnalyzer';

export type { ComplianceCheck } from './marketplaceRules';
export { checkTitleCompliance, checkDescriptionCompliance, checkKeywordCompliance } from './marketplaceRules';

export type { TitleAnalysisReport } from './titleAnalyzer';
export { analyzeTitle } from './titleAnalyzer';

export type { DescriptionAnalysisReport } from './descriptionAnalyzer';
export { analyzeDescription } from './descriptionAnalyzer';

export type { SeoContentInput, SeoValidationSeverity, SeoValidationIssue, SeoValidationReport } from './seoValidator';
export { validateSeoContent } from './seoValidator';

export type { SeoScoreReport } from './seoScoring';
export { computeSeoScore } from './seoScoring';

export type { SeoPackage } from './seoGenerator';
export { generateSeoPackage, UnknownSeoMarketplaceError } from './seoGenerator';

export type { PatternSeoRequest, PatternSeoResult } from './batchSeoService';
export { generatePatternSeo, generatePatternSeoForMarketplaces, generateBatchSeo } from './batchSeoService';
