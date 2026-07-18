import type { SeoProfile } from './seoProfile';
import { checkTitleCompliance } from './marketplaceRules';
import { normalizeKeyword } from './keywordNormalizer';

// Build 016 — Title Analyzer. Evaluates the 5 dimensions the brief names
// (Length, Keyword placement, Readability, Duplicate words, Marketplace
// compliance) and combines them into one 0-100 `score` — an unweighted
// average, deliberately matching the "unweighted average of N real
// dimensions" convention this repo's own `metadata/readinessScore.ts`
// already established for its own (differently-scoped) readiness score.

export interface TitleAnalysisReport {
  length: number;
  lengthScore: number;
  keywordPlacementScore: number;
  readabilityScore: number;
  duplicateWords: string[];
  duplicateWordScore: number;
  complianceScore: number;
  score: number;
}

function scoreLength(length: number, min: number, max: number): number {
  if (length === 0) return 0;
  if (length < min) return Math.max(0, Math.round((length / min) * 100));
  if (length > max) {
    const overshoot = length - max;
    return Math.max(0, 100 - overshoot * 2);
  }
  return 100;
}

/** Checks whether each of the first 3 keywords appears (case-insensitive
 * substring) in the title, weighting an earlier keyword's presence more
 * heavily than a later one — stock marketplace convention is that the
 * title's own words double as the most important keywords, so the
 * primary keyword showing up in the title matters more than the third.
 * An empty keyword list has nothing to place, so it scores 100 by
 * definition rather than being penalized for a condition that cannot be
 * satisfied. */
function scoreKeywordPlacement(title: string, keywords: string[]): number {
  if (keywords.length === 0) return 100;
  const normalizedTitle = normalizeKeyword(title);
  const topKeywords = keywords.slice(0, 3);
  const weights = [3, 2, 1].slice(0, topKeywords.length);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let matchedWeight = 0;
  topKeywords.forEach((keyword, i) => {
    if (normalizedTitle.includes(normalizeKeyword(keyword))) matchedWeight += weights[i];
  });
  return Math.round((matchedWeight / totalWeight) * 100);
}

function scoreReadability(title: string): number {
  const trimmed = title.trim();
  if (!trimmed) return 0;
  const words = trimmed.split(/\s+/).filter(Boolean);
  let score = 100;
  if (words.length < 3) score -= 30;
  if (words.length > 20) score -= 30;
  const hasLetters = /[a-zA-Z]/.test(trimmed);
  if (hasLetters && trimmed === trimmed.toUpperCase()) score -= 40; // ALL CAPS reads as shouting, not a real title
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
  if (avgWordLength > 12) score -= 20; // likely keyword-glued-together rather than real words
  return Math.max(0, score);
}

function findDuplicateWords(title: string): string[] {
  const words = normalizeKeyword(title).split(' ').filter((w) => w.length >= 3); // short connector words repeating ("a", "of") is not the signal this looks for
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([word]) => word);
}

export function analyzeTitle(title: string, keywords: string[], profile: SeoProfile): TitleAnalysisReport {
  const length = title.trim().length;
  const lengthScore = scoreLength(length, profile.title.minLength, profile.title.maxLength);
  const keywordPlacementScore = scoreKeywordPlacement(title, keywords);
  const readabilityScore = scoreReadability(title);
  const duplicateWords = findDuplicateWords(title);
  const duplicateWordScore = Math.max(0, 100 - duplicateWords.length * 20);
  const compliance = checkTitleCompliance(title, profile);
  const complianceScore = compliance.compliant ? 100 : Math.max(0, 100 - compliance.reasons.length * 40);

  const score = Math.round((lengthScore + keywordPlacementScore + readabilityScore + duplicateWordScore + complianceScore) / 5);

  return { length, lengthScore, keywordPlacementScore, readabilityScore, duplicateWords, duplicateWordScore, complianceScore, score };
}
