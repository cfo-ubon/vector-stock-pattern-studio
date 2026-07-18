# Portfolio Manager — Import Spec (P1)

Source of truth: `app/src/catalog/import/*.ts`. This document explains the
import pipeline step-by-step, the duplicate-detection rules, and the
thumbnail/preview priority order.

## How to import

`PortfolioImportPanel` supports:

- **Single-file** selection via the file input.
- **Multi-file** selection (native multi-select in the file input, or
  multiple files dropped at once).
- **Drag-and-drop** onto the panel's dropzone.
- Files sharing a basename (e.g. `spring-garden-001.svg`,
  `spring-garden-001.png`, `spring-garden-001.json`) are **automatically
  grouped into one candidate asset** — the user does not have to manually
  associate them.

Folder import (a whole directory in one action) is a browser-capability-
gated feature (`<input webkitdirectory>` / the File System Access API) —
P1 relies on the browser's native multi-file selection and drag-and-drop
instead, which covers the same "import several related files at once"
need without a browser-specific API; see Known Limitations in the P1 build
report for the exact scope decision.

## Pipeline (one call = one basename group)

`import/importPipeline.ts`'s `importFileGroup()` is the per-group
orchestrator; `importFiles()` loops it over every group from
`groupFilesByBasename()`, sequentially (never in parallel — a duplicate
check must see every asset imported *earlier in the same batch*, or two
files sharing a basename+content within one drop wouldn't catch each
other).

1. **Validate file type** (`fileValidation.ts`) — reject only genuinely
   inappropriate types for a stock-vector catalog: `.exe .sh .bat .cmd
   .dll .js .ts .msi .app .zip .rar .7z`. Everything else, including
   generic design formats not in the SVG/JSON/EPS/AI/PNG/JPG list (e.g.
   `.cdr`, `.pdf`, `.psd`), is still importable with role `'other'` — it
   just can't drive metadata extraction or serve as a preview. A 0-byte
   file is rejected with a clear message (nothing useful can be hashed or
   stored).
2. **Hash** (`domain/hash.ts`) — `sha256Hex()` of the exact bytes read via
   `file.arrayBuffer()`. Never touches/re-encodes the bytes first.
3. **Extract safe metadata** (`fileValidation.ts`'s `classifyFile()`) —
   role + MIME type from the file extension.
4. **Parse supported JSON** (`import/jsonCompat.ts`, only for files
   classified `role: 'json'`) — tolerant, multi-shape, never throws (see
   "JSON compatibility" below).
5. **Check duplicates** (`import/duplicates.ts`) — see below.
6. **Create the asset record** (`domain/asset.ts`'s `createPortfolioAsset()`).
7. **Persist source files without recompression** — one atomic
   `importAssetTransaction()` call writing the asset record and every file
   body together (see `PORTFOLIO_MANAGER_STORAGE.md`'s "Transaction
   safety").
8. **Confirm success or explain failure** — `ImportOutcome` (below) is
   returned to the UI, which renders a per-group result line
   (`PortfolioImportPanel`).

Steps 1–6 never touch storage — only step 7 writes anything, so a failure
or a duplicate block at any earlier step is a pure no-op from storage's
perspective (see `PORTFOLIO_MANAGER_STORAGE.md`).

## Import outcomes

```ts
type ImportOutcome =
  | { status: 'imported'; basename; asset; warnings: string[] }
  | { status: 'blockedDuplicate'; basename; existingAsset; group }
  | { status: 'possibleDuplicate'; basename; existingAsset; matchedOn: string[]; group }
  | { status: 'error'; basename; message: string };
```

`blockedDuplicate` and `possibleDuplicate` both carry the original `group`
(the `File[]` the user selected), so the UI can offer an explicit "import
as new" retry (`importFileGroup(group, existingAssets, { forceImportAsNew: true })`)
without asking the user to re-select files.

## Duplicate protection — three outcomes

`import/duplicates.ts`'s `detectDuplicate()`, multi-signal:

| Signal | Strength | What it catches |
|---|---|---|
| SHA-256 file hash | Exact | A byte-identical copy of a file already in the catalog (any role). |
| Normalized JSON hash | Possible (within one import batch only — see below) | A re-serialized/re-exported copy of the same JSON (different whitespace/key order, same content). |
| Original filename + total file size | Possible | Same-named import with the same total byte count — a common "re-exported the same design" fingerprint. |
| Generator seed (from parsed JSON) | Possible | The generator's own RNG seed matching an existing catalogued asset — strong signal independent of file bytes. |

**Exact duplicate → blocked.** At least one byte-identical source file
already exists under a *different* asset. This is the only outcome the
pipeline blocks on by default (`status: 'blockedDuplicate'`) — the UI shows
which existing asset it matches and does not import unless the user
explicitly retries with `forceImportAsNew: true`.

**Possible duplicate → warn, allow explicit "import as new."** Any of the
other three signals matches. The UI (`PortfolioImportPanel`) shows "อาจซ้ำ
(รอตัดสินใจ)" with two explicit actions: "นำเข้าเป็นชิ้นใหม่" (import as
new — re-runs `importFileGroup` with `forceImportAsNew: true`, and sets
`parentAssetId` to the matched existing asset, preserving the relationship)
or "ข้าม" (skip — drops the outcome from the results list without
importing).

**Related variation → import allowed, relationship preserved.** When the
caller passes an explicit `parentAssetId`/`variationGroupId` (a workflow
not yet exposed in the P1 UI, but supported end-to-end by
`ImportGroupOptions` and the domain model), the new asset imports normally
and both fields are set on the created record — a foundation for a future
"import as a variation of..." UI action.

**Never modifies file bytes to compute any of this** — every signal above
is either a hash already computed during step 2, or a plain metadata
comparison against already-loaded catalog records (`existingAssets`,
passed in by the caller, not re-queried per group).

`jsonHashOf()` (in `duplicates.ts`) is deliberately unimplemented for
*already-catalogued* assets — the catalog only stores raw per-file SHA-256s,
not a normalized-JSON hash, so `normalizedJsonHash` only protects duplicate
detection *within one import batch* (where the parsed JSON is available for
every candidate being compared), not against JSON re-serialized differently
from an asset imported in an earlier session. `filename+fileSize` and
`generatorSeed` remain the real possible-duplicate signals across sessions.
This is a documented, deliberate scope limit, not an oversight — see Known
Limitations in the P1 build report.

## JSON compatibility

`import/jsonCompat.ts`'s `parsePatternJson()` tolerantly probes a parsed
JSON value for one of three shapes this app already produces, rather than
hard-coding a single schema:

1. **`generateParams`** — a raw `GenerateParams`-shaped settings object
   (has `seed`, or a `categoryId`+`layoutId` pair).
2. **`projectExport`** — `project/projectJson.ts`'s Project export shape
   (`{ schemaVersion, exportedAt, project: { collections: [...] } }`) —
   metadata is pulled from the first collection's first pattern.
3. **`submissionMetadata`** — `metadata/exportPackage.ts`'s stock-
   submission `metadata.json` shape (`{ marketplace, seed, category,
   palette, ... }`).

Anything else gets `detectedShape: 'unknown'` — a **normal, non-error
outcome**, not a parse failure. The asset is still created; it just has no
derived `styleDna`/`patternType`/`seed`/etc. fields, and the raw JSON file
is still stored byte-for-byte as its `metadataReference` source (Section 6:
"unsupported-field preservation... raw JSON retention").

**Invalid JSON** (a syntax error): `parseJsonText()` never throws — it
returns `{ ok: false, error: <message> }`. The import pipeline surfaces
this as a per-file warning on the `imported` outcome ("… is not valid JSON
(…) — the file was still imported, but no metadata could be extracted from
it") rather than failing the whole group; the invalid JSON file itself is
still stored unchanged (Section 6: "preserve original invalid file if user
explicitly chooses to keep it" — in P1, the file is always kept since the
whole point of a byte-preserving catalog is to never silently drop a file
the user selected).

## Preview selection

`import/previewSelection.ts`'s `selectPreviewReference()` priority order,
matching the sprint brief's thumbnail-rule priority:

1. A file explicitly classified `role: 'preview'`
2. `role: 'png'`
3. `role: 'jpg'`
4. `role: 'svg'` (rendered natively by the browser via `<img src={objectURL}>`
   — no rasterization step needed)
5. `role: 'eps'`
6. `role: 'ai'`

If none of the group's files match any of these roles, `previewReference`
is `null` and the grid/detail panel show a file-type placeholder instead
(see `PortfolioThumbnail.tsx`). This selection never generates a new
image — it only picks which *already-stored* file to use as the preview
source; `usePreviewUrl.ts` lazily loads that one file's Blob into an
object URL only when a grid card or the detail panel actually mounts
(Section 9: "lazy loading... no main-thread blocking during large
imports").
