import { FACTORY_ORCHESTRATION_ARCHIVES_STORE } from '../../storage/db';
import { createGenericStore } from '../../aiCeo/storage/genericStore';
import { isValidProductionSessionArchive } from '../sessionArchive';
import type { ProductionSessionArchive } from '../domain/types';

// Mission 5, Part 9/13 — Production Session Archive storage. One row per
// archived run, keyed by `id`.

const store = createGenericStore<ProductionSessionArchive>(FACTORY_ORCHESTRATION_ARCHIVES_STORE, 'Production Session Archive', isValidProductionSessionArchive);

export async function loadProductionSessionArchives(): Promise<ProductionSessionArchive[]> {
  const all = await store.loadAll();
  return [...all].sort((a, b) => b.archivedAt - a.archivedAt);
}
export async function getProductionSessionArchive(id: string): Promise<ProductionSessionArchive | undefined> {
  return store.get(id);
}
export async function putProductionSessionArchive(archive: ProductionSessionArchive): Promise<void> {
  await store.put(archive);
}
export async function clearProductionSessionArchivesForTest(): Promise<void> {
  await store.clear();
}
