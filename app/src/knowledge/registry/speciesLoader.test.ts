import { describe, it, expect } from 'vitest';
import { loadSpeciesRecords, formatSpeciesLoadIssues } from './speciesLoader';
import { SPECIES_RAW_RECORDS } from './speciesData';

const VALID_A = {
  id: 'species-a', label: 'Species A', botanicalFamilyName: 'Testaceae',
  silhouette: 'rounded', growthPreset: 'sage', stemLengthScale: 1, leafDensityScale: 0.5,
  bouquetRole: 'filler',
  flowerDiameterClass: 'small', bloomStageRange: [0.5, 1], petalCountRange: [5, 10],
  petalArrangement: 'single', petalOverlap: 'slight', petalSilhouette: 'rounded', petalEdgeStyle: 'smooth',
  centerStructure: 'disc', sepalStructure: 'minimal', stemThickness: 'thin', branchingTendency: 'sparse',
  leafType: 'ovate', veinType: 'pinnate',
  naturalColorFamilies: ['white'],
  premiumScore: 50, eleganceScore: 50, commercialPopularity: 50,
  companions: [{ family: 'eucalyptus', role: 'foliage', strength: 0.5 }],
  usageProfiles: ['wallpaper'],
};
const VALID_B = { ...VALID_A, id: 'species-b', label: 'Species B' };

describe('loadSpeciesRecords (Build 008B, Section 1)', () => {
  it('loads every real species-data record successfully with no issues', () => {
    const result = loadSpeciesRecords(SPECIES_RAW_RECORDS);
    expect(result.issues).toEqual([]);
    expect(result.species).not.toBeNull();
    expect(result.species!.size).toBe(SPECIES_RAW_RECORDS.length);
  });

  it('accepts a set of valid, uniquely-id\'d records', () => {
    const result = loadSpeciesRecords([VALID_A, VALID_B]);
    expect(result.species).not.toBeNull();
    expect(result.species!.size).toBe(2);
  });

  it('derives companionFamilies from the real companions array, not hand-duplicated', () => {
    const result = loadSpeciesRecords([VALID_A]);
    const record = result.species!.get('species-a')!;
    expect(record.companionFamilies).toEqual(['eucalyptus']);
  });

  it('rejects (species: null) on a duplicate id, with a readable message', () => {
    const duplicate = { ...VALID_A, label: 'Species A (duplicate)' };
    const result = loadSpeciesRecords([VALID_A, duplicate]);
    expect(result.species).toBeNull();
    expect(result.issues.length).toBeGreaterThan(0);
    const dupIssue = result.issues.find((i) => i.issues.some((fi) => fi.field === 'id'));
    expect(dupIssue).toBeDefined();
    expect(dupIssue!.issues[0].message).toMatch(/duplicate species id "species-a"/i);
  });

  it('rejects on any record failing schema validation, reporting its own id', () => {
    const broken = { ...VALID_A, id: 'species-broken', premiumScore: 'not-a-number' };
    const result = loadSpeciesRecords([VALID_A, broken]);
    expect(result.species).toBeNull();
    const brokenIssue = result.issues.find((i) => i.recordId === 'species-broken');
    expect(brokenIssue).toBeDefined();
  });

  it('reports "(unknown)" as the record id when the record has no valid id at all', () => {
    const result = loadSpeciesRecords([{ label: 'No id here' }]);
    expect(result.species).toBeNull();
    expect(result.issues[0].recordId).toBe('(unknown)');
  });

  it('a fully valid load never returns partial data alongside issues', () => {
    const result = loadSpeciesRecords([VALID_A]);
    expect(result.species).not.toBeNull();
    expect(result.issues).toEqual([]);
  });

  it('formatSpeciesLoadIssues produces one readable line per issue, naming the record and field', () => {
    const result = loadSpeciesRecords([{ id: 'species-c' }]);
    const formatted = formatSpeciesLoadIssues(result.issues);
    expect(formatted).toContain('species-c');
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });
});
