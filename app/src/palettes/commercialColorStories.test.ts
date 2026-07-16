import { describe, it, expect } from 'vitest';
import { COMMERCIAL_COLOR_STORIES, COMMERCIAL_COLOR_STORY_IDS, getCommercialColorStory } from './commercialColorStories';
import { PALETTES, getPalette } from './palettes';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const EXPECTED_IDS = [
  'french-vintage', 'luxury-wedding', 'scandinavian-calm', 'muted-autumn',
  'desert-botanical', 'english-garden', 'soft-cottage', 'dark-floral',
];

describe('Commercial Color Story Engine (Build 006, Section 4)', () => {
  it('defines exactly the 8 named professional color stories the brief asks for', () => {
    expect(COMMERCIAL_COLOR_STORY_IDS.sort()).toEqual([...EXPECTED_IDS].sort());
  });

  it('every story has real, valid hex colors', () => {
    for (const story of COMMERCIAL_COLOR_STORIES) {
      expect(story.colors.length).toBeGreaterThanOrEqual(4);
      for (const c of story.colors) expect(c).toMatch(HEX_RE);
    }
  });

  it('accentColors is always a real, non-empty subset of colors', () => {
    for (const story of COMMERCIAL_COLOR_STORIES) {
      expect(story.accentColors.length).toBeGreaterThan(0);
      for (const c of story.accentColors) expect(story.colors).toContain(c);
    }
  });

  it('contrast/temperature/neutralBalance are valid, real computed values', () => {
    for (const story of COMMERCIAL_COLOR_STORIES) {
      expect(['low', 'medium', 'high']).toContain(story.contrast);
      expect(['warm', 'cool', 'neutral']).toContain(story.temperature);
      expect(story.neutralBalance).toBeGreaterThanOrEqual(0);
      expect(story.neutralBalance).toBeLessThanOrEqual(1);
    }
  });

  it('dark-floral genuinely reads as high contrast (real spread between its lightest and darkest color)', () => {
    const darkFloral = getCommercialColorStory('dark-floral')!;
    expect(darkFloral.contrast).toBe('high');
  });

  it('scandinavian-calm genuinely reads as low/medium contrast and cool/neutral (its own real, muted colors)', () => {
    const scandi = getCommercialColorStory('scandinavian-calm')!;
    expect(['low', 'medium']).toContain(scandi.contrast);
    expect(['cool', 'neutral']).toContain(scandi.temperature);
  });

  it('getCommercialColorStory returns undefined for an unknown id', () => {
    expect(getCommercialColorStory('not-a-real-story')).toBeUndefined();
  });

  it('every story is also registered as a real, resolvable Palette (so paletteIds can reference it)', () => {
    for (const story of COMMERCIAL_COLOR_STORIES) {
      const palette = getPalette(story.id);
      expect(palette.id).toBe(story.id);
      expect(palette.colors).toEqual(story.colors);
      expect(PALETTES.some((p) => p.id === story.id)).toBe(true);
    }
  });
});
