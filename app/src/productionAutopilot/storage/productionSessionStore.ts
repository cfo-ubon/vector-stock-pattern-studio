import { FACTORY_PRODUCTION_SESSIONS_STORE } from '../../storage/db';
import { createGenericStore } from '../../aiCeo/storage/genericStore';
import { isValidProductionSession } from '../productionSession';
import type { ProductionSession } from '../domain/types';

// Mission 4, Part 9 — Production Session History storage. One row per
// session, keyed by `id`, spanning Plan through Execution through Outcome.

const store = createGenericStore<ProductionSession>(FACTORY_PRODUCTION_SESSIONS_STORE, 'Production Session', isValidProductionSession);

export async function loadProductionSessions(): Promise<ProductionSession[]> {
  const all = await store.loadAll();
  return [...all].sort((a, b) => b.createdAt - a.createdAt);
}
export async function getProductionSession(id: string): Promise<ProductionSession | undefined> {
  return store.get(id);
}
export async function putProductionSession(session: ProductionSession): Promise<void> {
  await store.put(session);
}
export async function clearProductionSessionsForTest(): Promise<void> {
  await store.clear();
}
