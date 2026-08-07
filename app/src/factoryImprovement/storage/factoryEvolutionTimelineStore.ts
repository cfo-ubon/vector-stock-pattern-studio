import { FACTORY_EVOLUTION_TIMELINE_STORE } from '../../storage/db';
import { createGenericStore } from '../../aiCeo/storage/genericStore';
import type { FactoryEvolutionEntry } from '../domain/types';

// Mission 3, Part 10/12 — Factory Evolution Timeline storage. Append-only
// (callers never overwrite an existing entry — each `id` is generated
// fresh), keyed by `id`.

function isValidFactoryEvolutionEntry(value: unknown): value is FactoryEvolutionEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.type === 'string' && typeof v.refId === 'string' && typeof v.at === 'number';
}

const store = createGenericStore<FactoryEvolutionEntry>(FACTORY_EVOLUTION_TIMELINE_STORE, 'Factory Evolution Timeline', isValidFactoryEvolutionEntry);

export async function loadFactoryEvolutionTimeline(): Promise<FactoryEvolutionEntry[]> {
  const all = await store.loadAll();
  return [...all].sort((a, b) => b.at - a.at);
}
export async function appendFactoryEvolutionEntry(entry: FactoryEvolutionEntry): Promise<void> {
  await store.put(entry);
}
export async function clearFactoryEvolutionTimelineForTest(): Promise<void> {
  await store.clear();
}
