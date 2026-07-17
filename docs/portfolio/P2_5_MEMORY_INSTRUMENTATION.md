# Memory Instrumentation — Portfolio Manager P2.5 Sprint 1

Source of truth: `app/src/catalog/validation/memoryInstrumentation.ts`.

## Scope (read this first)

This sprint builds and proves the **instrumentation**, via one bounded
smoke run. It does **not** claim "no memory leak" anywhere — that would
require a real soak test (repeated cycles over minutes/hours, tracked
against a growth trend), which is explicitly out of scope for Sprint 1
per the brief's own instruction. Every number this sprint reports is from
a single bounded run, labeled as such.

## Adapter (`sampleMemory` / `MemorySampler`)

`sampleMemory()` returns one `MemorySample` with an explicit `supported`
flag and `source`:

- `'browser-performance-memory'` — Chromium's non-standard
  `performance.memory` (only present in a real Chromium-family browser;
  jsdom does not provide it).
- `'node-process'` — `process.memoryUsage()` (heapUsed/heapTotal/rss).
  This is what every actual run in this sprint reports from, since both
  the CLI (`tsx`, plain Node) and every vitest test (jsdom-on-real-Node)
  run on a genuine Node process.
- `'unsupported'` — every field `null`, `supported: false`. Never a
  fabricated number.

`MemorySampler` accumulates repeated `.sample()` calls and
`.summarize()`s into `{ baseline, peak, final, deltaHeapUsedBytes }` —
baseline is the first sample, final is the last, peak is the sample with
the largest `heapUsedBytes` seen, delta is `final - baseline`. Throws
(rather than fabricating a summary) if called with zero samples.

## Blob URL lifecycle tracker (`trackBlobUrlLifecycle`)

Monkey-patches the global `URL.createObjectURL`/`URL.revokeObjectURL` to
count calls, without touching any production hook's source
(`usePreviewUrl.ts`, `useCollectionCoverUrl.ts` are both unmodified) —
this observes calls the same way any external profiler would, via
`Reflect.apply` on the saved originals so `.restore()` puts back the
*exact* original function reference. Framework-agnostic (no dependency on
`vi.spyOn`), so it works identically under vitest/jsdom.

## Bounded smoke test (Section 8's required deliverable)

`app/src/catalog/validation/memorySmoke.test.tsx` — a real vitest/React
Testing Library test, not a Node-only script (Blob-URL lifecycle only
means anything with a DOM). It:

1. Seeds a bounded (20-member) collection with real preview `Blob`s via
   `importAssetTransaction` (the existing, unmodified P1 storage API).
2. Mounts the real `CollectionDetailPanel` component 5 times, each time
   waiting (`waitFor`) for at least one new object URL to actually be
   created (the cover/thumbnail Blob URLs resolve asynchronously — a real
   IndexedDB read sits between mount and `URL.createObjectURL`), then
   unmounts.
3. Asserts `tracker.outstanding === 0` after every single unmount — i.e.
   every `URL.createObjectURL` call from that mount was matched by a
   `URL.revokeObjectURL` from that mount's cleanup effect running.
4. Confirms `MemorySampler` collected one sample per cycle plus baseline/
   final, all `supported: true` (Node-process source).

**Result**: 1/1 passing (see `P2_5_SPRINT1_TEST_REPORT.md`) — cleanup
hooks (`useCollectionCoverUrl.ts`/`usePreviewUrl.ts`'s existing `useEffect`
returns) do run, and no leaked object URL survived across 5 mount/unmount
cycles in this bounded run.

## CLI's separate memory-smoke command

`npm run validate:collections:memory-smoke` runs a different, Node-only
bounded check (no React involved): seeds a small dataset, repeats
`loadCollections()`/`getAssetsForCollection()` 10 times, and reports a
`MemorySampler` summary via `process.memoryUsage()`. This exercises IDB
read-path memory behavior, not the Blob-URL/React lifecycle — the two
checks are complementary, not duplicates, and neither one is a soak test.
A real measured run: baseline heap 37.5MB, peak 39.3MB, final 38.4MB,
delta +0.89MB over 10 repeated reads on a 200-asset/20-collection dataset
(see `P2_5_SPRINT1_TEST_REPORT.md` for the full figures) — reported as
exactly that: one bounded run's numbers, not a leak/no-leak verdict.
