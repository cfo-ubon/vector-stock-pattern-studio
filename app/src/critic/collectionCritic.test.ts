import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { generateCollection } from '../collection/collectionGenerator';
import { computeCollectionScore } from '../collection/collectionScore';
import { critiqueCollection } from './collectionCritic';

describe('critiqueCollection', () => {
  it('maps every real CollectionScore dimension onto the brief-named checklist', () => {
    const collection = generateCollection({ ...defaultParams(), seed: 'collection-critic-1' });
    const score = computeCollectionScore(collection);
    const critique = critiqueCollection(collection);

    expect(critique.palette).toBe(score.paletteConsistency);
    expect(critique.motifs).toBe(score.motifConsistency);
    expect(critique.layouts).toBe(score.layoutDiversity);
    expect(critique.variation).toBe(score.motifShapeDiversity);
    expect(critique.commercialReadiness).toBe(score.commercialReadiness);
    expect(critique.overall).toBe(score.overall);
    expect(critique.raw).toEqual(score);
  });

  it('visualIdentity is the documented average of style/palette/motif consistency, not a fabricated new metric', () => {
    const collection = generateCollection({ ...defaultParams(), seed: 'collection-critic-2' });
    const score = computeCollectionScore(collection);
    const critique = critiqueCollection(collection);
    expect(critique.visualIdentity).toBe(Math.round((score.styleConsistency + score.paletteConsistency + score.motifConsistency) / 3));
  });

  it('preserves the real (Thai) issue strings verbatim, never translated or reworded', () => {
    const collection = generateCollection({ ...defaultParams(), seed: 'collection-critic-3' });
    const score = computeCollectionScore(collection);
    const critique = critiqueCollection(collection);
    expect(critique.issues.map((i) => i.message)).toEqual(score.issues);
  });

  it('is deterministic for the same collection', () => {
    const collection = generateCollection({ ...defaultParams(), seed: 'collection-critic-4' });
    expect(critiqueCollection(collection)).toEqual(critiqueCollection(collection));
  });
});
