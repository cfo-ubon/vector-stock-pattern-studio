import { describe, expect, it } from 'vitest';
import { buildPortfolioBaseline } from './baseline';
import { STYLE_SCHEMA_VERSION } from '../knowledge/registry/styleSchema';
import { SPECIES_SCHEMA_VERSION } from '../knowledge/registry/speciesSchema';
import { PENALTY_SYSTEM_VERSION } from '../engine/penaltyRulesV2';

describe('buildPortfolioBaseline', () => {
  it('pins the real schema/penalty versions, not placeholders', () => {
    const baseline = buildPortfolioBaseline('p13', 'p13-<styleId>-<n>', 1, { commit: 'abc123' });
    expect(baseline.styleSchemaVersion).toBe(STYLE_SCHEMA_VERSION);
    expect(baseline.speciesSchemaVersion).toBe(SPECIES_SCHEMA_VERSION);
    expect(baseline.penaltySystemVersion).toBe(PENALTY_SYSTEM_VERSION);
    expect(baseline.portfolioSchemaVersion).toBe(1);
  });

  it('records the injected commit for both evaluator and generator, never reading git itself', () => {
    const baseline = buildPortfolioBaseline('p13', 'desc', 1, { commit: 'deadbeef' });
    expect(baseline.evaluatorCommit).toBe('deadbeef');
    expect(baseline.generatorCommit).toBe('deadbeef');
  });

  it('defaults commit to "unknown" when none is supplied, never guessing', () => {
    const baseline = buildPortfolioBaseline('p13', 'desc', 1);
    expect(baseline.evaluatorCommit).toBe('unknown');
  });

  it('records the exact seed policy the caller documents', () => {
    const baseline = buildPortfolioBaseline('cr', 'cr-<n>, deterministic', 1);
    expect(baseline.seedPolicy).toEqual({ prefix: 'cr', description: 'cr-<n>, deterministic' });
  });

  it('stamps a real, parseable ISO timestamp', () => {
    const baseline = buildPortfolioBaseline('p13', 'desc', 1);
    expect(() => new Date(baseline.capturedAt).toISOString()).not.toThrow();
  });
});
