import { generateCollectionId } from './id';

// Portfolio Manager P2 Stage 1 — Collection domain model. A Collection is
// a user-defined grouping of catalog assets (`PortfolioAsset`, see
// `domain/types.ts`) — e.g. "Spring 2026 Florals" or "Etsy Q3 drop".
// Membership is many-to-many and stored on the *asset* side
// (`PortfolioAsset.collectionIds: string[]`, already reserved by P1 — see
// `docs/portfolio/COLLECTION_ARCHITECTURE.md` / ADR-005 for why a
// dedicated `collectionMembers` join store was not introduced instead).
// This module owns only the Collection record itself; membership
// mutations live in `services/collectionService.ts` since they touch both
// the `collections` and `portfolioAssets` stores.

/** Bumped alongside `normalizeCollection()` migration branches, mirroring
 * `domain/types.ts`'s `PORTFOLIO_ASSET_SCHEMA_VERSION` convention — a
 * record-shape version independent of `storage/db.ts`'s `DB_VERSION`. */
export const COLLECTION_SCHEMA_VERSION = 1;

/** Names longer than this are rejected at creation/rename — matches the
 * ballpark of other short user-facing text fields in this app (e.g.
 * `displayName` on `PortfolioAsset` has no hard cap today, but a
 * collection name is meant to be a short label, not a sentence). */
export const COLLECTION_NAME_MAX_LENGTH = 120;
export const COLLECTION_DESCRIPTION_MAX_LENGTH = 2000;

export interface Collection {
  id: string;
  name: string;
  /** Trimmed, lowercased, whitespace-collapsed form of `name` — used for
   * case-insensitive duplicate-name detection (`collectionService.ts`)
   * and case-insensitive search (`searchByName`). Not a URL slug: this
   * app has no per-collection routes/URLs, so a slug would be
   * unused surface area — see ADR-005. */
  normalizedName: string;
  description: string;
  /** `assetId` of the asset used as this collection's cover thumbnail, or
   * `null`. Must reference an existing asset or be `null` (Rule 12) — see
   * `services/collectionService.ts`'s integrity validation/repair for how
   * staleness (the referenced asset was later deleted) is detected and
   * fixed. */
  coverAssetId: string | null;
  isArchived: boolean;
  archivedAt: number | null;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
}

export class InvalidCollectionNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCollectionNameError';
  }
}

/** Trim + collapse internal whitespace runs to single spaces — the same
 * normalization applied to both the stored `name` (cosmetic cleanup) and
 * `normalizedName` (before lowercasing, for duplicate detection). */
function cleanWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeCollectionName(rawName: string): string {
  return cleanWhitespace(rawName).toLowerCase();
}

/** Throws `InvalidCollectionNameError` for empty/whitespace-only names or
 * names over `COLLECTION_NAME_MAX_LENGTH` — called by both
 * `createCollection` and `collectionService.renameCollection` so the rule
 * is enforced identically at creation and at rename, not just once. */
export function validateCollectionName(rawName: string): string {
  const cleaned = cleanWhitespace(rawName);
  if (cleaned.length === 0) {
    throw new InvalidCollectionNameError('Collection name cannot be empty or whitespace-only.');
  }
  if (cleaned.length > COLLECTION_NAME_MAX_LENGTH) {
    throw new InvalidCollectionNameError(`Collection name cannot exceed ${COLLECTION_NAME_MAX_LENGTH} characters.`);
  }
  return cleaned;
}

function validateDescription(rawDescription: string): string {
  const cleaned = rawDescription.trim();
  if (cleaned.length > COLLECTION_DESCRIPTION_MAX_LENGTH) {
    return cleaned.slice(0, COLLECTION_DESCRIPTION_MAX_LENGTH);
  }
  return cleaned;
}

export interface CreateCollectionInput {
  name: string;
  description?: string;
  coverAssetId?: string | null;
  /** Injectable clock for deterministic tests (mirrors `generateAssetId`'s
   * `now: Date` parameter) — production callers omit this. */
  now?: number;
}

/** Collection identity (`id`) is assigned once here and never changes —
 * `collectionService.ts` has no "change ID" operation, satisfying Rule 2
 * ("Collection identity cannot change after creation"). */
export function createCollection(input: CreateCollectionInput): Collection {
  const now = input.now ?? Date.now();
  const name = validateCollectionName(input.name);
  return {
    id: generateCollectionId(new Date(now)),
    name,
    normalizedName: normalizeCollectionName(name),
    description: validateDescription(input.description ?? ''),
    coverAssetId: input.coverAssetId ?? null,
    isArchived: false,
    archivedAt: null,
    schemaVersion: COLLECTION_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}

/** Defensive normalization for records loaded from storage — same
 * rationale and `??`-fallback style as `domain/asset.ts`'s
 * `normalizePortfolioAsset`, so a future schema bump never crashes on an
 * older stored record. */
export function normalizeCollection(collection: Collection): Collection {
  return {
    ...collection,
    schemaVersion: collection.schemaVersion ?? COLLECTION_SCHEMA_VERSION,
    description: collection.description ?? '',
    coverAssetId: collection.coverAssetId ?? null,
    isArchived: collection.isArchived ?? false,
    archivedAt: collection.archivedAt ?? null,
    normalizedName: collection.normalizedName ?? normalizeCollectionName(collection.name ?? ''),
  };
}

export function isValidCollection(value: unknown): value is Collection {
  if (!value || typeof value !== 'object') return false;
  const c = value as Partial<Collection>;
  return (
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    typeof c.createdAt === 'number' &&
    typeof c.updatedAt === 'number' &&
    typeof c.isArchived === 'boolean'
  );
}
