import { getSeoProfile } from './seoProfile';
import { checkTitleCompliance, checkDescriptionCompliance, checkKeywordCompliance } from './marketplaceRules';
import { analyzeKeywords } from './keywordAnalyzer';
import { analyzeTitle } from './titleAnalyzer';
import { analyzeDescription } from './descriptionAnalyzer';

// Build 016 — SEO Validator. Never throws (brief: "Never throw. Return
// structured validation") — every failure mode, including a completely
// unregistered marketplace id, is captured as an `errors`/`warnings`/
// `suggestions` entry in the returned report. Composes
// `marketplaceRules.ts` (hard numeric/structural compliance -> errors),
// `keywordAnalyzer.ts` (quality issues -> warnings, coverage gaps ->
// suggestions), and the two content analyzers (readability/duplicate-
// word issues -> warnings) rather than re-deriving any of it.

export interface SeoContentInput {
  title: string;
  description: string;
  keywords: string[];
}

export type SeoValidationSeverity = 'error' | 'warning' | 'suggestion';

export interface SeoValidationIssue {
  severity: SeoValidationSeverity;
  code: string;
  message: string;
}

export interface SeoValidationReport {
  /** True only when there are zero `errors` — `warnings` and
   * `suggestions` never affect validity, matching every other
   * validation report in this codebase (`backupValidation.ts`,
   * `submissionValidation.ts`): they are actionable information, not
   * blockers. */
  valid: boolean;
  errors: SeoValidationIssue[];
  warnings: SeoValidationIssue[];
  suggestions: SeoValidationIssue[];
}

export function validateSeoContent(content: SeoContentInput, marketplaceId: string): SeoValidationReport {
  const profile = getSeoProfile(marketplaceId);
  if (!profile) {
    return { valid: false, errors: [{ severity: 'error', code: 'unknown-marketplace', message: `"${marketplaceId}" is not a registered SEO profile — register it before validating against it.` }], warnings: [], suggestions: [] };
  }

  const errors: SeoValidationIssue[] = [];
  const warnings: SeoValidationIssue[] = [];
  const suggestions: SeoValidationIssue[] = [];

  const titleCompliance = checkTitleCompliance(content.title, profile);
  for (const reason of titleCompliance.reasons) errors.push({ severity: 'error', code: 'title-non-compliant', message: reason });

  const descriptionCompliance = checkDescriptionCompliance(content.description, profile);
  for (const reason of descriptionCompliance.reasons) errors.push({ severity: 'error', code: 'description-non-compliant', message: reason });

  const keywordCompliance = checkKeywordCompliance(content.keywords, profile);
  for (const reason of keywordCompliance.reasons) errors.push({ severity: 'error', code: 'keyword-non-compliant', message: reason });

  const keywordAnalysis = analyzeKeywords(content.keywords);
  if (keywordAnalysis.duplicates.length > 0) {
    warnings.push({ severity: 'warning', code: 'duplicate-keywords', message: `${keywordAnalysis.duplicates.length} duplicate keyword(s): ${keywordAnalysis.duplicates.map((d) => d.keyword).join(', ')}.` });
  }
  if (keywordAnalysis.similarPairs.length > 0) {
    warnings.push({ severity: 'warning', code: 'similar-keywords', message: `${keywordAnalysis.similarPairs.length} pair(s) of near-duplicate keywords: ${keywordAnalysis.similarPairs.map((p) => `"${p.a}"/"${p.b}"`).join(', ')}.` });
  }
  if (keywordAnalysis.pluralConflicts.length > 0) {
    warnings.push({ severity: 'warning', code: 'plural-singular-conflict', message: `${keywordAnalysis.pluralConflicts.length} plural/singular conflict(s): ${keywordAnalysis.pluralConflicts.map((p) => `"${p.singular}"/"${p.plural}"`).join(', ')}.` });
  }
  if (keywordAnalysis.noiseKeywords.length > 0) {
    warnings.push({ severity: 'warning', code: 'noise-keywords', message: `${keywordAnalysis.noiseKeywords.length} low-value keyword(s): ${keywordAnalysis.noiseKeywords.join(', ')}.` });
  }
  if (keywordAnalysis.orderingScore < 60) {
    suggestions.push({ severity: 'suggestion', code: 'keyword-ordering', message: 'Consider reordering keywords from broad/general terms to specific/narrow ones.' });
  }
  if (keywordAnalysis.coverage.missingConcepts.length > 0) {
    suggestions.push({ severity: 'suggestion', code: 'missing-concepts', message: `No keywords cover: ${keywordAnalysis.coverage.missingConcepts.join(', ')}.` });
  }

  const titleAnalysis = analyzeTitle(content.title, content.keywords, profile);
  if (titleAnalysis.duplicateWords.length > 0) {
    warnings.push({ severity: 'warning', code: 'duplicate-title-words', message: `Title repeats: ${titleAnalysis.duplicateWords.join(', ')}.` });
  }

  if (content.description.trim()) {
    const descriptionAnalysis = analyzeDescription(content.description, content.keywords, profile);
    if (descriptionAnalysis.naturalLanguageScore < 50) {
      suggestions.push({ severity: 'suggestion', code: 'description-not-natural-language', message: 'Description reads like a keyword list rather than a sentence — consider writing it as natural prose.' });
    }
  }

  return { valid: errors.length === 0, errors, warnings, suggestions };
}
