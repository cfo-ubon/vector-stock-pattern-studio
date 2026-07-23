import type { PortfolioAsset } from '../domain/types';
import { importFiles, type ImportBatchResult } from './importPipeline';
import { putPortfolioAssetsBulk } from '../storage/portfolioStore';
import { parseCsv } from './marketplaceResultImport';
import { parseJsonText } from './jsonCompat';

// Build 026, Phase 15 — Historical Portfolio Importer. Imports the
// per-build report folders this repo already committed
// (`portfolio_phase_1/`, `portfolio_phase_1b_review/`,
// `reports/build_023*/`, `reports/build_024*/`,
// `reports/build_025/portfolio_100/`) into the live Portfolio Manager
// catalog, WITHOUT ever modifying or deleting the source folders --
// this module only ever reads `File` objects the caller already
// selected (a directory picker or drag-drop), it has no filesystem
// write access to arbitrary paths at all by construction (the browser
// File API is read-only).
//
// Every one of these folders was produced by scripts that already write
// a per-pattern JSON metadata sidecar in the same shape
// `import/jsonCompat.ts` already knows how to read (styleDna, seed,
// compositionType, productTargets, colorPalette) -- so the actual
// asset import (hashing, duplicate detection, atomic write) is NOT
// reimplemented here; every real SVG/PNG/EPS/JSON quad is handed
// straight to `import/importPipeline.ts`'s existing, unmodified
// `importFiles`. This module's own job is narrower: recognize and set
// aside the aggregate manifest/report files each folder ALSO contains
// (a CSV summary, a MANIFEST.json rollup, a human-review checklist, a
// re-packaged .zip of the same loose files) so they don't get
// misclassified as broken assets, parse whichever manifest shape is
// present for "original classification" (the READY/REVIEW/REJECT
// decision each historical build already computed), and record that
// classification + originating build label onto the imported asset as
// additive `tags` (via a post-import bulk patch, so
// `import/importPipeline.ts` itself needs zero changes) -- never as a
// live `workflowStatus` override, since a build's historical decision
// is evaluation-time provenance, not necessarily today's human
// recommendation.

/** One selected file plus the relative path it was found at (folder
 * picker / drag-drop supply this; deliberately NOT read from the
 * non-standard, browser-inconsistent `File.webkitRelativePath` so this
 * module stays trivially testable with plain constructed `File`s). */
export interface HistoricalFileEntry {
  file: File;
  relativePath: string;
}

/** Known historical folder identifiers, checked in this order (most
 * specific first, matching `rejectionIntelligence.ts`'s established
 * "more specific before generic" convention) -- `portfolio_phase_1b_review`
 * must be checked before the shorter `portfolio_phase_1` it starts with. */
const BUILD_LABEL_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'portfolio_phase_1b_review', pattern: /portfolio_phase_1b_review/i },
  { label: 'portfolio_phase_1', pattern: /portfolio_phase_1(?!b)/i },
  { label: 'build_023', pattern: /build_023/i },
  { label: 'build_024', pattern: /build_024/i },
  { label: 'build_025', pattern: /build_025/i },
];

export function detectBuildLabel(relativePath: string): string {
  for (const { label, pattern } of BUILD_LABEL_PATTERNS) {
    if (pattern.test(relativePath)) return label;
  }
  return 'unknown-build';
}

/** Aggregate manifest/report/archive files every historical folder also
 * contains, alongside the real per-pattern asset files -- recognized by
 * exact (case-insensitive) filename, NOT by blanket extension, since a
 * per-pattern JSON sidecar (e.g. `berry-punch-...-0.json`) must NOT be
 * excluded the way an aggregate `MANIFEST.json`/`phase1_summary.json`
 * must be. `.zip` files are always excluded -- they are re-packaged
 * copies of the same loose files already present in the folder, and
 * this app only has a ZIP *writer* (`export/zip.ts`), never a reader. */
const KNOWN_MANIFEST_OR_REPORT_NAMES = new Set([
  'portfolio_manifest.csv',
  'quality_review.csv',
  'seo_master.csv',
  'phase1_summary.json',
  'phase1b_summary.json',
  'human_review_checklist.csv',
  'manifest.json',
]);

export function isHistoricalManifestOrReportFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.zip')) return true;
  if (lower.endsWith('.md')) return true;
  if (KNOWN_MANIFEST_OR_REPORT_NAMES.has(lower)) return true;
  return false;
}

/** One row of "what a historical build already decided about this
 * pattern," normalized from whichever manifest shape produced it.
 * `raw` keeps every original column/field verbatim (never lossy) so a
 * caller that wants more than the two normalized fields can still get
 * at it. */
export interface HistoricalManifestEntry {
  key: string;
  buildLabel: string;
  decision: string | null;
  raw: Record<string, unknown>;
}

function csvRowsToEntries(text: string, buildLabel: string): HistoricalManifestEntry[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim());
  const keyColumnIndex = header.findIndex((h) => /^(filename|pattern_id|patternid)$/i.test(h));
  const decisionColumnIndex = header.findIndex((h) => /^(decision|importstatus)$/i.test(h));
  if (keyColumnIndex === -1) return [];

  const entries: HistoricalManifestEntry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;
    const raw: Record<string, unknown> = {};
    header.forEach((col, idx) => {
      raw[col] = row[idx] ?? '';
    });
    entries.push({
      key: row[keyColumnIndex] ?? '',
      buildLabel,
      decision: decisionColumnIndex >= 0 ? row[decisionColumnIndex] ?? null : null,
      raw,
    });
  }
  return entries;
}

function jsonManifestToEntries(text: string, buildLabel: string): HistoricalManifestEntry[] {
  const parsed = parseJsonText(text);
  if (!parsed.ok) return [];
  const value = parsed.value as Record<string, unknown>;
  const patterns = Array.isArray(value.patterns) ? value.patterns : [];
  const entries: HistoricalManifestEntry[] = [];
  for (const p of patterns) {
    if (!p || typeof p !== 'object') continue;
    const row = p as Record<string, unknown>;
    const key = typeof row.patternId === 'string' ? row.patternId : typeof row.seed === 'string' ? row.seed : '';
    if (!key) continue;
    entries.push({
      key,
      buildLabel,
      decision: typeof row.decision === 'string' ? row.decision : null,
      raw: row,
    });
  }
  return entries;
}

export interface HistoricalImportMissingReference {
  key: string;
  buildLabel: string;
}

export interface HistoricalImportReport {
  importedAt: number;
  buildLabelsSeen: string[];
  assetsImported: number;
  assetsSkippedAsDuplicate: number;
  assetsErrored: number;
  manifestEntriesFound: number;
  skippedFiles: Array<{ filename: string; relativePath: string }>;
  missingReferences: HistoricalImportMissingReference[];
  malformedManifestFiles: string[];
}

/** Basename (no extension, no directory) -- the same join key
 * `import/basenameGrouping.ts` uses to group a pattern's SVG/PNG/EPS/
 * JSON quad together, reused here so a manifest row's `filename` column
 * (which is always an extensionless basename in every historical
 * export this repo produced) matches the same key. */
function basenameOf(name: string): string {
  const slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
  const base = slash >= 0 ? name.slice(slash + 1) : name;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

/** Imports every real asset file among `entries`, then tags each
 * successfully-imported asset with its originating build label and
 * (when a manifest recorded one) its original decision. The tagging is
 * a second, additive bulk-write pass over the assets `importFiles`
 * already created (via `putPortfolioAssetsBulk`) -- deliberately not
 * threaded through `importFiles` itself, so
 * `import/importPipeline.ts`'s existing, certified behavior needs zero
 * changes. Manifest/report files are recognized and set aside rather
 * than passed to `importFiles` (which would otherwise report every
 * `.csv`/`.md` as an "unsupported file type" error). Never modifies or
 * deletes any of the input `File` objects' source location -- the
 * browser File API has no mechanism to do so, by construction. */
export async function importHistoricalPortfolio(entries: HistoricalFileEntry[], existingAssets: PortfolioAsset[]): Promise<{ report: HistoricalImportReport; batchResult: ImportBatchResult }> {
  const assetEntries: HistoricalFileEntry[] = [];
  const manifestFileEntries: HistoricalFileEntry[] = [];
  const skippedFiles: Array<{ filename: string; relativePath: string }> = [];

  for (const entry of entries) {
    if (isHistoricalManifestOrReportFile(entry.file.name)) {
      if (entry.file.name.toLowerCase().endsWith('.zip')) {
        skippedFiles.push({ filename: entry.file.name, relativePath: entry.relativePath });
      } else {
        manifestFileEntries.push(entry);
      }
    } else {
      assetEntries.push(entry);
    }
  }

  const manifestEntries: HistoricalManifestEntry[] = [];
  const malformedManifestFiles: string[] = [];
  for (const { file, relativePath } of manifestFileEntries) {
    const buildLabel = detectBuildLabel(relativePath);
    const text = await file.text();
    const lower = file.name.toLowerCase();
    const parsedEntries = lower.endsWith('.json') ? jsonManifestToEntries(text, buildLabel) : lower.endsWith('.csv') ? csvRowsToEntries(text, buildLabel) : [];
    if (parsedEntries.length === 0) {
      malformedManifestFiles.push(relativePath || file.name);
    } else {
      manifestEntries.push(...parsedEntries);
    }
  }

  const manifestByKey = new Map<string, HistoricalManifestEntry>();
  for (const entry of manifestEntries) manifestByKey.set(entry.key, entry);

  const assetFiles = assetEntries.map((e) => e.file);
  const buildLabelByBasename = new Map<string, string>();
  for (const entry of assetEntries) buildLabelByBasename.set(basenameOf(entry.file.name), detectBuildLabel(entry.relativePath));

  const batchResult = await importFiles(assetFiles, existingAssets, (group) => ({ displayName: group.basename }));

  const assetsToPatch: PortfolioAsset[] = [];
  for (const outcome of batchResult.outcomes) {
    if (outcome.status !== 'imported') continue;
    const buildLabel = buildLabelByBasename.get(outcome.basename) ?? 'unknown-build';
    const manifestEntry = manifestByKey.get(outcome.basename);
    const tags = [`historical-import:${buildLabel}`, ...(manifestEntry?.decision ? [`historical-decision:${manifestEntry.decision}`] : [])];
    assetsToPatch.push({ ...outcome.asset, tags: [...new Set([...outcome.asset.tags, ...tags])] });
  }
  if (assetsToPatch.length > 0) await putPortfolioAssetsBulk(assetsToPatch);

  const importedBasenames = new Set(batchResult.outcomes.filter((o) => o.status === 'imported').map((o) => o.basename));
  const assetBasenames = new Set(assetEntries.map((e) => basenameOf(e.file.name)));
  const missingReferences: HistoricalImportMissingReference[] = [];
  for (const entry of manifestEntries) {
    if (!assetBasenames.has(entry.key) && !importedBasenames.has(entry.key)) {
      missingReferences.push({ key: entry.key, buildLabel: entry.buildLabel });
    }
  }

  const buildLabelsSeen = [...new Set(assetEntries.map((e) => detectBuildLabel(e.relativePath)))];

  const report: HistoricalImportReport = {
    importedAt: Date.now(),
    buildLabelsSeen,
    assetsImported: batchResult.importedCount,
    assetsSkippedAsDuplicate: batchResult.duplicateBlockedCount + batchResult.possibleDuplicateCount,
    assetsErrored: batchResult.errorCount,
    manifestEntriesFound: manifestEntries.length,
    skippedFiles,
    missingReferences,
    malformedManifestFiles,
  };

  return { report, batchResult };
}
