import type { SeoProfile } from './seoProfile';
import { checkDescriptionCompliance } from './marketplaceRules';
import { normalizeKeyword } from './keywordNormalizer';

// Build 016 — Description Analyzer. Evaluates the 5 dimensions the
// brief names (Length, Keyword coverage, Natural language, Readability,
// Marketplace compliance), combined into one 0-100 `score` via the same
// unweighted-average convention `titleAnalyzer.ts` uses.

export interface DescriptionAnalysisReport {
  length: number;
  lengthScore: number;
  keywordCoverageScore: number;
  naturalLanguageScore: number;
  readabilityScore: number;
  complianceScore: number;
  score: number;
}

/** A perfect 100 on every dimension for an empty description on a
 * marketplace that does not require one — there is genuinely nothing to
 * evaluate, and an omitted optional field is not a defect. A profile
 * that DOES require a description handles the empty case through the
 * normal length/compliance scoring path below instead (which correctly
 * scores it near zero). */
function emptyOptionalDescriptionReport(): DescriptionAnalysisReport {
  return { length: 0, lengthScore: 100, keywordCoverageScore: 100, naturalLanguageScore: 100, readabilityScore: 100, complianceScore: 100, score: 100 };
}

function scoreLength(length: number, min: number, max: number): number {
  if (length === 0) return 0;
  if (length < min) return Math.max(0, Math.round((length / min) * 100));
  if (length > max) {
    const overshoot = length - max;
    return Math.max(0, 100 - Math.round(overshoot / 10));
  }
  return 100;
}

function scoreKeywordCoverage(description: string, keywords: string[]): number {
  if (keywords.length === 0) return 100; // nothing to cover
  const normalizedDescription = normalizeKeyword(description);
  const covered = keywords.filter((k) => normalizedDescription.includes(normalizeKeyword(k)));
  return Math.round((covered.length / keywords.length) * 100);
}

/** Distinguishes real prose from a comma-joined keyword dump —
 * "seamless, floral, pattern, pastel, spring" is not a description, it's
 * keywords wearing a description's clothes. Rewards real sentence
 * structure (terminal punctuation) and enough words to constitute a
 * sentence; penalizes comma density disproportionate to word count,
 * the fingerprint of a keyword list pasted into the description field. */
function scoreNaturalLanguage(description: string): number {
  const trimmed = description.trim();
  if (!trimmed) return 0;
  const words = trimmed.split(/\s+/).filter(Boolean);
  const hasSentenceEnd = /[.!?]/.test(trimmed);
  const commaCount = (trimmed.match(/,/g) ?? []).length;
  let score = 100;
  if (words.length < 8) score -= 40;
  if (!hasSentenceEnd) score -= 30;
  if (commaCount > words.length / 3) score -= 20;
  return Math.max(0, score);
}

function scoreReadability(description: string): number {
  const trimmed = description.trim();
  if (!trimmed) return 0;
  const words = trimmed.split(/\s+/).filter(Boolean);
  const sentences = trimmed.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : words.length;
  let score = 100;
  if (avgWordsPerSentence > 30) score -= 30;
  const hasLetters = /[a-zA-Z]/.test(trimmed);
  if (hasLetters && trimmed === trimmed.toUpperCase()) score -= 40;
  return Math.max(0, score);
}

export function analyzeDescription(description: string, keywords: string[], profile: SeoProfile): DescriptionAnalysisReport {
  const length = description.trim().length;
  if (length === 0 && !profile.description.required) return emptyOptionalDescriptionReport();

  const lengthScore = scoreLength(length, profile.description.minLength, profile.description.maxLength);
  const keywordCoverageScore = scoreKeywordCoverage(description, keywords);
  const naturalLanguageScore = scoreNaturalLanguage(description);
  const readabilityScore = scoreReadability(description);
  const compliance = checkDescriptionCompliance(description, profile);
  const complianceScore = compliance.compliant ? 100 : Math.max(0, 100 - compliance.reasons.length * 40);

  const score = Math.round((lengthScore + keywordCoverageScore + naturalLanguageScore + readabilityScore + complianceScore) / 5);

  return { length, lengthScore, keywordCoverageScore, naturalLanguageScore, readabilityScore, complianceScore, score };
}
