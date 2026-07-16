import { describe, it, expect } from 'vitest';
import { validateStyleRecord, STYLE_SCHEMA_VERSION, STYLE_SCHEMA_FIELD_CATEGORIES } from './styleSchema';
import { STYLE_RAW_RECORDS } from './styleData';

const VALID_RECORD = {
  id: 'test-style',
  label: 'Test Style',
  description: 'A style used only in tests.',
  categories: ['botanical'],
  layouts: ['scatter'],
  hierarchyPreset: 'balancedEditorial',
  density: 0.5,
  negativeSpace: 0.2,
  overlapMode: 'subtle',
  overlapAmount: 0.1,
  flowProfile: 'calm',
  rhythmProfile: 'regular',
  clusterStyle: 'none',
  clusterDensity: 0.1,
  motifComplexity: 'simple',
  colorStrategy: 'fullPalette',
  paletteIds: ['pastel-dream'],
  backgroundStrategy: 'minimalLight',
  svgDepthMode: 'flat',
  exportRecommendation: { tileSize: 1200, patternScale: 1, recommendedSites: ['adobestock'] },
};

describe('validateStyleRecord (Build 008A, Section 4/6)', () => {
  it('accepts a fully valid record', () => {
    const result = validateStyleRecord(VALID_RECORD);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('every real style-data JSON record passes validation', () => {
    for (const raw of STYLE_RAW_RECORDS) {
      const result = validateStyleRecord(raw);
      expect(result.valid, `${(raw as { id?: string }).id}: ${JSON.stringify(result.issues)}`).toBe(true);
    }
  });

  it('rejects a non-object record', () => {
    const result = validateStyleRecord('not-an-object');
    expect(result.valid).toBe(false);
    expect(result.issues[0].field).toBe('(root)');
  });

  it('rejects a record missing a required string field, with a readable message', () => {
    const { id: _id, ...withoutId } = VALID_RECORD;
    const result = validateStyleRecord(withoutId);
    expect(result.valid).toBe(false);
    const idIssue = result.issues.find((i) => i.field === 'id');
    expect(idIssue).toBeDefined();
    expect(idIssue!.message).toMatch(/missing or empty required string field "id"/i);
  });

  it('rejects a record missing a required number field', () => {
    const { density: _density, ...withoutDensity } = VALID_RECORD;
    const result = validateStyleRecord(withoutDensity);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === 'density')).toBe(true);
  });

  it('rejects a record with an empty required array field', () => {
    const result = validateStyleRecord({ ...VALID_RECORD, categories: [] });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === 'categories')).toBe(true);
  });

  it('rejects an out-of-enum value with a readable message listing valid options', () => {
    const result = validateStyleRecord({ ...VALID_RECORD, flowProfile: 'chaotic' });
    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.field === 'flowProfile');
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('calm');
    expect(issue!.message).toContain('chaotic');
  });

  it('rejects a malformed exportRecommendation', () => {
    const result = validateStyleRecord({ ...VALID_RECORD, exportRecommendation: { tileSize: 'big' } });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === 'exportRecommendation.tileSize')).toBe(true);
    expect(result.issues.some((i) => i.field === 'exportRecommendation.recommendedSites')).toBe(true);
  });

  it('STYLE_SCHEMA_VERSION is a real semver-ish string matching schema_version.json', async () => {
    const schemaVersionJson = await import('../schema_version.json');
    expect(STYLE_SCHEMA_VERSION).toBe(schemaVersionJson.styleSchema);
  });

  it('every field category lists at least one field, and categories are disjoint', () => {
    const seen = new Set<string>();
    for (const fields of Object.values(STYLE_SCHEMA_FIELD_CATEGORIES)) {
      expect(fields.length).toBeGreaterThan(0);
      for (const f of fields) {
        expect(seen.has(f), `field "${f}" appears in more than one category`).toBe(false);
        seen.add(f);
      }
    }
  });
});
