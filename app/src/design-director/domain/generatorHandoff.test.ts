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
});
