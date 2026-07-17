import { describe, it, expect } from 'vitest';
import { generateDataset, validateDatasetConfig } from './datasetGenerator';
import { smallDatasetConfig, mediumDatasetConfig, presetDatasetConfig } from './datasetPresets';
import { InvalidDatasetConfigError } from './types';
import { isValidCollection } from '../domain/collection';
import { isValidPortfolioAsset } from '../domain/asset';

describe('generateDataset — determinism', () => {
  it('produces byte-identical logical output for the same seed and config', () => {
    const config = smallDatasetConfig('determinism-seed');
    const a = generateDataset(config);
    const b = generateDataset(config);
    // Manifests carry a real `generatedAt`/`generationDurationMs` wall-clock
    // stamp — strip those two before comparing, everything else must match.
    const strip = (m: typeof a.manifest) => {
      const { generatedAt: _generatedAt, generationDurationMs: _generationDurationMs, ...rest } = m;
      return rest;
    };
    expect(a.collections).toEqual(b.collections);
    expect(a.assets).toEqual(b.assets);
    expect(strip(a.manifest)).toEqual(strip(b.manifest));
  });

  it('different seeds produce different logical output', () => {
    const a = generateDataset(smallDatasetConfig('seed-one'));
    const b = generateDataset(smallDatasetConfig('seed-two'));
    expect(a.assets.map((x) => x.collectionIds)).not.toEqual(b.assets.map((x) => x.collectionIds));
  });

  it('IDs are deterministic across runs', () => {
    const a = generateDataset(smallDatasetConfig('id-seed'));
    const b = generateDataset(smallDatasetConfig('id-seed'));
    expect(a.assets.map((x) => x.assetId)).toEqual(b.assets.map((x) => x.assetId));
    expect(a.collections.map((x) => x.id)).toEqual(b.collections.map((x) => x.id));
  });

  it('collection names are deterministic', () => {
    const a = generateDataset(smallDatasetConfig('name-seed'));
    const b = generateDataset(smallDatasetConfig('name-seed'));
    expect(a.collections.map((c) => c.name)).toEqual(b.collections.map((c) => c.name));
  });
});

describe('generateDataset — exact requested counts', () => {
  it('produces exactly assetCount assets and collectionCount collections', () => {
    const { assets, collections } = generateDataset(smallDatasetConfig());
    expect(assets).toHaveLength(1000);
    expect(collections).toHaveLength(100);
  });

  it('every generated record is a structurally valid Collection/PortfolioAsset', () => {
    const { assets, collections } = generateDataset(smallDatasetConfig());
    expect(collections.every(isValidCollection)).toBe(true);
    expect(assets.every(isValidPortfolioAsset)).toBe(true);
  });
});

describe('generateDataset — membership target accuracy', () => {
  it('SMALL preset yields the target 5,000 memberships (before injected-defect extras)', () => {
    const config = { ...smallDatasetConfig(), orphanedCollectionIdRatio: 0, duplicateCollectionIdRatio: 0, includeHighMembershipFixtures: false };
    const { manifest } = generateDataset(config);
    expect(manifest.membershipCount).toBe(5000);
  });

  it('MEDIUM preset yields the target 50,000 memberships (before injected-defect extras)', () => {
    const config = { ...mediumDatasetConfig(), orphanedCollectionIdRatio: 0, duplicateCollectionIdRatio: 0, includeHighMembershipFixtures: false };
    const { manifest } = generateDataset(config);
    expect(manifest.membershipCount).toBe(50000);
  });
});

describe('generateDataset — injected-condition ratios', () => {
  it('archived ratio matches the configured fraction of collections', () => {
    const config = { ...smallDatasetConfig(), archivedCollectionRatio: 0.2, emptyCollectionRatio: 0 };
    const { manifest } = generateDataset(config);
    expect(manifest.archivedCollectionCount).toBe(20);
  });

  it('empty collection ratio matches the configured fraction', () => {
    const config = { ...smallDatasetConfig(), archivedCollectionRatio: 0, emptyCollectionRatio: 0.1, includeHighMembershipFixtures: false };
    const { manifest } = generateDataset(config);
    expect(manifest.emptyCollectionCount).toBeGreaterThanOrEqual(10);
  });

  it('stale cover injection produces the expected count of stale covers', () => {
    const config = { ...smallDatasetConfig(), collectionCoverRatio: 1, staleCoverRatio: 0.5, emptyCollectionRatio: 0 };
    const { manifest } = generateDataset(config);
    expect(manifest.staleCoverCount).toBeGreaterThan(0);
    expect(manifest.coverCount).toBeGreaterThanOrEqual(manifest.staleCoverCount);
  });

  it('orphan injection adds exactly the configured fraction of assets with one extra invalid collectionId', () => {
    const config = { ...smallDatasetConfig(), orphanedCollectionIdRatio: 0.1 };
    const { manifest } = generateDataset(config);
    expect(manifest.orphanedMembershipCount).toBe(100);
  });

  it('duplicate injection marks the expected count of assets', () => {
    const config = { ...smallDatasetConfig(), duplicateCollectionIdRatio: 0.1 };
    const { assets, manifest } = generateDataset(config);
    expect(manifest.duplicateCollectionIdAssetCount).toBeGreaterThan(0);
    // Confirm at least one asset really does carry a literal duplicate —
    // this condition cannot occur via `addCollectionMembership`, only via
    // this generator's direct raw-array injection.
    const hasDuplicate = assets.some((a) => new Set(a.collectionIds).size < a.collectionIds.length);
    expect(hasDuplicate).toBe(true);
  });

  it('high-membership/high-member fixtures exist when enabled', () => {
    const { manifest } = generateDataset({ ...smallDatasetConfig(), includeHighMembershipFixtures: true });
    expect(manifest.maxMembershipsOnOneAsset).toBeGreaterThanOrEqual(50);
  });
});

describe('generateDataset — invalid configuration', () => {
  it('rejects an empty seed', () => {
    expect(() => validateDatasetConfig({ ...smallDatasetConfig(), seed: '' })).toThrow(InvalidDatasetConfigError);
  });

  it('rejects a negative assetCount', () => {
    expect(() => validateDatasetConfig({ ...smallDatasetConfig(), assetCount: -1 })).toThrow(InvalidDatasetConfigError);
  });

  it('rejects an out-of-range ratio', () => {
    expect(() => validateDatasetConfig({ ...smallDatasetConfig(), archivedCollectionRatio: 1.5 })).toThrow(InvalidDatasetConfigError);
  });

  it('rejects avgMembershipsPerAsset larger than the assignable collection pool', () => {
    expect(() => validateDatasetConfig({ ...smallDatasetConfig(), collectionCount: 2, avgMembershipsPerAsset: 5 })).toThrow(
      InvalidDatasetConfigError,
    );
  });

  it('rejects a non-integer batchSize', () => {
    expect(() => validateDatasetConfig({ ...smallDatasetConfig(), batchSize: 0 })).toThrow(InvalidDatasetConfigError);
  });
});

describe('generateDataset — boundary conditions', () => {
  it('handles zero assets and zero collections without throwing', () => {
    const { assets, collections, manifest } = generateDataset({ ...smallDatasetConfig(), assetCount: 0, collectionCount: 0, avgMembershipsPerAsset: 0 });
    expect(assets).toHaveLength(0);
    expect(collections).toHaveLength(0);
    expect(manifest.membershipCount).toBe(0);
  });

  it('handles avgMembershipsPerAsset of 0 (no memberships at all)', () => {
    const { manifest } = generateDataset({ ...smallDatasetConfig(), avgMembershipsPerAsset: 0, includeHighMembershipFixtures: false, orphanedCollectionIdRatio: 0, duplicateCollectionIdRatio: 0 });
    expect(manifest.membershipCount).toBe(0);
  });
});

describe('presetDatasetConfig', () => {
  it('resolves small/medium/large to their documented shapes', () => {
    expect(presetDatasetConfig('small').assetCount).toBe(1000);
    expect(presetDatasetConfig('medium').assetCount).toBe(10000);
    expect(presetDatasetConfig('large').assetCount).toBe(100000);
  });

  it('throws for the "custom" preset (no built-in shape)', () => {
    expect(() => presetDatasetConfig('custom')).toThrow();
  });
});
