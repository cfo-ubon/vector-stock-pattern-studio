import type { GenerateParams } from '../engine/types';
import type { PortfolioAsset } from '../catalog/domain/types';
import { HIERARCHY_PRESETS } from '../engine/hierarchy';
import { loadDesignParamsForAsset } from './designParamsIO';
import { evaluateDesign } from './designEvaluation';
import { saveDesignVersion } from './designVersioning';
import { revalidateDesignVersion } from './designRevalidation';

// Design Refinement Studio Pro, Mission 4 — Batch Refinement. Applies one
// owner-defined adjustment to many already-generated patterns at once,
// each saved through the exact same non-destructive path a single Design
// Edit Mode Approve already uses (`loadDesignParamsForAsset` ->
// `evaluateDesign` -> `saveDesignVersion` -> `revalidateDesignVersion`) —
// no new engine, no bypass of duplicate detection or QA. Every item is
// processed sequentially, matching `importFileGroup`'s own documented
// requirement that duplicate checks never run in parallel (each check
// reads the assets accumulated by every prior item in the same batch).

export interface BatchRefinementAdjustments {
  /** Absolute override — every affected asset switches to this palette.
   * Undefined = keep each asset's own palette. */
  paletteId?: string;
  /** Absolute override, keyed into `HIERARCHY_PRESETS`. Undefined = keep
   * each asset's own hierarchy. */
  hierarchyPresetId?: string;
  /** Every delta below is added to each asset's OWN current value (not a
   * shared absolute target), then clamped to the field's real 0..1 range
   * — so the same "+0.1 density" adjustment nudges every pattern in the
   * batch rather than flattening them all to one identical value.
   * Undefined/0 = no change for that field. */
  densityDelta?: number;
  negativeSpaceDelta?: number;
  overlapDelta?: number;
  rotationJitterDelta?: number;
  scaleJitterDelta?: number;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function applyBatchAdjustments(params: GenerateParams, adjustments: BatchRefinementAdjustments): GenerateParams {
  const next: GenerateParams = { ...params };
  if (adjustments.paletteId) next.paletteId = adjustments.paletteId;
  if (adjustments.hierarchyPresetId) {
    const preset = HIERARCHY_PRESETS[adjustments.hierarchyPresetId];
    if (preset) next.hierarchy = preset.value;
  }
  if (adjustments.densityDelta) next.density = clamp01(params.density + adjustments.densityDelta);
  if (adjustments.negativeSpaceDelta) next.negativeSpace = clamp01((params.negativeSpace ?? 0) + adjustments.negativeSpaceDelta);
  if (adjustments.overlapDelta) next.overlapAmount = clamp01((params.overlapAmount ?? 0) + adjustments.overlapDelta);
  if (adjustments.rotationJitterDelta) next.rotationJitter = clamp01(params.rotationJitter + adjustments.rotationJitterDelta);
  if (adjustments.scaleJitterDelta) next.scaleJitter = clamp01(params.scaleJitter + adjustments.scaleJitterDelta);
  return next;
}

export type BatchRefinementItemOutcome =
  | { assetId: string; status: 'applied'; newAssetId: string }
  | { assetId: string; status: 'skippedNoParams' }
  | { assetId: string; status: 'duplicate' }
  | { assetId: string; status: 'error'; message: string };

export async function runBatchRefinement(
  assets: PortfolioAsset[],
  adjustments: BatchRefinementAdjustments,
  existingAssets: PortfolioAsset[],
  onProgress?: (done: number, total: number) => void,
): Promise<BatchRefinementItemOutcome[]> {
  const results: BatchRefinementItemOutcome[] = [];
  let known = [...existingAssets];

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    try {
      const params = await loadDesignParamsForAsset(asset);
      if (!params) {
        results.push({ assetId: asset.assetId, status: 'skippedNoParams' });
      } else {
        const nextParams = applyBatchAdjustments(params, adjustments);
        const evaluation = evaluateDesign(nextParams);
        const outcome = await saveDesignVersion(asset, nextParams, evaluation.tileData, known, { displayNameSuffix: 'batch refined' });
        if (outcome.status === 'imported') {
          known = [...known, outcome.asset];
          try {
            await revalidateDesignVersion(outcome.asset, evaluation.tileData, known, []);
          } catch {
            // Revalidation failing doesn't undo the already-saved version —
            // same non-fatal treatment DesignEditView's Approve flow uses.
          }
          results.push({ assetId: asset.assetId, status: 'applied', newAssetId: outcome.asset.assetId });
        } else if (outcome.status === 'blockedDuplicate' || outcome.status === 'possibleDuplicate') {
          results.push({ assetId: asset.assetId, status: 'duplicate' });
        } else {
          results.push({ assetId: asset.assetId, status: 'error', message: outcome.message });
        }
      }
    } catch (e) {
      results.push({ assetId: asset.assetId, status: 'error', message: e instanceof Error ? e.message : 'unknown error' });
    }
    onProgress?.(i + 1, assets.length);
  }

  return results;
}
