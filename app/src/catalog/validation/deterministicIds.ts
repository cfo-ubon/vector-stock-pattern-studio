// Deterministic id/date helpers for the validation dataset generator.
//
// `domain/id.ts`'s real `generateAssetId`/`generateCollectionId` call
// `Math.random()` for their 6-char suffix — correct for production (real
// imports/creates happen one at a time, collisions are astronomically
// unlikely) but unusable here: Section 3 requires the *same* seed and
// config to always produce the *same* ids. These helpers build strings in
// the exact same `VSP-YYYYMMDD-XXXXXX` / `COL-YYYYMMDD-XXXXXX` shape (so
// `domain/id.ts`'s own `isValidAssetId`/`isValidCollectionId` still accept
// them) from a plain deterministic index instead of `Math.random()| —
// mirroring the convention `collectionService.performance.test.ts` already
// established for its own synthetic fixtures.

function datePart(baseTimestamp: number): string {
  const d = new Date(baseTimestamp);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function indexSuffix(index: number): string {
  return index.toString(36).padStart(6, '0').toUpperCase();
}

export function deterministicAssetId(index: number, baseTimestamp: number): string {
  return `VSP-${datePart(baseTimestamp)}-${indexSuffix(index)}`;
}

export function deterministicCollectionId(index: number, baseTimestamp: number): string {
  return `COL-${datePart(baseTimestamp)}-${indexSuffix(index)}`;
}

/** A syntactically valid but deliberately never-generated id, used to
 * inject "references a record that doesn't exist" conditions (stale
 * cover, orphaned membership) without any chance of colliding with a
 * real deterministic id from the same generation run — real ids always
 * derive from `datePart(config.baseTimestamp)`, so a fixed, distant
 * placeholder date can never collide. */
export const GHOST_ASSET_ID = 'VSP-19990101-GHOST0';
export const GHOST_COLLECTION_ID = 'COL-19990101-GHOST0';
