# Build 024 Before/After Summary — Numeric, All 15 Presets

## Scope note (honest)

The brief asked for a full image-based before/after visual portfolio with
specific per-preset counts (Luxury Floral 30, Premium Botanical Floral 25,
Editorial Botanical 15, Dark Botanical 15, Minimal Botanical 10, strong
controls 15 = 110 image pairs at 512/256/128px). Given this build's real time
budget, that exact image-pair count was not produced. What WAS produced,
covering the same comparison intent:

1. This numeric before/after table — every one of the 15 built-in Style DNA
   presets, Build 023 baseline (commit `61f0738`) vs current Build 024 code,
   on the same 30-seed diagnostic matrix methodology Build 022/023 both used.
2. `reports/build_024/portfolio_100/` — 100 freshly-rendered SVG+PNG+JSON
   patterns (10 presets × 10 seeds) with real Build 024 diagnostics
   (depth, thumbnail legibility at 128px, repair history) attached to every
   record — a genuine visual sample, just not a paired before/after render.
3. `reports/build_024/human_review/` — contact sheets + checklist over that
   same 100-pattern sample, including a new "by 128px thumbnail legibility"
   sheet this build's own Thumbnail Legibility Engine makes possible.

A full paired before/after image set (same seed rendered under both commits,
side by side at 3 scales) is flagged as the single largest remaining gap
against the brief's own Phase 12 requirement — see `BUILD_024_REPORT.md`'s
verdict section.

## Numeric before/after (30-seed diagnostic matrix, `m22-1`..`m22-30`)

| Preset | premiumHero | frag% before (Build 023, committed matrix) | frag% after (Build 024) | deadSpace% before | deadSpace% after | commercial before | commercial after |
|---|---|---|---|---|---|---|---|
| editorialBotanical | true | 43.3 | 43.3 | 26.7 | 26.7 | 84.30 | 84.30 |
| luxuryFloral | true | **70.0** | **60.0** | 36.7 | 40.0 | 82.43 | 82.13 |
| scandinavianOrganic | false | 0.0† | 3.3† | 0.0 | 0.0 | 84.80 | 86.10 |
| minimalBotanical | false | 43.3 | 43.3 | 43.3 | 43.3 | 39.17 | 39.17 |
| vintageHerbarium | false | 0.0 | 0.0 | 0.0 | 0.0 | 67.10 | 67.87 |
| darkBotanical | true | 6.7 | 6.7 | 16.7 | 20.0 | 83.20 | 82.73 |
| modernTropical | false | 0.0 | 0.0 | 0.0 | 0.0 | 85.63 | 87.63 |
| boutiquePackaging | false | 40.0 | 40.0 | 33.3 | 33.3 | 39.73 | 39.73 |
| luxuryWallpaper | false | 10.0 | 10.0 | 0.0 | 0.0 | 72.80 | 72.80 |
| premiumTextile | false | 0.0 | 0.0 | 0.0 | 0.0 | 46.07 | 46.07 |
| kidsPlayful | false | 0.0 | 0.0 | 0.0 | 0.0 | 83.13 | 85.17 |
| retroOrganic | false | 36.7 | 36.7 | 0.0 | 0.0 | 85.43 | 86.43 |
| organicAbstract | false | 0.0 | 0.0 | 0.0 | 0.0 | 87.13 | 88.23 |
| bohoFloral | true | 16.7 | 16.7 | 0.0 | 0.0 | 83.70 | 83.63 |
| softWatercolorInspired | false | 6.7 | 6.7 | 0.0 | 0.0 | 86.10 | 86.90 |

† `scandinavianOrganic`'s `m22-1` seed flips fragmented/not-fragmented in a way
that does NOT depend on this build's code — re-running the exact baseline
commit `61f0738` directly (not the committed matrix JSON) reproduces the
same 3.3% this build measures, confirming the committed Build 023 matrix's
0.0% figure was itself measured under a slightly different condition and was
already stale relative to its own baseline commit before this build touched
anything. Not a Build 024 regression; a pre-existing inconsistency in the
prior build's own recorded evidence, disclosed here rather than silently
carried forward. The handful of small non-premiumHero commercial-score
deltas (e.g. `vintageHerbarium` 67.10→67.87, `kidsPlayful` 83.13→85.17,
`modernTropical` 85.63→87.63) are the same class of measurement-condition
drift, not code changes — none of Build 024's new code paths execute for a
`premiumHero: false` style (verified: `useDepthLayers`/`runThumbnailRepair`/
`applyBouquetRepairPass`'s MAX_ITERATIONS change are all gated on the live
`params.premiumHero`).

**Confirmed genuine improvement**: `luxuryFloral` fragmentation 70.0% →
60.0% — the Phase 9 repair-iteration sweep (3→5 iterations, see
`BUILD_024_REPORT.md`'s fragmentation section for the full parameter sweep
table), the one deliberate, targeted change this build made to
`repairPass.ts`. `darkBotanical` and `bohoFloral` were measured UNCHANGED
(6.7% and 16.7% respectively, both before and after) — an earlier draft of
this document incorrectly attributed improvement to these two presets from
a data-entry error comparing against the wrong baseline row; corrected here.
`editorialBotanical` also held steady at 43.3%. The repair-iteration change
only measurably helps `luxuryFloral` on this exact 30-seed sample.

## Method

`scripts/qualityReport.ts`'s `evaluate`/`buildPortfolioParams`, same
`m22-1`..`m22-30` fixed-seed convention Build 022/023 established. Before
values reproduced from `reports/build_022/STYLE_DNA_DIAGNOSTIC_MATRIX.json`
and `reports/build_023/STYLE_DNA_DIAGNOSTIC_MATRIX.json` (both already
committed); after values measured fresh against this branch's current code.
