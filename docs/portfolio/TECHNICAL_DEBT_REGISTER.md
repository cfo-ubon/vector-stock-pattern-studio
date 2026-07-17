# Technical Debt Register — Portfolio Manager

Tracks known, deliberate scope limits and any shortcuts taken across
Portfolio Manager sprints. Each entry states what's incomplete, why it
was deferred, and what would need to happen to close it. This is not a
bug list — everything here is a documented, intentional boundary, not an
accidental defect.

## P1 (Core Database and Asset Library)

| # | Item | Why deferred | Closing it requires |
|---|---|---|---|
| P1-1 | No folder (whole-directory) import | Browser-specific directory-picker APIs have inconsistent support; native multi-file selection + drag-and-drop covers the same need | Add `<input webkitdirectory>` or File System Access API support, feature-detected |
| P1-2 | No full-library backup/restore ZIP | Explicitly deferred by the P1 brief ("a later sprint") | Generalize `services/exportAsset.ts` to iterate every asset instead of one |
| P1-3 | No cross-device/cross-browser sync | IndexedDB is local to one browser profile by design (ADR-001); out of scope | Would require a backend — explicitly out of scope per every sprint brief so far |
| P1-4 | Cross-session duplicate detection via normalized-JSON hash is signal-limited (only works within one import batch) | The catalog doesn't persist a normalized-JSON hash field on already-stored assets | Add a `normalizedJsonHash` field to `PortfolioAsset` (schema bump) and populate it at import time |
| P1-5 | No automatic SVG viewBox / PNG dimension extraction | `PortfolioAsset.dimensions` exists but the import pipeline doesn't parse source files to populate it | Add a lightweight SVG/PNG header parser to the import pipeline |
| P1-6 | Health Check panel has no auto-repair | Deliberate — "Do not silently repair destructive issues" | N/A — this is a permanent design decision, not debt |

## P2 Stage 1 (Collection Domain and Data Foundation)

| # | Item | Why deferred | Closing it requires |
|---|---|---|---|
| S1-1 | **No Stage 2 UI** — no collection browsing/management screens | Explicitly out of scope for this stage (per the brief) | Build the UI layer on top of the now-complete `services/collectionService.ts` API — the natural Stage 2 |
| S1-2 | Cover-asset staleness (Rule 13) is repaired **lazily**, not automatically at asset-deletion time | Avoids modifying P1's stable, unmodified `deletePortfolioAssetRecordOnly`/`deletePortfolioAssetAndFiles` API for a Stage-1-only concern (see ADR-005's "Consistency and integrity strategy") — a deliberate architectural choice, not an oversight | A future stage could wire `repairCoverAssetIntegrity` (or an equivalent targeted single-asset repair) into the P1 delete path directly, once the tradeoff of touching that stable API is judged worthwhile |
| S1-3 | Duplicate collection-name enforcement is a service-level check (load-all-then-compare), not an IndexedDB `unique` index | Acceptable at the ~100-collection target scale (measured: `loadCollections()` over 100 records ≈ 1ms); a hard `unique` index would surface a raw `ConstraintError` instead of the typed `DuplicateCollectionNameError` | If collection counts grow far beyond the current target (thousands+), revisit with an indexed pre-check or a `unique` index plus error-translation wrapper |
| S1-4 | No collection-count or membership-count caching | Every `getAssetsForCollection`/dashboard-style query does a full `loadPortfolioAssets()` scan | If a future dashboard needs frequent per-collection counts at large asset-catalog scale, consider a denormalized `memberCount` field on `Collection`, updated alongside membership writes |
| S1-5 | `searchCollectionsByName` is in-memory substring matching, not an indexed prefix/range query | Same "small, bounded set" rationale as P1's `searchPortfolioAssets` — collections target ~100 records, not thousands | The `normalizedName` IndexedDB index already exists (added in this stage) and is unused by search today; a future stage could switch to an indexed range query if collection counts grow substantially |
| S1-6 | No collection-to-collection relationships (e.g. nested/hierarchical collections) | Not requested by the brief; Rule 3-4 only specify asset-to-collection many-to-many | Would need a new relationship concept entirely — no groundwork laid for or against it here |

## Explicitly not debt (by design, not to be "fixed")

- IndexedDB-only storage with no localStorage fallback (ADR-001) — a
  correctness requirement, not a shortcut.
- Lazy (not automatic) integrity repair across the whole Portfolio
  Manager feature (both P1's Health Check and Stage 1's
  `validateCollectionIntegrity`/`repair*` pair) — a permanent design
  stance against silent destructive repair, restated explicitly in this
  stage's own brief.
