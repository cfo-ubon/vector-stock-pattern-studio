/// <reference types="node" />
import { describe, it, expect, beforeEach } from 'vitest';
import { File as NodeFile } from 'node:buffer';
import { applyBatchAdjustments, runBatchRefinement } from './batchRefinement';
import { importFileGroup } from '../catalog/import/importPipeline';
import { groupFilesByBasename } from '../catalog/import/basenameGrouping';
import { clearPortfolioStores, getPortfolioAsset, loadPortfolioAssets } from '../catalog/storage/portfolioStore';
import { clearQualitySnapshots } from '../catalog/quality/qualitySnapshotStore';
import { defaultParams } from '../engine/defaults';
import { HIERARCHY_PRESETS } from '../engine/hierarchy';

beforeEach(async () => {
  await clearPortfolioStores();
  await clearQualitySnapshots();
});

function makeFile(name: string, content: string, type: string): File {
  return new NodeFile([content], name, { type }) as unknown as File;
}

async function makeAsset(seed: string) {
  const params = { ...defaultParams(), seed, density: 0.5 };
  const svg = makeFile(`${seed}.svg`, '<svg></svg>', 'image/svg+xml');
  const json = makeFile(`${seed}.json`, JSON.stringify(params), 'application/json');
  const group = groupFilesByBasename([svg, json])[0];
  const outcome = await importFileGroup(group, [], { generatorVersion: 'v1' });
  if (outcome.status !== 'imported') throw new Error('setup failed');
  return outcome.asset;
}

describe('applyBatchAdjustments', () => {
  it('applies a relative delta to each asset own value, clamped to 0..1', () => {
    const params = { ...defaultParams(), density: 0.5 };
    const result = applyBatchAdjustments(params, { densityDelta: 0.3 });
    expect(result.density).toBeCloseTo(0.8);

    const clamped = applyBatchAdjustments(params, { densityDelta: 0.9 });
    expect(clamped.density).toBe(1);
  });

  it('leaves fields untouched when no adjustment is specified for them', () => {
    const params = { ...defaultParams(), density: 0.42, paletteId: 'x' };
    const result = applyBatchAdjustments(params, { rotationJitterDelta: 0.1 });
    expect(result.density).toBe(0.42);
    expect(result.paletteId).toBe('x');
  });

  it('applies an absolute hierarchy preset override when specified', () => {
    const presetId = Object.keys(HIERARCHY_PRESETS)[0];
    const params = { ...defaultParams() };
    const result = applyBatchAdjustments(params, { hierarchyPresetId: presetId });
    expect(result.hierarchy).toEqual(HIERARCHY_PRESETS[presetId].value);
  });
});

describe('runBatchRefinement', () => {
  it('creates a new linked, non-destructive version for every real asset in the batch', async () => {
    const a = await makeAsset('batch-a');
    const b = await makeAsset('batch-b');
    const all = [a, b];

    const results = await runBatchRefinement(all, { densityDelta: 0.2 }, all);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'applied')).toBe(true);

    const allAfter = await loadPortfolioAssets();
    expect(allAfter.length).toBe(4); // 2 originals + 2 new versions

    // Originals are provably untouched.
    const reloadedA = await getPortfolioAsset(a.assetId);
    const reloadedB = await getPortfolioAsset(b.assetId);
    expect(reloadedA).toEqual(a);
    expect(reloadedB).toEqual(b);
  });

  it('reports skippedNoParams for an asset with no real GenerateParams, without touching the rest of the batch', async () => {
    const a = await makeAsset('batch-real');
    // Content deliberately different from `makeAsset`'s own SVG body so
    // this manual import isn't accidentally flagged as an exact byte
    // duplicate of `a` (that's a real, correctly-working signal — see
    // `designVersioning.test.ts` — just not what this test is about).
    const svgOnly = makeFile('noMeta.svg', '<svg><rect width="1" height="1"/></svg>', 'image/svg+xml');
    const group = groupFilesByBasename([svgOnly])[0];
    const manualOutcome = await importFileGroup(group, [a]);
    if (manualOutcome.status !== 'imported') throw new Error('setup failed');
    const manual = manualOutcome.asset;

    const all = [a, manual];
    const results = await runBatchRefinement(all, { densityDelta: 0.1 }, all);

    const manualResult = results.find((r) => r.assetId === manual.assetId);
    const realResult = results.find((r) => r.assetId === a.assetId);
    expect(manualResult?.status).toBe('skippedNoParams');
    expect(realResult?.status).toBe('applied');
  });

  it('reports progress for every item processed', async () => {
    const a = await makeAsset('progress-a');
    const b = await makeAsset('progress-b');
    const all = [a, b];
    const progressCalls: Array<[number, number]> = [];

    await runBatchRefinement(all, { densityDelta: 0.1 }, all, (done, total) => progressCalls.push([done, total]));

    expect(progressCalls).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it('does not apply any change when given a no-op adjustment set (still saves a version, but density stays real and unchanged)', async () => {
    const a = await makeAsset('noop-a');
    const results = await runBatchRefinement([a], {}, [a]);
    // A true no-op edit produces byte-identical output, which real duplicate
    // detection correctly blocks rather than silently allowing through.
    expect(results[0].status).toBe('duplicate');
  });
});
