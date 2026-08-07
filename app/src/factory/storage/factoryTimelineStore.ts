import { FACTORY_TIMELINE_STORE } from '../../storage/db';
import { createGenericStore } from '../../aiCeo/storage/genericStore';
import type { FactoryTimelineEntry } from '../domain/types';
import { FACTORY_TIMELINE_EVENT_VALUES } from '../domain/types';

// Build 031C, Part 6 — Factory Timeline storage. Append-only: callers
// should only ever `put` a brand-new entry (a fresh id per event), never
// mutate an existing one, matching `decisionTimeline`'s own convention.

function isValidFactoryTimelineEntry(value: unknown): value is FactoryTimelineEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.taskId === 'string' && FACTORY_TIMELINE_EVENT_VALUES.includes(v.event as (typeof FACTORY_TIMELINE_EVENT_VALUES)[number]) && typeof v.at === 'number';
}

const store = createGenericStore<FactoryTimelineEntry>(FACTORY_TIMELINE_STORE, 'Factory Timeline', isValidFactoryTimelineEntry);

export async function loadFactoryTimeline(): Promise<FactoryTimelineEntry[]> {
  const entries = await store.loadAll();
  return [...entries].sort((a, b) => b.at - a.at);
}
export async function putFactoryTimelineEntry(entry: FactoryTimelineEntry): Promise<void> {
  await store.put(entry);
}
export async function clearFactoryTimelineForTest(): Promise<void> {
  await store.clear();
}
