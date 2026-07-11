import type { Project } from '../project/projectTypes';
import { normalizeProject } from '../project/projectManager';
import { openDb, idbAvailable, requestAsPromise, lsLoad, lsStore, PROJECTS_STORE } from './db';

// IndexedDB-backed store for Projects — same DB/quota story as
// storage/savedStore.ts (see db.ts), same localStorage fallback shape.

const LEGACY_LS_KEY = 'vsp-projects-v1';

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(PROJECTS_STORE, mode).objectStore(PROJECTS_STORE);
}

export async function loadProjects(): Promise<Project[]> {
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch {
    // storage manager unavailable — non-fatal
  }
  if (!idbAvailable()) return lsLoad<Project>(LEGACY_LS_KEY).sort((a, b) => b.updatedAt - a.updatedAt).map(normalizeProject);
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<Project[]>);
  return items.sort((a, b) => b.updatedAt - a.updatedAt).map(normalizeProject);
}

export async function putProject(project: Project): Promise<void> {
  if (!idbAvailable()) {
    const items = lsLoad<Project>(LEGACY_LS_KEY).filter((p) => p.id !== project.id);
    lsStore(LEGACY_LS_KEY, [project, ...items]);
    return;
  }
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(project));
}

export async function deleteProject(id: string): Promise<void> {
  if (!idbAvailable()) {
    lsStore(LEGACY_LS_KEY, lsLoad<Project>(LEGACY_LS_KEY).filter((p) => p.id !== id));
    return;
  }
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(id));
}
