import { FACTORY_BUSINESS_OUTCOME_HISTORY_STORE } from '../../storage/db';
import { createGenericStore } from '../../aiCeo/storage/genericStore';
import type { BusinessOutcomeScore } from '../domain/types';

// Mission 2, Part 7/10 — Business Outcome Score history. One row per
// computed score, so the score's own trend is itself traceable over
// time (Part 6).

function isValidBusinessOutcomeScore(value: unknown): value is BusinessOutcomeScore {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && Array.isArray(v.components) && typeof v.createdAt === 'number';
}

const store = createGenericStore<BusinessOutcomeScore>(FACTORY_BUSINESS_OUTCOME_HISTORY_STORE, 'Business Outcome History', isValidBusinessOutcomeScore);

export async function loadBusinessOutcomeHistory(): Promise<BusinessOutcomeScore[]> {
  const all = await store.loadAll();
  return [...all].sort((a, b) => b.createdAt - a.createdAt);
}
export async function putBusinessOutcomeScore(score: BusinessOutcomeScore): Promise<void> {
  await store.put(score);
}
export async function clearBusinessOutcomeHistoryForTest(): Promise<void> {
  await store.clear();
}
