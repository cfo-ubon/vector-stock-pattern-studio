/// <reference types="node" />
import { describe, it, expect, beforeEach } from 'vitest';
import { File as NodeFile } from 'node:buffer';
import { revalidateDesignVersion } from './designRevalidation';
import { evaluateDesign } from './designEvaluation';
import { importFileGroup } from '../catalog/import/importPipeline';
import { groupFilesByBasename } from '../catalog/import/basenameGrouping';
import { clearPortfolioStores, getPortfolioAsset } from '../catalog/storage/portfolioStore';
import { clearQualitySnapshots, loadQualitySnapshots } from '../catalog/quality/qualitySnapshotStore';
import { defaultParams } from '../engine/defaults';

beforeEach(async () => {
  await clearPortfolioStores();
  await clearQualitySnapshots();
});

function makeFile(name: string, content: string, type: string): File {
  return new NodeFile([content], name, { type }) as unknown as File;
}

async function makeAsset(seed: string) {
  const params = { ...defaultParams(), seed };
  const svg = makeFile(`${seed}.svg`, '<svg></svg>', 'image/svg+xml');
  const json = makeFile(`${seed}.json`, JSON.stringify(params), 'application/json');
  const group = groupFilesByBasename([svg, json])[0];
  const outcome = await importFileGroup(group, [], { generatorVersion: 'v1' });
  if (outcome.status !== 'imported') throw new Error('setup failed');
  return { asset: outcome.asset, params };
}

describe('revalidateDesignVersion', () => {
  it('persists a real QualitySnapshot and links it onto the asset, matching what Factory/Autopilot already do', async () => {
    const { asset, params } = await makeAsset('revalidate-seed');
    const evaluation = evaluateDesign(params);

    const result = await revalidateDesignVersion(asset, evaluation.tileData, [asset], []);

    expect(result.snapshot.assetId).toBe(asset.assetId);
    expect(result.updatedAsset.qualitySnapshotId).toBe(result.snapshot.snapshotId);

    const persistedAsset = await getPortfolioAsset(asset.assetId);
    expect(persistedAsset?.qualitySnapshotId).toBe(result.snapshot.snapshotId);

    const snapshots = await loadQualitySnapshots();
    expect(snapshots.some((s) => s.snapshotId === result.snapshot.snapshotId)).toBe(true);
  });

  it('recomputes real Commercial Readiness reflecting the fresh snapshot (commercialScoreAvailable/beautyScoreAvailable now PASS)', async () => {
    const { asset, params } = await makeAsset('readiness-seed');
    const evaluation = evaluateDesign(params);

    const result = await revalidateDesignVersion(asset, evaluation.tileData, [asset], []);

    const commercialCheck = result.readiness.checks.find((c) => c.id === 'commercialScoreAvailable');
    const beautyCheck = result.readiness.checks.find((c) => c.id === 'beautyScoreAvailable');
    expect(commercialCheck?.status).toBe('PASS');
    expect(beautyCheck?.status).toBe('PASS');
    expect(result.readiness.assetId).toBe(asset.assetId);
  });

  it('excludes the asset itself from its own sibling/duplicate comparison', async () => {
    const { asset, params } = await makeAsset('sibling-seed');
    const evaluation = evaluateDesign(params);

    // Passing the asset itself inside `siblingAssets` (as the real caller,
    // DesignEditView, does via `existingAssets`) must not make it flag
    // itself as a duplicate of itself.
    const result = await revalidateDesignVersion(asset, evaluation.tileData, [asset], []);
    const dupCheck = result.readiness.checks.find((c) => c.id === 'duplicateCheckComplete');
    expect(dupCheck?.status).not.toBe('FAIL');
  });
});
