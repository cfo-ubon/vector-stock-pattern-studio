# BUILD 024 — Gap Audit

Phase 1 of the Botanical Anatomy, Depth & Thumbnail Beauty Engine brief.
Method: direct inspection of the actual source (`app/src/generators/botanical.ts`,
`app/src/engine/{depthEngine,patternReadability,hierarchy,tile,clusterEngine,
repairPass,richnessBudget,fragmentedSilhouetteV2,styleDna}.ts`), plus the
already-rendered evidence in `reports/build_023/` (before/after set, 100-pattern
portfolio, human review contact sheets) and the Luxury Floral fragmentation
benchmark. Findings below are stated plainly, including where the brief's
starting assumption does not match what the code actually contains.

## 1. Flower anatomy — NOT generic/mechanical to the degree assumed

`generators/botanical.ts` (1477 lines) already ships **29 tagged variants
across 19 named botanical families** (rose, peony, tulip, anemone, magnolia,
hydrangea, cosmos, wildflower, daisy, lavender, eucalyptus, olive, fern, berry
branch, herb, ranunculus, protea, tropical leaf, plus the untagged universal
fallback bloom), built across Builds 004/005/007/008B/019/020. Each named
flower has genuinely distinct geometry, not a recolored copy of one ring:

- `peonyFlower` — 3 concentric ruffled-petal rings, per-ring count/size/
  rotation-offset/asymmetry all seed-driven (`peonyPetalPath` with a `ruffle`
  parameter).
- `ranunculusRosette` — 5-7 spiral rings, each ring's petal count growing and
  twisted by a random spiral offset (tight rosette, distinct from peony).
- `roseFlower` — tight rolled-bud core + 2-3 looser outer ruffle rings
  (distinct core-vs-outer structure, not shared with ranunculus).
- `proteaFlower` — stiff un-ruffled bract cone + fuzzy bristle center.
- `poppyFlower` — crinkled Catmull-Rom petals + dark seed-pod center with
  radiating star lines.
- `anemoneFlower` — smooth rounded/folded/curled petal mix + fuzzy dark
  stamen-dot center.
- `daisyFlower` — thin radiating petals with `pointed/damaged/immature`
  variants mixed in + stippled disc center.
- `cosmosFlower` — V-notched petal tip (`cosmosPetalPath`).
- `magnoliaFlower` — few large waxy tepals + columnar stacked-ellipse center,
  optional inner tepal layer.
- `hydrangeaBloom` — 16-24 tiny 4-petal florets placed by golden-angle
  spiral (many-small-blooms-in-one-head, structurally distinct from every
  single-bloom variant).
- `lavenderSpike`, `bellFlower` — non-radial spike/raceme structures.
- `flowerBud` — closed bud + optional leaf, real bud silhouette.

**Verdict**: the brief's Phase 3 premise ("flower generators look mechanical
... perfect radial symmetry ... identical petals") describes the *original*
`flowerBloom` fallback accurately, but that variant already carries its own
Build 018/019 fix (`layeredPetalRing`, seeded `openness`, optional stem) and
is one of 29 variants, not the whole library. A ground-up "V2 rewrite of 10
named families" would in large part re-derive geometry that already exists
and is already measurably distinct per family (per-family `TaggedVariant`
tagging, `poolForFamily` narrowing). Real, remaining gaps (see Section 5) are
narrower than a full rewrite.

## 2. Leaf anatomy — also more developed than assumed

10 distinct leaf silhouette functions exist: `ovateLeafPath` (pointed-tip
asymmetric taper), `serratedLeafPath` (toothed edge), `mapleLeafPath` (5-lobe
palmate + palmate veins), `heartLeafPath` (cordate + vein pairs),
`roundedLeafPath` (eucalyptus), `lanceLeafPath` (olive, narrow),
`laurelLeafPath` (paired opposite arrangement), `sageLeafPath` (wobbled
Catmull-Rom edge), plus `monsteraLeaf`/`palmFrond` (tropical, in
`generators/tropical.ts`). Each has its own aspect ratio, taper and edge
behavior; `pinnateVeins` gives ovate/serrated leaves real branching venation.

**Real gap**: no leaf uses per-family *vein density/angle* variation beyond
the shared `pinnateVeins` helper, and several (rounded/lance/laurel/sage) have
**no vein rendering at all** — a flat silhouette only. This is a genuine,
narrow, fixable gap, not a "generic ellipse" problem.

## 3. Branch/stem anatomy — real growth engine exists, one real defect class remains

`generators/growth.ts`'s `generateStem`/`growLeaves`/`GROWTH_PRESETS` already
produce a continuously-curved stem spline with tangent-oriented leaf
placement (not straight lines / independent rotation) for
fern/eucalyptus/olive/laurel/sage/leafyBranch/wildflowerSprig/bellFlower/
lavenderSpike/berryBranch. `attachOptionalStem` (Build 019/020) adds a stem +
optional leaf(ves) to otherwise-bare flower-head variants, role-weighted so
hero always gets one.

**Confirmed real defect** (found and partially fixed in Build 023): the
`bouquetSpine.ts` connector (cluster-level, not per-motif) could draw a long
bare line across empty background when its target companion was far away;
capped at `MAX_STEM_REACH_MOTIF_MULTIPLE = 2.2`. No systematic bare-stem
*validation* pass exists yet (a check that runs after placement and flags any
remaining stem endpoint with no attached leaf/flower within a plausible
reach) — this is a real, addressable gap (Phase 5's validation requirement).

## 4. Depth-layering — CONFIRMED genuinely missing

`engine/depthEngine.ts` is 45 lines and does exactly one thing:
`applyDepthColorShift` blends filler/accent's own fill colors toward the
background color by a fixed per-role factor (0.35/0.55) when a style opts
into `depthStrength`. This is a **color treatment**, not a layering system —
there is no concept of 7 (or any) named depth planes, no occlusion-based
z-order beyond the existing 4-value `ROLE_LAYER_PRIORITY`
(hero=3/secondary=2/filler=1/accent=0, `hierarchy.ts`), and no depth
diagnostics (layer count, hero occlusion ratio, foreground framing score,
etc.) anywhere in the codebase. Build 010's own historical section name
("Multi-layer Depth Engine") is a misnomer for what shipped.

**Verdict**: this is the single largest genuine gap in the brief and the
correct place to spend most of this build's effort.

## 5. Thumbnail legibility — a real but coarse engine exists

`engine/patternReadability.ts` (98 lines, Build 001.1 Section 6) computes
`thumbnail200`/`thumbnail400`/`zoom800` from real geometry: on-screen px size
of every instance at a given display width vs. a visibility floor, plus a
hero-specific legibility floor, plus (for zoom) existing
`cornerContinuity`/`gridAppearanceScore`/`svgHealth` metrics. This is real
and deterministic, but coarse: two numbers (visible-fraction, hero-legible
bool) collapsed into one score per scale, no 128px tier, no motif-merging
detection, no dark-blob/washout risk, no repair recommendations, no
per-failure-reason breakdown. This matches the brief's Phase 7 requirement
almost exactly in intent but not in resolution — extending it, not replacing
it, is the right move.

## 6. Art-direction — no explicit data model exists

Style DNA (`styleDna.ts`, 639 lines) carries many of the *individual* signals
the brief's art-direction model wants (`hierarchyPreset`, `premiumHero`,
`depthStrength`, `compositionZone`→`eyeFlowPath`, `asymmetryDirection`,
`preferredFamilies`) but as a flat, uncorrelated field bag resolved
independently — there is no single `ArtDirection` object that ties story/
focal-strategy/silhouette-type/depth-plan/negative-space-plan/thumbnail-intent
together as one coherent decision threaded through generation. This is a
real, buildable gap (Phase 2).

## 7. Luxury Floral fragmentation — real, measured, still open

Per `reports/build_023/LUXURY_FLORAL_FRAGMENTATION_BENCHMARK.md`: Build 023
reduced the diagnostic-matrix fragmentation rate 100% → 70% (30-seed sample)
and 100% → 65% (20-seed before/after sample) via `anchorSpacingMultiplier`
(2.0x), `reserveClusterCompanions`, and `applyBouquetRepairPass`. The
benchmark's own honest-gap section states 2.0x was already tuned to
diminishing returns (2.5x regressed `deadSpace`/commercial score). Getting to
the brief's ≤30% target needs a different lever than "more anchor spacing" —
this build's Phase 9 explores raising the repair budget ceiling and
tightening the repair pass's target distance instead of touching spacing.

## 8. Measurable acceptance criteria for this build

| # | Criterion | Baseline (Build 023 / commit 61f0738) | How measured |
|---|---|---|---|
| 1 | Explicit `ArtDirection` type exists and is read by ≥1 real generation decision (not metadata-only) | absent | code review + test |
| 2 | Depth-Layering Engine assigns each instance one of 7 named layers, used for real paint order | absent (4-value role priority only) | unit test + rendered evidence |
| 3 | Depth diagnostics computed per tile (layer count, hero occlusion ratio, foreground framing score, rear-layer visibility, flattened-composition risk) | absent | unit test |
| 4 | Thumbnail Legibility Engine scores at 1024/512/256/128px with named failure reasons | 3 scales (200/400/800-zoom), no failure reasons | unit test |
| 5 | Bounded thumbnail-aware repair (max 3 passes, deterministic) | absent | unit test |
| 6 | `luxuryFloral` fragmentation rate on the same 30-seed matrix | 70% | re-run `build023DiagnosticMatrix`-style script |
| 7 | No regression on strong-control presets (scandinavianOrganic et al.) commercial score | 86.30 (post Build-023-fix) | before/after metric diff |
| 8 | Vein rendering added to ≥2 of the currently vein-less leaf shapes | 0/4 (rounded/lance/laurel/sage) | code review |
| 9 | Bare-stem/disconnected-endpoint validation diagnostic exists | absent | unit test |
| 10 | Full regression suite still green | 277 files / 3094+ tests passing (Build 023) | `npm test` |

## 9. Scope decision for this build

Given the above, this build will NOT attempt a ground-up 10-family flower/
leaf "V2 rewrite" — most of that work already exists and is already
measurably differentiated per family. Effort instead goes to the confirmed
real gaps: the Art-Direction model (Phase 2), a genuine Depth-Layering Engine
(Phase 6), an extended Thumbnail Legibility Engine + bounded repair (Phases
7-8), further Luxury Floral fragmentation work (Phase 9), and targeted
anatomical fixes (leaf veins on the 4 vein-less shapes, bare-stem validation)
rather than a full Phase 3-5 rewrite. This is reported honestly in
`BUILD_024_REPORT.md`'s verdict rather than claimed as complete.
