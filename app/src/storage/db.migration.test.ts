/// <reference types="node" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// jsdom's own Blob isn't recognized by Node's `structuredClone` (used
// internally by fake-indexeddb to simulate real IndexedDB structured-clone
// semantics) — see `testSetup.ts`'s header comment / the same pattern in
// `catalog/storage/portfolioStore.test.ts`. This file seeds a raw file
// body directly (not through the catalog's import pipeline), so it needs
// the same Node-Blob workaround.
import { Blob as NodeBlob } from 'node:buffer';

// Portfolio Manager P2 Stage 1 — migration tests for `storage/db.ts`'s
// v4 -> v5 upgrade (adds the `collections` object store). `db.ts` memoizes
// one shared `dbPromise` at module scope (by design, see its header
// comment), so each scenario below needs a *fresh* module instance
// (`vi.resetModules()` + a fresh dynamic `import()`) rather than reusing
// the previous scenario's already-opened connection, and a fresh
// underlying fake-indexeddb database (`indexedDB.deleteDatabase`) so each
// test starts from a known schema version instead of whatever the
// previous test left behind. Every connection opened by a test is
// tracked and closed in `afterEach` *before* the next test's
// `deleteDatabase` call — an open connection left dangling (e.g. because
// an assertion threw before a manual `.close()`) would otherwise block
// `deleteDatabase` indefinitely and every later test would time out.

const DB_NAME = 'vsp-db';
let openConnections: IDBDatabase[] = [];

function track(conn: IDBDatabase): IDBDatabase {
  openConnections.push(conn);
  return conn;
}

async function deleteTestDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

/** Manually recreates the exact P1-era (v4) schema — the four stores
 * `db.ts` created before this Stage 1's `collections` addition — so the
 * "upgrade from P1" tests below exercise a real `onupgradeneeded` 4 -> 5
 * transition rather than only ever seeing a fresh v5 database. */
async function seedV4Database(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 4);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('saved', { keyPath: 'id' });
      db.createObjectStore('projects', { keyPath: 'id' });
      db.createObjectStore('assets', { keyPath: 'metadata.id' });
      db.createObjectStore('portfolioAssets', { keyPath: 'assetId' });
      const files = db.createObjectStore('portfolioFiles', { keyPath: 'fileId' });
      files.createIndex('assetId', 'assetId', { unique: false });
      files.createIndex('sha256', 'sha256', { unique: false });
    };
    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

const SAMPLE_ASSET = {
  assetId: 'VSP-20260101-AAAAAA',
  displayName: 'Pre-migration asset',
  originalFilename: 'legacy.svg',
  assetType: 'svg',
  createdAt: 1,
  importedAt: 1,
  updatedAt: 1,
  generatorVersion: null,
  schemaVersion: 1,
  styleDna: null,
  presetId: null,
  compositionType: null,
  patternType: null,
  generatorSeed: null,
  productTargets: [],
  collectionIds: ['COL-PRE-EXISTING'],
  tags: [],
  rating: 0,
  workflowStatus: 'DRAFT',
  isArchived: false,
  archivedAt: null,
  archiveReason: null,
  previewReference: 'file-legacy-1',
  sourceFileReferences: [{ fileId: 'file-legacy-1', role: 'svg', filename: 'legacy.svg', mimeType: 'image/svg+xml', fileSize: 3, sha256: 'hash-legacy' }],
  metadataReference: null,
  sourceHashes: ['hash-legacy'],
  fileSizes: { 'file-legacy-1': 3 },
  dimensions: null,
  colorPalette: [],
  notes: '',
  parentAssetId: null,
  variationGroupId: null,
};

async function seedV4SampleData(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 4);
    req.onsuccess = () => {
      const db = req.result;
      const t = db.transaction(['portfolioAssets', 'portfolioFiles'], 'readwrite');
      t.objectStore('portfolioAssets').put(SAMPLE_ASSET);
      t.objectStore('portfolioFiles').put({
        fileId: 'file-legacy-1',
        assetId: SAMPLE_ASSET.assetId,
        role: 'svg',
        filename: 'legacy.svg',
        mimeType: 'image/svg+xml',
        fileSize: 6,
        sha256: 'hash-legacy',
        blob: new NodeBlob(['<svg/>'], { type: 'image/svg+xml' }) as unknown as Blob,
        storedAt: 1,
      });
      t.oncomplete = () => {
        db.close();
        resolve();
      };
      t.onerror = () => reject(t.error);
    };
    req.onerror = () => reject(req.error);
  });
}

afterEach(() => {
  for (const conn of openConnections) conn.close();
  openConnections = [];
});

beforeEach(async () => {
  await deleteTestDb();
  // `db.ts` memoizes `dbPromise` at module scope — reset the module
  // registry too, or every `import('./db')` below after the first would
  // return the same already-opened (and now stale, post-delete) connection.
  vi.resetModules();
});

describe('storage/db.ts migration — DB_VERSION reports (before/after)', () => {
  it('the current DB_VERSION is 19 (Mission 5 bumped it from the Mission 4 value of 18)', async () => {
    const { DB_VERSION } = await import('./db');
    expect(DB_VERSION).toBe(19);
  });
});

describe('storage/db.ts migration — fresh database creation', () => {
  it('creates every store (including the new AI CEO stores) in one pass', async () => {
    const dbModule = await import('./db');
    const conn = track(await dbModule.openDb());
    expect(conn.version).toBe(19);
    for (const store of [
      'saved', 'projects', 'assets', 'portfolioAssets', 'portfolioFiles', 'collections', 'researchSources', 'marketObservations',
      'marketSnapshots', 'designBriefs', 'designConfigurations', 'collectionPlans', 'autonomousDesignRuns',
      'aiCeoBriefs', 'businessGoals', 'aiConversations', 'aiConversationMessages', 'aiMemoryCandidates', 'aiMemories',
      'portfolioDiagnoses', 'businessCoachRecommendations', 'recommendationHistory', 'commercialPackageHistory',
      'decisionTimeline', 'decisionPolicyOverrides', 'factoryQueue', 'factoryTimeline', 'factorySchedulerState',
      'factoryDailyKpi', 'factoryReviews', 'factoryImprovementQueue', 'factoryBusinessOutcomeHistory',
      'factoryImprovementBacklog', 'factoryExperiments', 'factoryPolicyExperiments', 'factoryImprovementReviews', 'factoryEvolutionTimeline',
      'factoryProductionSessions', 'factoryOwnerDecisions', 'factoryProductionAutopilotState',
      'factoryOrchestrationRuns', 'factoryOrchestrationArchives',
    ]) {
      expect(conn.objectStoreNames.contains(store)).toBe(true);
    }
  });
});

describe('storage/db.ts migration — upgrade from a real Build 029 (v11) database', () => {
  async function seedV11Database(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 11);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('portfolioAssets', { keyPath: 'assetId' });
        const runs = db.createObjectStore('autonomousDesignRuns', { keyPath: 'id' });
        runs.createIndex('status', 'status', { unique: false });
        runs.createIndex('mode', 'mode', { unique: false });
        const recs = db.createObjectStore('recommendationHistory', { keyPath: 'id' });
        recs.createIndex('recommendationType', 'recommendationType', { unique: false });
        recs.createIndex('refId', 'refId', { unique: false });
      };
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function seedV11SampleRun(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 11);
      req.onsuccess = () => {
        const db = req.result;
        const t = db.transaction('autonomousDesignRuns', 'readwrite');
        t.objectStore('autonomousDesignRuns').put({ id: 'AUTORUN-PRE-EXISTING', status: 'COMPLETED', mode: 'FULL_AUTOPILOT', items: [], history: [] });
        t.oncomplete = () => {
          db.close();
          resolve();
        };
        t.onerror = () => reject(t.error);
      };
      req.onerror = () => reject(req.error);
    });
  }

  beforeEach(async () => {
    await seedV11Database();
    await seedV11SampleRun();
  });

  it('upgrades v11 -> v12, adds every new AI CEO store, and preserves pre-existing autonomousDesignRuns data', async () => {
    const dbModule = await import('./db');
    const conn = track(await dbModule.openDb());
    expect(conn.version).toBe(19);
    for (const store of [
      'aiCeoBriefs', 'businessGoals', 'aiConversations', 'aiConversationMessages', 'aiMemoryCandidates', 'aiMemories',
      'portfolioDiagnoses', 'businessCoachRecommendations',
    ]) {
      expect(conn.objectStoreNames.contains(store)).toBe(true);
    }
    const run = await new Promise((resolve, reject) => {
      const req = conn.transaction('autonomousDesignRuns', 'readonly').objectStore('autonomousDesignRuns').get('AUTORUN-PRE-EXISTING');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(run).toMatchObject({ id: 'AUTORUN-PRE-EXISTING', status: 'COMPLETED' });
  });

  it('the pre-provisioned recommendationHistory store is preserved (not recreated) through the upgrade', async () => {
    const dbModule = await import('./db');
    const conn = track(await dbModule.openDb());
    expect(conn.objectStoreNames.contains('recommendationHistory')).toBe(true);
    expect(conn.transaction('recommendationHistory', 'readonly').objectStore('recommendationHistory').indexNames.contains('refId')).toBe(true);
  });

  it('reopening the already-upgraded v12 database succeeds with no duplicate-object-store error', async () => {
    const first = await import('./db');
    track(await first.openDb());
    vi.resetModules();
    const second = await import('./db');
    const conn2 = track(await second.openDb());
    expect(conn2.version).toBe(19);
    expect(conn2.objectStoreNames.contains('aiCeoBriefs')).toBe(true);
  });
});

describe('storage/db.ts migration — upgrade from a real P1 (v4) database', () => {
  beforeEach(async () => {
    await seedV4Database();
    await seedV4SampleData();
  });

  it('opening the v4 database via openDb() upgrades it to the current version and preserves existing assets', async () => {
    const dbModule = await import('./db');
    const conn = track(await dbModule.openDb());
    expect(conn.version).toBe(19);

    const asset = await new Promise((resolve, reject) => {
      const req = conn.transaction('portfolioAssets', 'readonly').objectStore('portfolioAssets').get(SAMPLE_ASSET.assetId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(asset).toMatchObject({ assetId: SAMPLE_ASSET.assetId, displayName: 'Pre-migration asset' });
  });

  it('preserves existing binary Blob file bodies through the upgrade', async () => {
    const dbModule = await import('./db');
    const conn = track(await dbModule.openDb());
    const file = await new Promise<{ blob: Blob } | undefined>((resolve, reject) => {
      const req = conn.transaction('portfolioFiles', 'readonly').objectStore('portfolioFiles').get('file-legacy-1');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(file).toBeDefined();
    expect(typeof file!.blob.arrayBuffer).toBe('function');
    const text = new TextDecoder().decode(await file!.blob.arrayBuffer());
    expect(text).toBe('<svg/>');
  });

  it('preserves existing collectionIds on migrated assets', async () => {
    const dbModule = await import('./db');
    const conn = track(await dbModule.openDb());
    const asset = await new Promise<typeof SAMPLE_ASSET>((resolve, reject) => {
      const req = conn.transaction('portfolioAssets', 'readonly').objectStore('portfolioAssets').get(SAMPLE_ASSET.assetId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(asset.collectionIds).toEqual(['COL-PRE-EXISTING']);
  });

  it('the new collections store is available and empty after the upgrade', async () => {
    const dbModule = await import('./db');
    const conn = track(await dbModule.openDb());
    expect(conn.objectStoreNames.contains('collections')).toBe(true);
    const count = await new Promise<number>((resolve, reject) => {
      const req = conn.transaction('collections', 'readonly').objectStore('collections').count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(count).toBe(0);
  });

  it('reopening the already-upgraded database succeeds with no duplicate-object-store error', async () => {
    const first = await import('./db');
    track(await first.openDb());

    // Fresh module instance (fresh `dbPromise` memo) simulates a real
    // second page load / reopen against the now-already-v5 database.
    vi.resetModules();
    const second = await import('./db');
    const conn2 = track(await second.openDb());
    expect(conn2.version).toBe(19);
    expect(conn2.objectStoreNames.contains('collections')).toBe(true);
  });

  it('is idempotent within the normal IndexedDB upgrade lifecycle — no error surfaces from openDb()', async () => {
    const dbModule = await import('./db');
    await expect(dbModule.openDb().then((c) => track(c))).resolves.toBeDefined();
  });
});
