import { describe, it, expect, beforeEach } from 'vitest';
import { STYLE_DNA_PRESETS, STYLE_DNA_LIST, resolveStyleDna, exportStyleDnaJson, importStyleDnaJson, isStyleDnaCompatible } from './styleDna';
import { loadCustomStyles, saveCustomStyles } from '../storage/styleDnaStore';
import { PALETTES } from '../palettes/palettes';

// Build 008A, Section 7 (Compatibility) — this build swapped
// `STYLE_DNA_PRESETS`'s SOURCE from a hardcoded object literal to the new
// Knowledge Registry (see engine/styleDna.ts's own comment). Every public
// surface that existed before this migration must behave identically —
// this file asserts exactly that, independent of `knowledge/registry/`'s
// own unit tests (which test the Registry's own new behavior, not
// backward compatibility with the pre-migration public API).

const KNOWN_PRESET_IDS = [
  'editorialBotanical', 'luxuryFloral', 'scandinavianOrganic', 'minimalBotanical', 'vintageHerbarium',
  'darkBotanical', 'modernTropical', 'boutiquePackaging', 'luxuryWallpaper', 'premiumTextile',
  'kidsPlayful', 'retroOrganic', 'organicAbstract', 'bohoFloral', 'softWatercolorInspired',
];

describe('Style DNA registry migration compatibility (Build 008A)', () => {
  it('STYLE_DNA_LIST still has exactly 15 built-in presets', () => {
    expect(STYLE_DNA_LIST.length).toBe(15);
  });

  it('every previously-existing preset id still resolves via STYLE_DNA_PRESETS', () => {
    for (const id of KNOWN_PRESET_IDS) {
      expect(STYLE_DNA_PRESETS[id], `missing preset "${id}"`).toBeDefined();
      expect(STYLE_DNA_PRESETS[id].id).toBe(id);
    }
  });

  it('resolveStyleDna still produces a valid resolved patch for every built-in preset', () => {
    for (const dna of STYLE_DNA_LIST) {
      expect(() => resolveStyleDna(dna, 'compat-seed')).not.toThrow();
      const resolved = resolveStyleDna(dna, 'compat-seed');
      expect(resolved.categoryId).toBeTruthy();
      expect(resolved.paletteId).toBeTruthy();
    }
  });

  it('every built-in preset is still isStyleDnaCompatible against the real registered tables', () => {
    const paletteIds = new Set(PALETTES.map((p) => p.id));
    for (const dna of STYLE_DNA_LIST) {
      expect(isStyleDnaCompatible(dna, { paletteIds }), `${dna.id} failed compatibility check`).toBe(true);
    }
  });

  it('exportStyleDnaJson -> importStyleDnaJson still round-trips a registry-sourced style unchanged', () => {
    const paletteIds = new Set(PALETTES.map((p) => p.id));
    const original = STYLE_DNA_PRESETS.luxuryFloral;
    const json = exportStyleDnaJson(original);
    const imported = importStyleDnaJson(json, { paletteIds });
    expect(imported).not.toBeNull();
    expect(imported!.id).toBe(original.id);
    expect(imported!.density).toBe(original.density);
    expect(imported!.preferredFamilies).toEqual(original.preferredFamilies);
    expect(imported!.exportRecommendation).toEqual(original.exportRecommendation);
  });

  it('the pre-existing public JSON export format (schemaVersion + style) is unchanged', () => {
    const json = exportStyleDnaJson(STYLE_DNA_PRESETS.editorialBotanical);
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.style.id).toBe('editorialBotanical');
  });

  it('storage/styleDnaStore.ts still saves/loads a plain custom StyleDna unaffected by the registry migration', () => {
    localStorage.clear();
    const custom = { ...STYLE_DNA_PRESETS.bohoFloral, id: 'custom-compat-test', label: 'My Custom Style', custom: true as const };
    saveCustomStyles([custom]);
    const loaded = loadCustomStyles();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('custom-compat-test');
    expect(loaded[0].preferredFamilies).toEqual(custom.preferredFamilies);
  });

  beforeEach(() => {
    localStorage.clear();
  });
});
