import { FACTORY_REVIEWS_STORE } from '../../storage/db';
import { createGenericStore } from '../../aiCeo/storage/genericStore';
import type { FactoryReview } from '../domain/types';

// Mission 2, Part 4/10 — Factory Review storage. One row per completed
// batch, keyed by `id`.

function isValidFactoryReview(value: unknown): value is FactoryReview {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.batchId === 'string' && typeof v.packagesProduced === 'number' && typeof v.createdAt === 'number';
}

const store = createGenericStore<FactoryReview>(FACTORY_REVIEWS_STORE, 'Factory Review', isValidFactoryReview);

export async function loadFactoryReviews(): Promise<FactoryReview[]> {
  const all = await store.loadAll();
  return [...all].sort((a, b) => b.createdAt - a.createdAt);
}
export async function getFactoryReviewByBatchId(batchId: string): Promise<FactoryReview | undefined> {
  const all = await store.loadAll();
  return all.find((r) => r.batchId === batchId);
}
export async function putFactoryReview(review: FactoryReview): Promise<void> {
  await store.put(review);
}
export async function clearFactoryReviewsForTest(): Promise<void> {
  await store.clear();
}
