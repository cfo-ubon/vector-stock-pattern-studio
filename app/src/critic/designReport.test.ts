import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from '../trend/designIntelligence';
import type { KeywordBundle } from '../trend/designSpecTypes';
import { buildTileFromDesignSpec } from '../trend/designSpecToParams';
import { computeMetrics } from '../engine/scoring';
import { runDesignSpecQualityLoop } from '../trend/designSpecQuality';
import { buildDesignReport } from './designReport';

function makeBundle(overrides: Partial<KeywordBundle> = {}): KeywordBundle {
  return {
    primaryKeyword: 'Grid Pattern', secondaryKeywords: [], marketplace: 'adobestock', season: 'spring',
    audience: 'editorial', commercialCategory: 'wallpaper', patternType: 'geometric',
    paletteDirection: '', difficulty: 'moderate', collectionSize: 8, ...overrides,
  };
}

function makeSpec() {
  return buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: undefined, createdAt: 1000 });
}

describe('buildDesignReport', () => {
  it('combines a real critique, visual issues, problems, recommendations, and priority order', () => {
    const spec = { ...makeSpec(), repeatType: 'grid' as const, rhythm: 'regular' as const, flow: 'calm' as const };
    const tile = buildTileFromDesignSpec(spec, 'design-report-1');
    const metrics = computeMetrics(tile);
    const loopResult = runDesignSpecQualityLoop(spec, 'design-report-1', 'fast', 1);

    const report = buildDesignReport(spec, tile, metrics, loopResult.check.report, loopResult.check.meetsTargets);

    expect(report.critique.overall).toBeGreaterThanOrEqual(0);
    expect(report.visualIssues.length).toBe(11);
    expect(Array.isArray(report.problems)).toBe(true);
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(report.priorityOrder.length).toBe(report.recommendations.length);
    expect(report.meetsCommercialBar).toBe(loopResult.check.meetsTargets);
  });

  it('priorityOrder lists every recommendation id exactly once, high priority first', () => {
    const spec = { ...makeSpec(), repeatType: 'grid' as const, rhythm: 'regular' as const, flow: 'calm' as const, density: 0.3 };
    const tile = buildTileFromDesignSpec(spec, 'design-report-2');
    const metrics = computeMetrics(tile);
    const loopResult = runDesignSpecQualityLoop(spec, 'design-report-2', 'fast', 1);
    const report = buildDesignReport(spec, tile, metrics, loopResult.check.report, loopResult.check.meetsTargets);

    expect(new Set(report.priorityOrder)).toEqual(new Set(report.recommendations.map((r) => r.id)));
    const priorityRank = { high: 0, medium: 1, low: 2 };
    const orderedPriorities = report.priorityOrder.map((id) => report.recommendations.find((r) => r.id === id)!.priority);
    for (let i = 1; i < orderedPriorities.length; i++) {
      expect(priorityRank[orderedPriorities[i - 1]]).toBeLessThanOrEqual(priorityRank[orderedPriorities[i]]);
    }
  });

  it('every recommendation has a matching Expected Improvement entry naming a real critique dimension', () => {
    const spec = { ...makeSpec(), repeatType: 'grid' as const, rhythm: 'regular' as const, flow: 'calm' as const };
    const tile = buildTileFromDesignSpec(spec, 'design-report-3');
    const metrics = computeMetrics(tile);
    const loopResult = runDesignSpecQualityLoop(spec, 'design-report-3', 'fast', 1);
    const report = buildDesignReport(spec, tile, metrics, loopResult.check.report, loopResult.check.meetsTargets);

    expect(report.expectedImprovements.length).toBe(report.recommendations.length);
    for (const imp of report.expectedImprovements) {
      expect(report.critique).toHaveProperty(imp.dimension);
      expect(imp.note.length).toBeGreaterThan(0);
    }
  });

  it('passes an explicit styleCoachCategory through to real style coach notes', () => {
    const spec = makeSpec();
    const tile = buildTileFromDesignSpec(spec, 'design-report-4');
    const metrics = computeMetrics(tile);
    const loopResult = runDesignSpecQualityLoop(spec, 'design-report-4', 'fast', 1);
    const report = buildDesignReport(spec, tile, metrics, loopResult.check.report, loopResult.check.meetsTargets, 'minimal');
    for (const note of report.styleCoachNotes) expect(note.category).toBe('minimal');
  });

  it('is deterministic for the same real inputs', () => {
    const spec = makeSpec();
    const tile = buildTileFromDesignSpec(spec, 'design-report-5');
    const metrics = computeMetrics(tile);
    const loopResult = runDesignSpecQualityLoop(spec, 'design-report-5', 'fast', 1);
    const a = buildDesignReport(spec, tile, metrics, loopResult.check.report, loopResult.check.meetsTargets);
    const b = buildDesignReport(spec, tile, metrics, loopResult.check.report, loopResult.check.meetsTargets);
    expect(a).toEqual(b);
  });
});
