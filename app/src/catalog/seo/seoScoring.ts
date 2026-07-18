import { getSeoProfile } from './seoProfile';
import { analyzeTitle } from './titleAnalyzer';
import { analyzeDescription } from './descriptionAnalyzer';
import { analyzeKeywords } from './keywordAnalyzer';
import type { KeywordAnalysisReport } from './keywordAnalyzer';
import { validateSeoContent } from './seoValidator';
import type { SeoContentInput } from './seoValidator';

// Build 016 — SEO Scoring: the brief's "Produce: Overall SEO Score,
// Title Score, Description Score, Keyword Score, Marketplace
// Compatibility, Commercial Readiness. Return all scores." `overall` is
// an unweighted average of the 5 named sub-scores — deliberately the
// same "unweighted average of N real dimensions" convention this repo's
// own `metadata/readinessScore.ts` already established for its
// differently-scoped readiness score, applied here to a differently-
// scoped but analogous problem.

export interface SeoScoreReport {
  overall: number;
  titleScore: number;
  descriptionScore: number;
  keywordScore: number;
  /** How cleanly the content validates against the marketplace's own
   * rules — derived from `validateSeoContent`'s error/warning counts,
   * the same "errors cost more than warnings, floor at 0" penalty shape
   * `metadata/readinessScore.ts`'s `scoreFromIssues` already uses. */
  marketplaceCompatibility: number;
  /** Real commercial-intent keyword coverage, independent of the
   * concept-bucket `coverageScore` inside `keywordAnalyzer.ts` (which
   * asks "does this touch several different search concepts") — this
   * asks the narrower question "does this touch terms buyers use when
   * they intend to license something for commercial use." */
  commercialReadiness: number;
}

/** Deliberately its own small list, not imported from
 * `metadata/submissionCenter.ts`'s `COMMERCIAL_TAG_CANDIDATES` — same
 * decoupling rationale as `seoProfile.ts`'s module header: this engine
 * must stand alone. The two lists overlap heavily by design (both
 * describe the same real stock-marketplace convention), but are
 * independent data. */
const COMMERCIAL_INTENT_TERMS = ['seamless', 'vector', 'pattern', 'commercial use', 'editable', 'repeat', 'tileable', 'print', 'wallpaper', 'textile', 'royalty free', 'license'];

function computeKeywordScore(analysis: KeywordAnalysisReport): number {
  const cleanlinessScore = Math.max(
    0,
    100 - analysis.duplicates.length * 10 - analysis.similarPairs.length * 5 - analysis.pluralConflicts.length * 8 - analysis.noiseKeywords.length * 6,
  );
  return Math.round((cleanlinessScore + analysis.coverage.coverageScore + analysis.orderingScore) / 3);
}

function computeMarketplaceCompatibility(errorCount: number, warningCount: number): number {
  return Math.max(0, 100 - errorCount * 40 - warningCount * 15);
}

function computeCommercialReadiness(keywords: string[]): number {
  const normalized = keywords.map((k) => k.toLowerCase());
  const matched = COMMERCIAL_INTENT_TERMS.filter((term) => normalized.some((k) => k.includes(term)));
  return Math.min(100, matched.length * 25);
}

export function computeSeoScore(content: SeoContentInput, marketplaceId: string): SeoScoreReport {
  const profile = getSeoProfile(marketplaceId);
  const validation = validateSeoContent(content, marketplaceId);
  const marketplaceCompatibility = computeMarketplaceCompatibility(validation.errors.length, validation.warnings.length);
  const commercialReadiness = computeCommercialReadiness(content.keywords);
  const keywordScore = computeKeywordScore(analyzeKeywords(content.keywords));

  if (!profile) {
    // No profile to analyze title/description length/compliance against
    // — title/description scores fall back to 0 (see
    // `seoValidator.ts`'s parallel unknown-marketplace short-circuit)
    // rather than throwing, keeping this function's own "never throw"
    // guarantee even though the brief only states that requirement
    // explicitly for `seoValidator.ts`.
    return { overall: Math.round((marketplaceCompatibility + commercialReadiness + keywordScore) / 5), titleScore: 0, descriptionScore: 0, keywordScore, marketplaceCompatibility, commercialReadiness };
  }

  const titleScore = analyzeTitle(content.title, content.keywords, profile).score;
  const descriptionScore = analyzeDescription(content.description, content.keywords, profile).score;
  const overall = Math.round((titleScore + descriptionScore + keywordScore + marketplaceCompatibility + commercialReadiness) / 5);

  return { overall, titleScore, descriptionScore, keywordScore, marketplaceCompatibility, commercialReadiness };
}
