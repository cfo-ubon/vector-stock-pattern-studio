import { generateDataset } from './datasetGenerator';
import { DEFAULT_DATASET_CONFIG } from './types';
import type { DatasetGeneratorConfig } from './types';
import type { Collection } from '../domain/collection';
import type { PortfolioAsset } from '../domain/types';
import {
  validateCollectionIntegrity,
  repairOrphanedCollectionIds,
  repairCoverAssetIntegrity,
  type CollectionIntegrityReport,
  type BulkMembershipResult,
} from '../services/collectionService';

// Portfolio Manager P2.5 Sprint 1 — reusable integrity validation
// scenarios (Section 7). Every scenario here is a small, isolated
// dataset built through the same `generateDataset` used everywhere else
// in this validation infrastructure (never a hand-built fixture that
// drifts from the real generator), with every injection ratio zeroed out
// except the one condition the scenario is named for — so a test
// exercising `orphanedMembership` can assert on exactly the orphan count
// it asked for, with no incidental noise from stale covers or archived
// collections.
//
// Scanning/repair themselves are NOT reimplemented here — every function
// below is a thin call into Stage 1's existing, unmodified
// `services/collectionService.ts` (`validateCollectionIntegrity`,
// `repairOrphanedCollectionIds`, `repairCoverAssetIntegrity`). This module
// only builds scenarios and offers a couple of small assertion-adjacent
// helpers; the actual scanning/repair logic is never duplicated.

export type IntegrityScenarioName =
  | 'valid'
  | 'orphanedMembership'
  | 'duplicateCollectionId'
  | 'staleCover'
  | 'emptyCollection'
  | 'archivedCollection'
  | 'highMembershipAsset'
  | 'highMemberCollection';

export interface IntegrityScenario {
  name: IntegrityScenarioName;
  description: string;
  collections: Collection[];
  assets: PortfolioAsset[];
}

const SCENARIO_BASE_ASSET_COUNT = 30;
const SCENARIO_BASE_COLLECTION_COUNT = 6;

function baseConfig(seed: string): DatasetGeneratorConfig {
  return {
    ...DEFAULT_DATASET_CONFIG,
    seed,
    preset: 'custom',
    assetCount: SCENARIO_BASE_ASSET_COUNT,
    collectionCount: SCENARIO_BASE_COLLECTION_COUNT,
    avgMembershipsPerAsset: 2,
    archivedCollectionRatio: 0,
    emptyCollectionRatio: 0,
    collectionCoverRatio: 0,
    staleCoverRatio: 0,
    orphanedCollectionIdRatio: 0,
    duplicateCollectionIdRatio: 0,
    includeHighMembershipFixtures: false,
  };
}

const SCENARIO_DESCRIPTIONS: Record<IntegrityScenarioName, string> = {
  valid: 'A fully valid dataset: no orphaned memberships, no stale covers, no duplicate collectionIds.',
  orphanedMembership: 'Some assets reference a collection id that does not exist (Rule 11 violation).',
  duplicateCollectionId:
    'Some assets carry a literal duplicate entry within their own collectionIds array. This cannot occur through ' +
    '`collectionService.assignAssetsToCollections`/`addCollectionMembership` (which dedupes) — injected here by ' +
    'directly constructing the raw PortfolioAsset record, bypassing the service layer entirely. ' +
    '`validateCollectionIntegrity` does not currently scan for this condition — see ' +
    'docs/portfolio/TECHNICAL_DEBT_REGISTER.md.',
  staleCover: "Some collections have a coverAssetId that references an asset which does not exist (Rule 13 violation).",
  emptyCollection: 'One collection has zero members.',
  archivedCollection: 'One collection is archived but retains its existing members.',
  highMembershipAsset: 'One asset is a member of an unusually large number of collections.',
  highMemberCollection: 'One collection has an unusually large number of member assets.',
};

export function buildIntegrityScenario(name: IntegrityScenarioName, seed = `integrity-${name}`): IntegrityScenario {
  const config = baseConfig(seed);
  switch (name) {
    case 'valid':
      break;
    case 'orphanedMembership':
      config.orphanedCollectionIdRatio = 0.2;
      break;
    case 'duplicateCollectionId':
      config.duplicateCollectionIdRatio = 0.2;
      break;
    case 'staleCover':
      config.collectionCoverRatio = 1;
      config.staleCoverRatio = 1;
      break;
    case 'emptyCollection':
      config.emptyCollectionRatio = 1 / SCENARIO_BASE_COLLECTION_COUNT;
      break;
    case 'archivedCollection':
      config.archivedCollectionRatio = 1 / SCENARIO_BASE_COLLECTION_COUNT;
      break;
    case 'highMembershipAsset':
    case 'highMemberCollection':
      config.includeHighMembershipFixtures = true;
      break;
    default: {
      const _exhaustive: never = name;
      throw new Error(`Unknown integrity scenario: ${_exhaustive}`);
    }
  }
  const { collections, assets } = generateDataset(config);
  return { name, description: SCENARIO_DESCRIPTIONS[name], collections, assets };
}

export function allIntegrityScenarioNames(): IntegrityScenarioName[] {
  return ['valid', 'orphanedMembership', 'duplicateCollectionId', 'staleCover', 'emptyCollection', 'archivedCollection', 'highMembershipAsset', 'highMemberCollection'];
}

/** Thin, named wrapper over `collectionService.validateCollectionIntegrity`
 * — exists so test/CLI call sites read as "scan this scenario" rather than
 * importing the service function directly, without adding any new scan
 * logic of its own. */
export async function scanIntegrity(): Promise<CollectionIntegrityReport> {
  return validateCollectionIntegrity();
}

export interface RepairAllResult {
  orphans: BulkMembershipResult;
  covers: BulkMembershipResult;
}

/** Runs both existing repair functions back to back — still no new
 * repair logic, just a convenience for scenarios/CLI runs that want
 * "repair everything the current scanner supports" in one call. */
export async function repairAll(): Promise<RepairAllResult> {
  const orphans = await repairOrphanedCollectionIds();
  const covers = await repairCoverAssetIntegrity();
  return { orphans, covers };
}
