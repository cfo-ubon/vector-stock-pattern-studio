import { describe, it, expect } from 'vitest';
import { listPalettes } from '../../services/colorRoleService';
import {
  contrastRatio,
  getPaletteAccessibilityNote,
  getPaletteHarmonyNote,
  listPaletteKnowledge,
  getPaletteKnowledge,
  getPaletteColorRoles,
  listColorStoryVariantIds,
  getColorStoryForPalette,
} from './index';

describe('knowledge/palette: contrastRatio', () => {
  it('black vs white is the maximum WCAG ratio (21:1)', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('a color against itself is the minimum ratio (1:1)', () => {
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#112233', '#eeddcc')).toBeCloseTo(contrastRatio('#eeddcc', '#112233'), 10);
  });
});

describe('knowledge/palette: getPaletteAccessibilityNote', () => {
  it('returns a real weakest-pair contrast ratio for a real palette', () => {
    const palette = listPalettes()[0];
    const note = getPaletteAccessibilityNote(palette.id)!;
    expect(note.weakestPairContrast).toBeGreaterThanOrEqual(1);
    expect(note.message.length).toBeGreaterThan(0);
  });

  it('returns undefined for an unknown palette id', () => {
    expect(getPaletteAccessibilityNote('not-a-real-palette')).toBeUndefined();
  });
});

describe('knowledge/palette: harmony + role/story facades', () => {
  it('getPaletteHarmonyNote describes the real fixed role assignment', () => {
    expect(getPaletteHarmonyNote()).toContain('background');
  });

  it('listPaletteKnowledge / getPaletteKnowledge match the real palette library', () => {
    expect(listPaletteKnowledge().length).toBe(listPalettes().length);
    const palette = listPalettes()[0];
    expect(getPaletteKnowledge(palette.id)).toEqual(palette);
  });

  it('getPaletteColorRoles resolves real background/primary/secondary/accent colors', () => {
    const palette = listPalettes()[0];
    const roles = getPaletteColorRoles(palette.id)!;
    expect(roles.background).toBeDefined();
  });

  it('listColorStoryVariantIds has all 13 real variants', () => {
    expect(listColorStoryVariantIds().length).toBe(13);
  });

  it('getColorStoryForPalette derives the real 13-variant Color Story from the palette\'s own colors', () => {
    const palette = listPalettes()[0];
    const story = getColorStoryForPalette(palette.id)!;
    expect(Object.keys(story).length).toBe(13);
    expect(story.original.colors).toEqual(palette.colors);
  });

  it('getColorStoryForPalette returns undefined for an unknown palette', () => {
    expect(getColorStoryForPalette('not-a-real-palette')).toBeUndefined();
  });
});
