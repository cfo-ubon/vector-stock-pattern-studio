# Importing an Existing Portfolio — Build 026

Two distinct import paths were added in Build 026. They solve different
problems and don't overlap.

## 1. Historical Portfolio Importer

`app/src/catalog/import/historicalPortfolioImport.ts` +
`importHistoryStore.ts`

Imports this repo's own previously-committed per-build report folders
(`portfolio_phase_1/`, `portfolio_phase_1b_review/`,
`reports/build_023*/`, `reports/build_024*/`,
`reports/build_025/portfolio_100/`) into the live Portfolio Manager
catalog — **without ever modifying or deleting the source folders**. The
browser `File` API this module reads through is read-only by
construction, so there is no code path that could touch the originals
even by mistake.

### Why this needed almost no new import logic

Every one of those folders was produced by scripts that already write a
per-pattern JSON metadata sidecar in the same shape
`import/jsonCompat.ts` already knows how to read (styleDna, seed,
compositionType, productTargets, colorPalette). So the actual asset
import — hashing, duplicate detection, atomic write — is **not**
reimplemented here; every real SVG/PNG/EPS/JSON quad is handed straight
to the existing, unmodified `import/importPipeline.ts`'s `importFiles`.

This module's own job is narrower:

1. **Recognize and set aside** the aggregate manifest/report files each
   folder also contains (`portfolio_manifest.csv`, `quality_review.csv`,
   `seo_master.csv`, `phase1_summary.json`, `phase1b_summary.json`,
   `human_review_checklist.csv`, `manifest.json`, any `.md`, and any
   `.zip` — a re-packaged copy of files already present in the folder,
   this app only ever writes ZIPs, never reads them) — recognized by
   exact case-insensitive filename or extension, never by blanket
   extension that could exclude a real per-pattern JSON sidecar.
2. **Detect the originating build** from the file's relative path
   (`portfolio_phase_1b_review` checked before the shorter
   `portfolio_phase_1` it starts with, matching
   `rejectionIntelligence.ts`'s "more specific before generic"
   convention).
3. **Parse whichever manifest shape is present** (CSV or JSON) for the
   original READY/REVIEW/REJECT-style decision that build already
   computed.
4. **Tag** each successfully-imported asset with
   `historical-import:<buildLabel>` and (when known)
   `historical-decision:<decision>` via an **additive, second bulk-patch
   pass** — never threaded through `importFiles` itself, so
   `importPipeline.ts`'s existing certified behavior needed zero changes.
   This is recorded as a plain `tags` entry, never as a live
   `workflowStatus` override — a historical build's decision is
   evaluation-time provenance, not necessarily today's recommendation.

### Report

`importHistoricalPortfolio(entries, existingAssets)` returns a
`HistoricalImportReport`: counts imported/skipped-as-duplicate/errored,
which build labels were seen, how many manifest entries were found, any
manifest file that failed to parse, and any manifest row whose
referenced pattern was never found among the imported files
(`missingReferences`) — so a user can see exactly what didn't make it in
and why.

Every import run is recorded in `importHistoryStore.ts` (IndexedDB,
`importHistory` store) for later review.

## 2. Bulk Marketplace Results Import (CSV)

`app/src/catalog/import/marketplaceResultImport.ts`

Bulk-updates submission status/sales/rejection data from a marketplace's
own downloadable report — the brief's "Bulk CSV/Excel import."

**Scope decision:** CSV only, not native `.xlsx` binary parsing. Adding
an XLSX-parsing dependency was weighed against simply asking the user to
"Save As CSV" from Excel or Google Sheets (both do this in one click, no
new dependency, no binary-format parsing surface) and rejected as
unnecessary risk for a security-sensitive import path. This is stated
here explicitly rather than silently under-delivering on "Excel" from
the brief.

The importable fields are `productionAssetId`, `marketplace`,
`marketplaceAssetId`, `submittedDate`, `reviewDate`, `status`,
`rejectionReason`, `downloads`, `revenue`, `currency`, `notes` — a user
maps CSV columns to these via `ColumnMapping` before anything is applied,
and `previewImport(dataRows, mapping)` shows exactly what would change
(including duplicate-row detection) before any write happens.

The CSV parser (`parseCsv`) is a minimal, dependency-free RFC4180-ish
parser (quoted fields, embedded commas/newlines, CRLF/LF) — matching
this codebase's established convention of hand-rolled format
readers/writers (`metadata/csv.ts`'s builder, `export/zip.ts`'s ZIP
writer) rather than adding a parsing library.

Every cell value passes through `sanitizeCsvCell` before being placed on
a mapped row — see `docs/SECURITY_AND_PRIVACY.md` for why.
