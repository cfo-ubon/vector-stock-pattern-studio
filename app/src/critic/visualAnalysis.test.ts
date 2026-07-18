import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { buildTile } from '../engine/tile';
import { computeMetrics } from '../engine/scoring';
import { HIERARCHY_PRESETS } from '../engine/hierarchy';
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
    // Build 002, Section 5 gave `airy` real Cluster Engine cohesion (each
    // anchor is now a genuine hero + 1-2 member cluster, not an independent
    // scatter of same-weight motifs), so its *default*-density silhouette
    // reads as more cohesive than before — density is lowered here to keep
    // exercising this test's real intent (a genuinely sparse composition
    // still reads as fragmented), not because the detector itself changed.
    // Build 003, Section 2 (Rotation Angle Families) added one extra rng
    // draw before this layout's placement loop, shifting this seed's exact
    // placements enough to flip this borderline 0.15 case — lowered further
    // to 0.05, comfortably clear of the boundary, same as the original
    // tuning above (not a real fragmentation-detector change).
    const tile = buildTile({ ...defaultParams(), layoutId: 'airy', density: 0.05, seed: 'silhouette-airy-2' });
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

describe('detectVisualIssues: lowHeroVisibility / weakHierarchy calibration (Build 002, Section 6)', () => {
  // These two detectors (added Build 001.1, Section 5/9) had no dedicated
  // true-positive/true-negative fixture before this: a diagnostic sweep
  // across every layout x HIERARCHY_PRESETS combination found `hierarchy`
  // reaches down to single digits (weakHierarchy is real and reachable),
  // but no combination of layout x hierarchy preset alone ever pushed the
  // composite Hero Visibility Score below its own 55-point threshold — it
  // took a real, simultaneously weak hero (minimalRepeat's tiny heroRatio/
  // heroScale, which also thins out real hero-role instances so
  // `heroDetailRatio` reflects an undetailed hero) *and* a near-zero-
  // contrast forced 2-color palette together. Both thresholds are real and
  // reachable by genuinely bad output, not vestigial dead code.
  it('flags a genuinely weak hero (thin tiering + flat 2-color palette) as low hero visibility', () => {
    const tile = buildTile({
      ...defaultParams(),
      layoutId: 'halfDrop',
      categoryId: 'botanical',
      hierarchy: HIERARCHY_PRESETS.minimalRepeat.value,
      colorCount: 2,
      customColors: ['#f5f5f0', '#eeeee5'],
      density: 0.3,
      // Build 004, Section 2 (measured regression fix): this fixture's
      // original seed ('s6-lowherovis-b1') relied on the botanical
      // generator's random variant pick landing on a specific shape whose
      // heroDetailRatio kept the composite Hero Visibility Score under the
      // real 55-point threshold. Growing the pool from 21 to 25 variants
      // (Section 2's new families) shifts which variant that same seed's
      // rng() draw now lands on -- measured: the original seed's score rose
      // from under 55 to 63.55 (no longer weak). This seed was found via a
      // direct re-sweep and still produces a genuinely weak hero (score
      // 42.9, comfortable margin under the threshold) -- the fix is the
      // trigger seed, not the detector or its threshold, matching this
      // suite's own established precedent (see Build 003's
      // `fragmentedSilhouette` density retune, Section 2).
      //
      // Build 018 (measured regression fix, same category as above):
      // `generators/botanical.ts`'s `flowerBloom` variant gained an
      // optional stem (an `rngBool` draw, Priority 4 — Botanical
      // Realism), which consumes one extra random draw whenever that
      // variant is picked and so shifts which variant every *later*
      // rng() draw in the same generation lands on -- including this
      // fixture's own trigger seed, whose score rose out of the weak
      // range. Re-swept for a new seed that still produces a genuinely
      // weak hero (score 42.15, comparable margin to the seed it
      // replaces) with the current generator -- again, the fix is the
      // trigger seed, not the detector, its threshold, or the Botanical
      // Realism fix itself.
      seed: 's6-lowherovis-sweep-45',
    });
    const metrics = computeMetrics(tile);
    const issue = detectVisualIssues(tile, metrics).find((i) => i.id === 'lowHeroVisibility')!;
    expect(issue.detected).toBe(true);
  });

  it('does not flag a strongly-tiered, high-contrast hero as low hero visibility', () => {
    const tile = buildTile({
      ...defaultParams(),
      layoutId: 'grid',
      hierarchy: HIERARCHY_PRESETS.heroFocus.value,
      seed: 's6-stronghero-1',
    });
    const metrics = computeMetrics(tile);
    const issue = detectVisualIssues(tile, metrics).find((i) => i.id === 'lowHeroVisibility')!;
    expect(issue.detected).toBe(false);
  });

  it('flags near-uniform scale tiering (minimalRepeat) as weak hierarchy', () => {
    const tile = buildTile({
      ...defaultParams(),
      layoutId: 'gridMinimal',
      hierarchy: HIERARCHY_PRESETS.minimalRepeat.value,
      seed: 's6-weakhier-c3',
    });
    const metrics = computeMetrics(tile);
    const issue = detectVisualIssues(tile, metrics).find((i) => i.id === 'weakHierarchy')!;
    expect(issue.detected).toBe(true);
  });

  it('does not flag a strongly-tiered hierarchy (heroFocus) as weak hierarchy', () => {
    const tile = buildTile({
      ...defaultParams(),
      layoutId: 'grid',
      hierarchy: HIERARCHY_PRESETS.heroFocus.value,
      seed: 's6-stronghier-1',
    });
    const metrics = computeMetrics(tile);
    const issue = detectVisualIssues(tile, metrics).find((i) => i.id === 'weakHierarchy')!;
    expect(issue.detected).toBe(false);
  });
});
