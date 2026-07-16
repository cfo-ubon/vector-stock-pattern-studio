import { describe, it, expect } from 'vitest';
import { buildTile } from './tile';
import { defaultParams } from './defaults';
import { computeMetrics } from './scoring';
import { computePatternReadability } from './patternReadability';
import { h } from './svgAst';
import type { TileData } from './types';

/** Like `scoring.test.ts`'s own synthetic tile builders, but exposing
 * per-instance `scale` directly (needed here — readability depends on
 * each instance's real on-screen size, which those builders always pin
 * to `scale(1)`). */
function makeScaledSyntheticTile(
  entries: Array<{ x: number; y: number; scale: number; role?: 'hero' | 'secondary' | 'filler' | 'accent' }>,
  opts: { tileSize?: number; motifSize?: number } = {},
): TileData {
  const tileSize = opts.tileSize ?? 1000;
  const motifGroups = entries.map((e, i) =>
    h('g', { id: `motif-${i + 1}`, ...(e.role ? { 'data-role': e.role } : {}) }, [
      h('g', { transform: `translate(${e.x} ${e.y}) rotate(0) scale(${e.scale})` }, [h('circle', { cx: 0, cy: 0, r: 5, fill: '#000000' })]),
    ]),
  );
  const svg = h('g', { id: 'tile-content' }, [
    h('g', { id: 'layer-background' }, [h('rect', { x: 0, y: 0, width: tileSize, height: tileSize, fill: '#ffffff' })]),
    h('g', { id: 'layer-pattern' }, motifGroups),
  ]);
  return { params: { ...defaultParams(), tileSize, motifSize: opts.motifSize ?? defaultParams().motifSize }, backgroundColor: '#ffffff', colors: ['#ffffff', '#000000'], svg };
}

describe('computePatternReadability', () => {
  it('scores every dimension 0-100 on a real generated tile', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'readability-1' });
    const metrics = computeMetrics(tile);
    const result = computePatternReadability(tile, metrics);
    for (const v of [result.thumbnail200, result.thumbnail400, result.zoom800]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('readableAtAllScales is exactly the AND of all 3 scale scores clearing the floor', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'readability-2' });
    const metrics = computeMetrics(tile);
    const result = computePatternReadability(tile, metrics);
    const expected = result.thumbnail200 >= 50 && result.thumbnail400 >= 50 && result.zoom800 >= 50;
    expect(result.readableAtAllScales).toBe(expected);
  });

  it('an empty tile is trivially readable (no instances to fail legibility)', () => {
    const tile = makeScaledSyntheticTile([]);
    const metrics = computeMetrics(tile);
    const result = computePatternReadability(tile, metrics);
    expect(result.thumbnail200).toBe(100);
    expect(result.thumbnail400).toBe(100);
  });

  it('a hero scaled far too small to read at 200px scores lower than one that reads clearly', () => {
    const tileSize = 1000;
    const motifSize = 40;
    const tinyHero = makeScaledSyntheticTile([{ x: 500, y: 500, scale: 0.02, role: 'hero' }], { tileSize, motifSize });
    const clearHero = makeScaledSyntheticTile([{ x: 500, y: 500, scale: 1.5, role: 'hero' }], { tileSize, motifSize });
    const tinyResult = computePatternReadability(tinyHero, computeMetrics(tinyHero));
    const clearResult = computePatternReadability(clearHero, computeMetrics(clearHero));
    expect(tinyResult.thumbnail200).toBeLessThan(clearResult.thumbnail200);
  });

  it('thumbnail scores never depend on which real seed generated the tile beyond the tile itself (deterministic)', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'readability-3' });
    const metrics = computeMetrics(tile);
    const a = computePatternReadability(tile, metrics);
    const b = computePatternReadability(tile, metrics);
    expect(a).toEqual(b);
  });

  it('zoom800 is derived purely from real cornerContinuity/gridAppearanceScore/svgHealth metrics', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'readability-4' });
    const metrics = computeMetrics(tile);
    const result = computePatternReadability(tile, metrics);
    const expected = Math.max(0, Math.min(100, Math.round(metrics.cornerContinuity * 0.45 + metrics.gridAppearanceScore * 0.3 + metrics.svgHealth * 0.25)));
    expect(result.zoom800).toBe(expected);
  });
});
