# Build 024 — Botanical Anatomy: Audit Findings and Scope Decision

Build 024's brief asked for a "Flower Anatomy Engine V2" (10 named families)
and a "Leaf Anatomy Engine V2" (10 named families), each rewritten with
detailed per-family anatomical parameters. Before writing any code, this
build inspected the actual existing generator
(`app/src/generators/botanical.ts`, 1477 lines) against that requirement.
This document records what was found and why the scope was narrowed.

## What already exists (Builds 004/005/007/008B/018/019/020)

`generators/botanical.ts` ships **29 tagged variants across 19 named
botanical families** — not a single generic radially-symmetric fallback
bloom, as the brief's complaint list assumes. Each named flower has its own
distinct construction:

| Family | Real distinguishing structure |
|---|---|
| Peony | 3 concentric ruffled-petal rings, seeded ruffle/count/rotation per ring |
| Ranunculus | 5-7 spiral rings, growing petal count, twisted spiral offset |
| Rose | Tight rolled-bud core + 2-3 looser outer ruffle rings |
| Protea | Stiff un-ruffled bract cone + fuzzy bristle center |
| Poppy | Crinkled petals (Catmull-Rom curve) + dark seed-pod center + radiating star lines |
| Anemone | Smooth rounded/folded/curled petal mix + fuzzy dark stamen-dot center |
| Daisy | Thin radiating petals with damaged/immature variants mixed in + stippled disc |
| Cosmos | V-notched petal tip |
| Magnolia | Few large waxy tepals + columnar stacked-ellipse center |
| Hydrangea | 16-24 tiny 4-petal florets, golden-angle spiral placement |
| Lavender / Bell flower | Non-radial spike/raceme structures |
| Bud | Closed bud silhouette + optional leaf |

Ten leaf silhouette functions exist (`ovateLeafPath`, `serratedLeafPath`,
`mapleLeafPath`, `heartLeafPath`, `roundedLeafPath`, `lanceLeafPath`,
`laurelLeafPath`, `sageLeafPath`, plus tropical `monsteraLeaf`/`palmFrond`),
each with its own aspect ratio, taper, and edge behavior. A real growth
engine (`generators/growth.ts`) already produces continuously-curved stems
with tangent-oriented leaf placement (not straight lines / independently-
rotated leaves).

## Scope decision

A ground-up rewrite of 10 flower families and 10 leaf families would in
large part re-derive geometry that already exists and is already measurably
differentiated per species. That work would not close a real gap — it would
duplicate it. This build instead:

1. Did NOT rewrite the flower/leaf generator wholesale.
2. Spent its effort on the confirmed, real gaps: the Depth-Layering Engine
   (`docs/DEPTH_LAYERING_ENGINE.md`), the Thumbnail Legibility Engine
   (`docs/THUMBNAIL_LEGIBILITY_ENGINE.md`), the Art-Direction data model, and
   further Luxury Floral fragmentation reduction.
3. Identified — but did not fix, for lack of remaining time in this build —
   two narrower, real anatomical gaps worth a future build's attention:
   - 4 of the 10 leaf shapes (`roundedLeafPath`/eucalyptus,
     `lanceLeafPath`/olive, `laurelLeafPath`, `sageLeafPath`) render as a
     flat silhouette with **no vein rendering at all**, unlike
     `ovateLeafPath`/`serratedLeafPath`'s real `pinnateVeins`.
   - No systematic "bare stem / disconnected endpoint" validation pass
     exists — Build 023 fixed ONE instance of this (the bouquet spine
     connector's own bare-line defect) with a distance cap, but there is no
     general diagnostic that would catch a similar defect elsewhere.

## Honest verdict on this part of the brief

Per BUILD_024_AUDIT.md Section 9: this build does not claim Phase 3/4
("Flower/Leaf Anatomy Engine V2") complete. It claims the audit found the
underlying premise partially inaccurate for this codebase, and redirected
effort to the phases where a real gap was confirmed. See
`BUILD_024_REPORT.md`'s verdict section for how this factors into the final
PASS/FAIL decision.
