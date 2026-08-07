import { createGenericStore } from '../../aiCeo/storage/genericStore';
import { DECISION_TIMELINE_STORE } from '../../storage/db';
import { isValidDecisionTimelineEntry, type DecisionTimelineEntry } from '../domain/types';

// Build 031B, Part 8 — Decision Timeline storage. One row per `Decision`
// ever evaluated, append-only (never edited/merged) — reuses
// `aiCeo/storage/genericStore.ts`'s generic CRUD factory exactly like
// every one of Build 030 Part 2's 8 stores does, since this is the same
// flat, keyPath-'id' shape. This is audit history, not learning: nothing
// in this module reads its own past entries to influence a future
// decision (see `decisionEngine.ts`'s header comment).

const store = createGenericStore<DecisionTimelineEntry>(DECISION_TIMELINE_STORE, 'Decision Timeline', isValidDecisionTimelineEntry);

export async function recordDecisionTimelineEntry(entry: DecisionTimelineEntry): Promise<void> {
  await store.put(entry);
}

export async function loadDecisionTimeline(): Promise<DecisionTimelineEntry[]> {
  return store.loadAll();
}

export async function clearDecisionTimelineForTest(): Promise<void> {
  await store.clear();
}
