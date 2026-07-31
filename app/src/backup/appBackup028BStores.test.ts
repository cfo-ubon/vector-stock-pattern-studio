import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { buildAppBackup } from './appBackupBuilder';
import { applyAppBackupRestore, previewAppBackupRestore } from './appBackupRestore';
import { readZipArchive, buildCompressedZip } from './zipArchive';
import { restoreAllStores, dumpAllStores } from './appBackupIdb';
import { MANIFEST_ENTRY_NAME, DATABASE_ENTRY_NAME, APP_BACKUP_STORE_NAMES, type AppBackupManifest, type AppBackupDatabaseDump } from './appBackupFormat';
import { DB_VERSION, COLLECTION_PLANS_STORE, DESIGN_BRIEFS_STORE, DESIGN_CONFIGURATIONS_STORE } from '../storage/db';
import { createCreativeBrief } from '../design-director/domain/creativeBrief';
import { createCollectionPlan } from '../design-director/domain/collectionPlan';
import { createGeneratorHandoff } from '../design-director/domain/generatorHandoff';
import { putCreativeBrief, loadCreativeBriefs, clearCreativeBriefs, getCreativeBrief } from '../design-director/storage/creativeBriefStore';
import { putCollectionPlan, loadCollectionPlans, clearCollectionPlans, getCollectionPlan } from '../design-director/storage/collectionPlanStore';
import { putGeneratorHandoff, loadGeneratorHandoffs, clearGeneratorHandoffs, getGeneratorHandoff } from '../design-director/storage/generatorHandoffStore';

// Build 028B Hardening — .vspsb backup coverage for the 3 stores this
// build introduced/activated (`collectionPlans` new; `designBriefs`/
// `designConfigurations` pre-provisioned by Build 028 Phase 2 but only
// wired to a real store module in 028B). `appBackupBuilder.ts`/
// `appBackupIdb.ts`/`appBackupRestore.ts` are entirely generic over
// `APP_BACKUP_STORE_NAMES` (confirmed by reading them — no per-store
// special-casing anywhere), so most of what this file verifies is that
// registering these 3 names in that list actually gets them included
// end-to-end, not that the generic machinery itself needs new code.

// `appBackupHistoryStore` records (read back via fake-indexeddb, whose
// internal `structuredClone` doesn't recognize jsdom's own Blob — see
// `testSetup.ts`'s header comment) need Node's real Blob for the one test
// below that round-trips a Safety Backup's stored blob back through
// `applyAppBackupRestore` — same scoped swap `appBackupRestore.test.ts`
// already uses.
const originalBlob = globalThis.Blob;
beforeEach(async () => {
  await clearCreativeBriefs();
  await clearCollectionPlans();
  await clearGeneratorHandoffs();
  globalThis.Blob = NodeBlob as unknown as typeof Blob;
});
afterEach(() => {
  globalThis.Blob = originalBlob;
});

function seedBrief(overrides: Partial<Parameters<typeof createCreativeBrief>[0]> = {}) {
  return createCreativeBrief({ collectionName: 'Christmas Botanical', theme: 'christmas botanical', now: 1000, ...overrides });
}

describe('.vspsb coverage — collectionPlans / designBriefs / designConfigurations are registered', () => {
  it('APP_BACKUP_STORE_NAMES includes all three new/activated stores', () => {
    expect(APP_BACKUP_STORE_NAMES).toContain(DESIGN_BRIEFS_STORE);
    expect(APP_BACKUP_STORE_NAMES).toContain(DESIGN_CONFIGURATIONS_STORE);
    expect(APP_BACKUP_STORE_NAMES).toContain(COLLECTION_PLANS_STORE);
  });
});

describe('.vspsb — non-empty round trip', () => {
  it('backs up and restores a real CreativeBrief, CollectionPlan, and GeneratorHandoff, preserving IDs and foreign references', async () => {
    const brief = seedBrief();
    await putCreativeBrief(brief);

    const plan = createCollectionPlan({
      briefId: brief.id,
      name: 'Christmas Botanical, 30 Patterns',
      theme: brief.theme,
      totalSize: 30,
      patternTypeCounts: { hero: 5, secondary: 8, blender: 6, stripe: 3, border: 2, coordinate: 3, miniPattern: 2, texture: 1 },
      now: 2000,
    });
    await putCollectionPlan(plan);

    const handoff = createGeneratorHandoff({
      briefId: brief.id,
      collectionPlanId: plan.id,
      heroMotif: 'Poinsettia bouquet',
      categoryId: 'botanical',
      now: 3000,
    });
    await putGeneratorHandoff(handoff);

    const backup = await buildAppBackup();
    expect(backup.manifest.stats.storeRecordCounts[DESIGN_BRIEFS_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[COLLECTION_PLANS_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[DESIGN_CONFIGURATIONS_STORE]).toBe(1);

    // Mutate/clear after the backup, then restore.
    await clearCreativeBriefs();
    await clearCollectionPlans();
    await clearGeneratorHandoffs();
    expect(await loadCreativeBriefs()).toHaveLength(0);

    const result = await applyAppBackupRestore(backup.blob);
    expect(result.storeRecordCounts[DESIGN_BRIEFS_STORE]).toBe(1);
    expect(result.storeRecordCounts[COLLECTION_PLANS_STORE]).toBe(1);
    expect(result.storeRecordCounts[DESIGN_CONFIGURATIONS_STORE]).toBe(1);

    const restoredBrief = await getCreativeBrief(brief.id);
    const restoredPlan = await getCollectionPlan(plan.id);
    const restoredHandoff = await getGeneratorHandoff(handoff.id);
    expect(restoredBrief).toEqual(brief);
    expect(restoredPlan).toEqual(plan);
    expect(restoredHandoff).toEqual(handoff);
    // Foreign references survive the round trip intact.
    expect(restoredPlan?.briefId).toBe(brief.id);
    expect(restoredHandoff?.briefId).toBe(brief.id);
    expect(restoredHandoff?.collectionPlanId).toBe(plan.id);
  });

  it('restores multiple CollectionPlans for the same brief, preserving every id', async () => {
    const brief = seedBrief();
    await putCreativeBrief(brief);
    const planA = createCollectionPlan({ briefId: brief.id, name: 'Plan A', theme: 't', totalSize: 10, patternTypeCounts: { hero: 1, secondary: 1, blender: 1, stripe: 1, border: 1, coordinate: 1, miniPattern: 1, texture: 1 }, now: 10 });
    const planB = createCollectionPlan({ briefId: brief.id, name: 'Plan B', theme: 't', totalSize: 20, patternTypeCounts: { hero: 2, secondary: 2, blender: 2, stripe: 2, border: 2, coordinate: 2, miniPattern: 2, texture: 2 }, now: 20 });
    await putCollectionPlan(planA);
    await putCollectionPlan(planB);

    const backup = await buildAppBackup();
    await clearCollectionPlans();
    await applyAppBackupRestore(backup.blob);

    const restored = await loadCollectionPlans();
    expect(restored.map((p) => p.id).sort()).toEqual([planA.id, planB.id].sort());
  });
});

describe('.vspsb — empty-store behavior', () => {
  it('builds and restores cleanly when all three stores are empty (no errors, zero counts)', async () => {
    const backup = await buildAppBackup();
    expect(backup.manifest.stats.storeRecordCounts[DESIGN_BRIEFS_STORE]).toBe(0);
    expect(backup.manifest.stats.storeRecordCounts[COLLECTION_PLANS_STORE]).toBe(0);
    expect(backup.manifest.stats.storeRecordCounts[DESIGN_CONFIGURATIONS_STORE]).toBe(0);

    const result = await applyAppBackupRestore(backup.blob);
    expect(result.storeRecordCounts[DESIGN_BRIEFS_STORE]).toBe(0);
    expect(result.storeRecordCounts[COLLECTION_PLANS_STORE]).toBe(0);
    expect(result.storeRecordCounts[DESIGN_CONFIGURATIONS_STORE]).toBe(0);
    expect(await loadCreativeBriefs()).toHaveLength(0);
  });
});

describe('.vspsb — mixed old/new schema compatibility', () => {
  async function buildArchiveWithoutNewStores(dbVersion: number) {
    const backup = await buildAppBackup();
    const entries = await readZipArchive(backup.blob);

    // Simulate a genuine pre-028B backup: its database.json dump never
    // had these 3 keys at all (not merely empty arrays — the key itself
    // didn't exist yet, since `dumpAllStores` only iterates whatever list
    // the OLD app version's `APP_BACKUP_STORE_NAMES` had at the time).
    const dbEntry = entries.find((e) => e.name === DATABASE_ENTRY_NAME)!;
    const dump = JSON.parse(new TextDecoder().decode(dbEntry.data)) as AppBackupDatabaseDump;
    delete dump[DESIGN_BRIEFS_STORE];
    delete dump[COLLECTION_PLANS_STORE];
    delete dump[DESIGN_CONFIGURATIONS_STORE];
    const patchedDbBytes = new TextEncoder().encode(JSON.stringify(dump));

    const manifestEntry = entries.find((e) => e.name === MANIFEST_ENTRY_NAME)!;
    const manifest = JSON.parse(new TextDecoder().decode(manifestEntry.data)) as AppBackupManifest;
    manifest.metadata.dbVersion = dbVersion;
    delete manifest.stats.storeRecordCounts[DESIGN_BRIEFS_STORE];
    delete manifest.stats.storeRecordCounts[COLLECTION_PLANS_STORE];
    delete manifest.stats.storeRecordCounts[DESIGN_CONFIGURATIONS_STORE];
    const patchedManifestBytes = new TextEncoder().encode(JSON.stringify(manifest));

    const patched = entries.map((e) => {
      if (e.name === DATABASE_ENTRY_NAME) return { name: e.name, data: patchedDbBytes };
      if (e.name === MANIFEST_ENTRY_NAME) return { name: e.name, data: patchedManifestBytes };
      return e;
    });
    // checksums.sha256 must match the patched content or validation would
    // reject this as corrupted rather than exercising the old-backup path
    // this test actually wants to cover — rebuilding via
    // `buildCompressedZip` (which itself does not recompute checksums —
    // it round-trips whatever entries are handed to it) means we must
    // drop the stale checksums file, since a mismatched one is
    // indistinguishable from real tampering. `readZipArchive` validation
    // treats a fully-absent checksums.sha256 the same way the *old app
    // version* that produced this archive shape would not have — but to
    // isolate the version-compatibility behavior under test from
    // checksum validation (covered separately below), recompute a
    // consistent set instead of omitting it.
    return { patched, manifest };
  }

  it('restores successfully from a pre-028B backup missing these 3 stores entirely, flagged as olderBackup', async () => {
    const brief = seedBrief();
    await putCreativeBrief(brief);
    const { patched, manifest } = await buildArchiveWithoutNewStores(DB_VERSION - 1);

    // Recompute checksums for the patched content so this exercises the
    // version-gap path (not an unrelated checksum failure).
    const { sha256Hex } = await import('../catalog/domain/hash');
    const checksumLines: string[] = [];
    for (const entry of patched) {
      // checksums.sha256 covers every content entry EXCEPT manifest.json
      // itself (manifest.json is compressed and appended AFTER
      // checksums.sha256 is computed, mirroring `appBackupBuilder.ts`'s
      // own build order) and except its own file.
      if (entry.name === 'checksums.sha256' || entry.name === MANIFEST_ENTRY_NAME) continue;
      const hash = await sha256Hex(entry.data.buffer.slice(entry.data.byteOffset, entry.data.byteOffset + entry.data.byteLength) as ArrayBuffer);
      checksumLines.push(`${hash}  ${entry.name}`);
    }
    const checksumsBytes = new TextEncoder().encode(checksumLines.join('\n') + '\n');
    const archiveChecksum = await sha256Hex(checksumsBytes.buffer as ArrayBuffer);
    manifest.archiveChecksum = archiveChecksum;
    const finalManifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
    const finalEntries = patched.map((e) => {
      if (e.name === MANIFEST_ENTRY_NAME) return { name: e.name, data: finalManifestBytes };
      if (e.name === 'checksums.sha256') return { name: e.name, data: checksumsBytes };
      return e;
    });

    const { blob } = await buildCompressedZip(finalEntries);
    const result = await applyAppBackupRestore(blob);
    expect(result.compatibility.compatibility).toBe('olderBackup');
    // The 3 new stores simply weren't restored (nothing to restore) —
    // existing data for them is left untouched, never deleted.
    expect(result.storeRecordCounts[DESIGN_BRIEFS_STORE]).toBe(0);
    const stillThere = await getCreativeBrief(brief.id);
    expect(stillThere).toEqual(brief);
  });
});

describe('.vspsb — DB v9 backup restored into a fresh (cleared) database', () => {
  it('restores all three stores correctly starting from empty', async () => {
    const brief = seedBrief();
    await putCreativeBrief(brief);
    const plan = createCollectionPlan({ briefId: brief.id, name: 'Fresh Restore Plan', theme: 't', totalSize: 5, patternTypeCounts: { hero: 1, secondary: 1, blender: 1, stripe: 0, border: 0, coordinate: 1, miniPattern: 0, texture: 1 }, now: 500 });
    await putCollectionPlan(plan);
    const backup = await buildAppBackup();

    await clearCreativeBriefs();
    await clearCollectionPlans();

    const preview = await previewAppBackupRestore(backup.blob);
    expect(preview.canRestore).toBe(true);

    await applyAppBackupRestore(backup.blob);
    expect(await getCreativeBrief(brief.id)).toEqual(brief);
    expect(await getCollectionPlan(plan.id)).toEqual(plan);
  });
});

describe('.vspsb — checksum failure on a 028B store', () => {
  it('rejects a backup whose database.json was tampered to alter a CollectionPlan record', async () => {
    const brief = seedBrief();
    await putCreativeBrief(brief);
    const plan = createCollectionPlan({ briefId: brief.id, name: 'Original Name', theme: 't', totalSize: 1, patternTypeCounts: { hero: 1, secondary: 0, blender: 0, stripe: 0, border: 0, coordinate: 0, miniPattern: 0, texture: 0 }, now: 1 });
    await putCollectionPlan(plan);
    const backup = await buildAppBackup();

    const entries = await readZipArchive(backup.blob);
    const dbEntry = entries.find((e) => e.name === DATABASE_ENTRY_NAME)!;
    const dump = JSON.parse(new TextDecoder().decode(dbEntry.data)) as AppBackupDatabaseDump;
    (dump[COLLECTION_PLANS_STORE][0] as { name: string }).name = 'TAMPERED';
    const tamperedBytes = new TextEncoder().encode(JSON.stringify(dump));
    const tampered = entries.map((e) => (e.name === DATABASE_ENTRY_NAME ? { name: e.name, data: tamperedBytes } : e));
    const { blob } = await buildCompressedZip(tampered);

    await expect(applyAppBackupRestore(blob)).rejects.toThrow();
    // Rejected before any write — original record untouched.
    expect((await getCollectionPlan(plan.id))?.name).toBe('Original Name');
  });
});

describe('.vspsb — interrupted restore recovers on retry (self-heals, upsert semantics)', () => {
  it('a restore that only got through some stores before stopping completes correctly when retried', async () => {
    const brief = seedBrief();
    await putCreativeBrief(brief);
    const plan = createCollectionPlan({ briefId: brief.id, name: 'Interrupted Plan', theme: 't', totalSize: 1, patternTypeCounts: { hero: 1, secondary: 0, blender: 0, stripe: 0, border: 0, coordinate: 0, miniPattern: 0, texture: 0 }, now: 1 });
    await putCollectionPlan(plan);
    const handoff = createGeneratorHandoff({ briefId: brief.id, collectionPlanId: plan.id, heroMotif: 'Hero', categoryId: 'botanical', now: 1 });
    await putGeneratorHandoff(handoff);

    const dump = await dumpAllStores(APP_BACKUP_STORE_NAMES);

    // Simulate an interruption between two of `restoreAllStores`'s
    // sequential per-store writes: only the brief and plan "landed"
    // before the interruption; the handoff (and everything the real
    // for-loop would restore after it) never did.
    await clearCreativeBriefs();
    await clearCollectionPlans();
    await clearGeneratorHandoffs();
    await restoreAllStores({ [DESIGN_BRIEFS_STORE]: dump[DESIGN_BRIEFS_STORE], [COLLECTION_PLANS_STORE]: dump[COLLECTION_PLANS_STORE] }, [DESIGN_BRIEFS_STORE, COLLECTION_PLANS_STORE]);
    expect(await getGeneratorHandoff(handoff.id)).toBeUndefined();

    // Retrying the FULL restore (the real recovery action a user takes
    // after any interrupted restore) reaches a fully correct end state —
    // upsert semantics mean the already-landed brief/plan are simply
    // overwritten with the same values, not duplicated, and the
    // previously-missed handoff is added.
    const counts = await restoreAllStores(dump, APP_BACKUP_STORE_NAMES);
    expect(counts[DESIGN_BRIEFS_STORE]).toBe(1);
    expect(counts[COLLECTION_PLANS_STORE]).toBe(1);
    expect(counts[DESIGN_CONFIGURATIONS_STORE]).toBe(1);
    expect(await getCreativeBrief(brief.id)).toEqual(brief);
    expect(await getCollectionPlan(plan.id)).toEqual(plan);
    expect(await getGeneratorHandoff(handoff.id)).toEqual(handoff);

    // A second retry changes nothing further (full idempotency).
    const retryCounts = await restoreAllStores(dump, APP_BACKUP_STORE_NAMES);
    expect(retryCounts[DESIGN_CONFIGURATIONS_STORE]).toBe(1);
    expect(await loadGeneratorHandoffs()).toHaveLength(1);
  });

  it('a bad restore can be undone via its own mandatory Safety Backup (this system’s actual rollback path)', async () => {
    const brief = seedBrief({ collectionName: 'Pre-Restore Value' });
    await putCreativeBrief(brief);

    // The restore's own Safety Backup (taken automatically, before any
    // write) is the recovery path this system actually offers for "I
    // restored the wrong thing" — verified here by restoring an archive
    // that changes the brief, then restoring the Safety Backup back.
    const otherBrief = seedBrief({ collectionName: 'From Other Backup' });
    await clearCreativeBriefs();
    await putCreativeBrief({ ...otherBrief, id: brief.id });
    const incomingBackup = await buildAppBackup();

    await clearCreativeBriefs();
    await putCreativeBrief(brief); // back to the pre-restore value
    const result = await applyAppBackupRestore(incomingBackup.blob);
    expect((await getCreativeBrief(brief.id))?.collectionName).toBe('From Other Backup');

    const { listBackupHistory } = await import('./appBackupHistoryStore');
    const history = await listBackupHistory();
    const safetyRecord = history.find((r) => r.historyId === result.safetyBackupHistoryId);
    expect(safetyRecord?.blob).toBeTruthy();

    await applyAppBackupRestore(safetyRecord!.blob!);
    expect((await getCreativeBrief(brief.id))?.collectionName).toBe('Pre-Restore Value');
  });
});
