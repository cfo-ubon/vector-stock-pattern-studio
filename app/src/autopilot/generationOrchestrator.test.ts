import { describe, it, expect, beforeEach, vi } from 'vitest';
import { File as NodeFile } from 'node:buffer';
import { runAutonomousGeneration } from './generationOrchestrator';
import { createAutonomousDesignRun, transitionAutonomousDesignRun, type AutonomousDesignRun } from './domain/autonomousDesignRun';
import { createCollectionPlan, getCollectionPlanItems } from '../design-director/domain/collectionPlan';
import { createCreativeBrief } from '../design-director/domain/creativeBrief';
import { emptyAutopilotConstraints } from './domain/constraints';
import type { DesignPlan } from './domain/designPlan';
import { clearPortfolioStores, loadPortfolioAssets } from '../catalog/storage/portfolioStore';

// Same fake-indexeddb/structuredClone workaround `batchProductionService.test.ts`
// uses — `generationOrchestrator.ts` builds its own real File objects
// internally (generated SVG/JSON content), so jsdom's own File (which
// Node's structuredClone used by fake-indexeddb doesn't recognize) needs
// swapping for Node's real one for the duration of this file's tests only.
beforeEach(() => {
  vi.stubGlobal('File', NodeFile);
});

beforeEach(async () => {
  await clearPortfolioStores();
});

function makeDesignPlan(overrides: Partial<DesignPlan> = {}): DesignPlan {
  return {
    summary: 'Test autopilot collection',
    decisions: [
      { key: 'categoryId', label: 'Category', value: 'geometric', rationaleTh: 'x', rationaleEn: 'x', source: 'generatorDefault', userLocked: false },
      { key: 'heroMotif', label: 'Hero Motif', value: 'Not Provided — generator will select a hero motif from the chosen category', rationaleTh: 'x', rationaleEn: 'x', source: 'generatorDefault', userLocked: false },
      { key: 'palette', label: 'Palette', value: 'Auto (category default palette)', rationaleTh: 'x', rationaleEn: 'x', source: 'generatorDefault', userLocked: false },
    ],
    marketEvidence: [],
    portfolioReason: '',
    targetMarketplace: 'Etsy',
    targetCustomer: 'Not Provided',
    targetProducts: [],
    collectionStructure: [
      { role: 'hero', count: 1 },
      { role: 'secondary', count: 1 },
      { role: 'blender', count: 1 },
    ],
    visualDirection: '',
    paletteDirection: '',
    estimatedProductionEffort: '',
    risks: [],
    confidence: 'unknown',
    dataFreshness: '',
    offline: true,
    ...overrides,
  };
}

function makeCollectionPlan(totalSize = 3) {
  return createCollectionPlan({
    briefId: 'BRF-1',
    name: 'Test autopilot collection',
    theme: 'geometric',
    totalSize,
    patternTypeCounts: { hero: 1, secondary: 1, blender: 1, stripe: 0, border: 0, coordinate: 0, miniPattern: 0, texture: 0 },
    now: 1000,
  });
}

function makeBrief() {
  return createCreativeBrief({ collectionName: 'Test autopilot collection', theme: 'geometric', now: 1000 });
}

function makeRun(overrides: Partial<AutonomousDesignRun> = {}): AutonomousDesignRun {
  let run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 3, constraints: emptyAutopilotConstraints(), now: 1000 });
  run = { ...run, designPlan: makeDesignPlan(), collectionPlanId: 'CPL-1', creativeBriefId: 'BRF-1' };
  run = transitionAutonomousDesignRun(run, 'PLAN_READY', 1000);
  run = transitionAutonomousDesignRun(run, 'GENERATING', 1000);
  return { ...run, ...overrides };
}

describe('runAutonomousGeneration', () => {
  it('generates every Collection Plan Item end-to-end with no manual field selection, and reaches COMPLETED', async () => {
    const plan = makeCollectionPlan(3);
    const brief = makeBrief();
    const run = makeRun();
    const persisted: AutonomousDesignRun[] = [];

    const result = await runAutonomousGeneration({
      run,
      brief,
      plan,
      opportunity: null,
      existingAssets: [],
      persistRun: async (r) => {
        persisted.push(r);
      },
    });

    expect(result.status).toBe('COMPLETED');
    expect(result.completedCount).toBe(3);
    expect(result.items).toHaveLength(3);
    expect(result.readyCount + result.reviewCount + result.rejectCount).toBe(3);
    // Progress persisted after every single item, not only at the end.
    expect(persisted.length).toBeGreaterThanOrEqual(3);
    expect(persisted[persisted.length - 1].status).toBe('COMPLETED');

    const assets = await loadPortfolioAssets();
    expect(assets.length).toBe(3);
  }, 30000);

  it('threads a distinct collectionItemId per generated item, matching the real Collection Plan Items', async () => {
    const plan = makeCollectionPlan(3);
    const brief = makeBrief();
    const run = makeRun();
    const items = getCollectionPlanItems(plan);

    const result = await runAutonomousGeneration({
      run,
      brief,
      plan,
      opportunity: null,
      existingAssets: [],
      persistRun: async () => {},
    });

    const resultItemIds = result.items.map((i) => i.collectionItemId).sort();
    const planItemIds = items.map((i) => i.id).sort();
    expect(resultItemIds).toEqual(planItemIds);
  }, 30000);

  it('pausing via shouldPause transitions to PAUSED and preserves resumeFromIndex for a later resume', async () => {
    const plan = makeCollectionPlan(3);
    const brief = makeBrief();
    const run = makeRun();
    let calls = 0;

    const paused = await runAutonomousGeneration({
      run,
      brief,
      plan,
      opportunity: null,
      existingAssets: [],
      shouldPause: () => {
        calls++;
        return calls > 1;
      },
      persistRun: async () => {},
    });

    expect(paused.status).toBe('PAUSED');
    expect(paused.completedCount).toBe(1);
    expect(paused.resumeFromIndex).toBe(1);

    const resumedRun = transitionAutonomousDesignRun(paused, 'GENERATING', 2000);
    const completed = await runAutonomousGeneration({
      run: resumedRun,
      brief,
      plan,
      opportunity: null,
      existingAssets: (await loadPortfolioAssets()),
      persistRun: async () => {},
    });

    expect(completed.status).toBe('COMPLETED');
    expect(completed.completedCount).toBe(3);
    expect(completed.items).toHaveLength(3);
  }, 30000);

  it('cancelling via AbortSignal transitions to CANCELLED, sets cancelledAt, and never processes a partial item', async () => {
    const plan = makeCollectionPlan(3);
    const brief = makeBrief();
    const run = makeRun();
    const controller = new AbortController();
    controller.abort();

    const result = await runAutonomousGeneration({
      run,
      brief,
      plan,
      opportunity: null,
      existingAssets: [],
      signal: controller.signal,
      persistRun: async () => {},
    });

    expect(result.status).toBe('CANCELLED');
    expect(result.cancelledAt).not.toBeNull();
    expect(result.completedCount).toBe(0);
    expect(result.items).toHaveLength(0);
    expect(await loadPortfolioAssets()).toHaveLength(0);
  });

  it('throws for a run with no frozen Design Plan rather than silently generating an unapproved one', async () => {
    const plan = makeCollectionPlan(3);
    const brief = makeBrief();
    const run = { ...makeRun(), designPlan: null };

    await expect(
      runAutonomousGeneration({ run, brief, plan, opportunity: null, existingAssets: [], persistRun: async () => {} }),
    ).rejects.toThrow(/frozen Design Plan/);
  });
});
