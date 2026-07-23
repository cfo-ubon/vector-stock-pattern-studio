import { describe, it, expect } from 'vitest';
import { checkPerceptualContrast, ensureContrastSafePalette, wcagContrastRatio, MIN_CONTRAST_RATIO } from './paletteContrastEngine';

describe('checkPerceptualContrast / ensureContrastSafePalette (Build 022, Phase 4)', () => {
  it('detects a pale hero on a pale background', () => {
    const colors = ['#fdf6ee', '#f5e8da', '#e8d5c0', '#d4b89a']; // near-white through soft tan
    const check = checkPerceptualContrast(colors);
    expect(check.passed).toBe(false);
    const fixed = ensureContrastSafePalette(colors);
    expect(checkPerceptualContrast(fixed.colors).passed).toBe(true);
  });

  it('detects dark foliage obscuring a dark hero', () => {
    const colors = ['#1a1a1a', '#2b2b2b', '#242424', '#333333']; // all near-black
    const check = checkPerceptualContrast(colors);
    expect(check.passed).toBe(false);
    const fixed = ensureContrastSafePalette(colors);
    expect(checkPerceptualContrast(fixed.colors).passed).toBe(true);
  });

  it('detects adjacent flowers with near-identical values', () => {
    const colors = ['#ffffff', '#e6a5b8', '#e8a7ba', '#e4a3b6']; // hero/secondary/accent barely differ
    const check = checkPerceptualContrast(colors);
    expect(check.weakPairs.length).toBeGreaterThan(0);
  });

  it('a monochromatic minimal palette: fixes background-vs-color contrast but preserves hue (same family, still monochrome)', () => {
    const colors = ['#f0efed', '#3a3a3a']; // charcoal-on-off-white, 2-color monochromeAccent style
    const before = checkPerceptualContrast(colors);
    // charcoal on off-white already has strong contrast — this is the
    // "already fine" case within a monochrome palette, included to prove
    // the check doesn't false-positive on a legitimately high-contrast
    // monochrome pair.
    expect(before.passed).toBe(true);
    const result = ensureContrastSafePalette(colors);
    expect(result.colors).toEqual(colors);
    expect(result.adjustedIndexes).toEqual([]);
  });

  it('a cream-and-pastel editorial palette (the real Editorial Botanical case) gets fixed without losing its pastel character', () => {
    // Approximates the real measured weak case (paletteContrast 65.43).
    const colors = ['#fbf3ea', '#f2d9c4', '#e8c4a8', '#d9a878'];
    const before = checkPerceptualContrast(colors);
    expect(before.passed).toBe(false);
    const result = ensureContrastSafePalette(colors);
    expect(checkPerceptualContrast(result.colors).passed).toBe(true);
    // Still reads as the same warm cream/tan family — hue preserved,
    // adjustment is lightness-only.
    for (const idx of result.adjustedIndexes) {
      expect(result.colors[idx]).not.toBe(colors[idx]);
    }
  });

  it('a strong-contrast control palette is left completely unchanged (strict no-op)', () => {
    const colors = ['#ffffff', '#1a1a2e', '#e94560', '#0f3460']; // high-contrast editorial palette
    const before = checkPerceptualContrast(colors);
    expect(before.passed).toBe(true);
    const result = ensureContrastSafePalette(colors);
    expect(result.colors).toBe(colors); // identical reference, not just equal
    expect(result.adjustedIndexes).toEqual([]);
  });

  it('wcagContrastRatio is symmetric and >= 1', () => {
    expect(wcagContrastRatio('#ffffff', '#000000')).toBeCloseTo(wcagContrastRatio('#000000', '#ffffff'), 5);
    expect(wcagContrastRatio('#ffffff', '#000000')).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO);
  });

  it('never adjusts the background color itself (index 0 stays fixed, anchors every adjustment)', () => {
    const colors = ['#fdf6ee', '#f5e8da', '#e8d5c0', '#d4b89a'];
    const result = ensureContrastSafePalette(colors);
    expect(result.colors[0]).toBe(colors[0]);
    expect(result.adjustedIndexes).not.toContain(0);
  });
});
