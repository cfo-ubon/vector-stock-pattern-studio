import { describe, it, expect } from 'vitest';
import * as collectionDomain from './domain/collection';
import * as collectionMembership from './domain/collectionMembership';
import * as collectionStore from './storage/collectionStore';
import * as collectionService from './services/collectionService';

// Portfolio Manager P2.5 Sprint 4 — Production Certification & Module
// Freeze. This test is the automated half of the freeze contract
// documented in `docs/portfolio/COLLECTION_API_FREEZE.md`: every runtime
// export (function, class, const) of the frozen Collection module
// surface must appear in the lists below, and the lists must not gain or
// lose an entry without a deliberate edit to both this file and the
// freeze doc. Type-only exports (interfaces, type aliases) have no
// runtime representation and so cannot be checked here — the freeze
// doc's signature copies plus `tsc`'s own compiler check are what guard
// those; see the freeze doc's "How type-only exports are guarded"
// section.
//
// A failing test here means the public API surface changed — that is
// not automatically wrong (an additive, backward-compatible export is a
// legitimate reason to update both this file and the freeze doc), but it
// must never happen silently. This is a deliberate speed bump, not a
// hard rule against ever changing the API.

const FROZEN_DOMAIN_COLLECTION_EXPORTS = [
  'COLLECTION_DESCRIPTION_MAX_LENGTH',
  'COLLECTION_NAME_MAX_LENGTH',
  'COLLECTION_SCHEMA_VERSION',
  'InvalidCollectionNameError',
  'createCollection',
  'isValidCollection',
  'normalizeCollection',
  'normalizeCollectionName',
  'validateCollectionName',
].sort();

const FROZEN_DOMAIN_MEMBERSHIP_EXPORTS = ['addCollectionMembership', 'dedupeCollectionIds', 'removeCollectionMembership', 'removeInvalidMemberships'].sort();

const FROZEN_STORE_EXPORTS = [
  'CollectionStorageUnavailableError',
  'clearCollectionsStore',
  'collectionStorageAvailable',
  'countCollections',
  'deleteCollectionCascade',
  'deleteCollectionRecord',
  'getCollection',
  'loadCollections',
  'putCollectionRecord',
  'putCollectionRecordsBulk',
  'searchCollectionsByName',
].sort();

const FROZEN_SERVICE_EXPORTS = [
  'ArchivedCollectionError',
  'CollectionNotFoundError',
  'DuplicateCollectionNameError',
  'InvalidCoverAssetError',
  'archiveCollection',
  'assignAssetToCollection',
  'assignAssetsToCollections',
  'createCollectionService',
  'deleteCollectionSafely',
  'getAssetsForCollection',
  'getCollectionsForAsset',
  'removeAssetFromCollection',
  'removeAssetsFromCollections',
  'renameCollection',
  'repairCoverAssetIntegrity',
  'repairOrphanedCollectionIds',
  'setCollectionCoverAsset',
  'unarchiveCollection',
  'updateCollectionDescription',
  'validateCollectionIntegrity',
].sort();

describe('Collection module — frozen public API surface (P2.5 Sprint 4)', () => {
  it('domain/collection.ts exports exactly the frozen set', () => {
    expect(Object.keys(collectionDomain).sort()).toEqual(FROZEN_DOMAIN_COLLECTION_EXPORTS);
  });

  it('domain/collectionMembership.ts exports exactly the frozen set', () => {
    expect(Object.keys(collectionMembership).sort()).toEqual(FROZEN_DOMAIN_MEMBERSHIP_EXPORTS);
  });

  it('storage/collectionStore.ts exports exactly the frozen set', () => {
    expect(Object.keys(collectionStore).sort()).toEqual(FROZEN_STORE_EXPORTS);
  });

  it('services/collectionService.ts exports exactly the frozen set', () => {
    expect(Object.keys(collectionService).sort()).toEqual(FROZEN_SERVICE_EXPORTS);
  });

  it('every frozen error class is a real Error subclass', () => {
    expect(new collectionDomain.InvalidCollectionNameError('x')).toBeInstanceOf(Error);
    expect(new collectionStore.CollectionStorageUnavailableError()).toBeInstanceOf(Error);
    expect(new collectionService.CollectionNotFoundError('x')).toBeInstanceOf(Error);
    expect(new collectionService.DuplicateCollectionNameError('x')).toBeInstanceOf(Error);
    expect(new collectionService.ArchivedCollectionError('x')).toBeInstanceOf(Error);
    expect(new collectionService.InvalidCoverAssetError('x')).toBeInstanceOf(Error);
  });

  it('every frozen function export is still callable (typeof "function")', () => {
    const allModules = { ...collectionDomain, ...collectionMembership, ...collectionStore, ...collectionService };
    const nonFunctionKeys = ['COLLECTION_SCHEMA_VERSION', 'COLLECTION_NAME_MAX_LENGTH', 'COLLECTION_DESCRIPTION_MAX_LENGTH'];
    for (const [key, value] of Object.entries(allModules)) {
      if (nonFunctionKeys.includes(key)) {
        expect(typeof value).toBe('number');
        continue;
      }
      // Error classes and factory functions are both typeof "function" in JS.
      expect(typeof value).toBe('function');
    }
  });
});
