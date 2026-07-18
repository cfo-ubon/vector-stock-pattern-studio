# Collection Module — Public API Freeze (P2.5 Sprint 4)

Sprint 4 formally freezes the Collection module's public API — the same
surface `docs/portfolio/COLLECTION_ARCHITECTURE.md` documented at Stage 1
and which Sprints 1-3 confirmed, through real usage in validation
tooling and the shipped UI, has not drifted since. This document is the
contract; `app/src/catalog/collectionApiFreeze.test.ts` is its automated
enforcement for every runtime export (the freeze doc's job for
type-only exports is explained below).

## What "frozen" means

- **No breaking changes** to any signature, return type, or thrown-error
  type listed below without a deliberate, documented decision (updating
  this file, the guard test, and bumping the module's version — see
  `COLLECTION_RELEASE_NOTES.md`).
- **Additive changes are allowed**: a new optional parameter, a new
  exported function, a new field appended to a returned object, are all
  compatible with the freeze — existing callers are unaffected. Update
  this doc and the guard test's frozen list when adding one.
- **Internal implementation may still change** freely — Sprint 3's
  atomicity fix to `putCollectionRecordsBulk`/`deleteCollectionCascade`/
  etc. changed internal transaction handling without touching any
  signature in this document, and would not have been blocked by this
  freeze.
- This freeze covers `app/src/catalog/domain/collection.ts`,
  `domain/collectionMembership.ts`, `storage/collectionStore.ts`, and
  `services/collectionService.ts` only. `app/src/catalog/validation/*`
  and `app/scripts/*` remain dev-only tooling, explicitly **not** part of
  the frozen contract — they can change freely between sprints.

## How type-only exports are guarded

`Object.keys()` on an ES module only sees runtime values (functions,
classes, consts) — TypeScript `interface`/`type` exports have no runtime
representation, so `collectionApiFreeze.test.ts` cannot check them
directly. Their guarantee comes from two places instead: (1) every
interface's field list is copied verbatim into this document below, so a
reviewer diffing a future change against this doc sees the drift; (2)
`tsc -b`'s own structural type checking already fails the build if any
consumer (the 8 UI components listed in "Real consumers" below, or any
of Sprints 1-3's validation tooling) is used in a way incompatible with
a changed interface — a deleted or narrowed field breaks real, existing
call sites immediately.

## `domain/collection.ts`

```ts
export const COLLECTION_SCHEMA_VERSION = 1;
export const COLLECTION_NAME_MAX_LENGTH = 120;
export const COLLECTION_DESCRIPTION_MAX_LENGTH = 2000;

export interface Collection {
  id: string;
  name: string;
  normalizedName: string;
  description: string;
  coverAssetId: string | null;
  isArchived: boolean;
  archivedAt: number | null;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
}

export class InvalidCollectionNameError extends Error {
  constructor(message: string)
}

export function normalizeCollectionName(rawName: string): string
export function validateCollectionName(rawName: string): string

export interface CreateCollectionInput {
  name: string;
  description?: string;
  coverAssetId?: string | null;
  now?: number;
}
export function createCollection(input: CreateCollectionInput): Collection
export function normalizeCollection(collection: Collection): Collection
export function isValidCollection(value: unknown): value is Collection
```

## `domain/collectionMembership.ts`

Pure, synchronous, operate only on `string[]` — no I/O.

```ts
export function addCollectionMembership(collectionIds: string[], collectionId: string): string[]
export function removeCollectionMembership(collectionIds: string[], collectionId: string): string[]
export function dedupeCollectionIds(collectionIds: string[]): string[]
export function removeInvalidMemberships(collectionIds: string[], invalidIds: ReadonlySet<string>): string[]
```

## `storage/collectionStore.ts`

```ts
export class CollectionStorageUnavailableError extends Error {
  constructor()
}
export function collectionStorageAvailable(): boolean
export async function loadCollections(): Promise<Collection[]>
export async function getCollection(id: string): Promise<Collection | undefined>
export async function putCollectionRecord(collection: Collection): Promise<void>
export async function putCollectionRecordsBulk(collections: Collection[]): Promise<void>
export async function countCollections(): Promise<number>
export async function deleteCollectionRecord(id: string): Promise<void>
export async function deleteCollectionCascade(collectionId: string, updatedAssets: PortfolioAsset[]): Promise<void>
export async function searchCollectionsByName(query: string): Promise<Collection[]>
export async function clearCollectionsStore(): Promise<void>
```

`clearCollectionsStore` is test/reset-only by convention (mirrors
`portfolioStore.clearPortfolioStores`) — frozen as an export, but not
intended for production call sites.

## `services/collectionService.ts`

```ts
export class CollectionNotFoundError extends Error {
  constructor(id: string)
}
export class DuplicateCollectionNameError extends Error {
  constructor(name: string)
}
export class ArchivedCollectionError extends Error {
  constructor(id: string)
}
export class InvalidCoverAssetError extends Error {
  constructor(assetId: string)
}

export interface CreateCollectionServiceInput {
  name: string;
  description?: string;
  coverAssetId?: string | null;
}
export async function createCollectionService(input: CreateCollectionServiceInput): Promise<Collection>
export async function renameCollection(id: string, newName: string): Promise<Collection>
export async function updateCollectionDescription(id: string, description: string): Promise<Collection>
export async function archiveCollection(id: string): Promise<Collection>
export async function unarchiveCollection(id: string): Promise<Collection>
export async function setCollectionCoverAsset(id: string, assetId: string | null): Promise<Collection>
export async function deleteCollectionSafely(id: string): Promise<void>

export interface BulkMembershipFailure {
  assetId: string;
  collectionId: string;
  reason: string;
}
export interface BulkMembershipResult {
  requestedCount: number;
  changedCount: number;
  skippedCount: number;
  failedCount: number;
  failures: BulkMembershipFailure[];
}
export async function assignAssetsToCollections(assetIds: string[], collectionIds: string[]): Promise<BulkMembershipResult>
export async function removeAssetsFromCollections(assetIds: string[], collectionIds: string[]): Promise<BulkMembershipResult>
export async function assignAssetToCollection(assetId: string, collectionId: string): Promise<void>
export async function removeAssetFromCollection(assetId: string, collectionId: string): Promise<void>
export async function getAssetsForCollection(collectionId: string): Promise<PortfolioAsset[]>
export async function getCollectionsForAsset(assetId: string): Promise<Collection[]>

export interface OrphanedMembership {
  assetId: string;
  invalidCollectionIds: string[];
}
export interface InvalidCoverAssetReference {
  collectionId: string;
  coverAssetId: string;
}
export interface CollectionIntegrityReport {
  generatedAt: number;
  totalCollections: number;
  totalAssets: number;
  orphanedMemberships: OrphanedMembership[];
  invalidCoverAssetReferences: InvalidCoverAssetReference[];
}
export async function validateCollectionIntegrity(): Promise<CollectionIntegrityReport>
export async function repairOrphanedCollectionIds(): Promise<BulkMembershipResult>
export async function repairCoverAssetIntegrity(): Promise<BulkMembershipResult>
```

## Real consumers (confirmed by grep, not assumed)

8 UI components import from this frozen surface:
`CollectionAssignmentDialog.tsx`, `CollectionCard.tsx`,
`CollectionDetailPanel.tsx`, `CollectionIntegrityPanel.tsx`,
`CollectionList.tsx`, `CollectionsView.tsx`,
`CreateCollectionDialog.tsx`, `PortfolioDetailPanel.tsx`, plus
`PortfolioManagerView.tsx` and `PortfolioSidebar.tsx`.

**One documented, intentional layering exception**:
`PortfolioManagerView.tsx` imports `loadCollections` directly from
`storage/collectionStore.ts` rather than going through
`services/collectionService.ts` for that one read — already shipped
behavior from P2 Stage 2, not introduced or changed by this freeze.
Noted here so it's an explicit, known part of the frozen contract rather
than something a future reviewer stumbles on and assumes is drift.

All of Sprint 1-3's validation tooling (`recoveryEngine.ts`,
`durabilityEngine.ts`, `scripts/validateRecovery.ts`,
`scripts/browserRecovery.ts`, `consistencyManifest.ts`, and others) also
consume this exact surface — the 81-scenario failure matrix, 900-cycle
durability run, and real-browser crash simulation from Sprint 3 are all,
among other things, load-bearing evidence that this API surface behaves
correctly under real use, not just unit-test use.

## Versioning policy going forward

Any change to a signature/error-type/interface-field listed above is a
**breaking change** and requires: (1) a documented reason, (2) updating
this file and `collectionApiFreeze.test.ts` in the same change, (3) a
note in `COLLECTION_RELEASE_NOTES.md`. An additive change (new optional
param, new export, new appended field) does not require breaking
anything — update this doc and the guard test's frozen list, no version
bump required. See `COLLECTION_RELEASE_NOTES.md` for the recommended
version tag this freeze corresponds to.
