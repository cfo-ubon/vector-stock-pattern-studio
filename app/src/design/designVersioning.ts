import type { GenerateParams, TileData } from '../engine/types';
import type { PortfolioAsset } from '../catalog/domain/types';
import { buildSingleTileSvg, buildExportFilename, buildFilenameParts } from '../export/svgExporter';
import { importFileGroup, type ImportOutcome } from '../catalog/import/importPipeline';
import type { FileGroup } from '../catalog/import/basenameGrouping';
import { loadDesignParamsForAsset } from './designParamsIO';
import { evaluateDesign } from './designEvaluation';

// Design Refinement Studio Pro, Mission 1/6 — "Approve" persists an edit as
// a brand-new `PortfolioAsset`, built the exact same way every other
// generation pipeline already builds one (`buildSingleTileSvg` +
// `importFileGroup`) and linked back to the asset it was edited from via
// `parentAssetId`/`variationGroupId` — fields `catalog/domain/types.ts`
// already defines for exactly this lineage. The original asset's own row
// is never written to, never deleted: non-destructive by construction, not
// by a special-cased guard. Real duplicate detection still runs
// (`importFileGroup`'s own `detectDuplicate`) — a trivial edit that
// produces byte-identical output is still a real, correctly-surfaced
// duplicate, not something this flow silently overrides.

export async function saveDesignVersion(
  original: PortfolioAsset,
  params: GenerateParams,
  tileData: TileData,
  existingAssets: PortfolioAsset[],
  options: { forceImportAsNew?: boolean; displayNameSuffix?: string } = {},
): Promise<ImportOutcome> {
  const svgText = buildSingleTileSvg(tileData);
  const baseName = buildExportFilename(buildFilenameParts(params), params.seed).replace(/\.svg$/i, '');
  const svgFile = new File([svgText], `${baseName}.svg`, { type: 'image/svg+xml' });
  const jsonFile = new File([JSON.stringify(params)], `${baseName}.json`, { type: 'application/json' });
  const group: FileGroup<File> = { basename: baseName, files: [svgFile, jsonFile] };
  const displayName = `${buildFilenameParts(params).slice(0, 2).join(' ')} pattern (${options.displayNameSuffix ?? 'edited'})`;
  const importOptions = {
    displayName,
    parentAssetId: original.assetId,
    variationGroupId: original.variationGroupId ?? original.assetId,
    generatorVersion: original.generatorVersion ?? 'v1',
  };

  const outcome = await importFileGroup(group, existingAssets, { ...importOptions, forceImportAsNew: options.forceImportAsNew });

  // A saved Design Version normally keeps the parent's seed by default —
  // that's the expected case for every parameter edit that isn't a
  // deliberate seed reroll, not a real duplicate. `detectDuplicate` already
  // checks byte-identical content (`exact`) before it ever reaches this
  // heuristic, so landing here with `generatorSeed` as the *only* matched
  // signal means the rendered output genuinely changed — retry once,
  // forcing the import through. Any other/additional matched signal
  // (filename+fileSize, normalizedJsonHash) is still a real warning and is
  // left for the caller to handle.
  if (
    outcome.status === 'possibleDuplicate' &&
    !options.forceImportAsNew &&
    outcome.matchedOn.length === 1 &&
    outcome.matchedOn[0] === 'generatorSeed'
  ) {
    return importFileGroup(group, existingAssets, { ...importOptions, forceImportAsNew: true });
  }

  return outcome;
}

/** Every asset in the same edit lineage as `assetId` — the original plus
 * every version saved from it (or from one of its own versions), newest
 * first. Pure read over the already-loaded portfolio; no new storage. */
export function listDesignVersions(assetId: string, allAssets: PortfolioAsset[]): PortfolioAsset[] {
  const root = allAssets.find((a) => a.assetId === assetId);
  const groupId = root?.variationGroupId ?? assetId;
  return allAssets.filter((a) => a.assetId === groupId || a.variationGroupId === groupId).sort((a, b) => b.createdAt - a.createdAt);
}

/** Mission 3 — an explicit "Duplicate" action on a Version History entry:
 * makes an exact copy of a version's own real, already-generated pattern
 * as a new linked asset. Reuses the exact same `saveDesignVersion` ->
 * `importFileGroup` path Approve already uses, with `forceImportAsNew:
 * true` since a duplicate is *expected* to render byte-identical output
 * (the generatorSeed-retry logic in `saveDesignVersion` only matters when
 * content genuinely differs, which a duplicate never does). Returns `null`
 * — never a fabricated copy — if `source` has no real, loadable
 * `GenerateParams` to duplicate (e.g. a manually-imported asset with no
 * JSON sidecar). */
export async function duplicateDesignVersion(source: PortfolioAsset, existingAssets: PortfolioAsset[]): Promise<ImportOutcome | null> {
  const params = await loadDesignParamsForAsset(source);
  if (!params) return null;
  const evaluation = evaluateDesign(params);
  return saveDesignVersion(source, params, evaluation.tileData, existingAssets, { forceImportAsNew: true, displayNameSuffix: 'copy' });
}
