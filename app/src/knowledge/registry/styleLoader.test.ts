import { describe, it, expect } from 'vitest';
import { loadStyleRecords, formatStyleLoadIssues } from './styleLoader';
import { STYLE_RAW_RECORDS } from './styleData';

const VALID_A = {
  id: 'style-a', label: 'Style A', description: 'First test style.',
  categories: ['botanical'], layouts: ['scatter'], hierarchyPreset: 'balancedEditorial',
  density: 0.5, negativeSpace: 0.2, overlapMode: 'subtle', overlapAmount: 0.1,
  flowProfile: 'calm', rhythmProfile: 'regular', clusterStyle: 'none', clusterDensity: 0.1,
  motifComplexity: 'simple', colorStrategy: 'fullPalette', paletteIds: ['pastel-dream'],
  backgroundStrategy: 'minimalLight', svgDepthMode: 'flat',
  exportRecommendation: { tileSize: 1200, patternScale: 1, recommendedSites: ['adobestock'] },
};
const VALID_B = { ...VALID_A, id: 'style-b', label: 'Style B' };

describe('loadStyleRecords (Build 008A, Section 5/6)', () => {
  it('loads every real style-data record successfully with no issues', () => {
    const result = loadStyleRecords(STYLE_RAW_RECORDS);
    expect(result.issues).toEqual([]);
    expect(result.styles).not.toBeNull();
    expect(result.styles!.size).toBe(STYLE_RAW_RECORDS.length);
  });

  it('accepts a set of valid, uniquely-id\'d records', () => {
    const result = loadStyleRecords([VALID_A, VALID_B]);
    expect(result.styles).not.toBeNull();
    expect(result.styles!.size).toBe(2);
    expect(result.styles!.get('style-a')).toEqual(VALID_A);
  });

  it('rejects (styles: null) on a duplicate id, with a readable message', () => {
    const duplicate = { ...VALID_A, label: 'Style A (duplicate)' };
    const result = loadStyleRecords([VALID_A, duplicate]);
    expect(result.styles).toBeNull();
    expect(result.issues.length).toBeGreaterThan(0);
    const dupIssue = result.issues.find((i) => i.issues.some((fi) => fi.field === 'id'));
    expect(dupIssue).toBeDefined();
    expect(dupIssue!.issues[0].message).toMatch(/duplicate style id "style-a"/i);
  });

  it('rejects on any record failing schema validation, reporting its own id', () => {
    const broken = { ...VALID_A, id: 'style-broken', density: 'not-a-number' };
    const result = loadStyleRecords([VALID_A, broken]);
    expect(result.styles).toBeNull();
    const brokenIssue = result.issues.find((i) => i.recordId === 'style-broken');
    expect(brokenIssue).toBeDefined();
  });

  it('reports "(unknown)" as the record id when the record has no valid id at all', () => {
    const result = loadStyleRecords([{ label: 'No id here' }]);
    expect(result.styles).toBeNull();
    expect(result.issues[0].recordId).toBe('(unknown)');
  });

  it('a fully valid load never returns partial data alongside issues', () => {
    const result = loadStyleRecords([VALID_A]);
    expect(result.styles).not.toBeNull();
    expect(result.issues).toEqual([]);
  });

  it('formatStyleLoadIssues produces one readable line per issue, naming the record and field', () => {
    const result = loadStyleRecords([{ id: 'style-c' }]);
    const formatted = formatStyleLoadIssues(result.issues);
    expect(formatted).toContain('style-c');
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });
});
