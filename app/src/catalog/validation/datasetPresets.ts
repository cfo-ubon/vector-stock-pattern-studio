import { DEFAULT_DATASET_CONFIG } from './types';
import type { DatasetGeneratorConfig, DatasetPresetName } from './types';

// Portfolio Manager P2.5 Sprint 1, Section 3's three required presets.
// All three share `avgMembershipsPerAsset: 5`, which is exactly what
// yields each preset's stated target membership count
// (assetCount * 5 = 5,000 / 50,000 / 500,000) — verified by
// `datasetGenerator.test.ts`'s "membership target accuracy" cases.

export function smallDatasetConfig(seed = 'p2.5-small'): DatasetGeneratorConfig {
  return { ...DEFAULT_DATASET_CONFIG, seed, preset: 'small', assetCount: 1000, collectionCount: 100, avgMembershipsPerAsset: 5 };
}

export function mediumDatasetConfig(seed = 'p2.5-medium'): DatasetGeneratorConfig {
  return { ...DEFAULT_DATASET_CONFIG, seed, preset: 'medium', assetCount: 10000, collectionCount: 1000, avgMembershipsPerAsset: 5 };
}

export function largeDatasetConfig(seed = 'p2.5-large'): DatasetGeneratorConfig {
  return { ...DEFAULT_DATASET_CONFIG, seed, preset: 'large', assetCount: 100000, collectionCount: 10000, avgMembershipsPerAsset: 5 };
}

export function presetDatasetConfig(preset: DatasetPresetName, seed?: string): DatasetGeneratorConfig {
  switch (preset) {
    case 'small':
      return smallDatasetConfig(seed);
    case 'medium':
      return mediumDatasetConfig(seed);
    case 'large':
      return largeDatasetConfig(seed);
    default:
      throw new Error(`presetDatasetConfig: no built-in config for preset "${preset}" — build a custom DatasetGeneratorConfig instead.`);
  }
}
