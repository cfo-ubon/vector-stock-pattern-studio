import { FACTORY_IMPROVEMENT_REVIEWS_STORE } from '../../storage/db';
import { createGenericStore } from '../../aiCeo/storage/genericStore';
import type { ImprovementReview } from '../domain/types';

// Mission 3, Part 8/12 — Improvement Reviews storage. One row per
// generated Daily/Weekly/Monthly review, keyed by `id`.

function isValidImprovementReview(value: unknown): value is ImprovementReview {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.period === 'string' && typeof v.createdAt === 'number';
}

const store = createGenericStore<ImprovementReview>(FACTORY_IMPROVEMENT_REVIEWS_STORE, 'Improvement Review', isValidImprovementReview);

export async function loadImprovementReviews(): Promise<ImprovementReview[]> {
  const all = await store.loadAll();
  return [...all].sort((a, b) => b.createdAt - a.createdAt);
}
export async function putImprovementReview(review: ImprovementReview): Promise<void> {
  await store.put(review);
}
export async function clearImprovementReviewsForTest(): Promise<void> {
  await store.clear();
}
