import { describe, it, expect } from 'vitest';
import { defaultParams } from './defaults';
import { buildTile } from './tile';
import { serialize } from './svgAst';
import { PALETTES } from '../palettes/palettes';
import {
  STYLE_DNA_PRESETS,
  STYLE_DNA_LIST,
  resolveStyleDna,
  computeStyleDrift,
  resetToStyleDna,
  isStyleDnaCompatible,
  exportStyleDnaJson,
  importStyleDnaJson,
  deriveStyleDnaFromParams,
  duplicateStyleDna,
  computeStyleDnaConsistency,
  STYLE_DNA_SCHEMA_VERSION,
  type StyleDna,
} from './styleDna';

const PALETTE_IDS = new Set(PALETTES.map((p) => p.id));

describe('Style DNA: loading', () => {
  it('at least 15 built-in presets are registered', () => {
    expect(STYLE_DNA_LIST.length).toBeGreaterThanOrEqual(15);
  });

  it('every preset resolves to a buildable tile without throwing', () => {
    for (const dna of STYLE_DNA_LIST) {
      const patch = resolveStyleDna(dna, 'style-load-check');
      expect(() => buildTile({ ...defaultParams(), ...patch, seed: 'style-load-check' })).not.toThrow();
    }
  });

  it('every preset is internally compatible with the currently-registered engine tables', () => {
    for (const dna of STYLE_DNA_LIST) {
      expect(isStyleDnaCompatible(dna, { paletteIds: PALETTE_IDS })).toBe(true);
    }
  });

  it('resolving the same style + seed twice is fully deterministic', () => {
    const dna = STYLE_DNA_PRESETS.editorialBotanical;
    const a = resolveStyleDna(dna, 'determinism-check');
    const b = resolveStyleDna(dna, 'determinism-check');
    expect(a).toEqual(b);
  });

  it('a different seed can pick a different family member for a multi-entry style (not fixed to the first entry)', () => {
    const dna = STYLE_DNA_PRESETS.modernTropical; // 2 layouts, 2 palettes
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const patch = resolveStyleDna(dna, `variety-${i}`);
      seen.add(`${patch.layoutId}::${patch.paletteId}`);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('applying a style writes styleDnaId onto the resolved params for round-tripping', () => {
    const dna = STYLE_DNA_PRESETS.darkBotanical;
    const patch = resolveStyleDna(dna, 'roundtrip-check');
    expect(patch.styleDnaId).toBe('darkBotanical');
  });

  it('changing style visibly changes the generated SVG (not cosmetic-only)', () => {
    const a = resolveStyleDna(STYLE_DNA_PRESETS.minimalBotanical, 'visible-diff');
    const b = resolveStyleDna(STYLE_DNA_PRESETS.luxuryWallpaper, 'visible-diff');
    const svgA = serialize(buildTile({ ...defaultParams(), ...a, seed: 'visible-diff' }).svg);
    const svgB = serialize(buildTile({ ...defaultParams(), ...b, seed: 'visible-diff' }).svg);
    expect(svgA).not.toBe(svgB);
  });
});

describe('Style DNA: Composition Intelligence V2 wiring (Build 001)', () => {
  it('resolves a real flowProfile/flowBiasStrength pair for every preset (Section 5)', () => {
    for (const dna of STYLE_DNA_LIST) {
      const patch = resolveStyleDna(dna, 'ci-v2-flow-check');
      expect(patch.compositionIntelligence!.flowProfile).toBe(dna.flowProfile);
      expect(patch.compositionIntelligence!.flowBiasStrength).toBeGreaterThanOrEqual(0);
      if (dna.flowProfile !== 'calm') expect(patch.compositionIntelligence!.flowBiasStrength).toBeGreaterThan(0);
    }
  });

  it('resolves a real, positive attractionStrength for every preset (Section 8)', () => {
    for (const dna of STYLE_DNA_LIST) {
      const patch = resolveStyleDna(dna, 'ci-v2-attraction-check');
      expect(patch.compositionIntelligence!.attractionStrength).toBeGreaterThan(0);
    }
  });

  it('a tighter/bouquet cluster style resolves stronger attraction than none', () => {
    const none = { ...STYLE_DNA_PRESETS.editorialBotanical, clusterStyle: 'none' as const, clusterDensity: 0.3 };
    const bouquet = { ...STYLE_DNA_PRESETS.editorialBotanical, clusterStyle: 'bouquet' as const, clusterDensity: 0.3 };
    const noneStrength = resolveStyleDna(none, 'attraction-compare').compositionIntelligence!.attractionStrength!;
    const bouquetStrength = resolveStyleDna(bouquet, 'attraction-compare').compositionIntelligence!.attractionStrength!;
    expect(bouquetStrength).toBeGreaterThan(noneStrength);
  });

  it('resolves negativeSpaceStrength that increases with the style\'s own negativeSpace field', () => {
    const airy = { ...STYLE_DNA_PRESETS.editorialBotanical, negativeSpace: 0.8 };
    const dense = { ...STYLE_DNA_PRESETS.editorialBotanical, negativeSpace: 0.1 };
    const airyStrength = resolveStyleDna(airy, 'negspace-compare').compositionIntelligence!.negativeSpaceStrength!;
    const denseStrength = resolveStyleDna(dense, 'negspace-compare').compositionIntelligence!.negativeSpaceStrength!;
    expect(airyStrength).toBeGreaterThan(denseStrength);
  });

  it('every preset still resolves to a buildable tile with the new fields active', () => {
    for (const dna of STYLE_DNA_LIST) {
      const patch = resolveStyleDna(dna, 'ci-v2-build-check');
      expect(() => buildTile({ ...defaultParams(), ...patch, seed: 'ci-v2-build-check' })).not.toThrow();
    }
  });
});

describe('Style DNA: migration / backward compatibility', () => {
  it('a params object with no styleDnaId (pre-v1.30 shape) still builds fine', () => {
    const legacy = { ...defaultParams(), seed: 'style-migration' };
    delete (legacy as { styleDnaId?: string }).styleDnaId;
    expect(() => buildTile(legacy)).not.toThrow();
  });

  it('computeStyleDrift does not throw on a pre-v1.30-shaped params object', () => {
    const legacy = { ...defaultParams(), seed: 'style-migration-drift' };
    delete (legacy as { styleDnaId?: string }).styleDnaId;
    expect(() => computeStyleDrift(legacy, STYLE_DNA_PRESETS.editorialBotanical)).not.toThrow();
  });
});

describe('Style DNA: overrides / drift', () => {
  it('reports no drift immediately after applying a style', () => {
    const dna = STYLE_DNA_PRESETS.scandinavianOrganic;
    const patch = resolveStyleDna(dna, 'no-drift-check');
    const params = { ...defaultParams(), ...patch, seed: 'no-drift-check' };
    expect(computeStyleDrift(params, dna)).toEqual([]);
  });

  it('reports drift on exactly the fields the user hand-edited', () => {
    const dna = STYLE_DNA_PRESETS.scandinavianOrganic;
    const patch = resolveStyleDna(dna, 'drift-check');
    const edited = { ...defaultParams(), ...patch, seed: 'drift-check', density: 0.9, negativeSpace: 0.05 };
    const drift = computeStyleDrift(edited, dna);
    const fields = drift.map((d) => d.field).sort();
    expect(fields).toEqual(['density', 'negativeSpace']);
  });
});

describe('Style DNA: reset', () => {
  it('"Reset to Style" discards hand-edits and matches a fresh resolve exactly', () => {
    const dna = STYLE_DNA_PRESETS.kidsPlayful;
    const reset = resetToStyleDna(dna, 'reset-check');
    const fresh = resolveStyleDna(dna, 'reset-check');
    expect(reset).toEqual(fresh);
  });
});

describe('Style DNA: export / import', () => {
  it('exports valid JSON carrying the schema version and full style data', () => {
    const json = exportStyleDnaJson(STYLE_DNA_PRESETS.bohoFloral);
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe(STYLE_DNA_SCHEMA_VERSION);
    expect(parsed.style.id).toBe('bohoFloral');
  });

  it('imports a valid exported style and marks it custom', () => {
    const json = exportStyleDnaJson(STYLE_DNA_PRESETS.retroOrganic);
    const imported = importStyleDnaJson(json, { paletteIds: PALETTE_IDS });
    expect(imported).not.toBeNull();
    expect(imported!.id).toBe('retroOrganic');
    expect(imported!.custom).toBe(true);
  });

  it('round-trips a style through export -> import to an equivalent resolver output', () => {
    const original = STYLE_DNA_PRESETS.premiumTextile;
    const imported = importStyleDnaJson(exportStyleDnaJson(original), { paletteIds: PALETTE_IDS })!;
    const originalPatch = resolveStyleDna(original, 'roundtrip-resolve');
    const importedPatch = resolveStyleDna(imported, 'roundtrip-resolve');
    expect(importedPatch).toEqual(originalPatch);
  });

  it('returns null for malformed JSON instead of throwing', () => {
    expect(importStyleDnaJson('{not valid json', { paletteIds: PALETTE_IDS })).toBeNull();
  });

  it('returns null for a style missing required fields', () => {
    expect(importStyleDnaJson(JSON.stringify({ style: { id: 'x' } }), { paletteIds: PALETTE_IDS })).toBeNull();
  });
});

describe('Style DNA: create / duplicate custom styles', () => {
  it('deriveStyleDnaFromParams captures the current settings as a new, compatible custom style', () => {
    const patch = resolveStyleDna(STYLE_DNA_PRESETS.luxuryFloral, 'derive-check');
    const params = { ...defaultParams(), ...patch, seed: 'derive-check' };
    const derived = deriveStyleDnaFromParams(params, 'My Custom Style');
    expect(derived.custom).toBe(true);
    expect(derived.label).toBe('My Custom Style');
    expect(derived.id).not.toBe('luxuryFloral');
    expect(isStyleDnaCompatible(derived, { paletteIds: PALETTE_IDS })).toBe(true);
  });

  it('deriving from params twice produces two distinct ids', () => {
    const params = { ...defaultParams(), seed: 'derive-unique' };
    const a = deriveStyleDnaFromParams(params, 'A');
    const b = deriveStyleDnaFromParams(params, 'B');
    expect(a.id).not.toBe(b.id);
  });

  it('duplicateStyleDna copies a built-in preset into an independent custom style', () => {
    const dup = duplicateStyleDna(STYLE_DNA_PRESETS.editorialBotanical, 'Editorial Botanical (copy)');
    expect(dup.custom).toBe(true);
    expect(dup.id).not.toBe('editorialBotanical');
    expect(dup.label).toBe('Editorial Botanical (copy)');
    expect(dup.categories).toEqual(STYLE_DNA_PRESETS.editorialBotanical.categories);
    expect(isStyleDnaCompatible(dup, { paletteIds: PALETTE_IDS })).toBe(true);
  });
});

describe('Style DNA: computeStyleDnaConsistency (Section 12 enforcement)', () => {
  it('scores 100 when measured geometry exactly matches the style declared intent', () => {
    const dna = STYLE_DNA_PRESETS.scandinavianOrganic; // density 0.32, motifComplexity 'simple' -> expected rotationDiversity 30
    const score = computeStyleDnaConsistency({ occupancyRatio: 32, rotationDiversity: 30 }, dna);
    expect(score).toBe(100);
  });

  it('penalizes a density that reads far denser than the style declares', () => {
    const dna = STYLE_DNA_PRESETS.scandinavianOrganic; // density 0.32
    const onTarget = computeStyleDnaConsistency({ occupancyRatio: 32, rotationDiversity: 30 }, dna);
    const offTarget = computeStyleDnaConsistency({ occupancyRatio: 90, rotationDiversity: 30 }, dna);
    expect(offTarget).toBeLessThan(onTarget);
  });

  it('penalizes rotation diversity that does not match the declared motif complexity', () => {
    const simple = STYLE_DNA_PRESETS.scandinavianOrganic; // simple -> expects ~30
    const onTarget = computeStyleDnaConsistency({ occupancyRatio: 32, rotationDiversity: 30 }, simple);
    const offTarget = computeStyleDnaConsistency({ occupancyRatio: 32, rotationDiversity: 90 }, simple);
    expect(offTarget).toBeLessThan(onTarget);
  });

  it('expects higher rotation diversity for intricate styles than simple styles', () => {
    const intricate = STYLE_DNA_PRESETS.luxuryFloral; // motifComplexity 'intricate' -> expects ~80
    const simple = STYLE_DNA_PRESETS.scandinavianOrganic; // motifComplexity 'simple' -> expects ~30
    // The same measured rotationDiversity of 80 should read as consistent for
    // the intricate style but inconsistent for the simple one.
    const intricateScore = computeStyleDnaConsistency({ occupancyRatio: intricate.density * 100, rotationDiversity: 80 }, intricate);
    const simpleScore = computeStyleDnaConsistency({ occupancyRatio: simple.density * 100, rotationDiversity: 80 }, simple);
    expect(intricateScore).toBeGreaterThan(simpleScore);
  });

  it('clamps to 0 rather than going negative for wildly out-of-range measurements', () => {
    const dna = STYLE_DNA_PRESETS.minimalBotanical; // density 0.3, simple -> expects ~30
    const score = computeStyleDnaConsistency({ occupancyRatio: 100, rotationDiversity: 100 }, dna);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThan(50);
  });

  it('is a pure function of its inputs (no hidden randomness)', () => {
    const dna = STYLE_DNA_PRESETS.darkBotanical;
    const a = computeStyleDnaConsistency({ occupancyRatio: 55, rotationDiversity: 60 }, dna);
    const b = computeStyleDnaConsistency({ occupancyRatio: 55, rotationDiversity: 60 }, dna);
    expect(a).toBe(b);
  });
});

describe('Style DNA: compatibility', () => {
  it('rejects a style referencing a category id that does not exist', () => {
    const bad: StyleDna = { ...STYLE_DNA_PRESETS.editorialBotanical, categories: ['not-a-real-category'] };
    expect(isStyleDnaCompatible(bad, { paletteIds: PALETTE_IDS })).toBe(false);
  });

  it('rejects a style referencing a palette id that does not exist', () => {
    const bad: StyleDna = { ...STYLE_DNA_PRESETS.editorialBotanical, paletteIds: ['not-a-real-palette'] };
    expect(isStyleDnaCompatible(bad, { paletteIds: PALETTE_IDS })).toBe(false);
  });

  it('rejects a style with an empty categories/layouts/palettes list', () => {
    const bad: StyleDna = { ...STYLE_DNA_PRESETS.editorialBotanical, categories: [] };
    expect(isStyleDnaCompatible(bad, { paletteIds: PALETTE_IDS })).toBe(false);
  });
});
