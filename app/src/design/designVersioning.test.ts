/// <reference types="node" />
import { describe, it, expect, beforeEach } from 'vitest';
import { File as NodeFile } from 'node:buffer';
import { saveDesignVersion, listDesignVersions, duplicateDesignVersion } from './designVersioning';
import { evaluateDesign } from './designEvaluation';
import { importFileGroup } from '../catalog/import/importPipeline';
import { groupFilesByBasename } from '../catalog/import/basenameGrouping';
import { clearPortfolioStores, getPortfolioAsset, loadPortfolioAssets } from '../catalog/storage/portfolioStore';
import { defaultParams } from '../engine/defaults';

beforeEach(async () => {
  await clearPortfolioStores();
});

function makeFile(name: string, content: string, type: string): File {
  return new NodeFile([content], name, { type }) as unknown as File;
}

async function makeOriginalAsset(seed: string) {
  const params = { ...defaultParams(), seed };
  const svg = makeFile(`${seed}.svg`, '<svg></svg>', 'image/svg+xml');
  const json = makeFile(`${seed}.json`, JSON.stringify(params), 'application/json');
  const group = groupFilesByBasename([svg, json])[0];
  const outcome = await importFileGroup(group, [], { generatorVersion: 'v1' });
  if (outcome.status !== 'imported') throw new Error('setup failed');
  return outcome.asset;
}

describe('saveDesignVersion', () => {
  it('creates a brand-new linked asset and never modifies the original', async () => {
    const original = await makeOriginalAsset('original-seed');
    const editedParams = { ...defaultParams(), seed: 'original-seed', density: 0.9 };
    const evaluation = evaluateDesign(editedParams);

    const outcome = await saveDesignVersion(original, editedParams, evaluation.tileData, [original]);
    expect(outcome.status).toBe('imported');
    if (outcome.status !== 'imported') return;

    expect(outcome.asset.assetId).not.toBe(original.assetId);
    expect(outcome.asset.parentAssetId).toBe(original.assetId);
    expect(outcome.asset.variationGroupId).toBe(original.assetId);
    expect(outcome.asset.generatorVersion).toBe('v1');

    // The original row is byte-for-byte unchanged in storage.
    const reloadedOriginal = await getPortfolioAsset(original.assetId);
    expect(reloadedOriginal).toEqual(original);
  });

  it('a trivial edit that renders byte-identical output is still caught by real duplicate detection, not silently bypassed', async () => {
    const original = await makeOriginalAsset('dup-seed');
    const sameParams = { ...defaultParams(), seed: 'dup-seed' };
    const evaluation = evaluateDesign(sameParams);

    const outcome = await saveDesignVersion(original, sameParams, evaluation.tileData, [original]);
    expect(outcome.status).toBe('blockedDuplicate');
  });

  it('an explicit forceImportAsNew override still saves a real new linked version', async () => {
    const original = await makeOriginalAsset('force-seed');
    const sameParams = { ...defaultParams(), seed: 'force-seed' };
    const evaluation = evaluateDesign(sameParams);

    const outcome = await saveDesignVersion(original, sameParams, evaluation.tileData, [original], { forceImportAsNew: true });
    expect(outcome.status).toBe('imported');
    if (outcome.status !== 'imported') return;
    expect(outcome.asset.parentAssetId).toBe(original.assetId);
  });
});

describe('duplicateDesignVersion', () => {
  it('creates a new linked asset that renders byte-identical output to the source, using forceImportAsNew to skip the expected exact-duplicate block', async () => {
    const source = await makeOriginalAsset('dup-source-seed');

    const outcome = await duplicateDesignVersion(source, [source]);
    expect(outcome).not.toBeNull();
    expect(outcome?.status).toBe('imported');
    if (!outcome || outcome.status !== 'imported') return;

    expect(outcome.asset.assetId).not.toBe(source.assetId);
    expect(outcome.asset.parentAssetId).toBe(source.assetId);
    expect(outcome.asset.displayName).toContain('copy');

    // The source itself is never modified by duplicating it.
    const reloadedSource = await getPortfolioAsset(source.assetId);
    expect(reloadedSource).toEqual(source);
  });

  it('returns null (never a fabricated copy) for an asset with no loadable GenerateParams', async () => {
    const svg = makeFile('noMeta.svg', '<svg></svg>', 'image/svg+xml');
    const group = groupFilesByBasename([svg])[0];
    const outcome = await importFileGroup(group, []);
    if (outcome.status !== 'imported') throw new Error('setup failed');

    const dupOutcome = await duplicateDesignVersion(outcome.asset, [outcome.asset]);
    expect(dupOutcome).toBeNull();
  });
});

describe('listDesignVersions', () => {
  it('groups the original and every saved version together, newest first', async () => {
    const original = await makeOriginalAsset('lineage-seed');
    const v2Params = { ...defaultParams(), seed: 'lineage-seed', density: 0.5 };
    const v2Eval = evaluateDesign(v2Params);
    const v2Outcome = await saveDesignVersion(original, v2Params, v2Eval.tileData, [original]);
    if (v2Outcome.status !== 'imported') throw new Error('setup failed');

    const all = await loadPortfolioAssets();
    const lineage = listDesignVersions(original.assetId, all);

    expect(lineage.map((a) => a.assetId).sort()).toEqual([original.assetId, v2Outcome.asset.assetId].sort());
    expect(lineage[0].createdAt).toBeGreaterThanOrEqual(lineage[1].createdAt);
  });

  it('returns just the asset itself when it has no version history', async () => {
    const solo = await makeOriginalAsset('solo-seed');
    const all = await loadPortfolioAssets();
    const lineage = listDesignVersions(solo.assetId, all);
    expect(lineage.map((a) => a.assetId)).toEqual([solo.assetId]);
  });
});
