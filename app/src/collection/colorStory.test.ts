import { describe, it, expect } from 'vitest';
import { hexToHsl } from '../palettes/colorTransform';
import { buildColorStory, COLOR_STORY_VARIANT_IDS } from './colorStory';

const BASE_COLORS = ['#FFF6EC', '#FFD6E0', '#C9E4DE', '#C6DEF1', '#FBE4C8', '#DBCDF0'];

describe('buildColorStory', () => {
  it('produces exactly the 10 named variants', () => {
    const story = buildColorStory(BASE_COLORS);
    expect(Object.keys(story).sort()).toEqual([...COLOR_STORY_VARIANT_IDS].sort());
  });

  it('every variant keeps the same color count as the input', () => {
    const story = buildColorStory(BASE_COLORS);
    for (const id of COLOR_STORY_VARIANT_IDS) {
      expect(story[id].colors.length).toBe(BASE_COLORS.length);
    }
  });

  it('"original" is a passthrough of the input colors', () => {
    const story = buildColorStory(BASE_COLORS);
    expect(story.original.colors).toEqual(BASE_COLORS);
  });

  it('is deterministic for the same input', () => {
    const a = buildColorStory(BASE_COLORS);
    const b = buildColorStory(BASE_COLORS);
    expect(a).toEqual(b);
  });

  it('"light" is measurably lighter than "dark" across every color', () => {
    const story = buildColorStory(BASE_COLORS);
    for (let i = 0; i < BASE_COLORS.length; i++) {
      const lightL = hexToHsl(story.light.colors[i]).l;
      const darkL = hexToHsl(story.dark.colors[i]).l;
      expect(lightL).toBeGreaterThan(darkL);
    }
  });

  it('"bold" is measurably more saturated than "muted" across every color', () => {
    const story = buildColorStory(BASE_COLORS);
    for (let i = 0; i < BASE_COLORS.length; i++) {
      const boldS = hexToHsl(story.bold.colors[i]).s;
      const mutedS = hexToHsl(story.muted.colors[i]).s;
      expect(boldS).toBeGreaterThan(mutedS);
    }
  });

  it('"monochrome" collapses every color onto the same hue', () => {
    const story = buildColorStory(BASE_COLORS);
    const hues = story.monochrome.colors.map((c) => hexToHsl(c).h);
    // Every color should share (within rounding) the same hue — low-
    // saturation source colors (e.g. near-white) are numerically less
    // stable to recover an exact hue from after an 8-bit RGB round-trip,
    // so the tolerance is a few degrees rather than 1.
    for (const h of hues) {
      expect(Math.abs(h - hues[0])).toBeLessThanOrEqual(4);
    }
  });

  it('"monochrome" still preserves a light-to-dark ramp (not flattened to one lightness)', () => {
    const story = buildColorStory(BASE_COLORS);
    const lightnesses = story.monochrome.colors.map((c) => hexToHsl(c).l);
    expect(new Set(lightnesses).size).toBeGreaterThan(1);
  });

  it('seasonal variants (spring/summer/autumn/winter) each differ from each other and from original', () => {
    const story = buildColorStory(BASE_COLORS);
    const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;
    const serialized = seasons.map((s) => story[s].colors.join(','));
    expect(new Set(serialized).size).toBe(seasons.length);
    for (const s of seasons) {
      expect(story[s].colors.join(',')).not.toBe(story.original.colors.join(','));
    }
  });

  it('the background color (index 0) is transformed too, not left untouched, for a genuinely dark background in "dark"', () => {
    const story = buildColorStory(BASE_COLORS);
    const originalBgL = hexToHsl(BASE_COLORS[0]).l;
    const darkBgL = hexToHsl(story.dark.colors[0]).l;
    expect(darkBgL).toBeLessThan(originalBgL);
  });

  it('falls back to a safe default instead of throwing on an empty color array', () => {
    expect(() => buildColorStory([])).not.toThrow();
    const story = buildColorStory([]);
    expect(story.original.colors.length).toBeGreaterThan(0);
  });

  it('works correctly with a minimal 2-color palette', () => {
    const story = buildColorStory(['#FFFFFF', '#111111']);
    expect(story.light.colors.length).toBe(2);
    expect(story.monochrome.colors.length).toBe(2);
  });
});
