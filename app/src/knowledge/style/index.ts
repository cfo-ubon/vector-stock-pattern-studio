import { listStyleDna, getStyleDna, findStyleDnaByCategory, findStyleDnaByPalette, findStyleDnaRecommendedForMarketplace } from '../../services/styleDnaService';
import { HIERARCHY_PRESETS, type HierarchyParams } from '../../engine/hierarchy';
import type { StyleDnaData } from '../../style-dna';

// Design Knowledge Engine (Phase 6.5) — Section 2 "Style Knowledge". A
// thin facade over the real Style DNA library (`style-dna/*.json` +
// `services/styleDnaService.ts`) and `engine/hierarchy.ts`'s
// `HIERARCHY_PRESETS` — no new data, no re-implementation. A `StyleDnaData`
// record already carries every field the brief names: `paletteIds`
// (Preferred palettes), `hierarchyPreset` (Preferred hierarchy, resolved
// here to the real `HierarchyParams`), `density` (Preferred density), and
// `layouts`/`categories` (the closest real analogs to "preferred
// compositions" and "preferred motif families" — this app's actual model
// has no separate "motif family" list per style; `categories` *is* the
// generator-category-level preference, and `layouts` *is* the repeat-
// strategy preference, so this module names its getters after what they
// really return rather than forcing a fake 1:1 label match to the brief's
// wording).

export interface StyleKnowledge {
  id: string;
  label: string;
  description: string;
  preferredMotifFamilies: string[];
  preferredLayouts: StyleDnaData['layouts'];
  preferredDensity: number;
  preferredHierarchy: HierarchyParams;
  preferredPalettes: string[];
  /** The style's own `exportRecommendation.recommendedSites` — real,
   * per-style curated marketplace targets, not a guess. */
  recommendedMarketplaces: string[];
}

function toStyleKnowledge(dna: StyleDnaData): StyleKnowledge {
  return {
    id: dna.id,
    label: dna.label,
    description: dna.description,
    preferredMotifFamilies: dna.categories,
    preferredLayouts: dna.layouts,
    preferredDensity: dna.density,
    preferredHierarchy: HIERARCHY_PRESETS[dna.hierarchyPreset].value,
    preferredPalettes: dna.paletteIds,
    recommendedMarketplaces: dna.exportRecommendation.recommendedSites,
  };
}

export function listStyleKnowledge(): StyleKnowledge[] {
  return listStyleDna().map(toStyleKnowledge);
}

export function getStyleKnowledge(id: string): StyleKnowledge | undefined {
  const dna = getStyleDna(id);
  return dna ? toStyleKnowledge(dna) : undefined;
}

export function findStyleKnowledgeByMotifFamily(categoryId: string): StyleKnowledge[] {
  return findStyleDnaByCategory(categoryId).map(toStyleKnowledge);
}

export function findStyleKnowledgeByPalette(paletteId: string): StyleKnowledge[] {
  return findStyleDnaByPalette(paletteId).map(toStyleKnowledge);
}

export function findStyleKnowledgeForMarketplace(marketplaceId: string): StyleKnowledge[] {
  return findStyleDnaRecommendedForMarketplace(marketplaceId).map(toStyleKnowledge);
}
