import type { PortfolioAsset } from '../catalog/domain/types';
import type { Collection } from '../catalog/domain/collection';
import type { CollectionCompletenessReport } from './domain/types';

// Build 031A, Phase 4 — Collection Completeness. `PortfolioAsset` (the
// Portfolio/Catalog domain model this pipeline operates on) has no
// persisted "creative role" field — the Collection Studio's own
// `collection/collectionGenerator.ts`/`collectionScore.ts` already do this
// completeness check, but only for its own in-memory `GeneratedCollection`
// shape, not for a `catalog/domain/collection.ts` `Collection` grouping
// already-imported Portfolio assets. Rather than fabricate a role an asset
// was never tagged with, this module looks for the spec's role names
// inside each member asset's own `tags` (a real, freely-settable field)
// and is explicit — via `roleTrackingAvailable` — about the difference
// between "verified complete," "verified incomplete," and "cannot be
// verified because no asset in this collection carries a role tag at all."

/** The spec's own 7 role names, verbatim, lower-cased for matching. */
export const COLLECTION_ROLE_NAMES = ['hero', 'secondary', 'blender', 'coordinate', 'stripe', 'texture', 'colorway'] as const;

function memberHasRoleTag(asset: PortfolioAsset, role: string): boolean {
  return asset.tags.some((tag) => tag.trim().toLowerCase() === role || tag.trim().toLowerCase().includes(role));
}

export function checkCollectionCompleteness(collection: Collection, memberAssets: PortfolioAsset[]): CollectionCompletenessReport {
  const presentRoles = COLLECTION_ROLE_NAMES.filter((role) => memberAssets.some((asset) => memberHasRoleTag(asset, role)));
  const roleTrackingAvailable = presentRoles.length > 0;

  if (!roleTrackingAvailable) {
    return {
      collectionId: collection.id,
      collectionName: collection.name,
      memberCount: memberAssets.length,
      roleTrackingAvailable: false,
      presentRoles: [],
      missingRoles: [],
      complete: false,
      explanation:
        memberAssets.length === 0
          ? 'Collection is empty — no assets assigned yet.'
          : `Role tracking not available for "${collection.name}" — none of its ${memberAssets.length} asset(s) are tagged with a commercial role (hero/secondary/blender/coordinate/stripe/texture/colorway), so role completeness cannot be verified. Tag assets to enable this check.`,
    };
  }

  const missingRoles = COLLECTION_ROLE_NAMES.filter((role) => !presentRoles.includes(role));
  const complete = missingRoles.length === 0;
  return {
    collectionId: collection.id,
    collectionName: collection.name,
    memberCount: memberAssets.length,
    roleTrackingAvailable: true,
    presentRoles: [...presentRoles],
    missingRoles: [...missingRoles],
    complete,
    explanation: complete
      ? `"${collection.name}" has every tracked commercial role represented.`
      : `Collection not commercially complete — "${collection.name}" is missing: ${missingRoles.join(', ')}.`,
  };
}
