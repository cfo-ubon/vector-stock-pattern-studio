import { describe, it, expect } from 'vitest';
import { shouldStop } from './stoppingConditions';
import { DEFAULT_EVOLUTION_CONFIG, type EvolutionConfig } from './types';

function config(overrides: Partial<EvolutionConfig> = {}): EvolutionConfig {
  return { ...DEFAULT_EVOLUTION_CONFIG, ...overrides };
}

describe('shouldStop: maxGenerations', () => {
  it('stops once the next generation index would reach maxGenerations', () => {
    const decision = shouldStop({ generationIndex: 2, bestScore: 10, startedAt: Date.now(), evaluationsUsed: 5 }, config({ maxGenerations: 3 }));
    expect(decision.stop).toBe(true);
    expect(decision.reason).toContain('maximum of 3 generation');
  });

  it('does not stop while generations remain', () => {
    const decision = shouldStop({ generationIndex: 0, bestScore: 10, startedAt: Date.now(), evaluationsUsed: 5 }, config({ maxGenerations: 3 }));
    expect(decision.stop).toBe(false);
  });
});

describe('shouldStop: qualityThreshold', () => {
  it('stops as soon as the best score meets the threshold', () => {
    const decision = shouldStop({ generationIndex: 0, bestScore: 85, startedAt: Date.now(), evaluationsUsed: 1 }, config({ maxGenerations: 10, qualityThreshold: 80 }));
    expect(decision.stop).toBe(true);
    expect(decision.reason).toContain('quality threshold');
  });

  it('does not stop below the threshold', () => {
    const decision = shouldStop({ generationIndex: 0, bestScore: 60, startedAt: Date.now(), evaluationsUsed: 1 }, config({ maxGenerations: 10, qualityThreshold: 80 }));
    expect(decision.stop).toBe(false);
  });

  it('is disabled by default (undefined)', () => {
    const decision = shouldStop({ generationIndex: 0, bestScore: 100, startedAt: Date.now(), evaluationsUsed: 1 }, config({ maxGenerations: 10 }));
    expect(decision.stop).toBe(false);
  });
});

describe('shouldStop: maxDurationMs', () => {
  it('stops once the wall-clock budget is exceeded', () => {
    const decision = shouldStop({ generationIndex: 0, bestScore: 10, startedAt: Date.now() - 5000, evaluationsUsed: 1 }, config({ maxGenerations: 10, maxDurationMs: 1000 }));
    expect(decision.stop).toBe(true);
    expect(decision.reason).toContain('performance budget');
  });

  it('does not stop within budget', () => {
    const decision = shouldStop({ generationIndex: 0, bestScore: 10, startedAt: Date.now(), evaluationsUsed: 1 }, config({ maxGenerations: 10, maxDurationMs: 60000 }));
    expect(decision.stop).toBe(false);
  });
});

describe('shouldStop: maxEvaluations', () => {
  it('stops once the evaluation budget is spent', () => {
    const decision = shouldStop({ generationIndex: 0, bestScore: 10, startedAt: Date.now(), evaluationsUsed: 20 }, config({ maxGenerations: 10, maxEvaluations: 20 }));
    expect(decision.stop).toBe(true);
    expect(decision.reason).toContain('fitness evaluation');
  });

  it('does not stop under budget', () => {
    const decision = shouldStop({ generationIndex: 0, bestScore: 10, startedAt: Date.now(), evaluationsUsed: 5 }, config({ maxGenerations: 10, maxEvaluations: 20 }));
    expect(decision.stop).toBe(false);
  });
});

describe('shouldStop: precedence', () => {
  it('maxGenerations always applies even if every other check is disabled', () => {
    const decision = shouldStop({ generationIndex: 4, bestScore: 0, startedAt: Date.now(), evaluationsUsed: 0 }, config({ maxGenerations: 5 }));
    expect(decision.stop).toBe(true);
  });
});
