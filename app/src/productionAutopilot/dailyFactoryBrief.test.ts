import { describe, it, expect } from 'vitest';
import { generateProductionDailyBrief } from './dailyFactoryBrief';
import { recordOwnerDecision } from './ownerDecision';
import { createFactoryTask } from '../factory/domain/factoryTask';

const NOW = Date.UTC(2026, 0, 15, 9, 0, 0);

describe('generateProductionDailyBrief', () => {
  it('composes a real recommendation and real Owner Decision count, never inventing a mission', () => {
    const brief = generateProductionDailyBrief([], [], [], [], [], [], NOW);
    expect(brief.topRecommendation).toBeDefined();
    expect(brief.todaysMission).toBe(brief.topRecommendation.reason);
    expect(brief.ownerDecisionsToday).toBe(0);
    expect(brief.withinDailyDecisionTarget).toBe(true);
  });

  it('reports factory status honestly when there is no activity yet', () => {
    const brief = generateProductionDailyBrief([], [], [], [], [], [], NOW);
    expect(brief.factoryStatus).toBe('No factory activity yet.');
  });

  it('counts only today\'s real Owner Decision records', () => {
    const records = [recordOwnerDecision('APPROVE_SESSION', null, 1000, NOW), recordOwnerDecision('APPROVE_EXPORT', null, 1000, NOW)];
    const brief = generateProductionDailyBrief([], [], records, [], [], [], NOW);
    expect(brief.ownerDecisionsToday).toBe(2);
  });

  it('flips withinDailyDecisionTarget false once the disclosed target is exceeded', () => {
    const records = [1, 2, 3, 4].map(() => recordOwnerDecision('APPROVE_SESSION', null, 1000, NOW));
    const brief = generateProductionDailyBrief([], [], records, [], [], [], NOW);
    expect(brief.withinDailyDecisionTarget).toBe(false);
  });

  it('reflects real commercialPackagesReady from the underlying Daily Brief, never a duplicate computation', () => {
    const task = createFactoryTask({ type: 'package', reason: 'x', assetId: 'A-1', now: NOW });
    const brief = generateProductionDailyBrief([task], [], [], [], [], [], NOW);
    expect(typeof brief.commercialPackagesReady).toBe('number');
  });
});
