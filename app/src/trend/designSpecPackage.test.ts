import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from './designIntelligence';
import { buildTileFromDesignSpec } from './designSpecToParams';
import { buildDesignSpecPackageTextFiles, buildAllDesignSpecPackageTextFiles, type DesignSpecManifest } from './designSpecPackage';
import { MARKETPLACE_PROFILES } from '../metadata/marketplaceProfiles';
import type { KeywordBundle } from './designSpecTypes';
import type { PackageTextFile } from '../metadata/exportPackage';

function makeBundle(overrides: Partial<KeywordBundle> = {}): KeywordBundle {
  return {
    primaryKeyword: 'Luxury Botanical',
    secondaryKeywords: ['Wallpaper', 'Spring', 'Muted Green', 'Editorial'],
    marketplace: 'adobestock',
    season: 'spring',
    audience: 'editorial',
    commercialCategory: 'wallpaper',
    patternType: 'botanical',
    paletteDirection: 'muted green',
    difficulty: 'moderate',
    collectionSize: 8,
    ...overrides,
  };
}

/** Strips generatedAt (a real wall-clock timestamp, allowed to differ by a
 * millisecond between two independently-timed calls) before comparing two
 * package results for equality — same technique metadata/exportPackage.test.ts
 * uses for the same reason. */
function stripGeneratedAt(files: PackageTextFile[]): PackageTextFile[] {
  return files.map((f) => {
    if (f.name !== 'manifest.json' && f.name !== 'metadata.json') return f;
    const parsed = JSON.parse(f.content);
    return { ...f, content: JSON.stringify({ ...parsed, generatedAt: null }) };
  });
}

describe('buildDesignSpecPackageTextFiles', () => {
  it('includes every base package file plus manifest.json', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const tile = buildTileFromDesignSpec(spec, 'seed-pkg');
    const files = buildDesignSpecPackageTextFiles(spec, tile, 'shutterstock', 'seed-pkg');
    const names = files.map((f) => f.name);
    expect(names).toContain('title.txt');
    expect(names).toContain('description.txt');
    expect(names).toContain('keywords.txt');
    expect(names).toContain('filename.txt');
    expect(names).toContain('metadata.json');
    expect(names).toContain('manifest.json');
  });

  it('omits description.txt for a marketplace with no description field (Adobe Stock)', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const tile = buildTileFromDesignSpec(spec, 'seed-pkg-desc');
    const files = buildDesignSpecPackageTextFiles(spec, tile, 'adobestock', 'seed-pkg-desc');
    expect(files.map((f) => f.name)).not.toContain('description.txt');
  });

  it('manifest.json carries the real project/trend/keyword-bundle/collection-name/asset-name data', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const tile = buildTileFromDesignSpec(spec, 'seed-manifest');
    const files = buildDesignSpecPackageTextFiles(spec, tile, 'shutterstock', 'seed-manifest', 'Hero Pattern');
    const manifest = JSON.parse(files.find((f) => f.name === 'manifest.json')!.content) as DesignSpecManifest;
    expect(manifest.seed).toBe('seed-manifest');
    expect(manifest.marketplace).toBe('shutterstock');
    expect(manifest.project.id).toBe(spec.project.id);
    expect(manifest.trend).toEqual(spec.trend);
    expect(manifest.keywordBundle.primaryKeyword).toBe('Luxury Botanical');
    expect(manifest.collectionName.length).toBeGreaterThan(0);
    expect(manifest.assetName).toContain('Hero Pattern');
    expect(manifest.files).toContain('pattern.svg');
    expect(manifest.files).toContain('preview.png');
    expect(manifest.files).toContain('manifest.json');
  });

  it('manifest.json lists real file names that match the actual returned package files', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const tile = buildTileFromDesignSpec(spec, 'seed-manifest-files');
    const files = buildDesignSpecPackageTextFiles(spec, tile, 'creativefabrica', 'seed-manifest-files');
    const manifest = JSON.parse(files.find((f) => f.name === 'manifest.json')!.content) as DesignSpecManifest;
    for (const f of files) {
      expect(manifest.files, f.name).toContain(f.name);
    }
  });

  it('is deterministic for the same spec + tile + marketplace + seed (ignoring wall-clock timestamps)', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const tile = buildTileFromDesignSpec(spec, 'seed-det');
    const a = buildDesignSpecPackageTextFiles(spec, tile, 'shutterstock', 'seed-det');
    const b = buildDesignSpecPackageTextFiles(spec, tile, 'shutterstock', 'seed-det');
    expect(stripGeneratedAt(a)).toEqual(stripGeneratedAt(b));
  });

  it('filename.txt matches the market-driven filename (leads with the keyword slug)', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const tile = buildTileFromDesignSpec(spec, 'seed-filename');
    const files = buildDesignSpecPackageTextFiles(spec, tile, 'shutterstock', 'seed-filename');
    const filename = files.find((f) => f.name === 'filename.txt')!.content;
    expect(filename.startsWith('luxury-botanical-')).toBe(true);
  });
});

describe('buildAllDesignSpecPackageTextFiles', () => {
  it('covers every marketplace, keyed by id', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const tile = buildTileFromDesignSpec(spec, 'seed-all-pkg');
    const all = buildAllDesignSpecPackageTextFiles(spec, tile, 'seed-all-pkg');
    expect(Object.keys(all).sort()).toEqual(Object.keys(MARKETPLACE_PROFILES).sort());
    for (const files of Object.values(all)) {
      expect(files.map((f) => f.name)).toContain('manifest.json');
    }
  });
});
