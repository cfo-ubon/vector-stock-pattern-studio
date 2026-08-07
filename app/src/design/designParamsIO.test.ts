/// <reference types="node" />
import { describe, it, expect, beforeEach } from 'vitest';
import { File as NodeFile } from 'node:buffer';
import { isEditableGenerateParams, loadDesignParamsForAsset } from './designParamsIO';
import { importFileGroup } from '../catalog/import/importPipeline';
import { groupFilesByBasename } from '../catalog/import/basenameGrouping';
import { clearPortfolioStores } from '../catalog/storage/portfolioStore';
import { defaultParams } from '../engine/defaults';

beforeEach(async () => {
  await clearPortfolioStores();
});

function makeFile(name: string, content: string, type: string): File {
  return new NodeFile([content], name, { type }) as unknown as File;
}

describe('isEditableGenerateParams', () => {
  it('accepts a real GenerateParams object', () => {
    expect(isEditableGenerateParams({ ...defaultParams(), seed: 'abc123' })).toBe(true);
  });

  it('rejects null/non-objects', () => {
    expect(isEditableGenerateParams(null)).toBe(false);
    expect(isEditableGenerateParams('not an object')).toBe(false);
    expect(isEditableGenerateParams(42)).toBe(false);
  });

  it('rejects an object missing required fields (e.g. a manual-import metadata shape)', () => {
    expect(isEditableGenerateParams({ styleDna: 'x', patternType: 'y' })).toBe(false);
  });
});

describe('loadDesignParamsForAsset', () => {
  it('round-trips the exact GenerateParams a generation pipeline wrote as the JSON sidecar', async () => {
    const params = { ...defaultParams(), seed: 'roundtrip-seed' };
    const svg = makeFile('pattern.svg', '<svg></svg>', 'image/svg+xml');
    const json = makeFile('pattern.json', JSON.stringify(params), 'application/json');
    const group = groupFilesByBasename([svg, json])[0];
    const outcome = await importFileGroup(group, []);
    expect(outcome.status).toBe('imported');
    if (outcome.status !== 'imported') return;

    const loaded = await loadDesignParamsForAsset(outcome.asset);
    expect(loaded).not.toBeNull();
    expect(loaded?.seed).toBe('roundtrip-seed');
    expect(loaded?.categoryId).toBe(params.categoryId);
  });

  it('returns null (never a fabricated default) for an asset with no metadataReference', async () => {
    const svg = makeFile('noMeta.svg', '<svg></svg>', 'image/svg+xml');
    const group = groupFilesByBasename([svg])[0];
    const outcome = await importFileGroup(group, []);
    expect(outcome.status).toBe('imported');
    if (outcome.status !== 'imported') return;

    expect(outcome.asset.metadataReference).toBeNull();
    const loaded = await loadDesignParamsForAsset(outcome.asset);
    expect(loaded).toBeNull();
  });

  it('returns null when the sidecar JSON is not a real GenerateParams (e.g. a manual import with unrelated metadata)', async () => {
    const svg = makeFile('weird.svg', '<svg></svg>', 'image/svg+xml');
    const json = makeFile('weird.json', JSON.stringify({ hello: 'world' }), 'application/json');
    const group = groupFilesByBasename([svg, json])[0];
    const outcome = await importFileGroup(group, []);
    expect(outcome.status).toBe('imported');
    if (outcome.status !== 'imported') return;

    const loaded = await loadDesignParamsForAsset(outcome.asset);
    expect(loaded).toBeNull();
  });
});
