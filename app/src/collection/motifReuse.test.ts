import { describe, it, expect } from 'vitest';
import { buildMotifReuseReport, type CollectionMotifPlacement } from './motifReuse';
import type { FactoryMotif } from '../engine/motifFactory';
import type { CollectionManifest } from './collectionGenerator';

function makeMotif(overrides: Partial<FactoryMotif> = {}): FactoryMotif {
  return {
    id: 'motif-1',
    family: 'decorative',
    role: 'accent',
    category: 'geometric',
    node: { tag: 'g', children: [] },
    radius: 10,
    bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10, width: 10, height: 10 },
    anchors: [],
    complexity: 10,
    colorRoles: [],
    tags: [],
    ...overrides,
  };
}

const rel = (assetId: string, motifId: string) => ({ assetId, motifId });

describe('buildMotifReuseReport', () => {
  it('a motif used in only one asset is not counted as reused', () => {
    const relationships: CollectionManifest['relationships'] = [rel('asset-a', 'motif-1')];
    const motifs = [makeMotif({ id: 'motif-1' })];
    const report = buildMotifReuseReport(relationships, motifs);
    expect(report.totalDistinctMotifs).toBe(1);
    expect(report.reusedMotifCount).toBe(0);
    expect(report.reuseRatio).toBe(0);
  });

  it('a motif used in 2+ assets is counted as reused, with correct usedInAssetIds/reuseCount', () => {
    const relationships: CollectionManifest['relationships'] = [
      rel('border-top', 'motif-1'),
      rel('corner-top-left', 'motif-1'),
      rel('decorative-sheet', 'motif-1'),
    ];
    const motifs = [makeMotif({ id: 'motif-1', role: 'filler' })];
    const report = buildMotifReuseReport(relationships, motifs);
    expect(report.reusedMotifCount).toBe(1);
    expect(report.sharedFillers.length).toBe(1);
    expect(report.sharedFillers[0].reuseCount).toBe(3);
    expect(report.sharedFillers[0].usedInAssetIds).toEqual(['border-top', 'corner-top-left', 'decorative-sheet']);
  });

  it('duplicate relationship rows for the same asset+motif do not inflate reuseCount', () => {
    const relationships: CollectionManifest['relationships'] = [
      rel('spot-sheet', 'motif-1'),
      rel('spot-sheet', 'motif-1'),
      rel('individual-motif-1', 'motif-1'),
    ];
    const motifs = [makeMotif({ id: 'motif-1', role: 'hero' })];
    const report = buildMotifReuseReport(relationships, motifs);
    expect(report.sharedHeroMotifs[0].reuseCount).toBe(2);
  });

  it('groups by role: hero/filler/accent land in the right bucket', () => {
    const relationships: CollectionManifest['relationships'] = [
      rel('a', 'hero-1'), rel('b', 'hero-1'),
      rel('c', 'filler-1'), rel('d', 'filler-1'),
      rel('e', 'accent-1'), rel('f', 'accent-1'),
    ];
    const motifs = [
      makeMotif({ id: 'hero-1', role: 'hero' }),
      makeMotif({ id: 'filler-1', role: 'filler' }),
      makeMotif({ id: 'accent-1', role: 'accent' }),
    ];
    const report = buildMotifReuseReport(relationships, motifs);
    expect(report.sharedHeroMotifs.map((e) => e.motifId)).toEqual(['hero-1']);
    expect(report.sharedFillers.map((e) => e.motifId)).toEqual(['filler-1']);
    expect(report.sharedDecorativeElements.map((e) => e.motifId)).toEqual(['accent-1']);
  });

  it('groups sharedLeaves by family, independent of role', () => {
    const relationships: CollectionManifest['relationships'] = [rel('a', 'leaf-1'), rel('b', 'leaf-1')];
    const motifs = [makeMotif({ id: 'leaf-1', role: 'filler', family: 'leaf' })];
    const report = buildMotifReuseReport(relationships, motifs);
    expect(report.sharedLeaves.length).toBe(1);
    expect(report.sharedLeaves[0].motifId).toBe('leaf-1');
  });

  it('attaches real placement variants when provided, empty array when not', () => {
    const relationships: CollectionManifest['relationships'] = [rel('border-top', 'motif-1'), rel('corner-tl', 'motif-1')];
    const motifs = [makeMotif({ id: 'motif-1', role: 'filler' })];
    const placements: CollectionMotifPlacement[] = [
      { motifId: 'motif-1', assetId: 'border-top', rotationDeg: 4, scale: 0.8 },
      { motifId: 'motif-1', assetId: 'corner-tl', rotationDeg: -6, scale: 1.1 },
    ];
    const withPlacements = buildMotifReuseReport(relationships, motifs, placements);
    expect(withPlacements.sharedFillers[0].variants.length).toBe(2);
    expect(withPlacements.sharedFillers[0].variants).toEqual(placements);

    const withoutPlacements = buildMotifReuseReport(relationships, motifs);
    expect(withoutPlacements.sharedFillers[0].variants).toEqual([]);
  });

  it('reuseRatio is a real percentage of reused/total, rounded', () => {
    const relationships: CollectionManifest['relationships'] = [
      rel('a', 'm1'), rel('b', 'm1'), // reused
      rel('c', 'm2'), // not reused
      rel('d', 'm3'), // not reused
    ];
    const motifs = [makeMotif({ id: 'm1' }), makeMotif({ id: 'm2' }), makeMotif({ id: 'm3' })];
    const report = buildMotifReuseReport(relationships, motifs);
    expect(report.totalDistinctMotifs).toBe(3);
    expect(report.reusedMotifCount).toBe(1);
    expect(report.reuseRatio).toBe(33);
  });

  it('handles an empty collection gracefully', () => {
    const report = buildMotifReuseReport([], []);
    expect(report.totalDistinctMotifs).toBe(0);
    expect(report.reusedMotifCount).toBe(0);
    expect(report.reuseRatio).toBe(0);
    expect(report.sharedHeroMotifs).toEqual([]);
  });

  it('falls back to safe role/family defaults for a motif id with no matching FactoryMotif', () => {
    const relationships: CollectionManifest['relationships'] = [rel('a', 'ghost'), rel('b', 'ghost')];
    const report = buildMotifReuseReport(relationships, []);
    expect(report.totalDistinctMotifs).toBe(1);
    expect(report.reusedMotifCount).toBe(1);
  });
});
