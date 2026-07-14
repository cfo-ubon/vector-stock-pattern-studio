import { validateAssetData, type ValidationIssue } from '../validators';
import { getMotifKnowledge } from '../knowledge/motif';
import type { Asset, AssetRelationship } from './types';

// Asset Ecosystem Engine (Phase 9) — Section 10 "JSON": validation reuses
// the exact same `validators/index.ts` `SCHEMA_REGISTRY`/`makeValidator`
// machinery every other domain in this app already uses — no second
// validation engine. Two real checks, mirroring `knowledge/validation.ts`'s
// own two-check shape: schema validation per asset, and cross-domain
// referential-integrity (every asset's `categoryId` resolves to a real
// Motif Grammar record, and every relationship's asset ids resolve to
// real assets in the pool).

export interface AssetValidationResult {
  id: string;
  issues: ValidationIssue[];
}

export function validateAssetPool(assets: Asset[]): AssetValidationResult[] {
  return assets.map((asset) => ({ id: asset.metadata.id, issues: validateAssetData(asset) }));
}

export function isAssetPoolValid(assets: Asset[]): boolean {
  return validateAssetPool(assets).every((r) => r.issues.length === 0);
}

/** Cross-domain referential-integrity — every asset's real `categoryId`
 * resolves to a real `knowledge/motif` record, and every relationship's
 * `fromAssetId`/`toAssetId` resolves to a real asset id (except
 * `collectionToAsset`, whose `fromAssetId` is a collection id, not an
 * asset id — the one real exception `relationships.ts` itself produces). */
export function validateAssetRelationshipIntegrity(assets: Asset[], relationships: AssetRelationship[]): AssetValidationResult[] {
  const results: AssetValidationResult[] = [];
  const realAssetIds = new Set(assets.map((a) => a.metadata.id));

  for (const asset of assets) {
    const issues: ValidationIssue[] = [];
    if (!getMotifKnowledge(asset.metadata.categoryId)) {
      issues.push({ path: 'metadata.categoryId', message: `references unknown motif category "${asset.metadata.categoryId}"` });
    }
    results.push({ id: asset.metadata.id, issues });
  }

  for (const rel of relationships) {
    const issues: ValidationIssue[] = [];
    if (rel.type !== 'collectionToAsset' && !realAssetIds.has(rel.fromAssetId)) {
      issues.push({ path: 'fromAssetId', message: `relationship references unknown asset "${rel.fromAssetId}"` });
    }
    if (!realAssetIds.has(rel.toAssetId)) {
      issues.push({ path: 'toAssetId', message: `relationship references unknown asset "${rel.toAssetId}"` });
    }
    if (issues.length > 0) results.push({ id: `${rel.fromAssetId}->${rel.toAssetId}`, issues });
  }

  return results;
}

export function isAssetRelationshipIntegrityValid(assets: Asset[], relationships: AssetRelationship[]): boolean {
  return validateAssetRelationshipIntegrity(assets, relationships).every((r) => r.issues.length === 0);
}
