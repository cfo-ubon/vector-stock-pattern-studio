import type { Asset, AssetRelationship } from './types';

// Asset Ecosystem Engine (Phase 9) — Section 3 "Asset Relationships".
// Every relationship below is derived from real fields already on the
// extracted `Asset` records (`family`, `sourceCollectionId`,
// `sourceMotifIds`) — nothing here is a hardcoded pairing (Section 10).
//
// `family` is assigned per real generator *category*, one family per
// category (`engine/motifFactory.ts`'s `CATEGORY_FAMILY`) — a single
// Collection's motifs therefore always share one family, so a real
// Flower→Leaf or Leaf→Branch pairing can only ever exist *across*
// collections (e.g. a botanical collection's flowers with a tropical
// collection's leaves), never within one. Border→Corner is the opposite:
// both are built from the *same* collection's real filler-motif pool
// (see `extraction.ts`), so that pairing is genuinely collection-scoped.

function groupBySourceCollection(assets: Asset[]): Map<string, Asset[]> {
  const groups = new Map<string, Asset[]>();
  for (const asset of assets) {
    const key = asset.metadata.sourceCollectionId;
    const bucket = groups.get(key);
    if (bucket) bucket.push(asset);
    else groups.set(key, [asset]);
  }
  return groups;
}

function sharesMotif(a: Asset, b: Asset): number {
  const bIds = new Set(b.metadata.sourceMotifIds);
  return a.metadata.sourceMotifIds.filter((id) => bIds.has(id)).length;
}

function crossFamilyPairs(assets: Asset[], fromFamily: string, toFamily: string, type: AssetRelationship['type']): AssetRelationship[] {
  const from = assets.filter((a) => a.metadata.family === fromFamily);
  const to = assets.filter((a) => a.metadata.family === toFamily);
  const relationships: AssetRelationship[] = [];
  for (const a of from) {
    for (const b of to) {
      if (a.metadata.id === b.metadata.id) continue;
      const sameCollection = a.metadata.sourceCollectionId === b.metadata.sourceCollectionId;
      relationships.push({
        fromAssetId: a.metadata.id,
        toAssetId: b.metadata.id,
        type,
        note: sameCollection ? 'same collection, botanical pairing' : 'botanical pairing across collections',
      });
    }
  }
  return relationships;
}

/** Section 3's named examples, all derived. Flower→Leaves and Leaf→Branch
 * are pool-wide (see module header — one family per category means a
 * real pairing usually spans two different collections). Border→Corner
 * and Collection→Assets stay collection-scoped. A `sameFamily`
 * relationship additionally surfaces cross-collection reuse candidates —
 * two assets sharing a family regardless of kind, the closest real
 * analog of "these could be swapped for each other". */
export function deriveAssetRelationships(assets: Asset[]): AssetRelationship[] {
  const relationships: AssetRelationship[] = [
    ...crossFamilyPairs(assets, 'flower', 'leaf', 'flowerToLeaf'),
    ...crossFamilyPairs(assets, 'leaf', 'branch', 'leafToBranch'),
  ];

  const byCollection = groupBySourceCollection(assets);
  for (const [collectionId, group] of byCollection) {
    const borders = group.filter((a) => a.metadata.kind === 'border');
    const frames = group.filter((a) => a.metadata.kind === 'frame');
    for (const border of borders) {
      for (const frame of frames) {
        const shared = sharesMotif(border, frame);
        if (shared > 0) {
          relationships.push({ fromAssetId: border.metadata.id, toAssetId: frame.metadata.id, type: 'borderToCorner', note: `shares ${shared} motif(s) from the same filler pool` });
        }
      }
    }
    for (const asset of group) {
      relationships.push({ fromAssetId: collectionId, toAssetId: asset.metadata.id, type: 'collectionToAsset', note: 'extracted from this collection' });
    }
  }

  for (let i = 0; i < assets.length; i++) {
    for (let j = i + 1; j < assets.length; j++) {
      const a = assets[i];
      const b = assets[j];
      if (a.metadata.sourceCollectionId === b.metadata.sourceCollectionId) continue;
      if (a.metadata.family === b.metadata.family) {
        relationships.push({ fromAssetId: a.metadata.id, toAssetId: b.metadata.id, type: 'sameFamily', note: `both ${a.metadata.family}, from different collections — reuse candidates` });
      }
    }
  }

  return relationships;
}

/** Every relationship touching one asset, either direction — the
 * "what's related to this?" query a UI needs. */
export function relationshipsForAsset(relationships: AssetRelationship[], assetId: string): AssetRelationship[] {
  return relationships.filter((r) => r.fromAssetId === assetId || r.toAssetId === assetId);
}
