/// <reference types="node" />
import { describe, it, expect, beforeEach } from 'vitest';
import { importFileGroup, importFiles } from './importPipeline';
import { groupFilesByBasename } from './basenameGrouping';
import { clearPortfolioStores, loadFilesForAsset } from '../storage/portfolioStore';
import type { PortfolioAsset } from '../domain/types';
// jsdom's own File/Blob isn't recognized by Node's `structuredClone`
// (used internally by fake-indexeddb) — see testSetup.ts's header
// comment. Node's real File roundtrips correctly through
// `importAssetTransaction`'s IndexedDB writes, so these import-pipeline
// tests build files with it explicitly (cast to the DOM `File` type,
// which the production pipeline only ever calls `.name`/`.size`/
// `.arrayBuffer()` on — all present on Node's File too).
import { File as NodeFile } from 'node:buffer';

beforeEach(async () => {
  await clearPortfolioStores();
});

function makeFile(name: string, content: string, type: string): File {
  return new NodeFile([content], name, { type }) as unknown as File;
}

function svgFile(name: string, content = '<svg></svg>'): File {
  return makeFile(name, content, 'image/svg+xml');
}

function pngFile(name: string, content = 'fake-png-bytes'): File {
  return makeFile(name, content, 'image/png');
}

function jsonFile(name: string, content: string): File {
  return makeFile(name, content, 'application/json');
}

describe('importFileGroup', () => {
  it('imports a single SVG-only file as one asset', async () => {
    const group = groupFilesByBasename([svgFile('leaf.svg')])[0];
    const outcome = await importFileGroup(group, []);
    expect(outcome.status).toBe('imported');
    if (outcome.status === 'imported') {
      expect(outcome.asset.sourceFileReferences).toHaveLength(1);
      expect(outcome.asset.assetType).toBe('svg');
      expect(outcome.asset.previewReference).toBe(outcome.asset.sourceFileReferences[0].fileId);
    }
  });

  it('imports a single PNG-only file as one asset', async () => {
    const group = groupFilesByBasename([pngFile('preview.png')])[0];
    const outcome = await importFileGroup(group, []);
    expect(outcome.status).toBe('imported');
    if (outcome.status === 'imported') expect(outcome.asset.assetType).toBe('png');
  });

  it('imports a single JSON-only file as one asset and extracts metadata', async () => {
    const json = JSON.stringify({ seed: 'abc123', categoryId: 'botanical', layoutId: 'grid', styleDnaId: 'darkBotanical' });
    const group = groupFilesByBasename([jsonFile('settings.json', json)])[0];
    const outcome = await importFileGroup(group, []);
    expect(outcome.status).toBe('imported');
    if (outcome.status === 'imported') {
      expect(outcome.asset.assetType).toBe('json');
      expect(outcome.asset.generatorSeed).toBe('abc123');
      expect(outcome.asset.patternType).toBe('botanical');
      expect(outcome.asset.styleDna).toBe('darkBotanical');
    }
  });

  it('groups SVG + PNG + JSON with the same basename into one asset', async () => {
    const files = [svgFile('spring-garden-001.svg'), pngFile('spring-garden-001.png'), jsonFile('spring-garden-001.json', '{"seed":"s1"}')];
    const group = groupFilesByBasename(files)[0];
    expect(group.basename).toBe('spring-garden-001');
    expect(group.files).toHaveLength(3);
    const outcome = await importFileGroup(group, []);
    expect(outcome.status).toBe('imported');
    if (outcome.status === 'imported') {
      expect(outcome.asset.sourceFileReferences).toHaveLength(3);
      expect(outcome.asset.assetType).toBe('svg'); // svg wins priority over png/json
      const files2 = await loadFilesForAsset(outcome.asset.assetId);
      expect(files2).toHaveLength(3);
    }
  });

  it('keeps an invalid-JSON file (imported, with a warning) instead of crashing', async () => {
    const group = groupFilesByBasename([jsonFile('broken.json', '{not valid json')])[0];
    const outcome = await importFileGroup(group, []);
    expect(outcome.status).toBe('imported');
    if (outcome.status === 'imported') {
      expect(outcome.warnings.length).toBeGreaterThan(0);
      expect(outcome.asset.sourceFileReferences).toHaveLength(1);
    }
  });

  it('blocks an exact duplicate (same file content already in the catalog)', async () => {
    const group1 = groupFilesByBasename([svgFile('a.svg', 'same-bytes')])[0];
    const first = await importFileGroup(group1, []);
    expect(first.status).toBe('imported');
    const existing = first.status === 'imported' ? [first.asset] : [];

    const group2 = groupFilesByBasename([svgFile('a-copy.svg', 'same-bytes')])[0];
    const second = await importFileGroup(group2, existing);
    expect(second.status).toBe('blockedDuplicate');
  });

  it('warns (does not block) on a possible duplicate — same filename+size, different content', async () => {
    const group1 = groupFilesByBasename([svgFile('a.svg', 'content-one')])[0];
    const first = await importFileGroup(group1, []);
    const existing: PortfolioAsset[] = first.status === 'imported' ? [first.asset] : [];

    // Same filename, same byte length as 'content-one' (11 bytes), different bytes.
    const group2 = groupFilesByBasename([svgFile('a.svg', 'content-two')])[0];
    const second = await importFileGroup(group2, existing);
    expect(second.status).toBe('possibleDuplicate');
  });

  it('forceImportAsNew bypasses a possible-duplicate warning and imports anyway', async () => {
    const group1 = groupFilesByBasename([svgFile('a.svg', 'content-one')])[0];
    const first = await importFileGroup(group1, []);
    const existing: PortfolioAsset[] = first.status === 'imported' ? [first.asset] : [];

    const group2 = groupFilesByBasename([svgFile('a.svg', 'content-two')])[0];
    const second = await importFileGroup(group2, existing, { forceImportAsNew: true });
    expect(second.status).toBe('imported');
  });

  it('rejects an unsupported file type', async () => {
    const group = groupFilesByBasename([new File(['x'], 'malware.exe')])[0];
    const outcome = await importFileGroup(group, []);
    expect(outcome.status).toBe('error');
  });

  it('reports an error (not a crash) for an interrupted read', async () => {
    const file = svgFile('a.svg');
    Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.reject(new Error('disk read failed')) });
    const group = groupFilesByBasename([file])[0];
    const outcome = await importFileGroup(group, []);
    expect(outcome.status).toBe('error');
  });

  it('rejects an empty (0-byte) file', async () => {
    const group = groupFilesByBasename([svgFile('empty.svg', '')])[0];
    const outcome = await importFileGroup(group, []);
    expect(outcome.status).toBe('error');
  });
});

describe('importFiles (batch)', () => {
  it('imports multiple distinct assets from one batch', async () => {
    const files = [svgFile('one.svg', '<svg>1</svg>'), svgFile('two.svg', '<svg>2</svg>'), svgFile('three.svg', '<svg>3</svg>')];
    const result = await importFiles(files, []);
    expect(result.importedCount).toBe(3);
    expect(result.errorCount).toBe(0);
  });

  it('continues past one bad group instead of aborting the whole batch', async () => {
    const files = [svgFile('good-one.svg', '<svg>1</svg>'), new File(['x'], 'bad.exe'), svgFile('good-two.svg', '<svg>2</svg>')];
    const result = await importFiles(files, []);
    expect(result.importedCount).toBe(2);
    expect(result.errorCount).toBe(1);
  });

  it('catches an exact duplicate introduced within the same batch (two identical files, different names)', async () => {
    const files = [svgFile('first.svg', 'identical-bytes'), svgFile('second.svg', 'identical-bytes')];
    const result = await importFiles(files, []);
    expect(result.importedCount).toBe(1);
    expect(result.duplicateBlockedCount).toBe(1);
  });
});
