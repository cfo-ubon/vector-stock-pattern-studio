import { describe, it, expect } from 'vitest';
import { recommendProductionAction } from './productionRecommendation';
import { runPreflightValidation } from './preflightValidation';
import { createFactoryTask } from '../factory/domain/factoryTask';

const NOW = 1_700_000_000_000;

describe('recommendProductionAction', () => {
  it('recommends CONTINUE_PREVIOUS_BATCH when a batch has active tasks', () => {
    const task = createFactoryTask({ type: 'seo', reason: 'x', assetId: 'A-1', batchId: 'B-1', now: NOW });
    const preflight = runPreflightValidation([task], [], [], [], NOW);
    const rec = recommendProductionAction([task], preflight, NOW);
    expect(rec.action).toBe('CONTINUE_PREVIOUS_BATCH');
    expect(rec.sourceTaskIds).toContain(task.id);
  });

  it('recommends REPAIR before SEO when both are READY, matching Decision OS priority order', () => {
    const repair = createFactoryTask({ type: 'repair', reason: 'x', assetId: 'A-1', now: NOW });
    const seo = createFactoryTask({ type: 'seo', reason: 'x', assetId: 'A-2', now: NOW });
    const preflight = runPreflightValidation([repair, seo], [], [], [], NOW);
    const rec = recommendProductionAction([repair, seo], preflight, NOW);
    expect(rec.action).toBe('REPAIR');
  });

  it('never recommends GENERATE unless Decision OS shouldGenerate is true', () => {
    const preflight = { ...runPreflightValidation([], [], [], [], NOW), shouldGenerate: false, generateBlockedReason: 'blocked for test' };
    const rec = recommendProductionAction([], preflight, NOW);
    expect(rec.action).not.toBe('GENERATE');
  });

  it('recommends GENERATE only as the final fallback, carrying the real decisionTrace', () => {
    const preflight = runPreflightValidation([], [], [], [], NOW);
    const rec = recommendProductionAction([], preflight, NOW);
    expect(rec.action).toBe('GENERATE');
    expect(rec.decisionTrace).toBe(preflight.decisionTrace);
  });

  it('attaches no fabricated evidence for the empty/no-work case', () => {
    const preflight = { ...runPreflightValidation([], [], [], [], NOW), shouldGenerate: false, generateBlockedReason: null };
    const rec = recommendProductionAction([], preflight, NOW);
    expect(rec.evidence).toEqual([]);
  });
});
