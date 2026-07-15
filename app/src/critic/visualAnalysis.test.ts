import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { buildTile } from '../engine/tile';
import { computeMetrics } from '../engine/scoring';
import { detectVisualIssues } from './visualAnalysis';

describe('detectVisualIssues', () => {
  it('returns exactly the 14 brief-named issues, every time', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'visual-analysis-1' });
    const metrics = computeMetrics(tile);
    const issues = detectVisualIssues(tile, metrics);
    expect(issues.map((i) => i.id).sort()).toEqual(
      [
        'crowdedAreas', 'deadSpace', 'fragmentedSilhouette', 'gridAppearance', 'lowDetail', 'mechanicalSpacing',
        'repeatedRotation', 'repeatedScale', 'weakClusters', 'weakFlow', 'weakHero',
        'lowHeroVisibility', 'weakHierarchy', 'tooManyFillers',
      ].sort(),
    );
  });

  it('every issue carries a non-empty real evidence string', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'visual-analysis-2' });
    const metrics = computeMetrics(tile);
    for (const issue of detectVisualIssues(tile, metrics)) {
      expect(issue.evidence.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic for the same tile', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'visual-analysis-3' });
    const metrics = computeMetrics(tile);
    expect(detectVisualIssues(tile, metrics)).toEqual(detectVisualIssues(tile, metrics));
  });

  it('a strict grid layout at default settings triggers gridAppearance and mechanicalSpacing', () => {
    const tile = buildTile({ ...defaultParams(), layoutId: 'grid', seed: 'visual-analysis-grid' });
    const metrics = computeMetrics(tile);
    const issues = detectVisualIssues(tile, metrics);
    const byId = Object.fromEntries(issues.map((i) => [i.id, i.detected]));
    expect(byId.gridAppearance).toBe(true);
    expect(byId.mechanicalSpacing).toBe(true);
  });

  it('a high-jitter bouquet layout does not trigger the same grid/mechanical issues', () => {
    const tile = buildTile({
      ...defaultParams(),
      layoutId: 'bouquet',
      categoryId: 'botanical',
      rotationJitter: 45,
      scaleJitter: 0.4,
      density: 0.6,
      overlapAmount: 0.3,
      seed: 'visual-analysis-bouquet',
    });
    const metrics = computeMetrics(tile);
    const issues = detectVisualIssues(tile, metrics);
    const byId = Object.fromEntries(issues.map((i) => [i.id, i.detected]));
    expect(byId.gridAppearance).toBe(false);
    expect(byId.mechanicalSpacing).toBe(false);
  });

  it('crowdedAreas evidence cites a real densest-cell fraction out of the real instance count', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'visual-analysis-crowd' });
    const metrics = computeMetrics(tile);
    const crowded = detectVisualIssues(tile, metrics).find((i) => i.id === 'crowdedAreas')!;
    expect(crowded.evidence).toMatch(/\d+\/\d+ instances/);
  });

  it('repeatedRotation and repeatedScale evidence cite real fractions', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'visual-analysis-rotscale' });
    const metrics = computeMetrics(tile);
    const issues = detectVisualIssues(tile, metrics);
    const rotation = issues.find((i) => i.id === 'repeatedRotation')!;
    const scale = issues.find((i) => i.id === 'repeatedScale')!;
    expect(rotation.evidence).toMatch(/\d+\/\d+ instances/);
    expect(scale.evidence).toMatch(/\d+\/\d+ instances/);
  });

  it('handles a tile with no instances without throwing', () => {
    const tile = buildTile({ ...defaultParams(), density: 0, seed: 'visual-analysis-empty' });
    const metrics = computeMetrics(tile);
    expect(() => detectVisualIssues(tile, metrics)).not.toThrow();
  });
});

describe('detectVisualIssues: fragmentedSilhouette (Build 001, Section 9)', () => {
  it('flags a genuinely sparse, small-motif Airy pattern as fragmented', () => {
    const tile = buildTile({ ...defaultParams(), layoutId: 'airy', seed: 'silhouette-airy-1' });
    const metrics = computeMetrics(tile);
    const issue = detectVisualIssues(tile, metrics).find((i) => i.id === 'fragmentedSilhouette')!;
    expect(issue.detected).toBe(true);
  });

  it('does not flag a dense, cluster-engine-backed Scatter pattern (cohesive by construction)', () => {
    const tile = buildTile({ ...defaultParams(), layoutId: 'scatter', seed: 'silhouette-scatter-1' });
    const metrics = computeMetrics(tile);
    const issue = detectVisualIssues(tile, metrics).find((i) => i.id === 'fragmentedSilhouette')!;
    expect(issue.detected).toBe(false);
  });

  it('does not flag a dense Bouquet pattern (cohesive by construction)', () => {
    const tile = buildTile({ ...defaultParams(), layoutId: 'bouquet', categoryId: 'botanical', seed: 'silhouette-bouquet-1' });
    const metrics = computeMetrics(tile);
    const issue = detectVisualIssues(tile, metrics).find((i) => i.id === 'fragmentedSilhouette')!;
    expect(issue.detected).toBe(false);
  });

  it('cites the real region/island/largest-blob counts in its evidence', () => {
    const tile = buildTile({ ...defaultParams(), layoutId: 'airy', seed: 'silhouette-evidence-1' });
    const metrics = computeMetrics(tile);
    const issue = detectVisualIssues(tile, metrics).find((i) => i.id === 'fragmentedSilhouette')!;
    expect(issue.evidence).toMatch(/region\(s\) on the \d+x\d+ grid/);
  });

  it('is deterministic for the same tile', () => {
    const tile = buildTile({ ...defaultParams(), layoutId: 'airy', seed: 'silhouette-det-1' });
    const metrics = computeMetrics(tile);
    const a = detectVisualIssues(tile, metrics).find((i) => i.id === 'fragmentedSilhouette');
    const b = detectVisualIssues(tile, metrics).find((i) => i.id === 'fragmentedSilhouette');
    expect(a).toEqual(b);
  });

  it('never throws when there are too few instances to assess', () => {
    const tile = buildTile({ ...defaultParams(), density: 0, seed: 'silhouette-empty-1' });
    const metrics = computeMetrics(tile);
    const issue = detectVisualIssues(tile, metrics).find((i) => i.id === 'fragmentedSilhouette')!;
    expect(issue.detected).toBe(false);
  });
});
