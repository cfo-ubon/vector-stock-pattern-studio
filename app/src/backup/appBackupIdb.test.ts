import { describe, it, expect, beforeEach } from 'vitest';
import { dumpStore, dumpAllStores, putAllRecords, restoreAllStores } from './appBackupIdb';
import { openDb, SAVED_STORE, PROJECTS_STORE } from '../storage/db';

async function clearStore(name: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(name, 'readwrite');
  tx.objectStore(name).clear();
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

beforeEach(async () => {
  await clearStore(SAVED_STORE);
  await clearStore(PROJECTS_STORE);
});

describe('dumpStore', () => {
  it('returns an empty array for an empty store', async () => {
    expect(await dumpStore(SAVED_STORE)).toEqual([]);
  });

  it('returns every record currently in the store', async () => {
    const db = await openDb();
    const tx = db.transaction(SAVED_STORE, 'readwrite');
    tx.objectStore(SAVED_STORE).put({ id: 'p1', name: 'Pattern 1' });
    tx.objectStore(SAVED_STORE).put({ id: 'p2', name: 'Pattern 2' });
    await new Promise((resolve) => (tx.oncomplete = resolve));

    const dumped = await dumpStore(SAVED_STORE);
    expect(dumped).toHaveLength(2);
    expect(dumped).toEqual(expect.arrayContaining([{ id: 'p1', name: 'Pattern 1' }, { id: 'p2', name: 'Pattern 2' }]));
  });
});

describe('dumpAllStores', () => {
  it('keys the result by store name, including empty stores', async () => {
    const db = await openDb();
    const tx = db.transaction(SAVED_STORE, 'readwrite');
    tx.objectStore(SAVED_STORE).put({ id: 'p1' });
    await new Promise((resolve) => (tx.oncomplete = resolve));

    const dump = await dumpAllStores([SAVED_STORE, PROJECTS_STORE]);
    expect(dump[SAVED_STORE]).toEqual([{ id: 'p1' }]);
    expect(dump[PROJECTS_STORE]).toEqual([]);
  });
});

describe('putAllRecords', () => {
  it('is a no-op for an empty array (no transaction error)', async () => {
    await expect(putAllRecords(SAVED_STORE, [])).resolves.toBeUndefined();
  });

  it('upserts every record via its own keyPath', async () => {
    await putAllRecords(SAVED_STORE, [{ id: 'a', v: 1 }, { id: 'b', v: 1 }]);
    expect(await dumpStore(SAVED_STORE)).toHaveLength(2);
  });

  it('overwrites an existing record with the same key rather than duplicating it', async () => {
    await putAllRecords(SAVED_STORE, [{ id: 'a', v: 1 }]);
    await putAllRecords(SAVED_STORE, [{ id: 'a', v: 2 }]);
    const dumped = await dumpStore(SAVED_STORE);
    expect(dumped).toEqual([{ id: 'a', v: 2 }]);
  });
});

describe('restoreAllStores', () => {
  it('restores every listed store and reports the record count per store', async () => {
    const counts = await restoreAllStores(
      { [SAVED_STORE]: [{ id: 'x' }, { id: 'y' }], [PROJECTS_STORE]: [{ id: 'proj1' }] },
      [SAVED_STORE, PROJECTS_STORE]
    );
    expect(counts).toEqual({ [SAVED_STORE]: 2, [PROJECTS_STORE]: 1 });
    expect(await dumpStore(SAVED_STORE)).toHaveLength(2);
    expect(await dumpStore(PROJECTS_STORE)).toHaveLength(1);
  });

  it('treats a store missing from the dump as zero records, without throwing', async () => {
    const counts = await restoreAllStores({ [SAVED_STORE]: [{ id: 'x' }] }, [SAVED_STORE, PROJECTS_STORE]);
    expect(counts[PROJECTS_STORE]).toBe(0);
  });
});
