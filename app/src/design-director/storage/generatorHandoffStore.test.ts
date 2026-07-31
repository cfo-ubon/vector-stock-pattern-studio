import { describe, it, expect, beforeEach } from 'vitest';
import { createGeneratorHandoff } from '../domain/generatorHandoff';
import { loadGeneratorHandoffs, getGeneratorHandoff, putGeneratorHandoff, deleteGeneratorHandoff, clearGeneratorHandoffs } from './generatorHandoffStore';

beforeEach(async () => {
  await clearGeneratorHandoffs();
});

function makeHandoff() {
  return createGeneratorHandoff({ briefId: 'BRF-1', collectionPlanId: 'CPLAN-1', heroMotif: 'Tulip bouquet', categoryId: 'botanical', now: 1000 });
}

describe('generatorHandoffStore', () => {
  it('persists and retrieves a handoff', async () => {
    const handoff = makeHandoff();
    await putGeneratorHandoff(handoff);
    expect(await getGeneratorHandoff(handoff.id)).toEqual(handoff);
  });

  it('deletes a handoff', async () => {
    const handoff = makeHandoff();
    await putGeneratorHandoff(handoff);
    await deleteGeneratorHandoff(handoff.id);
    expect(await getGeneratorHandoff(handoff.id)).toBeUndefined();
  });

  it('loads all handoffs', async () => {
    await putGeneratorHandoff(makeHandoff());
    expect(await loadGeneratorHandoffs()).toHaveLength(1);
  });
});
