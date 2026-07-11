import { describe, it, expect } from 'vitest';
import { STYLE_DNA_DATA } from '../style-dna';
import { MOTIF_GRAMMAR_DATA } from '../motif-grammar';
import { PATTERN_GRAMMAR_DATA } from '../pattern-grammar';
import { PALETTE_DATA } from '../color-roles';
import { MARKETPLACE_DATA } from '../marketplaces';
import { validateAllKnowledge, isAllKnowledgeValid, validateKnowledgeRelationships, isKnowledgeRelationshipsValid } from './validation';

// Design Knowledge Engine (Phase 6.5) — Section 12/13 "Validation"/
// "Tests: ... Performance". These tests exercise the two real checks
// against the app's actual committed knowledge data (not fixtures), so a
// future edit to any knowledge JSON file that breaks its own schema or
// dangles a cross-domain reference fails here.

describe('validateAllKnowledge', () => {
  it('covers one entry per real record across every knowledge domain', () => {
    const results = validateAllKnowledge();
    const expectedCount =
      STYLE_DNA_DATA.length +
      MOTIF_GRAMMAR_DATA.length +
      PATTERN_GRAMMAR_DATA.length +
      1 /* colorRoleSystem */ +
      PALETTE_DATA.length +
      MARKETPLACE_DATA.length +
      1 /* rejectRules */ +
      1 /* defaultLearningHistory */;
    expect(results.length).toBe(expectedCount);
  });

  it('every real committed knowledge file is schema-valid', () => {
    const results = validateAllKnowledge();
    const failures = results.filter((r) => r.issues.length > 0);
    expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
  });

  it('isAllKnowledgeValid is true for the real committed data', () => {
    expect(isAllKnowledgeValid()).toBe(true);
  });
});

describe('validateKnowledgeRelationships', () => {
  it('every real cross-domain reference in the knowledge base resolves', () => {
    const results = validateKnowledgeRelationships();
    const failures = results.filter((r) => r.issues.length > 0);
    expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
  });

  it('isKnowledgeRelationshipsValid is true for the real committed data', () => {
    expect(isKnowledgeRelationshipsValid()).toBe(true);
  });

  it('flags a Style DNA that references a palette id which does not exist', () => {
    const fakeStyleDna = { ...STYLE_DNA_DATA[0], id: '__fake_style_for_test__', paletteIds: ['not-a-real-palette'] };
    const originalLength = STYLE_DNA_DATA.length;
    STYLE_DNA_DATA.push(fakeStyleDna);
    try {
      const results = validateKnowledgeRelationships();
      const entry = results.find((r) => r.id === '__fake_style_for_test__');
      expect(entry).toBeDefined();
      expect(entry!.issues.length).toBeGreaterThan(0);
      expect(entry!.issues[0].message).toContain('not-a-real-palette');
    } finally {
      STYLE_DNA_DATA.length = originalLength;
    }
  });
});

describe('knowledge validation: performance', () => {
  it('validates the entire knowledge base (schema + relationships) in well under 200ms', () => {
    const start = performance.now();
    validateAllKnowledge();
    validateKnowledgeRelationships();
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });

  it('is stable in output across repeated runs (deterministic, no hidden mutation)', () => {
    const first = validateAllKnowledge();
    const second = validateAllKnowledge();
    expect(first).toEqual(second);
  });
});
