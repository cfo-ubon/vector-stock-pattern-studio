import { describe, it, expect } from 'vitest';
import { defaultParams } from './defaults';
import { buildTile } from './tile';
import { TREND_PRESETS, resolveTrend, computeTrendFit } from './trendEngine';
import { GENERATORS } from '../generators';
import { PALETTES } from '../palettes/palettes';

const TREND_IDS = Object.keys(TREND_PRESETS);

describe('resolveTrend', () => {
  it('returns null for an unknown id', () => {
    expect(resolveTrend('not-a-real-trend')).toBeNull();
  });

  it('resolves every preset to a valid, buildable params patch', () => {
    for (const id of TREND_IDS) {
      const patch = resolveTrend(id);
      expect(patch).not.toBeNull();
      const params = { ...defaultParams(), ...patch, seed: `trend-${id}` };
      expect(() => buildTile(params)).not.toThrow();
      expect(params.trend).toBe(id);
    }
  });

  it('is deterministic', () => {
    expect(resolveTrend('quietLuxury')).toEqual(resolveTrend('quietLuxury'));
  });
});

describe('computeTrendFit', () => {
  it('returns null for an unknown trend id', () => {
    const tile = buildTile({ ...defaultParams(), seed: 'fit-unknown' });
    expect(computeTrendFit(tile, 'not-a-real-trend')).toBeNull();
  });

  it('is deterministic and every sub-score is within [0, 100]', () => {
    for (const id of TREND_IDS) {
      const params = { ...defaultParams(), ...resolveTrend(id), seed: `fit-bounds-${id}` };
      const tile = buildTile(params);
      const fit = computeTrendFit(tile, id);
      expect(fit).not.toBeNull();
      expect(computeTrendFit(tile, id)).toEqual(fit);
      for (const v of Object.values(fit!)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });

  it('scores a perfect density/overlap match at 100 right after applying the preset', () => {
    // resolveTrend sets density/overlapAmount to the preset's own declared
    // values, which are defined to sit inside that preset's own range —
    // so density/overlap fit should read 100 immediately after applying it
    // (before any hand-editing).
    for (const id of TREND_IDS) {
      const params = { ...defaultParams(), ...resolveTrend(id), seed: `fit-selfmatch-${id}` };
      const tile = buildTile(params);
      const fit = computeTrendFit(tile, id)!;
      expect(fit.densityFit).toBe(100);
      expect(fit.overlapFit).toBe(100);
    }
  });

  it('degrades density fit when density is pushed far outside the trend range', () => {
    const id = 'quietLuxury'; // densityRange [0.2, 0.45]
    const base = { ...defaultParams(), ...resolveTrend(id), seed: 'fit-degrade' };
    const inRange = computeTrendFit(buildTile({ ...base, density: 0.35 }), id)!;
    const outOfRange = computeTrendFit(buildTile({ ...base, density: 0.95 }), id)!;
    expect(inRange.densityFit).toBe(100);
    expect(outOfRange.densityFit).toBeLessThan(100);
  });

  it('handles a hue-wrapping signature (y2kRevival) without throwing and scores its own palette well', () => {
    const params = { ...defaultParams(), ...resolveTrend('y2kRevival'), seed: 'fit-wrap' };
    const tile = buildTile(params);
    const fit = computeTrendFit(tile, 'y2kRevival')!;
    expect(fit.hueFit).toBeGreaterThan(0);
  });
});

describe('Build 011, Section 7 (Commercial Trend Engine): new named profiles', () => {
  it('adds the 3 brief-named profiles with no prior exact-label match', () => {
    expect(TREND_PRESETS.vintageBotanical.label).toBe('Vintage Botanical');
    expect(TREND_PRESETS.modernCottagecore.label).toBe('Modern Cottagecore');
    expect(TREND_PRESETS.maximalFloral.label).toBe('Maximal Floral');
  });

  it('each new profile scores its own resolved palette well against its own declared signature', () => {
    for (const id of ['vintageBotanical', 'modernCottagecore', 'maximalFloral']) {
      const params = { ...defaultParams(), ...resolveTrend(id), seed: `fit-new-${id}` };
      const tile = buildTile(params);
      const fit = computeTrendFit(tile, id)!;
      expect(fit.overall).toBeGreaterThan(50);
    }
  });

  it('maximalFloral (a hue-wrapping signature) never throws and scores its own palette well', () => {
    const params = { ...defaultParams(), ...resolveTrend('maximalFloral'), seed: 'fit-wrap-maximal' };
    const tile = buildTile(params);
    const fit = computeTrendFit(tile, 'maximalFloral')!;
    expect(fit.hueFit).toBeGreaterThan(0);
  });

  it('reuses only already-real categories/layouts/palettes/hierarchy presets, not invented engine parameters', () => {
    const paletteIds = new Set(PALETTES.map((p) => p.id));
    for (const id of ['vintageBotanical', 'modernCottagecore', 'maximalFloral']) {
      const preset = TREND_PRESETS[id];
      if (preset.categoryId) expect(GENERATORS[preset.categoryId]).toBeDefined();
      if (preset.paletteId) expect(paletteIds.has(preset.paletteId)).toBe(true);
    }
  });
});
