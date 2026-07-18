import type { GenerateParams, TileData } from '../engine/types';
import type { PortfolioAsset } from '../catalog/domain/types';
import { createRng, randomSeed } from '../engine/rng';
import { randomizedParams } from '../engine/defaults';
import { assignPortfolioDiversity } from '../engine/portfolioVariety';
import { HIERARCHY_PRESETS } from '../engine/hierarchy';
import { buildTileForGenerate } from '../engine/heroDetector';
import { resolveStyleDna, type StyleDna } from '../engine/styleDna';
import { buildSingleTileSvg, buildExportFilename, buildFilenameParts } from '../export/svgExporter';
import { importFileGroup, type ImportOutcome } from '../catalog/import/importPipeline';
import type { FileGroup } from '../catalog/import/basenameGrouping';

// Build 018 ("Revenue First", Priority 3 — Batch Generate; Priority 2 —
// Portfolio Diversity; Priority 5 — Duplicate Detection). This module
// introduces ZERO new scoring, diversity, or duplicate-detection logic —
// it is pure orchestration over four already-existing, unmodified
// systems:
//   1. `engine/portfolioVariety.ts`'s `assignPortfolioDiversity` (Build
//      003/004) — the exact shuffled-bag diversity assignment
//      `App.tsx`'s pre-existing "Generate 9 Variations" flow already
//      uses, here simply given a caller-supplied `count` instead of a
//      hardcoded 9.
//   2. `engine/heroDetector.ts`'s `buildTileForGenerate` (Build 003/007,
//      extracted to a shared export as part of this same build so this
//      service and the UI's own single/9-variation flows call one
//      routing implementation, not two) — the same hero-visibility /
//      commercial-composition quality retry every other generation path
//      already gets.
//   3. `export/svgExporter.ts`'s `buildSingleTileSvg` /
//      `buildFilenameParts` / `buildExportFilename` (unchanged) — the
//      same SVG export + filename derivation the manual "Export SVG"
//      action already uses.
//   4. `catalog/import/importPipeline.ts`'s `importFileGroup` (Sprint
//      P1) — the Portfolio Manager's own, already-shipped duplicate
//      detection (`catalog/import/duplicates.ts`'s `detectDuplicate`,
//      exact-hash + possible-match signals) and IndexedDB persistence
//      (`importAssetTransaction`). A freshly-generated pattern is turned
//      into the exact same `File`-shaped input a manual drag-and-drop
//      import would produce (an `.svg` + a `.json` sidecar sharing one
//      basename) and handed to the same function — so a batch item is
//      duplicate-checked and stored with precisely the same rules and
//      code path a human-imported file gets, never a second policy.

/** Mirrors `App.tsx`'s pre-existing "Generate 9 Variations" per-item
 * param construction (Style DNA re-resolved per item when active,
 * otherwise a fresh `randomizedParams` roll) — unchanged logic, just
 * factored out so it runs `count` times instead of a hardcoded 9. */
function buildVariantParams(base: GenerateParams, activeDna: StyleDna | undefined, seed: string, assignment: ReturnType<typeof assignPortfolioDiversity>[number]): GenerateParams {
  return {
    ...(activeDna ? { ...base, ...resolveStyleDna(activeDna, seed), seed } : { ...randomizedParams(base), seed }),
    compositionZone: assignment.compositionZone,
    botanicalFamily: assignment.botanicalFamily,
    clusterArchetypes: [assignment.clusterType],
    hierarchy: HIERARCHY_PRESETS[assignment.heroStructure].value,
    heroArchetype: assignment.heroSilhouette,
  };
}

export interface BatchProductionInput {
  /** How many patterns to generate — the brief's 10/20/50/100 presets,
   * though any positive integer works. */
  count: number;
  params: GenerateParams;
  /** Already-resolved active Style DNA, if one is set — same object
   * `App.tsx` already looks up from `STYLE_DNA_PRESETS`/`loadCustomStyles`
   * for the existing 9-variation flow. */
  activeDna?: StyleDna;
  /** The catalog's current assets, so duplicate detection can compare
   * against real prior history, not just within this one batch. */
  existingAssets: PortfolioAsset[];
  /** Injectable, for deterministic tests — omitted callers get a fresh
   * `randomSeed()` per item, matching every other generation path's
   * convention. */
  seedForItem?: (index: number) => string;
  /** Seeds the shuffled-bag diversity assignment (`assignPortfolioDiversity`)
   * — omitted callers get a fresh `randomSeed()`, matching the existing
   * 9-variation flow's own per-click randomness. Injectable for the same
   * reason `seedForItem` is: without it, two calls with identical
   * `params`/`seedForItem` still produce structurally different patterns
   * (different composition zone/botanical family/cluster/hierarchy/hero
   * silhouette draws), which is the right default for real production use
   * but makes exact reproduction — including in tests — otherwise
   * impossible. */
  diversityRngSeed?: string;
}

export interface BatchProductionItemResult {
  index: number;
  variantParams: GenerateParams;
  tileData: TileData;
  outcome: ImportOutcome;
  /** How many attempts `buildTileForGenerate`'s own quality-retry gate
   * (engine/heroDetector.ts) took for this item — 1 means the first
   * attempt already cleared the real commercial threshold. Build 019
   * ("Visual Commercial Upgrade"), Priority 5/6: plumbed through from the
   * retry result Batch Generate already computes, not a new measurement. */
  attempts: number;
  /** True if at least one retry actually ran for this item (mirrors
   * `HeroRetryResult`/`CommercialRetryResult`'s own field of the same
   * name). */
  regenerated: boolean;
}

export interface BatchProductionResult {
  items: BatchProductionItemResult[];
  generatedCount: number;
  importedCount: number;
  possibleDuplicateCount: number;
  blockedDuplicateCount: number;
  errorCount: number;
  /** Fraction of items (0-100) whose first attempt did not clear the
   * quality-retry gate's real threshold, i.e. needed at least one
   * regeneration — Build 019, Priority 5/6's "retry rate" validation
   * metric, aggregated from `items[].regenerated` rather than computed by
   * any new logic. */
  retryRate: number;
  /** Mean `attempts` across all generated items. */
  meanAttempts: number;
}

/** Generates `count` diverse patterns and saves each straight into the
 * Portfolio catalog via the existing import pipeline — the "Batch
 * Generate (10/20/50/100)" feature. Sequential (never parallel), the
 * same reason `catalog/import/importPipeline.ts`'s own `importFiles`
 * batch loop is sequential: each item's duplicate check must see every
 * asset already imported earlier in this same batch, not just the
 * catalog's state before the batch started. */
export async function generateBatchToPortfolio(input: BatchProductionInput): Promise<BatchProductionResult> {
  const { count, params, activeDna, existingAssets, seedForItem, diversityRngSeed } = input;
  if (count <= 0) {
    return { items: [], generatedCount: 0, importedCount: 0, possibleDuplicateCount: 0, blockedDuplicateCount: 0, errorCount: 0, retryRate: 0, meanAttempts: 0 };
  }

  const diversityRng = createRng(diversityRngSeed ?? randomSeed());
  const assignments = assignPortfolioDiversity(diversityRng, count, {
    compositionZones: activeDna?.preferredZones?.length ? activeDna.preferredZones : undefined,
    botanicalFamilies: activeDna?.preferredFamilies?.length ? activeDna.preferredFamilies : undefined,
    clusterTypes: activeDna?.preferredClusterArchetypes?.length ? activeDna.preferredClusterArchetypes : undefined,
  });

  const items: BatchProductionItemResult[] = [];
  const knownAssets = [...existingAssets];

  for (let i = 0; i < count; i++) {
    const seed = seedForItem ? seedForItem(i) : randomSeed();
    const variantParams = buildVariantParams(params, activeDna, seed, assignments[i]);
    const retryResult = buildTileForGenerate(variantParams);
    const { tileData, attempts, regenerated } = retryResult;

    const svgText = buildSingleTileSvg(tileData);
    const baseName = buildExportFilename(buildFilenameParts(variantParams), variantParams.seed).replace(/\.svg$/i, '');
    const svgFile = new File([svgText], `${baseName}.svg`, { type: 'image/svg+xml' });
    const jsonFile = new File([JSON.stringify(variantParams)], `${baseName}.json`, { type: 'application/json' });
    const group: FileGroup<File> = { basename: baseName, files: [svgFile, jsonFile] };

    const outcome = await importFileGroup(group, knownAssets, {});
    if (outcome.status === 'imported') knownAssets.push(outcome.asset);
    items.push({ index: i, variantParams, tileData, outcome, attempts, regenerated });
  }

  return {
    items,
    generatedCount: items.length,
    importedCount: items.filter((it) => it.outcome.status === 'imported').length,
    possibleDuplicateCount: items.filter((it) => it.outcome.status === 'possibleDuplicate').length,
    blockedDuplicateCount: items.filter((it) => it.outcome.status === 'blockedDuplicate').length,
    errorCount: items.filter((it) => it.outcome.status === 'error').length,
    retryRate: Math.round((items.filter((it) => it.regenerated).length / items.length) * 10000) / 100,
    meanAttempts: Math.round((items.reduce((a, it) => a + it.attempts, 0) / items.length) * 100) / 100,
  };
}
