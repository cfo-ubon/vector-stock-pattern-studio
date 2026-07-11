import { listStyleKnowledge, findStyleKnowledgeForMarketplace, type StyleKnowledge } from '../style';
import { evaluateCollectionProductUses, getRecommendedProductUses } from '../collection';
import type { ProductUseEvaluation, ProductUseId, ProductTargetsInput } from '../../collection/productTargets';
import { resolveTrendPack } from '../../trend/designIntelligence';
import type { KeywordBundle } from '../../trend/designSpecTypes';
import type { TrendPack } from '../../trend/trendPacks';
import { buildQualityRecommendations, type DesignSpecQualityReport } from '../../trend/designSpecQuality';
import type { MarketplaceId } from '../../metadata/marketplaceProfiles';
import { getFrequentStyleDna, getFrequentPalettes, getFrequentMotifs, type LearningHistory } from '../history';

// Design Knowledge Engine (Phase 6.5) — Section 11 "Recommendation
// Engine". A real, deterministic, rule-based aggregator over the
// independent recommenders this codebase already has (Style DNA's
// `exportRecommendation`, Product Targets, the Trend Pack "Auto-match"
// resolver, and the Quality Loop's recommendation rules) plus Section
// 10's Learning History for personalization — never a hardcoded list.
// Every recommendation traces back to a real rule or a real recorded
// usage count; nothing here invents scores or copy.

export interface RecommendationContext {
  marketplaceId?: MarketplaceId;
  /** Learning History, if the caller wants frequency-aware personalization
   * — omit to get plain rule-based recommendations with no history bias. */
  history?: LearningHistory;
}

/** Style DNA candidates for a context. When `marketplaceId` is given,
 * narrows to styles whose real `exportRecommendation.recommendedSites`
 * includes it (an actual per-style curated list, not a guess). When
 * `history` is given, frequently-used styles are moved to the front —
 * personalization is a stable re-sort of the real candidate set, never a
 * fabricated addition to it. */
export function recommendStyleDna(context: RecommendationContext = {}): StyleKnowledge[] {
  const candidates = context.marketplaceId ? findStyleKnowledgeForMarketplace(context.marketplaceId) : listStyleKnowledge();
  if (!context.history) return candidates;
  const frequent = getFrequentStyleDna(context.history, candidates.length);
  const rank = (id: string) => {
    const idx = frequent.indexOf(id);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };
  return [...candidates].sort((a, b) => rank(a.id) - rank(b.id));
}

/** A single Style DNA's own preferred palettes, real-ordered first
 * (`preferredPalettes` is already primary-first per `style-dna/*`'s own
 * field docs) — with frequently-used palettes from history promoted
 * within that same real candidate set when history is supplied. */
export function recommendPalettesForStyle(styleDna: StyleKnowledge, history?: LearningHistory): string[] {
  if (!history) return styleDna.preferredPalettes;
  const frequent = getFrequentPalettes(history, styleDna.preferredPalettes.length);
  return [...styleDna.preferredPalettes].sort((a, b) => {
    const fa = frequent.indexOf(a);
    const fb = frequent.indexOf(b);
    if (fa === -1 && fb === -1) return 0;
    if (fa === -1) return 1;
    if (fb === -1) return -1;
    return fa - fb;
  });
}

/** A single Style DNA's own preferred motif families, with frequently-
 * used motif categories from history promoted first when supplied. */
export function recommendMotifFamiliesForStyle(styleDna: StyleKnowledge, history?: LearningHistory): string[] {
  if (!history) return styleDna.preferredMotifFamilies;
  const frequent = getFrequentMotifs(history, styleDna.preferredMotifFamilies.length);
  return [...styleDna.preferredMotifFamilies].sort((a, b) => {
    const fa = frequent.indexOf(a);
    const fb = frequent.indexOf(b);
    if (fa === -1 && fb === -1) return 0;
    if (fa === -1) return 1;
    if (fb === -1) return -1;
    return fa - fb;
  });
}

/** Marketplace targets a Style DNA is actually curated for — its real
 * `exportRecommendation.recommendedSites`, not a guess. */
export function recommendMarketplacesForStyle(styleDnaId: string): MarketplaceId[] {
  const style = listStyleKnowledge().find((s) => s.id === styleDnaId);
  return (style?.recommendedMarketplaces ?? []) as MarketplaceId[];
}

/** Real Product Targets evaluation + the top recommended subset — wraps
 * `collection/productTargets.ts` (Commercial Collection Engine Phase 4)
 * unmodified. */
export function recommendProductUses(input: ProductTargetsInput, max = 4): { evaluations: ProductUseEvaluation[]; recommended: ProductUseId[] } {
  const evaluations = evaluateCollectionProductUses(input);
  return { evaluations, recommended: getRecommendedProductUses(evaluations, max) };
}

/** Wraps the real Trend Pack "Auto-match" resolver
 * (`trend/designIntelligence.ts`'s `resolveTrendPack`, already the exact
 * logic behind the Trend Studio form's "✨ Auto-match" button) — an
 * explicit id always wins; otherwise season/pattern-type matching. */
export function recommendTrendPack(trendPackId: string | undefined, bundle: KeywordBundle): TrendPack | null {
  return resolveTrendPack(trendPackId, bundle);
}

/** Wraps the real Quality Loop recommendation rules
 * (`trend/designSpecQuality.ts`'s `buildQualityRecommendations`, Design
 * Workbench Phase 6) — actionable per-dimension advice for whichever
 * quality dimensions scored below the real threshold. */
export function recommendQualityImprovements(report: DesignSpecQualityReport): string[] {
  return buildQualityRecommendations(report);
}
