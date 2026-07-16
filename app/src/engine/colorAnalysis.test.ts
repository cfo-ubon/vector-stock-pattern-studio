import { describe, it, expect } from 'vitest';
import { hexToHsl, meanHue, circularHueDistance, colorSetStats, computePaletteEnergy, computeDominantAccentIndex } from './colorAnalysis';

describe('hexToHsl', () => {
  it('converts known primary colors correctly', () => {
    expect(hexToHsl('#ff0000')).toEqual({ h: 0, s: 1, l: 0.5 });
    const green = hexToHsl('#00ff00');
    expect(green.h).toBeCloseTo(120, 0);
    expect(green.s).toBeCloseTo(1, 5);
    const blue = hexToHsl('#0000ff');
    expect(blue.h).toBeCloseTo(240, 0);
  });

  it('gives zero saturation for grayscale', () => {
    const gray = hexToHsl('#808080');
    expect(gray.s).toBe(0);
  });

  it('handles black and white as extreme lightness', () => {
    expect(hexToHsl('#000000').l).toBe(0);
    expect(hexToHsl('#ffffff').l).toBe(1);
  });
});

describe('meanHue', () => {
  it('is the plain average for hues far from the wrap boundary', () => {
    expect(meanHue([100, 120])).toBeCloseTo(110, 0);
  });

  it('correctly averages hues that straddle 0/360 (not a naive arithmetic mean)', () => {
    // Naive mean of 350 and 10 would be 180 (green) — the true circular
    // mean is 0/360 (red). Compare via circular distance since exactly-
    // symmetric inputs can land on either side of the 0/360 seam due to
    // floating-point noise (e.g. 359.999999...).
    expect(circularHueDistance(meanHue([350, 10]), 0)).toBeCloseTo(0, 3);
  });

  it('returns 0 for an empty set', () => {
    expect(meanHue([])).toBe(0);
  });
});

describe('circularHueDistance', () => {
  it('is symmetric and takes the shorter path around the wheel', () => {
    expect(circularHueDistance(10, 350)).toBeCloseTo(20, 5);
    expect(circularHueDistance(350, 10)).toBeCloseTo(20, 5);
  });

  it('is zero for identical hues', () => {
    expect(circularHueDistance(180, 180)).toBe(0);
  });
});

describe('colorSetStats', () => {
  it('excludes the background (colors[0]) from the stats', () => {
    const stats = colorSetStats(['#000000', '#ff0000']);
    // Only #ff0000 should count — pure red, s=1, l=0.5.
    expect(stats.meanSaturation).toBeCloseTo(1, 5);
    expect(stats.meanLightness).toBeCloseTo(0.5, 5);
  });

  it('is deterministic', () => {
    const colors = ['#f4ede4', '#c9a86c', '#7c8a5f', '#a94438'];
    expect(colorSetStats(colors)).toEqual(colorSetStats(colors));
  });
});

describe('computePaletteEnergy (Build 011, Section 1/3)', () => {
  it('returns 0 for a flat, unsaturated, single-lightness-band palette', () => {
    expect(computePaletteEnergy(['#808080', '#808080', '#808080'])).toBe(0);
  });

  it('returns a high value for a maximally saturated, high-contrast palette', () => {
    const energy = computePaletteEnergy(['#ffffff', '#ff0000', '#800000']);
    expect(energy).toBeGreaterThan(0.6);
  });

  it('a more saturated palette scores higher than a desaturated one at the same lightness', () => {
    const vivid = computePaletteEnergy(['#ffffff', '#ff0000']);
    const muted = computePaletteEnergy(['#ffffff', '#a08080']);
    expect(vivid).toBeGreaterThan(muted);
  });

  it('a wider lightness spread scores higher than a narrow one at the same saturation', () => {
    const wide = computePaletteEnergy(['#ffffff', '#330000', '#ff9999']);
    const narrow = computePaletteEnergy(['#ffffff', '#ee8888', '#ff9999']);
    expect(wide).toBeGreaterThan(narrow);
  });

  it('is bounded to [0, 1]', () => {
    const energy = computePaletteEnergy(['#000000', '#ff0000', '#00ff00', '#0000ff', '#ffffff']);
    expect(energy).toBeGreaterThanOrEqual(0);
    expect(energy).toBeLessThanOrEqual(1);
  });

  it('treats a single-color array as its own accent (no background to exclude)', () => {
    expect(computePaletteEnergy(['#ff0000'])).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    const colors = ['#f4ede4', '#c9a86c', '#7c8a5f', '#a94438'];
    expect(computePaletteEnergy(colors)).toBe(computePaletteEnergy(colors));
  });
});

describe('computeDominantAccentIndex (Build 011, Section 3: Color Harmony Intelligence)', () => {
  it('returns 0 for a single-accent or accent-less palette', () => {
    expect(computeDominantAccentIndex(['#000000'])).toBe(0);
    expect(computeDominantAccentIndex(['#000000', '#ff0000'])).toBe(0);
  });

  it('picks the most saturated accent among several', () => {
    // background + 3 accents: dull, vivid, medium.
    const colors = ['#ffffff', '#a08080', '#ff0000', '#c08080'];
    expect(computeDominantAccentIndex(colors)).toBe(1); // index into colors.slice(1) -> '#ff0000'
  });

  it('breaks ties toward the first occurrence', () => {
    const colors = ['#ffffff', '#ff0000', '#00ff00'];
    expect(computeDominantAccentIndex(colors)).toBe(0);
  });

  it('is deterministic', () => {
    const colors = ['#f4ede4', '#c9a86c', '#7c8a5f', '#a94438'];
    expect(computeDominantAccentIndex(colors)).toBe(computeDominantAccentIndex(colors));
  });
});
