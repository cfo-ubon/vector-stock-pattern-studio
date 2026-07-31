import { openDb, idbAvailable, requestAsPromise, SCORING_PROFILES_STORE } from '../../storage/db';
import type { ScoringProfile } from '../domain/scoringProfile';
import { isValidScoringProfile, createScoringProfile } from '../domain/scoringProfile';

export class ScoringProfileStorageUnavailableError extends Error {
  constructor() {
    super('The Marketing Intelligence Center requires a browser with IndexedDB support.');
    this.name = 'ScoringProfileStorageUnavailableError';
  }
}

function assertAvailable(): void {
  if (!idbAvailable()) throw new ScoringProfileStorageUnavailableError();
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(SCORING_PROFILES_STORE, mode).objectStore(SCORING_PROFILES_STORE);
}

export async function loadScoringProfiles(): Promise<ScoringProfile[]> {
  assertAvailable();
  const db = await openDb();
  const items = await requestAsPromise(tx(db, 'readonly').getAll() as IDBRequest<ScoringProfile[]>);
  return items.filter(isValidScoringProfile);
}

export async function putScoringProfile(item: ScoringProfile): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').put(item));
}

export async function deleteScoringProfile(id: string): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').delete(id) as unknown as IDBRequest<undefined>);
}

export async function clearScoringProfiles(): Promise<void> {
  assertAvailable();
  const db = await openDb();
  await requestAsPromise(tx(db, 'readwrite').clear() as unknown as IDBRequest<undefined>);
}

/** Ensures exactly one default scoring profile exists, matching this
 * codebase's other "ensure a default exists" seeding conventions. Never
 * overwrites a user's own edited default. */
export async function ensureDefaultScoringProfile(now: number = Date.now()): Promise<ScoringProfile> {
  const existing = await loadScoringProfiles();
  const currentDefault = existing.find((p) => p.isDefault);
  if (currentDefault) return currentDefault;
  const profile = createScoringProfile({ name: 'Default', isDefault: true, now });
  await putScoringProfile(profile);
  return profile;
}
