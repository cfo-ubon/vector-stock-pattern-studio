import { describe, it, expect, beforeEach } from 'vitest';
import { createMarketSnapshot } from '../domain/marketSnapshot';
import { loadMarketSnapshots, getMarketSnapshot, putMarketSnapshot, deleteMarketSnapshot, clearMarketSnapshots } from './marketSnapshotStore';

beforeEach(async () => {
  await clearMarketSnapshots();
});

describe('marketSnapshotStore', () => {
  it('is empty before anything is written', async () => {
    expect(await loadMarketSnapshots()).toEqual([]);
  });

  it('persists and retrieves a snapshot', async () => {
    const snapshot = createMarketSnapshot({ researchDateRange: { from: 0, to: 1 }, evidenceRefs: ['OBS-1'], now: 1000 });
    await putMarketSnapshot(snapshot);
    expect(await getMarketSnapshot(snapshot.id)).toEqual(snapshot);
    expect(await loadMarketSnapshots()).toEqual([snapshot]);
  });

  it('deletes a snapshot', async () => {
    const snapshot = createMarketSnapshot({ researchDateRange: { from: 0, to: 1 }, evidenceRefs: ['OBS-1'], now: 1000 });
    await putMarketSnapshot(snapshot);
    await deleteMarketSnapshot(snapshot.id);
    expect(await getMarketSnapshot(snapshot.id)).toBeUndefined();
  });

  it('data persists across a fresh load call, matching real reload behavior', async () => {
    const a = createMarketSnapshot({ researchDateRange: { from: 0, to: 1 }, evidenceRefs: ['OBS-1'], now: 1000 });
    const b = createMarketSnapshot({ researchDateRange: { from: 0, to: 1 }, evidenceRefs: ['OBS-2'], now: 2000 });
    await putMarketSnapshot(a);
    await putMarketSnapshot(b);
    const all = await loadMarketSnapshots();
    expect(all.map((s) => s.id).sort()).toEqual([a.id, b.id].sort());
  });
});
