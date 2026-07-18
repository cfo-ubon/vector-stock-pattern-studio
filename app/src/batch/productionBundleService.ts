import type { GenerateParams, TileData } from '../engine/types';
import type { SavedItem } from '../components/SavedPanel';
import { buildSingleTileSvg, buildExportFilename, buildFilenameParts } from '../export/svgExporter';
import { buildEps } from '../export/epsExporter';
import { buildShutterstockCsv, buildAdobeStockCsv } from '../metadata/csv';

// Build 021 ("Production Ready"). Verification found the app's export
// pipeline was three separate, non-integrated systems: Batch Generate to
// Portfolio only ever wrote SVG+JSON per item (no EPS/PNG/SEO CSV), the
// richer file formats only existed in the single-pattern "Saved library"
// flow, and no single click produced a complete sellable file set for a
// whole batch. This module is the pure, DOM-free packaging glue that
// closes that gap for "Production Mode" — it introduces ZERO new
// generation, scoring, or SVG/EPS/CSV logic of its own: every byte comes
// from `export/svgExporter.ts`'s `buildSingleTileSvg` (unchanged),
// `export/epsExporter.ts`'s `buildEps` (unchanged), and
// `metadata/csv.ts`'s `buildShutterstockCsv`/`buildAdobeStockCsv`
// (unchanged) — the exact same functions the pre-existing single-tile
// export buttons and the Saved-library "ย้ายทั้งคลังลงเครื่อง" bundle
// already use. Raster (PNG) preview generation stays in `App.tsx`, per
// this repo's own established convention (canvas rasterization needs a
// real DOM, so it never lives in a pure `src/batch/*Service.ts` file —
// see `rasterizeSvgToPngBlob`, already used the same way by the
// Collection Generator's own zip-building flow).

export interface ProductionBundleSource {
  tileData: TileData;
  variantParams: GenerateParams;
}

/** The base filename (no extension) every format for one item shares —
 * identical derivation to every other export path in the app
 * (`App.tsx`'s own `exportBase`, `batchProductionService.ts`'s own
 * `baseName`), so a Production Mode bundle's files match what a human
 * manually exporting the same pattern would get. */
export function productionBundleBaseName(variantParams: GenerateParams): string {
  return buildExportFilename(buildFilenameParts(variantParams), variantParams.seed).replace(/\.svg$/i, '');
}

export interface ProductionItemFiles {
  baseName: string;
  svg: string;
  eps: string;
}

/** SVG + EPS text for one item — the two vector formats every major stock
 * site accepts, generated exactly as the single-tile export buttons do. */
export function buildProductionItemFiles(source: ProductionBundleSource): ProductionItemFiles {
  return {
    baseName: productionBundleBaseName(source.variantParams),
    svg: buildSingleTileSvg(source.tileData),
    eps: buildEps(source.tileData),
  };
}

/** Adapts a batch item's `tileData` into the throwaway `SavedItem`-shaped
 * object `metadata/csv.ts`'s CSV builders expect — the exact "adapt
 * tileData into a SavedItem shape" precedent `collection/collectionGenerator.ts`
 * already established for its own SEO/CSV step, not a new convention. */
function toSavedItemShape(source: ProductionBundleSource, index: number): SavedItem {
  return { id: `production-${index}`, tileData: source.tileData, name: '', createdAt: Date.now(), note: '', submissions: {} };
}

export interface ProductionCsvBundle {
  shutterstockCsv: string;
  adobeStockCsv: string;
}

/** Combined multi-item metadata CSVs for the whole batch, in one shot —
 * reuses `metadata/csv.ts`'s existing Shutterstock/Adobe Stock builders
 * unmodified (same columns, same escaping), the same builders the
 * Saved-library "ย้ายทั้งคลังลงเครื่อง" flow already ships with. */
export function buildProductionCsvBundle(sources: ProductionBundleSource[]): ProductionCsvBundle {
  const filenameByItem = new Map<SavedItem, string>();
  const savedItems = sources.map((source, i) => {
    const saved = toSavedItemShape(source, i);
    filenameByItem.set(saved, `${productionBundleBaseName(source.variantParams)}.eps`);
    return saved;
  });
  const filenameFor = (item: SavedItem) => filenameByItem.get(item) ?? '';
  return {
    shutterstockCsv: buildShutterstockCsv(savedItems, filenameFor),
    adobeStockCsv: buildAdobeStockCsv(savedItems, filenameFor),
  };
}

export interface ProductionManifestItem {
  baseName: string;
  seed: string;
  styleDnaId?: string;
  categoryId: string;
  attempts: number;
  regenerated: boolean;
  status: string;
}

export interface ProductionManifest {
  generatedAt: string;
  itemCount: number;
  items: ProductionManifestItem[];
}

/** A plain traceability manifest for the whole run — mirrors the role
 * `library-backup.json` already plays for the Saved-library bundle and
 * `manifest.json` plays for Portfolio export ZIPs (Build 013), just
 * scoped to one Production Mode run. Carries no scoring data of its own. */
export function buildProductionManifest(
  entries: Array<{ source: ProductionBundleSource; attempts: number; regenerated: boolean; status: string }>,
): ProductionManifest {
  return {
    generatedAt: new Date().toISOString(),
    itemCount: entries.length,
    items: entries.map((entry) => ({
      baseName: productionBundleBaseName(entry.source.variantParams),
      seed: entry.source.variantParams.seed,
      styleDnaId: entry.source.variantParams.styleDnaId,
      categoryId: entry.source.variantParams.categoryId,
      attempts: entry.attempts,
      regenerated: entry.regenerated,
      status: entry.status,
    })),
  };
}
