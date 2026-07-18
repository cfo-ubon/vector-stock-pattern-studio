# Test Report — Portfolio Manager P2.5 Sprint 1

## Summary

89 new tests across 9 files, all passing. Zero pre-existing test modified.

| File | Tests | Category |
|---|---|---|
| `datasetGenerator.test.ts` | 23 | Dataset generator (determinism, exact counts, membership accuracy, injected-condition ratios, invalid config, boundary conditions, presets) |
| `benchmarkRunner.test.ts` | 11 | Benchmark runner (warm-up exclusion, statistics, timeout/failure handling, environment metadata, empty suite) |
| `benchmarkReport.test.ts` | 5 | Report formatting (JSON/console/Markdown, empty-section omission) |
| `validationDb.test.ts` | 5 | Persistence (safety gate, batch writes, reset/idempotency, real durations) |
| `integrityScenarios.test.ts` | 25 | Integrity scenarios (all 8 build/persist, determinism, valid/orphan/stale-cover detection+repair+idempotency, duplicate non-detection documented, shape-only scenarios) |
| `memoryInstrumentation.test.ts` | 5 | Memory tooling (sample support, sampler summary, zero-sample guard, Blob URL tracker, restore) |
| `memorySmoke.test.tsx` | 1 | Bounded memory smoke (5 real mount/unmount cycles, Blob URL lifecycle proven) |
| `baselinePolicy.test.ts` | 12 | Baseline policy (comparison verdicts, environment mismatch, upsert refusal/force/improvement) |
| `cli.test.ts` | 3 | CLI/integration (real subprocess: success path, bad-mode failure, database isolation) |

Regression command: `npx vitest run src/catalog/validation/` — 9 files, 89
tests, 0 failures.

## Test category detail (Section 11 checklist)

**Dataset generator**: deterministic output ✓; different seeds differ ✓;
exact requested counts ✓; membership target accuracy ✓ (5,000/50,000
exact-base assertions); archived/empty ratios ✓; stale cover injection ✓;
orphan injection ✓; duplicate injection ✓; invalid configuration (5
distinct rejection cases) ✓; boundary conditions (zero counts, zero
membership target) ✓; no production database collision — proven
structurally (see `cli.test.ts`'s isolation test) rather than a unit
assertion on the generator itself, since the generator has no IndexedDB
access to collide with anything.

**Manifest**: counts match generated records ✓ (every manifest field in
`datasetGenerator.test.ts` is asserted against the actual generated
arrays, not a formula); deterministic metadata excluding
`generatedAt`/`generationDurationMs` ✓ (explicit strip-and-compare in the
determinism test); JSON serialization ✓ (`benchmarkReport.test.ts`'s
`toJsonReport` round-trip includes a real manifest); schema version ✓
(`DATASET_MANIFEST_SCHEMA_VERSION` asserted implicitly via the manifest
shape tests — no dedicated version-bump test since the version hasn't
changed yet).

**Benchmark runner**: warm-up excluded ✓; statistics correct (known
delay-sequence assertions) ✓; timeout handling ✓; failed benchmark
reporting ✓ (clean message, no stack trace) ✓; JSON output ✓; Markdown
output ✓; environment metadata ✓; empty sample handling ✓ (empty case
list; `MemorySampler.summarize()` on zero samples throws instead of
fabricating).

**Integrity**: each injected condition detected where the scanner
supports it (orphan, stale cover) ✓; read-only scan (scanning twice
changes nothing) ✓; repair correctness (exact changed-count match,
targeted condition cleared) ✓; repair idempotency (second repair pass is
a no-op) ✓; valid records preserved (byte-equal before/after a no-op
repair pass) ✓; duplicate-collectionId condition documented as not
currently scanner-detectable, condition itself proven real via direct
inspection of the raw record ✓.

**Memory tooling**: supported/unsupported handling ✓ (Node-process source
confirmed; `readChromiumMemory` path exists and is exercised implicitly
by falling through when unavailable); sample collection ✓; delta
calculation ✓; Blob URL lifecycle instrumentation ✓ (count matching,
`Reflect.apply`-based restore proven exact).

**CLI/integration**: default validation command succeeds ✓ (via
`integrity` mode as the fast full-flow-shaped smoke case; `small`/
`medium`/`large`/`default`/`benchmark`/`memory-smoke` all additionally
verified manually — see `P2_5_SPRINT1_REPORT.md`'s Real Measurements
section for their actual console output); bad configuration fails
non-zero ✓; reports are created ✓; validation DB is isolated ✓ (proven by
seeding a marker collection in the *test's own* fake-indexeddb instance,
running the CLI as a real child process, and confirming the marker
survived — if the CLI shared this process's store, its own
`resetValidationDatabase` call would have wiped it out); cleanup works ✓
(`resetValidationDatabase`'s idempotency test).

## Regression (Section 11's required categories)

Full baseline run (before this sprint's first edit, dev server stopped to
avoid the documented `collectionGenerator`/`designSpecCollection` flake
class): **209 test files, 2,520 tests, 0 failures** — zero flake observed
in that run.

This sprint added 9 files / 89 tests, touching **zero** existing
production or test files. See "Full Regression Result" in
`P2_5_SPRINT1_REPORT.md` for the final combined run.

## Known pre-existing flake — handled transparently

`src/collection/collectionGenerator.test.ts` and
`src/trend/designSpecCollection.test.ts` share an underlying
`generateCollection` call whose timing is sensitive to concurrent
resource contention (documented in Stage 1/Stage 2's own reports). This
sprint did not touch either file (confirmed via `git diff --stat` showing
zero changes under `src/collection/` and `src/trend/`) and did not
increase the timeout to force a green result — the pre-existing 15s
timeout is unchanged.
