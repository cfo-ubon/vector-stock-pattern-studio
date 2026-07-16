import { describe, it, expect } from 'vitest';
import { listStyleDna } from '../../services/styleDnaService';
import { HIERARCHY_PRESETS } from '../../engine/hierarchy';
import {
  listStyleKnowledge,
  getStyleKnowledge,
  findStyleKnowledgeByMotifFamily,
  findStyleKnowledgeByPalette,
  findStyleKnowledgeForMarketplace,
} from './index';

describe('knowledge/style: listStyleKnowledge', () => {
  it('returns one entry per real Style DNA preset', () => {
    expect(listStyleKnowledge().length).toBe(listStyleDna().length);
  });
});

describe('knowledge/style: getStyleKnowledge', () => {
  it('resolves hierarchyPreset to the real HierarchyParams value, not just the preset id', () => {
    const dna = listStyleDna()[0];
    const knowledge = getStyleKnowledge(dna.id)!;
    expect(knowledge.preferredHierarchy).toEqual(HIERARCHY_PRESETS[dna.hierarchyPreset].value);
  });

  it('maps categories -> preferredMotifFamilies and layouts -> preferredLayouts without transformation', () => {
    const dna = listStyleDna()[0];
    const knowledge = getStyleKnowledge(dna.id)!;
    expect(knowledge.preferredMotifFamilies).toEqual(dna.categories);
    expect(knowledge.preferredLayouts).toEqual(dna.layouts);
    expect(knowledge.preferredDensity).toBe(dna.density);
    expect(knowledge.preferredPalettes).toEqual(dna.paletteIds);
    expect(knowledge.recommendedMarketplaces).toEqual(dna.exportRecommendation.recommendedSites);
  });

  it('returns undefined for an unknown id', () => {
    expect(getStyleKnowledge('not-a-real-style')).toBeUndefined();
  });
});

describe('knowledge/style: lookups', () => {
  it('findStyleKnowledgeByMotifFamily returns only styles that actually list that category', () => {
    const results = findStyleKnowledgeByMotifFamily('botanical');
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(r.preferredMotifFamilies).toContain('botanical');
  });

  it('findStyleKnowledgeByPalette returns only styles that actually list that palette', () => {
    const dna = listStyleDna().find((d) => d.paletteIds.length > 0)!;
    const results = findStyleKnowledgeByPalette(dna.paletteIds[0]);
    expect(results.some((r) => r.id === dna.id)).toBe(true);
  });

  it('findStyleKnowledgeForMarketplace returns only styles that actually recommend that marketplace', () => {
    const dna = listStyleDna()[0];
    const marketplaceId = dna.exportRecommendation.recommendedSites[0];
    const results = findStyleKnowledgeForMarketplace(marketplaceId);
    for (const r of results) expect(r.recommendedMarketplaces).toContain(marketplaceId);
  });
});
