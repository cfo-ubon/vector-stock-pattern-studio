// Stable application-level IDs for the Portfolio Manager catalog.

/** `VSP-YYYYMMDD-XXXXXX` — date-stamped for human scanability in exported
 * filenames/ZIP manifests, with a 6-char base36 random suffix (~2.1B
 * possible values/day) to avoid collisions within the same import batch.
 * Not derived from file content — collision-avoidance for *identity* is
 * this suffix; collision-avoidance for *duplicate detection* is the
 * separate SHA-256 content hash (see `domain/hash.ts`). */
export function generateAssetId(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0');
  return `VSP-${y}${m}${d}-${suffix}`;
}

/** Internal pointer key for a stored file body — never shown to the user,
 * so it uses the rest of the codebase's plain `prefix-timestamp-random`
 * convention (`workbenchHistory.ts`/`projectManager.ts`) rather than the
 * asset-facing `VSP-` format. */
export function generateFileId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const ASSET_ID_PATTERN = /^VSP-\d{8}-[0-9A-Z]{6}$/;

export function isValidAssetId(value: unknown): value is string {
  return typeof value === 'string' && ASSET_ID_PATTERN.test(value);
}

/** `COL-YYYYMMDD-XXXXXX` — Portfolio Manager P2 Stage 1. Same shape and
 * same collision-avoidance rationale as `generateAssetId` (date-stamped +
 * 6-char base36 random suffix), with a distinct `COL-` prefix so a
 * collection ID and an asset ID are never visually or programmatically
 * ambiguous even though both are plain strings. */
export function generateCollectionId(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0');
  return `COL-${y}${m}${d}-${suffix}`;
}

const COLLECTION_ID_PATTERN = /^COL-\d{8}-[0-9A-Z]{6}$/;

export function isValidCollectionId(value: unknown): value is string {
  return typeof value === 'string' && COLLECTION_ID_PATTERN.test(value);
}
