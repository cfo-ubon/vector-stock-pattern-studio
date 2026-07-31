import { describe, it, expect, beforeEach } from 'vitest';
import { createMarketObservation } from '../domain/marketObservation';
import {
  loadMarketObservations,
  getMarketObservation,
  putMarketObservation,
  deleteMarketObservation,
  clearMarketObservations,
} from './marketObservationStore';

beforeEach(async () => {
  await clearMarketObservations();
});

describe('marketObservationStore', () => {
  it('is empty before anything is written', async () => {
    expect(await loadMarketObservations()).toEqual([]);
  });

  it('persists and retrieves an observation, evidence status intact', async () => {
    const obs = createMarketObservation({ sourceType: 'adobe-stock', evidenceStatus: 'VERIFIED_SOURCE', now: 1000 });
    await putMarketObservation(obs);
    const loaded = await getMarketObservation(obs.id);
    expect(loaded).toEqual(obs);
    expect(loaded?.evidenceStatus).toBe('VERIFIED_SOURCE');
  });

  it('deletes an observation', async () => {
    const obs = createMarketObservation({ sourceType: 'freepik', evidenceStatus: 'SAMPLE_DATA', now: 1000 });
    await putMarketObservation(obs);
    await deleteMarketObservation(obs.id);
    expect(await getMarketObservation(obs.id)).toBeUndefined();
  });
});
