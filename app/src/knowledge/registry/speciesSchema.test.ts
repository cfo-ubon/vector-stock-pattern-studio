import { describe, it, expect } from 'vitest';
import { validateSpeciesRecord, SPECIES_SCHEMA_VERSION } from './speciesSchema';
import { SPECIES_RAW_RECORDS } from './speciesData';

const VALID_RECORD = {
  id: 'rose',
  label: 'Rose',
  botanicalFamilyName: 'Rosaceae',
  silhouette: 'layered',
  growthPreset: 'leafyBranch',
  stemLengthScale: 1,
  leafDensityScale: 0.9,
  bouquetRole: 'statement',
  flowerDiameterClass: 'large',
  bloomStageRange: [0.55, 1],
  petalCountRange: [25, 40],
  petalArrangement: 'layered',
  petalOverlap: 'heavy',
  petalSilhouette: 'cupped',
  petalEdgeStyle: 'smooth',
  centerStructure: 'disc',
  sepalStructure: 'star',
  stemThickness: 'medium',
  branchingTendency: 'sparse',
  leafType: 'serrated',
  veinType: 'pinnate',
  naturalColorFamilies: ['red', 'pink', 'white'],
  premiumScore: 92,
  eleganceScore: 95,
  commercialPopularity: 98,
  companions: [
    { family: 'eucalyptus', role: 'foliage', strength: 0.9 },
    { family: 'babysBreath', role: 'filler', strength: 0.85 },
  ],
  usageProfiles: ['luxuryFloral', 'wedding'],
};

describe('validateSpeciesRecord (Build 008B, Section 1)', () => {
  it('accepts a fully valid record', () => {
    const result = validateSpeciesRecord(VALID_RECORD);
    expect(result.valid, JSON.stringify(result.issues)).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('every real species-data JSON record passes validation', () => {
    for (const raw of SPECIES_RAW_RECORDS) {
      const result = validateSpeciesRecord(raw);
      expect(result.valid, `${(raw as { id?: string }).id}: ${JSON.stringify(result.issues)}`).toBe(true);
    }
  });

  it('rejects a non-object record', () => {
    const result = validateSpeciesRecord('not-an-object');
    expect(result.valid).toBe(false);
    expect(result.issues[0].field).toBe('(root)');
  });

  it('rejects a record missing a required string field, with a readable message', () => {
    const { botanicalFamilyName: _b, ...withoutFamilyName } = VALID_RECORD;
    const result = validateSpeciesRecord(withoutFamilyName);
    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.field === 'botanicalFamilyName');
    expect(issue).toBeDefined();
    expect(issue!.message).toMatch(/missing or empty required string field "botanicalFamilyName"/i);
  });

  it('rejects a record missing a required number field', () => {
    const { premiumScore: _p, ...withoutScore } = VALID_RECORD;
    const result = validateSpeciesRecord(withoutScore);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === 'premiumScore')).toBe(true);
  });

  it('rejects a score field outside [0, 100]', () => {
    const result = validateSpeciesRecord({ ...VALID_RECORD, eleganceScore: 150 });
    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.field === 'eleganceScore');
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('[0, 100]');
  });

  it('rejects a malformed bloomStageRange (min > max)', () => {
    const result = validateSpeciesRecord({ ...VALID_RECORD, bloomStageRange: [1, 0.5] });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === 'bloomStageRange')).toBe(true);
  });

  it('rejects a malformed petalCountRange (wrong length)', () => {
    const result = validateSpeciesRecord({ ...VALID_RECORD, petalCountRange: [5] });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === 'petalCountRange')).toBe(true);
  });

  it('rejects an empty naturalColorFamilies for a blooming (non-foliageOnly) species', () => {
    const result = validateSpeciesRecord({ ...VALID_RECORD, naturalColorFamilies: [] });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === 'naturalColorFamilies')).toBe(true);
  });

  it('allows an empty naturalColorFamilies for a foliageOnly species', () => {
    const result = validateSpeciesRecord({ ...VALID_RECORD, bouquetRole: 'foliageOnly', naturalColorFamilies: [] });
    expect(result.valid).toBe(true);
  });

  it('rejects an empty usageProfiles array', () => {
    const result = validateSpeciesRecord({ ...VALID_RECORD, usageProfiles: [] });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === 'usageProfiles')).toBe(true);
  });

  it('rejects a companions entry with an invalid role', () => {
    const result = validateSpeciesRecord({
      ...VALID_RECORD,
      companions: [{ family: 'eucalyptus', role: 'notARealRole', strength: 0.5 }],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === 'companions[0].role')).toBe(true);
  });

  it('rejects a companions entry with a strength outside [0, 1]', () => {
    const result = validateSpeciesRecord({
      ...VALID_RECORD,
      companions: [{ family: 'eucalyptus', role: 'foliage', strength: 1.5 }],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.field === 'companions[0].strength')).toBe(true);
  });

  it('accepts an empty companions array (a species with no curated pairing)', () => {
    const result = validateSpeciesRecord({ ...VALID_RECORD, companions: [] });
    expect(result.valid).toBe(true);
  });

  it('SPECIES_SCHEMA_VERSION is a real semver-ish string matching schema_version.json', async () => {
    const schemaVersionJson = await import('../schema_version.json');
    expect(SPECIES_SCHEMA_VERSION).toBe(schemaVersionJson.speciesSchema);
  });
});
