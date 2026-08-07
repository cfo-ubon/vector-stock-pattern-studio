import { describe, it, expect } from 'vitest';
import { computeBusinessOutcomeScore } from './businessOutcomeScore';
import { createFactoryTask, transitionFactoryTask } from '../factory/domain/factoryTask';

describe('computeBusinessOutcomeScore', () => {
  it('is explainable — every component reports its raw value, weight, and contribution', () => {
    let pkg = createFactoryTask({ type: 'package', reason: 'x', assetId: 'A-1', now: 1000 });
    pkg = transitionFactoryTask(transitionFactoryTask(pkg, 'RUNNING', 1500), 'COMPLETED', 2000);
    const result = computeBusinessOutcomeScore([pkg], [], 3000);
    expect(result.score).not.toBeNull();
    const throughput = result.components.find((c) => c.name === 'commercialThroughput')!;
    expect(throughput.value).toBe(100);
    expect(throughput.weight).toBe(0.1);
    expect(throughput.contribution).not.toBeNull();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('re-normalizes weights over available components rather than silently zeroing out missing ones', () => {
    // On a fully empty queue, `commercialThroughput` (0 packages — a real,
    // verified fact, not an estimate) is the only component with real
    // data; every other component (factoryEfficiency, commercialReadiness,
    // automation, ownerTime, queueHealth, blockedRatio) is genuinely
    // `null` (not enough data). The score is computed from the one real
    // component only — the missing components are excluded, not
    // defaulted to 0, and the score is never `null` while at least one
    // real component exists.
    const result = computeBusinessOutcomeScore([], [], 1000);
    const throughput = result.components.find((c) => c.name === 'commercialThroughput')!;
    expect(throughput.value).toBe(0);
    const others = result.components.filter((c) => c.name !== 'commercialThroughput');
    expect(others.every((c) => c.value === null && c.contribution === null)).toBe(true);
    expect(result.score).toBe(0);
    expect(result.explanation[0]).toContain('1 of 7 components');
  });

  it('reports the components list unchanged in shape regardless of data availability', () => {
    const result = computeBusinessOutcomeScore([], [], 1000);
    expect(result.components).toHaveLength(7);
    expect(result.components.map((c) => c.name).sort()).toEqual(['automation', 'blockedRatio', 'commercialReadiness', 'commercialThroughput', 'factoryEfficiency', 'ownerTime', 'queueHealth'].sort());
  });
});
