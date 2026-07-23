# Build 023 Report — Visual Beauty & Premium Art Direction Engine

Base commit: `525c1d1` (Build 022 final, verified). Branch:
`claude/build-023-visual-beauty-engine` (renamed mid-session from
`claude/build-023-premium-bouquet-cohesion` — the brief was expanded/
redefined partway through this session; see "Scope note" below).

## 0. Scope note (read this first)

This build began under an earlier, narrower brief ("Premium Bouquet
Silhouette & Visual Cohesion Upgrade") and had already substantially
implemented the fragmentation/composition-cohesion fix set (anchor
spacing, cluster spatial graph, deterministic repair pass, stem/spine
connector wiring, `fragmentedSilhouetteV2` diagnostic) when a much larger,
18-step "Visual Beauty & Premium Art Direction Engine" brief arrived
mid-session, redefining Build 023's scope and target branch name. That
prior work directly satisfies this new brief's own Step 4 (Fragmented
Silhouette Repair) almost verbatim (its own listed repair actions —
"add a foliage bridge," "add a botanical stem connection," "move
disconnected cluster toward primary mass" — are exactly what had already
been built), so it was kept and finished rather than discarded.

The new brief's remaining steps (2, 3, 5-11: an explicit Art Direction
data model, a from-scratch Bouquet Composition Engine with named anchor/
spine structures, flower-family-specific anatomy rewrites, leaf/branch
family rewrites, a dedicated depth-layering engine, negative-space
planning, rhythm/repetition detectors, and product-specific composition
rules) are each individually the scope of one or more entire prior builds
in this codebase's own history (Builds 004/005/007/008B for flower/leaf
anatomy, Build 010 for depth, Builds 006/009/011 for negative space/
rhythm/palette, Build 009/010 for product-aware composition). Completing
all of them to production quality was not achievable in the remainder of
this session alongside the required audit, before/after evidence,
100-pattern portfolio, and human review package — and this report does
not pretend otherwise. What follows is an honest account of what was
actually built, verified, and measured this session, and an honest
verdict against the brief's own Step 16 acceptance targets.

## 1. What was implemented and verified this session

### 1.1 Fragmentation / bouquet-cohesion fix (carried forward, completed, verified)
- `engine/clusterEngine.ts` / `layouts/bouquet.ts` / `layouts/heroScatter.ts`:
  `anchorSpacingMultiplier` (2.0x, `premiumHero`-gated) widens spacing
  between cluster anchors.
- `engine/bouquetSpatialGraph.ts` (new): mirrors the critic's own
  connectivity grid; `reserveClusterCompanions` guarantees each surviving
  hero cluster keeps at least one companion through node-budget thinning.
- `engine/repairPass.ts` (new): deterministic, max-3-iteration, budget-capped
  pull of stray cluster members toward their anchor.
- `engine/richnessBudget.ts` (new): `premiumHero`-aware repair-fraction cap.
- `engine/fragmentedSilhouetteV2.ts` (new): additive cluster-aware
  diagnostic — never replaces or suppresses the existing
  `critic/visualAnalysis.ts` detector.
- `engine/bouquetSpine.ts` (new): wires the previously-unused
  `clusterEngine.ts` `buildClusterStem` into real rendering — a genuine
  "foliage and stem connector engine" / "botanical spine" implementation.

### 1.2 Two real defects found and fixed during this session's own audit
- **P1 — bare stem line across empty background**: the first version of
  `bouquetSpine.ts` drew a connector to any surviving companion regardless
  of distance; combined with wider anchor spacing this produced a long,
  visibly broken line. Fixed with a `motifSize * 2.2` max-reach cap.
  Re-rendered and confirmed resolved. See `BUILD_023_VISUAL_AUDIT.md`
  Finding V-1.
- **Regression scope-leak on a non-premium "strong control" preset**:
  `applyBouquetRepairPass` and `reserveClusterCompanions` were keyed off
  `clusterId` presence (which `buildClusterPlacements` tags
  unconditionally) rather than `params.premiumHero`, so
  `scandinavianOrganic` (not a premium bouquet style) took a real,
  unintended -1.4 point commercial-score regression. Both call sites in
  `engine/tile.ts` are now explicitly gated to `premiumHero`; re-measured
  after the fix: 86.40 -> 86.30 (residual, noise-level). See
  `BUILD_023_VISUAL_AUDIT.md` Finding V-5.

### 1.3 Beauty Review Engine (Step 12)
- `critic/beautyReview.ts` (new): 12 named dimensions (focal clarity,
  silhouette cohesion, botanical flow, illustration refinement, depth,
  hierarchy, visual rhythm, negative-space quality, palette harmony,
  thumbnail impact, originality, product suitability), each a direct read
  of an existing, already-tested measurement (no fabricated scores) —
  kept explicitly separate from `absoluteCommercialQuality[V2]` per the
  brief's own rule. Emits `beautyFailureReasons` explaining every weak
  dimension. 9 tests.

### 1.4 Evidence produced (all committed under `reports/build_023/`)
- `STYLE_DNA_DIAGNOSTIC_MATRIX.{json,md}` — 450-pattern (15 preset x 30
  seed) before/after matrix.
- `LUXURY_FLORAL_FRAGMENTATION_BENCHMARK.md` — dedicated deep-dive.
- `before_after/{before_build022,after_build023}/` — 70 patterns (20
  Luxury Floral, 10+10 `darkBotanical`/`bohoFloral` as the closest
  "Premium Botanical Floral" analogues, 10 Editorial Botanical, 10
  Minimal Botanical, 10 `scandinavianOrganic` strong control) x 4 scales
  (full/512/256/128px) x before/after, plus per-sample `metrics.json`.
- `portfolio_100/` — 100-pattern portfolio (10 collections x 10 patterns),
  each with SVG + PNG + JSON, Shutterstock SEO (50 keywords), beauty +
  commercial + fragmentation + thumbnail + product-target diagnostics,
  classified READY (73) / REVIEW (20) / REJECT (7) — no silent discard.
- `human_review/` — `HUMAN_REVIEW_CHECKLIST.csv` (100 rows), 3 contact
  sheets (by Style DNA / product target / decision), `HUMAN_REVIEW_GUIDE_TH.md`.
- `visual_evidence/` (from the build's earlier, narrower phase) — 6-sample
  spot-check set, superseded in scope by `before_after/` but left in
  place as it's still valid, real evidence.

### 1.5 Tests, verification
- 6 new test files: `bouquetSpatialGraph.test.ts` (11), `repairPass.test.ts`
  (6), `richnessBudget.test.ts` (2), `fragmentedSilhouetteV2.test.ts` (4),
  `bouquetSpine.test.ts` (6), `beautyReview.test.ts` (9) — 38 new tests,
  all passing.
- Full regression: **278/278 test files, 3100/3100 tests passing** (after
  all fixes, including the two defects found above).
- `npx tsc -b`: clean. `npm run lint` (oxlint): clean, exit 0.
- `npm run build`: succeeds; `/studio` rebuilt and committed per this
  repo's CLAUDE.md rule.
- Export validity: all 100 portfolio SVGs parse as well-formed XML; EPS
  export (`buildEps`) verified to produce valid `%!PS-Adobe`...`%%EOF`
  output for `luxuryFloral`/`darkBotanical`/`bohoFloral`/`editorialBotanical`
  samples with the new stem/spine layer present.
- Product-target fit: `productTargetFit`/`productTargetFitV2` measured
  identical before/after across all 5 spot-checked presets (this build's
  changes don't touch product-target computation at all).

## 2. Measured results

| Preset | fragmentedSilhouette (before -> after) | Commercial V1/V2 (before -> after) |
|---|---|---|
| Luxury Floral (30-seed matrix) | 100% -> 70% | 63.27 -> 82.43 |
| Luxury Floral (20-seed evidence sample) | 100% -> 65% | 61.10 -> 82.00 |
| Dark Botanical (30-seed matrix) | 66.67% -> 6.7% | 68.47 -> 83.20 |
| Boho Floral (30-seed matrix) | ~16.7% -> 16.7% (flat) | 85.67 -> 83.77 (small dip) |
| Boho Floral (10-seed evidence sample) | 0% -> 10% (small rise) | 85.50 -> 83.40 |
| Editorial Botanical | unaffected in this sample (no cluster-tagged layout picked) | unaffected |
| Minimal Botanical (not premiumHero) | untouched by design | untouched by design |
| Scandinavian Organic (not premiumHero, strong control) | untouched after the V-5 gating fix | 86.40 -> 86.30 (noise-level) |

Tradeoff: `deadSpace` rate for Luxury Floral rose from not-separately-reported
to 36.7% as a side effect of wider anchor spacing — net commercial-score
effect stays strongly positive, but this is a real, not-fully-free tradeoff.

## 3. Verdict against the brief's Step 16 acceptance targets

1. Luxury Floral fragmentedSilhouette failure rate reduced substantially from 100%. **MET** (70% / 65%, two independent samples).
2. At least 80% of Luxury Floral before/after pairs show visible improvement. **MET** (16/20 = 80.0%, by commercial-score-improved-or-fragmentation-resolved-with-no-regression).
3. At least 80% of Premium Botanical Floral pairs show visible improvement. **NOT CLEARLY MET** — `darkBotanical` alone (the single closest analogue) reaches 8/10 = 80%, but combined with `bohoFloral` (the second analogue used to reach the brief's requested sample count) the combined rate is 8/20 = 40%. The brief names no single preset called "Premium Botanical Floral," so this target's own denominator is ambiguous by construction; taking the more conservative combined reading, it is not met.
4. Hero focal clarity must improve. **NOT DEMONSTRATED** — no targeted before/after measurement of `heroVisibility` specifically was made; this build's mechanisms target cluster spacing/cohesion, not focal-point design.
5. Bouquet masses must appear connected. **PARTIALLY MET** — the stem/spine connector fires only for a minority of samples in practice (~20-40% of premiumHero tiles, by direct measurement) because most surviving companions land outside the deliberately conservative connection-distance cap; the dominant improvement mechanism is fewer isolated single-cell islands (an anchor-spacing effect), not visually connected foliage. The build's own visual audit (`BUILD_023_VISUAL_AUDIT.md`, Finding V-2) is explicit that the "after" render still does not read as one deliberately composed bouquet.
6. Flower construction must look less mechanical. **NOT ADDRESSED** this session — no flower-anatomy generator changes were made.
7. Leaf silhouettes must show real variation. **NOT ADDRESSED** this session — no leaf/branch generator changes were made.
8. Thumbnail readability must improve. **NOT DEMONSTRATED / likely unimproved** — `BUILD_023_VISUAL_AUDIT.md` Finding V-3 shows `luxuryFloral` at 128px still reads as unrecognizable scattered specks in both before and after renders; no thumbnail-specific legibility mechanism was built.
9. Strong presets must not materially regress. **MET** (after fixing the V-5 scope-leak; verified near-identical, not just "close").
10. Export compatibility must remain intact. **MET**.
11. No P0 or P1 defects. **MET in the final delivered state** (one real P1 — the bare stem line — was found and fixed within this same session before any commit).
12. Full regression must pass. **MET** (278/278, 3100/3100).
13. The 100-pattern portfolio must be completed. **MET**.
14. Human review package must be completed. **MET**.

**8 of 14 targets clearly met, 1 met only under a debatable interpretation
of an undefined preset name, 1 partially met, and 4 not addressed at all**
(the flower/leaf/depth/focal-design generator work named in Steps 4/6/7/8
of the acceptance list). The brief is explicit that PASS requires visible
improvement across the named targets, and explicitly disallows a
scope-limited PASS. Declaring PASS here would misrepresent what was
actually delivered against what was actually asked for.

## 4. Known limitations / unresolved issues (for a follow-up build)

- Luxury Floral's fragmentation rate is reduced, not eliminated (65-70%
  still trigger the diagnostic).
- Flower/leaf/branch anatomy, a dedicated depth-layering engine, an
  explicit Art Direction data model, and product-specific composition
  rules (brief Steps 2, 5, 6, 7, 11) were not built or modified this
  session — the existing generator code from Builds 004/005/007/008B/010
  remains as-is, audited but not rewritten.
- Thumbnail-scale legibility for dense premium-hero presets is a real,
  measured gap with no dedicated fix yet.
- `Minimal Botanical`'s visible grid-alignment/flat-palette defects
  (`BUILD_023_VISUAL_AUDIT.md` Finding V-4) are pre-existing and
  untouched, since that preset is not `premiumHero` and none of this
  build's mechanisms reach it.
- The "Premium Botanical Floral" acceptance target's own preset mapping
  is ambiguous (no built-in preset carries that exact name) — a future
  build should either add a preset by that name or have the brief name
  the real preset(s) it means.

## 5. Files changed / added (see `git diff`/`git status` for the full list)

New: `engine/bouquetSpatialGraph.ts`, `engine/repairPass.ts`,
`engine/richnessBudget.ts`, `engine/fragmentedSilhouetteV2.ts`,
`engine/bouquetSpine.ts`, `critic/beautyReview.ts`, and their 6 test
files; `scripts/build023DiagnosticMatrix.ts`,
`scripts/build023VisualEvidence.ts`, `scripts/build023BeforeAfterEvidence.ts`,
`scripts/build023BeforeAfterMetrics.ts`, `scripts/build023Portfolio100.ts`;
`BUILD_023_VISUAL_AUDIT.md`, `BUILD_023_REPORT.md`,
`reports/build_023/**`. Modified: `engine/clusterEngine.ts`,
`engine/compositionIntelligence.ts`, `engine/tile.ts`, `engine/types.ts`,
`layouts/bouquet.ts`, `layouts/heroScatter.ts`, `docs/USER_GUIDE.md`
(v1.76 changelog entry), `/studio` (rebuilt).

Preserved, untouched, not committed per explicit instruction:
`app/dist-standalone/`, `portfolio_phase_1/`, `portfolio_phase_1b_review/`.

## 6. Final verdict

BUILD 023 VISUAL BEAUTY ENGINE: FAIL
