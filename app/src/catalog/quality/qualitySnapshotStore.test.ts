import { describe, it, expect, beforeEach } from 'vitest';
import {
  createQualitySnapshot,
  isValidQualitySnapshot,
} from './qualitySnapshotStore';
import {
  loadQualitySnapshots,
  putQualitySnapshot,
  latestQualitySnapshotForAsset,
  clearQualitySnapshots,
} from './qualitySnapshotStore';

beforeEach(async () => {
  await clearQualitySnapshots();
});

describe('createQualitySnapshot', () => {
  it('builds a valid snapshot from inputs', () => {
    const snap = createQualitySnapshot({
      assetId: 'VSP-1',
      beautyScore: 80,
      commercialScore: 85,
      fragmented: false,
      deadSpace: false,
      decision: 'READY',
      generatorVersion: '1.79',
    });
    expect(isValidQualitySnapshot(snap)).toBe(true);
    expect(snap.decision).toBe('READY');
  });
});

describe('qualitySnapshotStore', () => {
  it('is empty before anything is written', async () => {
    expect(await loadQualitySnapshots()).toEqual([]);
  });

  it('persists and retrieves a snapshot', async () => {
    const snap = createQualitySnapshot({
      assetId: 'VSP-1',
      beautyScore: 80,
      commercialScore: 85,
      fragmented: false,
      deadSpace: false,
      decision: 'READY',
      generatorVersion: '1.79',
    });
    await putQualitySnapshot(snap);
    expect(await loadQualitySnapshots()).toEqual([snap]);
  });

  it('latestQualitySnapshotForAsset returns the most recent snapshot, not just any', async () => {
    const older = createQualitySnapshot({
      assetId: 'VSP-1',
      beautyScore: 50,
      commercialScore: 50,
      fragmented: true,
      deadSpace: false,
      decision: 'REVIEW',
      generatorVersion: '1.78',
      now: 1000,
    });
    const newer = createQualitySnapshot({
      assetId: 'VSP-1',
      beautyScore: 80,
      commercialScore: 85,
      fragmented: false,
      deadSpace: false,
      decision: 'READY',
      generatorVersion: '1.79',
      now: 2000,
    });
    await putQualitySnapshot(older);
    await putQualitySnapshot(newer);
    const latest = await latestQualitySnapshotForAsset('VSP-1');
    expect(latest?.snapshotId).toBe(newer.snapshotId);
  });

  it('never overwrites history -- re-evaluation creates a new row', async () => {
    const a = createQualitySnapshot({
      assetId: 'VSP-1',
      beautyScore: 50,
      commercialScore: 50,
      fragmented: true,
      deadSpace: false,
      decision: 'REVIEW',
      generatorVersion: '1.78',
      now: 1000,
    });
    const b = createQualitySnapshot({
      assetId: 'VSP-1',
      beautyScore: 80,
      commercialScore: 85,
      fragmented: false,
      deadSpace: false,
      decision: 'READY',
      generatorVersion: '1.79',
      now: 2000,
    });
    await putQualitySnapshot(a);
    await putQualitySnapshot(b);
    expect(await loadQualitySnapshots()).toHaveLength(2);
  });

  it('clearQualitySnapshots empties the store', async () => {
    await putQualitySnapshot(
      createQualitySnapshot({ assetId: 'VSP-1', beautyScore: 1, commercialScore: 1, fragmented: false, deadSpace: false, decision: 'REJECT', generatorVersion: '1.79' }),
    );
    await clearQualitySnapshots();
    expect(await loadQualitySnapshots()).toEqual([]);
  });
});
