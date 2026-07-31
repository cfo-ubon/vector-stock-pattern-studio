import { describe, it, expect } from 'vitest';
import { createGeneratorHandoff, isValidGeneratorHandoff, InvalidGeneratorHandoffInputError } from './generatorHandoff';

describe('createGeneratorHandoff', () => {
  it('creates a well-shaped handoff with sensible defaults', () => {
    const handoff = createGeneratorHandoff({ briefId: 'BRF-1', collectionPlanId: 'CPLAN-1', heroMotif: 'Tulip bouquet', categoryId: 'botanical', now: 1000 });
    expect(handoff.patternType).toBe('hero');
    expect(handoff.scale).toBe('medium');
    expect(handoff.seedStrategy).toBe('collection-CPLAN-1');
    expect(isValidGeneratorHandoff(handoff)).toBe(true);
  });

  it('rejects an empty collectionPlanId', () => {
    expect(() => createGeneratorHandoff({ briefId: 'BRF-1', collectionPlanId: '', heroMotif: 'x', categoryId: 'botanical' })).toThrow(InvalidGeneratorHandoffInputError);
  });

  // Build 028C, requirement #9 — collectionItemId support.
  it('defaults collectionItemId to null when not provided', () => {
    const handoff = createGeneratorHandoff({ briefId: 'BRF-1', collectionPlanId: 'CPLAN-1', heroMotif: 'Tulip', categoryId: 'botanical', now: 1 });
    expect(handoff.collectionItemId).toBeNull();
  });

  it('preserves a real collectionItemId when one is provided', () => {
    const handoff = createGeneratorHandoff({
      briefId: 'BRF-1',
      collectionPlanId: 'CPLAN-1',
      collectionItemId: 'CITEM-20260101-AAAAAA',
      heroMotif: 'Tulip',
      categoryId: 'botanical',
      now: 1,
    });
    expect(handoff.collectionItemId).toBe('CITEM-20260101-AAAAAA');
    expect(isValidGeneratorHandoff(handoff)).toBe(true);
  });
});
