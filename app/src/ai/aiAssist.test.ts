import { describe, it, expect } from 'vitest';
import { parseAiJson } from './aiAssist';

describe('parseAiJson: backward compatibility (pre-v1.23 schema)', () => {
  it('parses an old-format response with none of the v2 fields', () => {
    const legacy = JSON.stringify([
      {
        concept: 'Autumn botanical',
        category: 'botanical',
        layout: 'grid',
        palette: 'earth-tone',
        density: 0.5,
        motifSize: 80,
        seed: 'abc123',
      },
    ]);
    const result = parseAiJson(legacy);
    expect(result.error).toBeUndefined();
    expect(result.patches).toHaveLength(1);
    expect(result.patches[0].categoryId).toBe('botanical');
    expect(result.patches[0].hierarchy).toBeUndefined();
    expect(result.patches[0].negativeSpace).toBeUndefined();
  });

  it('tolerates markdown code fences around the JSON', () => {
    const fenced = '```json\n[{"category": "geometric", "layout": "grid", "seed": "x"}]\n```';
    const result = parseAiJson(fenced);
    expect(result.error).toBeUndefined();
    expect(result.patches).toHaveLength(1);
  });
});

describe('parseAiJson: schema v2 fields', () => {
  it('resolves a named artDirection preset to a full hierarchy bundle', () => {
    const json = JSON.stringify([{ category: 'botanical', layout: 'grid', artDirection: 'luxuryFloral', seed: 'x' }]);
    const result = parseAiJson(json);
    expect(result.patches[0].artDirection).toBe('luxuryFloral');
    expect(result.patches[0].hierarchy).toBeDefined();
    expect(result.patches[0].hierarchy!.heroRatio).toBeGreaterThan(0);
  });

  it('validates and clamps a manual hierarchy object', () => {
    const json = JSON.stringify([
      { category: 'botanical', layout: 'grid', hierarchy: { heroRatio: 999, heroScale: -5 }, seed: 'x' },
    ]);
    const result = parseAiJson(json);
    const h = result.patches[0].hierarchy!;
    expect(h.heroRatio).toBeLessThanOrEqual(0.4);
    expect(h.heroScale).toBeGreaterThanOrEqual(0.8);
  });

  it('ignores an unknown artDirection id instead of crashing', () => {
    const json = JSON.stringify([{ category: 'botanical', layout: 'grid', artDirection: 'not-a-real-preset', seed: 'x' }]);
    const result = parseAiJson(json);
    expect(result.error).toBeUndefined();
    expect(result.patches[0].artDirection).toBeUndefined();
  });

  it('clamps negativeSpace and overlapAmount to [0,1]', () => {
    const json = JSON.stringify([{ category: 'botanical', layout: 'grid', negativeSpace: 5, overlapAmount: -2, seed: 'x' }]);
    const result = parseAiJson(json);
    expect(result.patches[0].negativeSpace).toBe(1);
    expect(result.patches[0].overlapAmount).toBe(0);
  });

  it('ignores unrelated unknown fields safely', () => {
    const json = JSON.stringify([{ category: 'botanical', layout: 'grid', someFutureField: { nested: true }, seed: 'x' }]);
    const result = parseAiJson(json);
    expect(result.error).toBeUndefined();
    expect(result.patches).toHaveLength(1);
  });
});

describe('parseAiJson: error handling', () => {
  it('reports a Thai error message for unparseable text', () => {
    const result = parseAiJson('this is not json at all {{{');
    expect(result.error).toBeDefined();
    expect(result.patches).toHaveLength(0);
  });

  it('reports a Thai error message when nothing usable is found', () => {
    const result = parseAiJson('[{"unrelated": true}]');
    expect(result.error).toBeDefined();
  });
});
