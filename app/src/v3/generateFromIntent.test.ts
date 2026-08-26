import { describe, it, expect } from 'vitest';
import { generateConcepts } from './generateFromIntent';
import { analyzeKeyword } from './keywordIntent';

describe('generateConcepts (real generation, no mocks)', () => {
  it('generates the requested number of concepts with distinct labels and layouts', () => {
    const intent = analyzeKeyword('minimal botanical leaves');
    const concepts = generateConcepts(intent, 5);
    expect(concepts).toHaveLength(5);
    const labels = new Set(concepts.map((c) => c.label));
    expect(labels.size).toBe(5);
    const layouts = new Set(concepts.map((c) => c.params.layoutId));
    expect(layouts.size).toBeGreaterThan(1); // meaningfully different compositions, not just seed jitter
  });

  it('every concept produces real TileData with a non-empty SVG tree', () => {
    const intent = analyzeKeyword('japanese geometric');
    const concepts = generateConcepts(intent, 2);
    for (const concept of concepts) {
      // TileData.svg's root node is the content group ('g') — the outer
      // <svg> wrapper is added by exporters/preview builders, not stored
      // on TileData itself (confirmed via buildPreviewMarkup's own
      // contract, which likewise emits no outer <svg> tag).
      expect(concept.tileData.svg.tag).toBe('g');
      expect(concept.tileData.svg.children?.length).toBeGreaterThan(0);
    }
  });

  it('real generated output passes the Vector Integrity Gate (engine only emits allowed primitives)', () => {
    const intent = analyzeKeyword('luxury abstract leaves');
    const concepts = generateConcepts(intent, 3);
    for (const concept of concepts) {
      expect(concept.vectorIntegrity.status).toBe('VECTOR_PASS');
      expect(concept.vectorIntegrity.issues).toEqual([]);
      expect(concept.vectorIntegrity.nodeCount).toBeGreaterThan(0);
    }
  });

  it('seamless gate reports a real, computed cornerContinuity value (not the hardcoded seamlessIntegrity=100)', () => {
    const intent = analyzeKeyword('boho rainbow nursery');
    const concepts = generateConcepts(intent, 2);
    for (const concept of concepts) {
      expect(typeof concept.seamlessIntegrity.cornerContinuity).toBe('number');
      expect(concept.seamlessIntegrity.cornerContinuity).toBeGreaterThanOrEqual(0);
      expect(concept.seamlessIntegrity.cornerContinuity).toBeLessThanOrEqual(100);
    }
  });

  it('produces real 1x1 and 3x3 repeat preview markup (a <pattern> def + a sized <rect>, per buildPreviewMarkup\'s real contract) that differ by repeat size', () => {
    const intent = analyzeKeyword('christmas candy');
    const [concept] = generateConcepts(intent, 1);
    expect(concept.seamlessIntegrity.tilePreviewMarkup1x1).toContain('<pattern');
    expect(concept.seamlessIntegrity.tilePreviewMarkup1x1).toMatch(/<rect [^>]*width="1200"/);
    expect(concept.seamlessIntegrity.repeatPreviewMarkup3x3).toContain('<pattern');
    expect(concept.seamlessIntegrity.repeatPreviewMarkup3x3).toMatch(/<rect [^>]*width="3600"/);
  });

  it('overallReady is true only when both gates pass, never fabricated', () => {
    const intent = analyzeKeyword('cute dinosaur kids');
    const concepts = generateConcepts(intent, 3);
    for (const concept of concepts) {
      const expected = concept.vectorIntegrity.status === 'VECTOR_PASS' && concept.seamlessIntegrity.status === 'SEAMLESS_PASS';
      expect(concept.overallReady).toBe(expected);
    }
  });

  it('is deterministic for the same keyword (same derived seeds -> same layout sequence)', () => {
    const intentA = analyzeKeyword('minimal botanical leaves');
    const intentB = analyzeKeyword('minimal botanical leaves');
    const conceptsA = generateConcepts(intentA, 3);
    const conceptsB = generateConcepts(intentB, 3);
    expect(conceptsA.map((c) => c.params.seed)).toEqual(conceptsB.map((c) => c.params.seed));
  });

  it('respects intent.density: a "minimal" keyword yields lower density params than a "dense" one, on average', () => {
    const sparse = analyzeKeyword('minimal simple pattern');
    const dense = analyzeKeyword('dense busy rich pattern');
    const sparseConcepts = generateConcepts(sparse, 5);
    const denseConcepts = generateConcepts(dense, 5);
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    expect(avg(sparseConcepts.map((c) => c.params.density))).toBeLessThan(avg(denseConcepts.map((c) => c.params.density)));
  });
});
