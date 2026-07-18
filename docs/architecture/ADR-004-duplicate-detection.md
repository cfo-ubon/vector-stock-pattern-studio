# ADR-004: Multi-signal duplicate detection, separate from asset identity

## Status

Accepted — **Retrospective** (P1 decision). Unchanged by P2 Stage 1.

## Context

The sprint brief required duplicate protection with three distinct
outcomes (exact/block, possible/warn, related-variation/allow) and
explicitly forbade computing any duplicate signal by modifying file
bytes ("Never modify file bytes merely to calculate metadata").

## Decision

Layer several independent signals, each computed from data already
produced during import (never a bytes-modifying extra pass):

1. **SHA-256 file hash** (`domain/hash.ts`) — the *only* signal that
   blocks import by default (`kind: 'exact'`). A byte-identical file
   already in the catalog is the strongest possible non-cryptographic-
   collision-risk signal.
2. **Normalized-JSON hash** (`domain/hash.ts`'s `normalizedJsonHash`) —
   order-independent hash of *parsed* JSON content, catching a
   re-serialized-but-semantically-identical JSON source. Documented as
   only reliable *within one import batch* (see `import/duplicates.ts`'s
   `jsonHashOf()` comment) since the catalog doesn't persist this hash on
   already-stored assets.
3. **Filename + total file size** — a cheap, always-available
   possible-duplicate signal.
4. **Generator seed** (recovered from parsed JSON metadata) — a
   content-independent signal: two exports of the same generated design
   share a seed even if their file bytes differ (re-exported at a
   different time/size).

## Alternatives considered

- **Hash-only duplicate detection** — rejected: would miss the
  "re-exported, same design, different bytes" case the generator seed
  and filename+size signals exist to catch, and would miss "same JSON
  content, re-serialized" without the normalized-JSON hash.
- **Fuzzy/perceptual image hashing** (comparing rendered pixels) —
  rejected as out of scope for P1's byte-preservation-focused catalog;
  no rasterization/rendering pipeline exists in this module by design
  (see `docs/portfolio/PORTFOLIO_MANAGER_IMPORT_SPEC.md`'s preview
  selection — previews reuse an already-provided file, never render one).
- **Blocking on *any* possible-duplicate signal, not just exact** —
  rejected: false positives (two unrelated but same-sized SVGs) would
  make the importer too aggressive; the brief explicitly wants
  possible-duplicates to warn-and-allow, not block.

## Consequences

- Every signal is computed from bytes/metadata already produced by
  steps 2-4 of the import pipeline (hash, classify, JSON-parse) — no
  additional file read or transform exists solely for duplicate
  detection.
- `detectDuplicate()` (`import/duplicates.ts`) is pure and synchronous
  given its inputs, making it trivially unit-testable without IndexedDB.

## Migration impact

None. P2 Stage 1 does not add, remove, or change any duplicate-detection
signal — collections have no duplicate-*content* detection concept (a
collection's own duplicate concern is its **name**, handled entirely
differently: a case-insensitive uniqueness check in
`collectionService.ts`'s `assertNameNotTaken`, not a content hash — see
ADR-005 for why collection-name uniqueness is a service-level check
rather than an IndexedDB `unique` index).

## Test evidence

- P1: `catalog/import/duplicates.test.ts` (5 tests) and
  `catalog/import/importPipeline.test.ts`'s duplicate-outcome tests (14
  tests total in that file, several duplicate-specific).
- P2 Stage 1: no changes to this area; regression confirmed by re-running
  `catalog/import/duplicates.test.ts` and `catalog/import/importPipeline.test.ts`
  unmodified alongside the new collection tests (see
  `docs/portfolio/P2_STAGE1_TEST_REPORT.md`'s regression section).
