import { describe, it, expect } from 'vitest';
import { BOTANICAL_SPECIES, BOTANICAL_FAMILIES } from './botanicalFamilies';
import { illustrationTemplateForSpecies, ILLUSTRATION_TEMPLATES } from './illustrationFamily';

describe('illustrationTemplateForSpecies (Build 005, Section 5)', () => {
  it('falls back to the bouquet template when no species is given (unchanged Build 004 Section 8 behavior)', () => {
    expect(illustrationTemplateForSpecies(undefined)).toBe(ILLUSTRATION_TEMPLATES.bouquet);
  });

  it('foliage-only species get the branch template (no flower/bud/berry parts)', () => {
    for (const family of ['eucalyptus', 'olive', 'fern', 'herb', 'tropicalLeaf'] as const) {
      const template = illustrationTemplateForSpecies(BOTANICAL_SPECIES[family]);
      expect(template.id).toBe('branch');
      expect(template.heroPart).not.toBe('heroFlower');
      expect(template.fillerPart).not.toBe('berry');
    }
  });

  it('filler-role species get the spray template with no calyx', () => {
    for (const family of ['cosmos', 'wildflower', 'daisy', 'lavender'] as const) {
      const template = illustrationTemplateForSpecies(BOTANICAL_SPECIES[family]);
      expect(template.id).toBe('spray');
      expect(template.usesCalyx).toBe(false);
    }
  });

  it('statement/supporting species get the bouquet template with a calyx', () => {
    for (const family of ['rose', 'peony', 'ranunculus', 'protea', 'magnolia', 'hydrangea'] as const) {
      const template = illustrationTemplateForSpecies(BOTANICAL_SPECIES[family]);
      expect(template.id).toBe('bouquet');
      expect(template.usesCalyx).toBe(true);
    }
  });

  it('every one of the 18 real families resolves to exactly one of the 3 named templates', () => {
    for (const family of BOTANICAL_FAMILIES) {
      const template = illustrationTemplateForSpecies(BOTANICAL_SPECIES[family]);
      expect(['bouquet', 'spray', 'branch']).toContain(template.id);
    }
  });

  it('every template declares a real fillerLeafPart (Build 008B, Section 3: Commercial Bouquet Grammar)', () => {
    for (const template of Object.values(ILLUSTRATION_TEMPLATES)) {
      expect(template.fillerLeafPart).toBeTruthy();
    }
  });
});
