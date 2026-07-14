import { listCompositionKnowledge } from '../knowledge/composition';
import { listMarketplaceKnowledge } from '../knowledge/marketplace';
import type { Asset, AssetQualityScore } from './types';

// Asset Ecosystem Engine (Phase 9) — Section 9 "Quality". Every score is
// grounded in a real, already-derived field (`complexity`,
// `compatibility.patternGrammars`, `compatibility.marketplaces`) measured
// against the real total count of Pattern Grammars / Marketplaces the
// Design Knowledge Engine (Phase 6.5) knows about — never a fabricated
// number.

function clampScore(n: number): number {
  return Math.round(Math.max(0, Math.min(100, n)));
}

/** What fraction of every known Pattern Grammar this asset's category
 * lists as compatible — a real, verifiable "how broadly does this fit
 * into the app's real composition styles" measure. */
function computeCompatibilityScore(asset: Asset): number {
  const total = listCompositionKnowledge().length;
  if (total === 0) return 0;
  return clampScore((asset.metadata.patternTypes.length / total) * 100);
}

/** What fraction of every known marketplace this asset's Style DNA (if
 * any) is curated for. Assets with no `styleDnaId` get a fixed neutral
 * baseline (40) rather than 0 — the absence of a Style DNA reference
 * means "unverified", not "commercially useless". */
const NO_STYLE_BASELINE = 40;

function computeCommercialUsefulness(asset: Asset): number {
  if (!asset.metadata.styleDnaId) return NO_STYLE_BASELINE;
  const total = listMarketplaceKnowledge().length;
  if (total === 0) return NO_STYLE_BASELINE;
  return clampScore((asset.metadata.compatibility.marketplaces.length / total) * 100);
}

/** A moderate-complexity, well-compatible asset is the most broadly
 * reusable — a very sparse shape reads as "too plain to be distinctive"
 * and a very ornate one as "too specific to reuse elsewhere". This is a
 * deliberate heuristic (documented as one, not presented as a measured
 * fact): a triangular curve peaking at complexity 50, blended with the
 * real compatibility score. */
function computeReusability(complexity: number, compatibility: number): number {
  const complexityAppropriateness = clampScore(100 - Math.abs(complexity - 50) * 2);
  return clampScore((complexityAppropriateness + compatibility) / 2);
}

export function evaluateAssetQuality(asset: Asset): AssetQualityScore {
  const complexity = asset.metadata.complexity;
  const compatibility = computeCompatibilityScore(asset);
  const commercialUsefulness = computeCommercialUsefulness(asset);
  const reusability = computeReusability(complexity, compatibility);
  const overall = clampScore((reusability + complexity + commercialUsefulness + compatibility) / 4);
  return { reusability, complexity, commercialUsefulness, compatibility, overall };
}
