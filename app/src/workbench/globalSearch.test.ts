import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { generateCollection } from '../collection/collectionGenerator';
import { createProject, addCollectionToProject } from '../project/projectManager';
import { TREND_PACK_LIST } from '../trend/trendPacks';
import { listMotifGrammars } from '../services/motifGrammarService';
import { listMarketplaces } from '../services/marketplaceService';
import { searchWorkbench } from './globalSearch';

// Design Workbench Section 9 ("Global Search"). Every assertion below
// searches for a real id/label already registered in the app's own
// registries (Trend Packs, Motif Grammars, Marketplace Profiles) or built
// via the real Project/Collection generator — nothing invented.

describe('searchWorkbench: empty query', () => {
  it('returns no results for an empty or whitespace-only query', () => {
    const project = createProject('Botanical Wallpaper Co');
    expect(searchWorkbench('', [project])).toEqual([]);
    expect(searchWorkbench('   ', [project])).toEqual([]);
  });
});

describe('searchWorkbench: projects', () => {
  it('finds a project by a case-insensitive substring of its name', () => {
    const project = createProject('Botanical Wallpaper Co');
    const results = searchWorkbench('wallpaper', [project]);
    expect(results.some((r) => r.type === 'project' && r.id === project.id)).toBe(true);
  });

  it('does not match a project whose name has no overlap with the query', () => {
    const project = createProject('Botanical Wallpaper Co');
    const results = searchWorkbench('zzz-nonexistent', [project]);
    expect(results.some((r) => r.type === 'project')).toBe(false);
  });
});

describe('searchWorkbench: collections', () => {
  it('finds a collection nested inside a project and tags it with the parent projectId', () => {
    const collection = generateCollection({ ...defaultParams(), seed: 'global-search-collection' });
    const project = addCollectionToProject(createProject('Parent Project'), collection);
    const collectionName = project.collections[0].collection.manifest.collectionName;

    const results = searchWorkbench(collectionName.slice(0, 6), [project]);
    const match = results.find((r) => r.type === 'collection');
    expect(match).toBeDefined();
    expect(match?.projectId).toBe(project.id);
    expect(match?.id).toBe(project.collections[0].id);
  });
});

describe('searchWorkbench: motifs', () => {
  it('finds a real Motif Grammar by label', () => {
    const grammar = listMotifGrammars()[0];
    const results = searchWorkbench(grammar.label.slice(0, 4), []);
    expect(results.some((r) => r.type === 'motif' && r.id === grammar.id)).toBe(true);
  });
});

describe('searchWorkbench: trend packs', () => {
  it('finds a real Trend Pack by theme', () => {
    const pack = TREND_PACK_LIST[0];
    const results = searchWorkbench(pack.theme.slice(0, 5), []);
    expect(results.some((r) => r.type === 'trendPack' && r.id === pack.id)).toBe(true);
  });
});

describe('searchWorkbench: marketplace profiles', () => {
  it('finds a real Marketplace Profile by label', () => {
    const marketplace = listMarketplaces()[0];
    const results = searchWorkbench(marketplace.label.slice(0, 4), []);
    expect(results.some((r) => r.type === 'marketplace' && r.id === marketplace.id)).toBe(true);
  });
});

describe('searchWorkbench: cross-category', () => {
  it('a broad query can return results from more than one category at once', () => {
    const project = createProject('Adobe Style Notes');
    const results = searchWorkbench('adobe', [project]);
    const types = new Set(results.map((r) => r.type));
    expect(types.size).toBeGreaterThan(1);
  });
});
