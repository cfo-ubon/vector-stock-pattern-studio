import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeRegistry } from './knowledgeRegistry';
import { BOTANICAL_FAMILIES, BOTANICAL_SPECIES } from '../../generators/botanicalFamilies';
import { STYLE_RAW_RECORDS } from './styleData';

describe('KnowledgeRegistry (Build 008A, Section 2)', () => {
  beforeEach(() => {
    KnowledgeRegistry._resetCacheForTests();
  });

  it('getStyle resolves a known built-in style id to a real record', () => {
    const style = KnowledgeRegistry.getStyle('luxuryFloral');
    expect(style).toBeDefined();
    expect(style!.label).toBe('Luxury Floral');
    expect(style!.premiumHero).toBe(true);
    expect(style!.preferredFamilies).toContain('rose');
  });

  it('getStyle returns undefined for an unknown id, never throws', () => {
    expect(KnowledgeRegistry.getStyle('not-a-real-style-id')).toBeUndefined();
  });

  it('list("style") returns exactly one entry per real style-data record', () => {
    const list = KnowledgeRegistry.list('style');
    expect(list.length).toBe(STYLE_RAW_RECORDS.length);
    const ids = new Set(list.map((s) => s.id));
    expect(ids.size).toBe(list.length);
  });

  it('list("style") preserves the data file\'s own declared order', () => {
    const list = KnowledgeRegistry.list('style');
    const expectedIds = STYLE_RAW_RECORDS.map((r) => (r as { id: string }).id);
    expect(list.map((s) => s.id)).toEqual(expectedIds);
  });

  it('getSpecies resolves every real botanical family to its real profile (Build 004/005/007 data, unmigrated but exposed)', () => {
    for (const family of BOTANICAL_FAMILIES) {
      const species = KnowledgeRegistry.getSpecies(family);
      expect(species).toEqual(BOTANICAL_SPECIES[family]);
    }
  });

  it('list("species") returns one entry per real botanical family', () => {
    expect(KnowledgeRegistry.list('species').length).toBe(BOTANICAL_FAMILIES.length);
  });

  it('validate() reports valid:true and no issues for the real, shipped data', () => {
    const result = KnowledgeRegistry.validate();
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('diagnostics() reports real, consistent counts and version info', () => {
    const diag = KnowledgeRegistry.diagnostics();
    expect(diag.styleCount).toBe(STYLE_RAW_RECORDS.length);
    expect(diag.speciesCount).toBe(BOTANICAL_FAMILIES.length);
    expect(diag.declaredVersion.knowledgeVersion).toBe('1.0');
    expect(diag.implementedStyleSchemaVersion).toBe(diag.declaredVersion.styleSchema);
    expect(diag.lastLoadedAt).toBeGreaterThan(0);
  });

  it('caches the style load: two getStyle calls return the exact same object reference', () => {
    const a = KnowledgeRegistry.getStyle('editorialBotanical');
    const b = KnowledgeRegistry.getStyle('editorialBotanical');
    expect(a).toBe(b);
  });

  it('diagnostics() lastLoadedAt only changes across an explicit cache reset', () => {
    const first = KnowledgeRegistry.diagnostics().lastLoadedAt;
    const second = KnowledgeRegistry.diagnostics().lastLoadedAt;
    expect(second).toBe(first);
    KnowledgeRegistry._resetCacheForTests();
    const third = KnowledgeRegistry.diagnostics().lastLoadedAt;
    expect(third).toBeGreaterThanOrEqual(first);
  });
});
