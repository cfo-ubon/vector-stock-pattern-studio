import { isCombinationRecommended, getRecommendedFamilyCombinations } from '../knowledge/motif';
import type { Asset } from './types';

// Asset Ecosystem Engine (Phase 9) — Section 6 "Smart Recommendation".
// Reuses the Design Knowledge Engine's real motif-compatibility data
// (`knowledge/motif`, Phase 6.5) instead of a second compatibility
// scheme — the same rule set `critic/*` and `knowledge/recommendation`
// already consume.

/** Real signals, weighted by how strong a match they are — no fabricated
 * score, every point traces back to a real shared field or a real
 * `knowledge/motif` compatibility check:
 *  - same Style DNA: the strongest signal (+3) — an asset explicitly
 *    built for the same style.
 *  - same source collection: (+2) — already known to sit together.
 *  - candidate's family is in the target's recommended family
 *    combinations (`getRecommendedFamilyCombinations`): (+2).
 *  - candidate and target share at least one real compatible Pattern
 *    Grammar (`isCombinationRecommended` against each of the target's
 *    own `patternTypes`): (+1) per shared grammar. */
function scoreCandidate(target: Asset, candidate: Asset): number {
  if (candidate.metadata.id === target.metadata.id) return -1;
  let score = 0;
  if (target.metadata.styleDnaId && candidate.metadata.styleDnaId === target.metadata.styleDnaId) score += 3;
  if (candidate.metadata.sourceCollectionId === target.metadata.sourceCollectionId) score += 2;

  const recommendedFamilies = new Set(getRecommendedFamilyCombinations(target.metadata.categoryId).map((g) => g.family));
  if (recommendedFamilies.has(candidate.metadata.family)) score += 2;

  const sharedGrammars = target.metadata.patternTypes.filter((grammarId) => isCombinationRecommended(candidate.metadata.categoryId, grammarId));
  score += sharedGrammars.length;

  return score;
}

/** Ranks `pool` by real compatibility with `target`, highest first,
 * dropping non-positive scores (an asset with zero real overlap isn't a
 * recommendation, just noise). */
export function recommendCompatibleAssets(target: Asset, pool: Asset[], limit = 8): Asset[] {
  return pool
    .map((candidate) => ({ candidate, score: scoreCandidate(target, candidate) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}
