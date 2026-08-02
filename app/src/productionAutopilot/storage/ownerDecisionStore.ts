import { FACTORY_OWNER_DECISIONS_STORE } from '../../storage/db';
import { createGenericStore } from '../../aiCeo/storage/genericStore';
import type { OwnerDecisionRecord } from '../domain/types';

// Mission 4, Part 5 — Owner Decision Reduction storage. One row per real,
// timestamped Owner Decision (Approve Session / Approve Override / Approve
// Export), keyed by `id` — the basis for the "≤3 decisions/day" target.

function isValidOwnerDecisionRecord(value: unknown): value is OwnerDecisionRecord {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.type === 'string' && typeof v.decidedAt === 'number';
}

const store = createGenericStore<OwnerDecisionRecord>(FACTORY_OWNER_DECISIONS_STORE, 'Owner Decision', isValidOwnerDecisionRecord);

export async function loadOwnerDecisionRecords(): Promise<OwnerDecisionRecord[]> {
  const all = await store.loadAll();
  return [...all].sort((a, b) => b.decidedAt - a.decidedAt);
}
export async function putOwnerDecisionRecord(record: OwnerDecisionRecord): Promise<void> {
  await store.put(record);
}
export async function clearOwnerDecisionRecordsForTest(): Promise<void> {
  await store.clear();
}
