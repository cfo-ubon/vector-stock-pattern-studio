import { describe, it, expect } from 'vitest';
import { generateCollection } from './generateFromIntent';
import { analyzeKeyword } from './keywordIntent';
import { checkCollectionSimilarity } from './similarityCheck';

describe('generateCollection (Milestone 19 — Collection Mode)', () => {
  it('generates the requested collection size', () => {
    const intent = analyzeKeyword('minimal botanical');
    const collection = generateCollection(intent, 10);
    expect(collection).toHaveLength(10);
  });

  it('shares design language: every item resolves the same category/style from the intent', () => {
    const intent = analyzeKeyword('minimal botanical');
    const collection = generateCollection(intent, 10);
    const categoryIds = new Set(collection.map((c) => c.params.categoryId));
    expect(categoryIds.size).toBe(1);
    if (intent.styleDnaId) {
      const styleDnaIds = new Set(collection.map((c) => c.params.styleDnaId));
      expect(styleDnaIds.size).toBe(1);
    }
  });

  it('differs in composition/scale: not every item has the same layoutId+motifSize combination', () => {
    const intent = analyzeKeyword('minimal botanical');
    const collection = generateCollection(intent, 10);
    const combos = new Set(collection.map((c) => `${c.params.layoutId}-${Math.round(c.params.motifSize)}`));
    expect(combos.size).toBeGreaterThan(1);
  });

  it('runs both mandatory gates on every collection item, never assuming pass', () => {
    const intent = analyzeKeyword('christmas candy');
    const collection = generateCollection(intent, 10);
    for (const concept of collection) {
      expect(['VECTOR_PASS', 'VECTOR_BLOCKED']).toContain(concept.vectorIntegrity.status);
      expect(['SEAMLESS_PASS', 'SEAMLESS_BLOCKED']).toContain(concept.seamlessIntegrity.status);
    }
  });

  it('is deterministic for the same keyword', () => {
    const intentA = analyzeKeyword('japanese geometric');
    const intentB = analyzeKeyword('japanese geometric');
    const collectionA = generateCollection(intentA, 10);
    const collectionB = generateCollection(intentB, 10);
    expect(collectionA.map((c) => c.params.seed)).toEqual(collectionB.map((c) => c.params.seed));
  });
});

describe('checkCollectionSimilarity (Milestone 20 — Duplicate/Similarity Safety)', () => {
  it('flags zero pairs as too-similar for a real, meaningfully diverse 10-item collection', async () => {
    const intent = analyzeKeyword('minimal botanical');
    const collection = generateCollection(intent, 10);
    const warnings = await checkCollectionSimilarity(collection);
    const tooSimilar = warnings.filter((w) => w.kind === 'TOO_SIMILAR');
    // Real assertion, not a tautology: the 5 real archetypes x 2 distinct
    // scale multipliers should all differ enough in layout+scale to avoid
    // tripping the tolerance — if this ever fails, it's real evidence the
    // diversity engine produced two visually-indistinguishable items.
    expect(tooSimilar.length).toBe(0);
  });

  it('flags an exact duplicate when two concepts share identical params', async () => {
    const intent = analyzeKeyword('christmas candy');
    const [concept] = generateCollection(intent, 1);
    const warnings = await checkCollectionSimilarity([concept, { ...concept, id: 'clone-of-first' }]);
    expect(warnings.some((w) => w.kind === 'EXACT_DUPLICATE')).toBe(true);
  });

  it('never flags two concepts with genuinely different layouts, even with similar density', async () => {
    const intent = analyzeKeyword('luxury abstract leaves');
    const collection = generateCollection(intent, 5); // one full cycle, all different layoutIds
    const warnings = await checkCollectionSimilarity(collection);
    expect(warnings.filter((w) => w.kind === 'TOO_SIMILAR').length).toBe(0);
  });
});
