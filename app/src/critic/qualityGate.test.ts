import { describe, it, expect } from 'vitest';
import { checkQualityGate } from './qualityGate';
import type { DesignReport } from './designReport';

function fakeReport(overrides: Partial<DesignReport> = {}): DesignReport {
  return {
    critique: {
      composition: 90, hierarchy: 90, balance: 90, rhythm: 90, flow: 90, clusterQuality: 90,
      negativeSpace: 90, overlap: 90, repeatQuality: 90, motifDiversity: 90, commercialReadiness: 90, overall: 90,
    },
    visualIssues: [],
    problems: [],
    recommendations: [],
    expectedImprovements: [],
    priorityOrder: [],
    styleCoachNotes: [],
    meetsCommercialBar: true,
    readability: { thumbnail200: 90, thumbnail400: 90, zoom800: 90, readableAtAllScales: true },
    commercialValidation: {
      commercialScore: 90, commercialReadiness: 90, premiumFeeling: 90, luxuryFeeling: 90,
      editorialFeeling: 90, wallpaperScore: 90, fabricScore: 90, giftWrapScore: 90,
    },
    ...overrides,
  };
}

describe('checkQualityGate', () => {
  it('passes a healthy report with no problems and a met commercial bar', () => {
    const result = checkQualityGate(fakeReport());
    expect(result.passed).toBe(true);
    expect(result.blockingProblems).toEqual([]);
  });

  it('fails when the spec\'s own quality targets are not met, even with a high overall score', () => {
    const result = checkQualityGate(fakeReport({ meetsCommercialBar: false }));
    expect(result.passed).toBe(false);
    expect(result.message).toContain('quality targets');
  });

  it('fails when at least one high-severity problem is present, even if the commercial bar is met', () => {
    const report = fakeReport({ problems: [{ id: 'gridAppearance', label: 'reads as a grid', points: 20, severity: 'high' }] });
    const result = checkQualityGate(report);
    expect(result.passed).toBe(false);
    expect(result.blockingProblems).toHaveLength(1);
    expect(result.message).toContain('high-severity');
  });

  it('does not block on a medium or low severity problem alone', () => {
    const report = fakeReport({ problems: [{ id: 'lowPaletteContrast', label: 'muddy palette', points: 5, severity: 'low' }] });
    const result = checkQualityGate(report);
    expect(result.passed).toBe(true);
    expect(result.blockingProblems).toEqual([]);
  });

  it('fails when the overall score is below the commercial floor even with no named problems', () => {
    const report = fakeReport({ critique: { ...fakeReport().critique, overall: 20 } });
    const result = checkQualityGate(report);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('commercial floor');
  });

  it('meetsCommercialBar on the result mirrors the report\'s own field', () => {
    expect(checkQualityGate(fakeReport({ meetsCommercialBar: false })).meetsCommercialBar).toBe(false);
    expect(checkQualityGate(fakeReport({ meetsCommercialBar: true })).meetsCommercialBar).toBe(true);
  });
});
