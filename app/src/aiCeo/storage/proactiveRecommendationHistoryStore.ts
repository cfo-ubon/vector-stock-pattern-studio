import { RECOMMENDATION_HISTORY_STORE } from '../../storage/db';
import { createGenericStore } from './genericStore';
import { isValidProactiveRecommendationHistoryEntry, type ProactiveRecommendationHistoryEntry } from '../domain/types';
import { proactiveRecommendationHistoryId } from '../domain/id';

// Build 030 Part 2 — first real consumer of `recommendationHistory`
// (`storage/db.ts`, pre-provisioned since v8/Build 028, indexed by
// `recommendationType`/`refId`). Module 14's `proactiveRecommendationHistory`
// requirement fits this store's existing shape exactly, so no new store is
// created for it — see `storage/db.ts`'s v12 comment.

const store = createGenericStore<ProactiveRecommendationHistoryEntry>(
  RECOMMENDATION_HISTORY_STORE,
  'Proactive recommendation history',
  isValidProactiveRecommendationHistoryEntry,
);

export async function loadProactiveRecommendationHistory(): Promise<ProactiveRecommendationHistoryEntry[]> {
  const all = await store.loadAll();
  return all.sort((a, b) => b.createdAt - a.createdAt);
}
export const putProactiveRecommendationHistoryEntry = store.put;
export const clearProactiveRecommendationHistory = store.clear;

export async function recordRecommendationOutcome(
  entry: Pick<ProactiveRecommendationHistoryEntry, 'refId' | 'action' | 'outcome'>,
  now: number = Date.now(),
): Promise<void> {
  await putProactiveRecommendationHistoryEntry({
    id: proactiveRecommendationHistoryId.generate(now),
    recommendationType: 'aiCeoRecommendation',
    refId: entry.refId,
    action: entry.action,
    outcome: entry.outcome,
    createdAt: now,
  });
}
