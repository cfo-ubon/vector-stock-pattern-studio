import type { GenerateParams } from '../engine/types';
import type { PortfolioAsset } from '../catalog/domain/types';
import { getPortfolioFile } from '../catalog/storage/portfolioStore';

// Design Refinement Studio Pro, Mission 1/3 — reads the exact same JSON
// sidecar file every generation pipeline already writes next to the SVG
// (`batch/batchProductionService.ts`, `autopilot/generationOrchestrator.ts`:
// `new File([JSON.stringify(variantParams)], ...)`), so Design Edit Mode
// starts from the asset's own real params — never a reconstructed or
// guessed default. Assets with no recoverable params (manual imports with
// no JSON sidecar, or a sidecar that isn't a real `GenerateParams`) are
// honestly reported as not editable rather than silently defaulted.

const REQUIRED_KEYS: (keyof GenerateParams)[] = [
  'categoryId',
  'layoutId',
  'paletteId',
  'colorCount',
  'tileSize',
  'density',
  'motifSize',
  'rotationJitter',
  'scaleJitter',
  'mirror',
  'radialSymmetry',
  'seed',
];

/** A real runtime check (not just a TypeScript cast) — the sidecar JSON
 * could be anything (a manual import's own metadata shape, a corrupted
 * file, a future/older schema). Only treated as editable when every field
 * the editor and renderer actually depend on is present. */
export function isEditableGenerateParams(value: unknown): value is GenerateParams {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return REQUIRED_KEYS.every((k) => v[k] !== undefined);
}

/** Returns `null` (never a fabricated default) when this asset has no
 * recoverable, real `GenerateParams` to edit. */
export async function loadDesignParamsForAsset(asset: PortfolioAsset): Promise<GenerateParams | null> {
  if (!asset.metadataReference) return null;
  const file = await getPortfolioFile(asset.metadataReference);
  if (!file) return null;
  try {
    const text = await file.blob.text();
    const value: unknown = JSON.parse(text);
    return isEditableGenerateParams(value) ? value : null;
  } catch {
    return null;
  }
}
