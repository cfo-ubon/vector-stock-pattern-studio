import { describe, it, expect, beforeEach } from 'vitest';
import { loadRejectionRecords, putRejectionRecord, deleteRejectionRecord, clearRejectionRecords } from './rejectionStore';
import { createRejectionRecord } from './rejectionIntelligence';

beforeEach(async () => {
  await clearRejectionRecords();
});

describe('rejectionStore', () => {
  it('is empty before anything is written', async () => {
    expect(await loadRejectionRecords()).toEqual([]);
  });

  it('putRejectionRecord persists a record', async () => {
    const record = createRejectionRecord({ submissionId: 'SUB-1', marketplaceReasonText: 'Duplicate content' });
    await putRejectionRecord(record);
    const all = await loadRejectionRecords();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(record);
  });

  it('deleteRejectionRecord removes exactly the targeted record', async () => {
    const a = createRejectionRecord({ submissionId: 'SUB-1', marketplaceReasonText: 'Duplicate content' });
    const b = createRejectionRecord({ submissionId: 'SUB-2', marketplaceReasonText: 'Trademark issue' });
    await putRejectionRecord(a);
    await putRejectionRecord(b);
    await deleteRejectionRecord(a.rejectionId);
    const all = await loadRejectionRecords();
    expect(all).toHaveLength(1);
    expect(all[0].rejectionId).toBe(b.rejectionId);
  });

  it('clearRejectionRecords empties the store', async () => {
    await putRejectionRecord(createRejectionRecord({ submissionId: 'SUB-1', marketplaceReasonText: 'x' }));
    await clearRejectionRecords();
    expect(await loadRejectionRecords()).toEqual([]);
  });
});
