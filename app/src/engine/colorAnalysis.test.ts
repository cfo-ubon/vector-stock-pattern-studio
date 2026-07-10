import { describe, it, expect } from 'vitest';
import { hexToHsl, meanHue, circularHueDistance, colorSetStats } from './colorAnalysis';

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
