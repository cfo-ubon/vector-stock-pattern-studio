import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { buildAppBackup } from './appBackupBuilder';
import { applyAppBackupRestore, previewAppBackupRestore } from './appBackupRestore';
import { readZipArchive, buildCompressedZip } from './zipArchive';
import { restoreAllStores, dumpAllStores } from './appBackupIdb';
import { MANIFEST_ENTRY_NAME, DATABASE_ENTRY_NAME, APP_BACKUP_STORE_NAMES, type AppBackupManifest, type AppBackupDatabaseDump } from './appBackupFormat';
import { DB_VERSION, MARKETING_DESIGN_HANDOFFS_STORE } from '../storage/db';
import { createCreativeBrief } from '../design-director/domain/creativeBrief';
import { createCollectionPlan, getCollectionPlanItems, type CollectionPlan } from '../design-director/domain/collectionPlan';
import { createGeneratorHandoff, type GeneratorHandoff } from '../design-director/domain/generatorHandoff';
import { createMarketingDesignHandoff, transitionMarketingDesignHandoffWorkflow } from '../design-director/domain/marketingDesignHandoff';
import { putCreativeBrief, clearCreativeBriefs } from '../design-director/storage/creativeBriefStore';
import { putCollectionPlan, clearCollectionPlans, getCollectionPlan } from '../design-director/storage/collectionPlanStore';
import { putGeneratorHandoff, clearGeneratorHandoffs, getGeneratorHandoff } from '../design-director/storage/generatorHandoffStore';
import {
  putMarketingDesignHandoff,
  loadMarketingDesignHandoffs,
  clearMarketingDesignHandoffs,
  getMarketingDesignHandoff,
} from '../design-director/storage/marketingDesignHandoffStore';
import { buildGeneratorHandoffApplication } from '../design-director/handoff/applyGeneratorHandoff';
import { defaultParams } from '../engine/defaults';

// Build 028C — .vspsb backup coverage for `marketingDesignHandoffs` (the
// one new store this build activates — pre-provisioned since Build 028
// Phase 2, first given a real read/write store module here) plus
// collectionItemId end-to-end coverage (requirement #9): a real
// CollectionPlanItem id threaded through GeneratorHandoff.collectionItemId
// -> GeneratorHandoffLineage.collectionItemId -> GenerateParams.sourceLineage,
// verified to survive a real JSON round trip and a full .vspsb backup/restore
// cycle. Follows the exact template `appBackup028BStores.test.ts` already
// established.

const originalBlob = globalThis.Blob;
beforeEach(async () => {
  await clearCreativeBriefs();
  await clearCollectionPlans();
  await clearGeneratorHandoffs();
  await clearMarketingDesignHandoffs();
  globalThis.Blob = NodeBlob as unknown as typeof Blob;
});
afterEach(() => {
  globalThis.Blob = originalBlob;
});

function seedBrief(overrides: Partial<Parameters<typeof createCreativeBrief>[0]> = {}) {
  return createCreativeBrief({ collectionName: 'Spring Florals', theme: 'spring florals', now: 1000, ...overrides });
}

describe('.vspsb coverage — marketingDesignHandoffs is registered', () => {
  it('APP_BACKUP_STORE_NAMES includes the new store', () => {
    expect(APP_BACKUP_STORE_NAMES).toContain(MARKETING_DESIGN_HANDOFFS_STORE);
  });
});

describe('.vspsb — non-empty round trip', () => {
  it('backs up and restores a real MarketingDesignHandoff, preserving workflow history and every foreign reference', async () => {
    const brief = seedBrief();
    await putCreativeBrief(brief);
    const plan = createCollectionPlan({
      briefId: brief.id,
      name: 'Spring Florals, 10 Patterns',
      theme: brief.theme,
      totalSize: 10,
      patternTypeCounts: { hero: 2, secondary: 2, blender: 2, stripe: 1, border: 1, coordinate: 1, miniPattern: 1, texture: 0 },
      now: 2000,
    });
    await putCollectionPlan(plan);
    const item = getCollectionPlanItems(plan)[0];
    const handoff = createGeneratorHandoff({
      briefId: brief.id,
      collectionPlanId: plan.id,
      collectionItemId: item.id,
      heroMotif: 'Tulip bouquet',
      categoryId: 'botanical',
      now: 3000,
    });
    await putGeneratorHandoff(handoff);

    let marketingHandoff = createMarketingDesignHandoff({
      marketSnapshotId: 'SNAP-20260101-AAAAAA',
      marketOpportunityId: 'OPP-20260101-BBBBBB',
      dailyMissionId: 'MISN-20260101-CCCCCC',
      evidenceRefs: ['obs:OBS-1'],
      opportunityScore: 82,
      confidence: 'high',
      dataFreshness: '2 days old',
      targetMarketplace: 'Etsy',
      targetProducts: ['giftWrap'],
      recommendedTheme: 'spring florals',
      heroMotif: 'Tulip bouquet',
      composition: 'balanced-toss',
      palette: ['#ffffff', '#ffb6c1'],
      productionTiming: 'Q2',
      now: 4000,
    });
    marketingHandoff = transitionMarketingDesignHandoffWorkflow({ ...marketingHandoff, creativeBriefId: brief.id }, 'BRIEF_DRAFT', 4100);
    marketingHandoff = transitionMarketingDesignHandoffWorkflow({ ...marketingHandoff, collectionPlanId: plan.id }, 'COLLECTION_PLANNED', 4200);
    marketingHandoff = transitionMarketingDesignHandoffWorkflow(
      { ...marketingHandoff, collectionItemId: item.id, generatorHandoffId: handoff.id },
      'READY_FOR_GENERATOR',
      4300,
    );
    await putMarketingDesignHandoff(marketingHandoff);

    const backup = await buildAppBackup();
    expect(backup.manifest.stats.storeRecordCounts[MARKETING_DESIGN_HANDOFFS_STORE]).toBe(1);

    await clearMarketingDesignHandoffs();
    expect(await loadMarketingDesignHandoffs()).toHaveLength(0);

    const result = await applyAppBackupRestore(backup.blob);
    expect(result.storeRecordCounts[MARKETING_DESIGN_HANDOFFS_STORE]).toBe(1);

    const restored = await getMarketingDesignHandoff(marketingHandoff.id);
    expect(restored).toEqual(marketingHandoff);
    expect(restored?.workflowHistory.map((h) => h.status)).toEqual([
      'MARKETING_RESEARCH',
      'OPPORTUNITY_SELECTED',
      'BRIEF_DRAFT',
      'COLLECTION_PLANNED',
      'READY_FOR_GENERATOR',
    ]);
    // Foreign references survive the round trip intact.
    expect(restored?.creativeBriefId).toBe(brief.id);
    expect(restored?.collectionPlanId).toBe(plan.id);
    expect(restored?.collectionItemId).toBe(item.id);
    expect(restored?.generatorHandoffId).toBe(handoff.id);
  });
});

describe('.vspsb — empty-store behavior', () => {
  it('builds and restores cleanly when marketingDesignHandoffs is empty', async () => {
    const backup = await buildAppBackup();
    expect(backup.manifest.stats.storeRecordCounts[MARKETING_DESIGN_HANDOFFS_STORE]).toBe(0);
    const result = await applyAppBackupRestore(backup.blob);
    expect(result.storeRecordCounts[MARKETING_DESIGN_HANDOFFS_STORE]).toBe(0);
    expect(await loadMarketingDesignHandoffs()).toHaveLength(0);
  });
});

describe('.vspsb — mixed old/new schema compatibility', () => {
  it('restores successfully from a pre-028C backup missing marketingDesignHandoffs entirely, flagged as olderBackup', async () => {
    const brief = seedBrief();
    await putCreativeBrief(brief);
    const backup = await buildAppBackup();
    const entries = await readZipArchive(backup.blob);

    const dbEntry = entries.find((e) => e.name === DATABASE_ENTRY_NAME)!;
    const dump = JSON.parse(new TextDecoder().decode(dbEntry.data)) as AppBackupDatabaseDump;
    delete dump[MARKETING_DESIGN_HANDOFFS_STORE];
    const patchedDbBytes = new TextEncoder().encode(JSON.stringify(dump));

    const manifestEntry = entries.find((e) => e.name === MANIFEST_ENTRY_NAME)!;
    const manifest = JSON.parse(new TextDecoder().decode(manifestEntry.data)) as AppBackupManifest;
    manifest.metadata.dbVersion = DB_VERSION - 1;
    delete manifest.stats.storeRecordCounts[MARKETING_DESIGN_HANDOFFS_STORE];

    const patched = entries.map((e) => {
      if (e.name === DATABASE_ENTRY_NAME) return { name: e.name, data: patchedDbBytes };
      return e;
    });

    // Recompute checksums for the patched content so this exercises the
    // version-gap path (not an unrelated checksum failure) — mirrors
    // appBackup028BStores.test.ts's own approach exactly.
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
    expect(result.storeRecordCounts[MARKETING_DESIGN_HANDOFFS_STORE]).toBe(0);
  });
});

describe('.vspsb — current DB version backup restored into a fresh (cleared) database', () => {
  it('restores marketingDesignHandoffs correctly starting from empty', async () => {
    const handoff = createMarketingDesignHandoff({ recommendedTheme: 'fresh restore theme', now: 500 });
    await putMarketingDesignHandoff(handoff);
    const backup = await buildAppBackup();

    await clearMarketingDesignHandoffs();
    const preview = await previewAppBackupRestore(backup.blob);
    expect(preview.canRestore).toBe(true);

    await applyAppBackupRestore(backup.blob);
    expect(await getMarketingDesignHandoff(handoff.id)).toEqual(handoff);
  });
});

describe('.vspsb — checksum failure on a marketingDesignHandoffs record', () => {
  it('rejects a backup whose database.json was tampered to alter a MarketingDesignHandoff record', async () => {
    const handoff = createMarketingDesignHandoff({ recommendedTheme: 'Original Theme', now: 1 });
    await putMarketingDesignHandoff(handoff);
    const backup = await buildAppBackup();

    const entries = await readZipArchive(backup.blob);
    const dbEntry = entries.find((e) => e.name === DATABASE_ENTRY_NAME)!;
    const dump = JSON.parse(new TextDecoder().decode(dbEntry.data)) as AppBackupDatabaseDump;
    (dump[MARKETING_DESIGN_HANDOFFS_STORE][0] as { recommendedTheme: string }).recommendedTheme = 'TAMPERED';
    const tamperedBytes = new TextEncoder().encode(JSON.stringify(dump));
    const tampered = entries.map((e) => (e.name === DATABASE_ENTRY_NAME ? { name: e.name, data: tamperedBytes } : e));
    const { blob } = await buildCompressedZip(tampered);

    await expect(applyAppBackupRestore(blob)).rejects.toThrow();
    expect((await getMarketingDesignHandoff(handoff.id))?.recommendedTheme).toBe('Original Theme');
  });
});

describe('.vspsb — interrupted restore recovers on retry (self-heals, upsert semantics)', () => {
  it('a restore that only got through some stores before stopping completes correctly when retried', async () => {
    const brief = seedBrief();
    await putCreativeBrief(brief);
    let handoff = createMarketingDesignHandoff({ recommendedTheme: 'Interrupted Theme', now: 1 });
    handoff = transitionMarketingDesignHandoffWorkflow({ ...handoff, creativeBriefId: brief.id }, 'BRIEF_DRAFT');
    await putMarketingDesignHandoff(handoff);

    const dump = await dumpAllStores(APP_BACKUP_STORE_NAMES);

    await clearCreativeBriefs();
    await clearMarketingDesignHandoffs();
    // Simulate an interruption where only designBriefs "landed".
    await restoreAllStores({ designBriefs: dump.designBriefs }, ['designBriefs']);
    expect(await getMarketingDesignHandoff(handoff.id)).toBeUndefined();

    const counts = await restoreAllStores(dump, APP_BACKUP_STORE_NAMES);
    expect(counts[MARKETING_DESIGN_HANDOFFS_STORE]).toBe(1);
    expect(await getMarketingDesignHandoff(handoff.id)).toEqual(handoff);

    const retryCounts = await restoreAllStores(dump, APP_BACKUP_STORE_NAMES);
    expect(retryCounts[MARKETING_DESIGN_HANDOFFS_STORE]).toBe(1);
    expect(await loadMarketingDesignHandoffs()).toHaveLength(1);
  });
});

describe('Build 028C, requirement #9 — collectionItemId end-to-end', () => {
  it('threads a real CollectionPlanItem id through GeneratorHandoff -> lineage -> GenerateParams.sourceLineage, surviving JSON round-trip', () => {
    const brief = seedBrief({ now: 1 });
    const plan = createCollectionPlan({
      briefId: brief.id,
      name: 'Plan',
      theme: 'spring florals',
      totalSize: 3,
      patternTypeCounts: { hero: 1, secondary: 1, blender: 1, stripe: 0, border: 0, coordinate: 0, miniPattern: 0, texture: 0 },
      now: 2,
    });
    const item = getCollectionPlanItems(plan)[0];
    expect(item).toBeTruthy();
    const handoff = createGeneratorHandoff({ briefId: brief.id, collectionPlanId: plan.id, collectionItemId: item.id, heroMotif: 'Tulip', categoryId: 'botanical', now: 3 });
    expect(handoff.collectionItemId).toBe(item.id);

    const application = buildGeneratorHandoffApplication(handoff, brief, plan, null);
    expect(application.lineage.collectionItemId).toBe(item.id);

    const params = { ...defaultParams(), sourceLineage: application.lineage };
    const roundTripped = JSON.parse(JSON.stringify(params));
    expect(roundTripped.sourceLineage.collectionItemId).toBe(item.id);
  });

  it('.vspsb backup/restore preserves GeneratorHandoff.collectionItemId', async () => {
    const brief = seedBrief({ now: 1 });
    await putCreativeBrief(brief);
    const plan = createCollectionPlan({
      briefId: brief.id,
      name: 'Plan',
      theme: 'spring florals',
      totalSize: 1,
      patternTypeCounts: { hero: 1, secondary: 0, blender: 0, stripe: 0, border: 0, coordinate: 0, miniPattern: 0, texture: 0 },
      now: 2,
    });
    await putCollectionPlan(plan);
    const item = getCollectionPlanItems(plan)[0];
    const handoff = createGeneratorHandoff({ briefId: brief.id, collectionPlanId: plan.id, collectionItemId: item.id, heroMotif: 'Tulip', categoryId: 'botanical', now: 3 });
    await putGeneratorHandoff(handoff);

    const backup = await buildAppBackup();
    await clearGeneratorHandoffs();
    await applyAppBackupRestore(backup.blob);

    const restored = await getGeneratorHandoff(handoff.id);
    expect(restored?.collectionItemId).toBe(item.id);
  });

  it('migration: an old-shaped CollectionPlan (no items array) and GeneratorHandoff (no collectionItemId) still load and validate correctly', async () => {
    const brief = seedBrief({ now: 1 });
    await putCreativeBrief(brief);
    const modernPlan = createCollectionPlan({
      briefId: brief.id,
      name: 'Plan',
      theme: 't',
      totalSize: 1,
      patternTypeCounts: { hero: 1, secondary: 0, blender: 0, stripe: 0, border: 0, coordinate: 0, miniPattern: 0, texture: 0 },
      now: 2,
    });
    // Simulate a pre-028C record: strip the `items` field entirely (as a
    // genuinely old record in IndexedDB would never have had it).
    const oldPlan = { ...modernPlan } as Partial<CollectionPlan>;
    delete oldPlan.items;
    await putCollectionPlan(oldPlan as CollectionPlan);
    const loadedPlan = await getCollectionPlan(modernPlan.id);
    expect(loadedPlan).toBeTruthy();
    expect(getCollectionPlanItems(loadedPlan!)).toEqual([]);

    const modernHandoff = createGeneratorHandoff({ briefId: brief.id, collectionPlanId: modernPlan.id, heroMotif: 'Tulip', categoryId: 'botanical', now: 3 });
    const oldHandoff = { ...modernHandoff } as Partial<GeneratorHandoff>;
    delete oldHandoff.collectionItemId;
    await putGeneratorHandoff(oldHandoff as GeneratorHandoff);
    const loadedHandoff = await getGeneratorHandoff(modernHandoff.id);
    expect(loadedHandoff).toBeTruthy();
    expect(loadedHandoff?.collectionItemId).toBeUndefined();

    // The lineage builder must honestly report null, never fabricate an id.
    const application = buildGeneratorHandoffApplication(loadedHandoff!, brief, loadedPlan!, null);
    expect(application.lineage.collectionItemId).toBeNull();
  });
});
