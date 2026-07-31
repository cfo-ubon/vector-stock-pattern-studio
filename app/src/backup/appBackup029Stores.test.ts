import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { buildAppBackup } from './appBackupBuilder';
import { applyAppBackupRestore, previewAppBackupRestore } from './appBackupRestore';
import { readZipArchive, buildCompressedZip } from './zipArchive';
import { restoreAllStores, dumpAllStores } from './appBackupIdb';
import { MANIFEST_ENTRY_NAME, DATABASE_ENTRY_NAME, APP_BACKUP_STORE_NAMES, type AppBackupManifest, type AppBackupDatabaseDump } from './appBackupFormat';
import { DB_VERSION, AUTONOMOUS_DESIGN_RUNS_STORE } from '../storage/db';
import { createAutonomousDesignRun, transitionAutonomousDesignRun } from '../autopilot/domain/autonomousDesignRun';
import {
  putAutonomousDesignRun,
  loadAutonomousDesignRuns,
  clearAutonomousDesignRuns,
  getAutonomousDesignRun,
} from '../autopilot/storage/autonomousDesignRunStore';

// Build 029 — .vspsb backup coverage for the new `autonomousDesignRuns`
// store, following the exact template `appBackup028CStores.test.ts` already
// established.

const originalBlob = globalThis.Blob;
beforeEach(async () => {
  await clearAutonomousDesignRuns();
  globalThis.Blob = NodeBlob as unknown as typeof Blob;
});
afterEach(() => {
  globalThis.Blob = originalBlob;
});

describe('.vspsb coverage — autonomousDesignRuns is registered', () => {
  it('APP_BACKUP_STORE_NAMES includes the new store', () => {
    expect(APP_BACKUP_STORE_NAMES).toContain(AUTONOMOUS_DESIGN_RUNS_STORE);
  });
});

describe('.vspsb — non-empty round trip', () => {
  it('backs up and restores a real AutonomousDesignRun, preserving its full transition history', async () => {
    let run = createAutonomousDesignRun({
      mode: 'FULL_AUTOPILOT',
      requestedCount: 10,
      sourceEvidence: { marketSnapshotId: 'SNAP-20260101-AAAAAA', marketOpportunityId: 'OPP-20260101-BBBBBB', dailyMissionId: null },
      now: 1000,
    });
    run = transitionAutonomousDesignRun(run, 'PLAN_READY', 1100);
    run = transitionAutonomousDesignRun(run, 'GENERATING', 1200);
    await putAutonomousDesignRun(run);

    const backup = await buildAppBackup();
    expect(backup.manifest.stats.storeRecordCounts[AUTONOMOUS_DESIGN_RUNS_STORE]).toBe(1);

    await clearAutonomousDesignRuns();
    expect(await loadAutonomousDesignRuns()).toHaveLength(0);

    const result = await applyAppBackupRestore(backup.blob);
    expect(result.storeRecordCounts[AUTONOMOUS_DESIGN_RUNS_STORE]).toBe(1);

    const restored = await getAutonomousDesignRun(run.id);
    expect(restored).toEqual(run);
    expect(restored?.history.map((h) => h.status)).toEqual(['PLAN_DRAFT', 'PLAN_READY', 'GENERATING']);
  });
});

describe('.vspsb — empty-store behavior', () => {
  it('builds and restores cleanly when autonomousDesignRuns is empty', async () => {
    const backup = await buildAppBackup();
    expect(backup.manifest.stats.storeRecordCounts[AUTONOMOUS_DESIGN_RUNS_STORE]).toBe(0);
    const result = await applyAppBackupRestore(backup.blob);
    expect(result.storeRecordCounts[AUTONOMOUS_DESIGN_RUNS_STORE]).toBe(0);
    expect(await loadAutonomousDesignRuns()).toHaveLength(0);
  });
});

describe('.vspsb — mixed old/new schema compatibility', () => {
  it('restores successfully from a pre-029 backup missing autonomousDesignRuns entirely, flagged as olderBackup', async () => {
    const backup = await buildAppBackup();
    const entries = await readZipArchive(backup.blob);

    const dbEntry = entries.find((e) => e.name === DATABASE_ENTRY_NAME)!;
    const dump = JSON.parse(new TextDecoder().decode(dbEntry.data)) as AppBackupDatabaseDump;
    delete dump[AUTONOMOUS_DESIGN_RUNS_STORE];
    const patchedDbBytes = new TextEncoder().encode(JSON.stringify(dump));

    const manifestEntry = entries.find((e) => e.name === MANIFEST_ENTRY_NAME)!;
    const manifest = JSON.parse(new TextDecoder().decode(manifestEntry.data)) as AppBackupManifest;
    manifest.metadata.dbVersion = DB_VERSION - 1;
    delete manifest.stats.storeRecordCounts[AUTONOMOUS_DESIGN_RUNS_STORE];

    const patched = entries.map((e) => {
      if (e.name === DATABASE_ENTRY_NAME) return { name: e.name, data: patchedDbBytes };
      return e;
    });

    const { sha256Hex } = await import('../catalog/domain/hash');
    const checksumLines: string[] = [];
    for (const entry of patched) {
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
    expect(result.storeRecordCounts[AUTONOMOUS_DESIGN_RUNS_STORE]).toBe(0);
  });
});

describe('.vspsb — current DB version backup restored into a fresh (cleared) database', () => {
  it('restores autonomousDesignRuns correctly starting from empty', async () => {
    const run = createAutonomousDesignRun({ mode: 'PORTFOLIO_GAP', requestedCount: 5, now: 500 });
    await putAutonomousDesignRun(run);
    const backup = await buildAppBackup();

    await clearAutonomousDesignRuns();
    const preview = await previewAppBackupRestore(backup.blob);
    expect(preview.canRestore).toBe(true);

    await applyAppBackupRestore(backup.blob);
    expect(await getAutonomousDesignRun(run.id)).toEqual(run);
  });
});

describe('.vspsb — checksum failure on an autonomousDesignRuns record', () => {
  it('rejects a backup whose database.json was tampered to alter an AutonomousDesignRun record', async () => {
    const run = createAutonomousDesignRun({ mode: 'EVERGREEN_COMMERCIAL', requestedCount: 3, now: 1 });
    await putAutonomousDesignRun(run);
    const backup = await buildAppBackup();

    const entries = await readZipArchive(backup.blob);
    const dbEntry = entries.find((e) => e.name === DATABASE_ENTRY_NAME)!;
    const dump = JSON.parse(new TextDecoder().decode(dbEntry.data)) as AppBackupDatabaseDump;
    (dump[AUTONOMOUS_DESIGN_RUNS_STORE][0] as { requestedCount: number }).requestedCount = 999;
    const tamperedBytes = new TextEncoder().encode(JSON.stringify(dump));
    const tampered = entries.map((e) => (e.name === DATABASE_ENTRY_NAME ? { name: e.name, data: tamperedBytes } : e));
    const { blob } = await buildCompressedZip(tampered);

    await expect(applyAppBackupRestore(blob)).rejects.toThrow();
    expect((await getAutonomousDesignRun(run.id))?.requestedCount).toBe(3);
  });
});

describe('.vspsb — interrupted restore recovers on retry (self-heals, upsert semantics)', () => {
  it('a restore that only got through some stores before stopping completes correctly when retried', async () => {
    const run = createAutonomousDesignRun({ mode: 'SEASONAL_OPPORTUNITY', requestedCount: 8, now: 1 });
    await putAutonomousDesignRun(run);

    const dump = await dumpAllStores(APP_BACKUP_STORE_NAMES);

    await clearAutonomousDesignRuns();
    await restoreAllStores({ marketingDesignHandoffs: dump.marketingDesignHandoffs }, ['marketingDesignHandoffs']);
    expect(await getAutonomousDesignRun(run.id)).toBeUndefined();

    const counts = await restoreAllStores(dump, APP_BACKUP_STORE_NAMES);
    expect(counts[AUTONOMOUS_DESIGN_RUNS_STORE]).toBe(1);
    expect(await getAutonomousDesignRun(run.id)).toEqual(run);

    const retryCounts = await restoreAllStores(dump, APP_BACKUP_STORE_NAMES);
    expect(retryCounts[AUTONOMOUS_DESIGN_RUNS_STORE]).toBe(1);
    expect(await loadAutonomousDesignRuns()).toHaveLength(1);
  });
});
