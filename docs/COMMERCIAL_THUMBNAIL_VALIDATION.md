# Commercial Thumbnail Validation — Build 022 Status

The originating brief (Phase 9) asked for a dedicated commercial thumbnail
review system: rendering each pattern at 1024px/512px/256px/128px with
diagnostic overlays, to catch legibility problems that only show up at
small marketplace-thumbnail scale.

**This was not built in this build.** Recording that honestly here rather
than fabricating results, per this repo's own "never fabricate
verification results" convention.

## What already exists and covers part of this need

- `src/engine/thumbnailLegibility.ts` (Build 002, Section 3) already scores
  hero legibility at 200px specifically, and is exercised by the existing
  test suite and every portfolio evaluation run via `qualityReport.ts`.
- `scripts/portfolioVisuals.ts` (Build 013) already renders sampled
  patterns to real PNG contact sheets for visual art-director review, and
  was reused conceptually (not re-invoked at Build 022's specific weak-
  preset scale) — see `BUILD_022_REPORT.md` for what visual evidence this
  build did produce.

## What's still missing for a real multi-scale commercial thumbnail system

- No 1024/512/256/128px multi-scale rendering pipeline exists yet.
- No diagnostic-overlay rendering (highlighting where legibility/contrast
  fails at small scale) exists yet.
- `thumbnailLegibility.ts`'s 200px score is not broken out per scale band.

## Recommendation for a future build

Build a dedicated `scripts/build0NNThumbnailValidation.ts` that renders a
representative sample (weak presets first) at all 4 scales via the
existing PNG-in-Node rendering path already proven in
`scripts/portfolioVisuals.ts`/Portfolio Phase 1, and extend
`thumbnailLegibility.ts` to report a legibility score per scale band
instead of a single 200px number. This is real, scoped follow-up work —
not something this build's remaining time budget could complete without
either rushing the render pipeline (risking silent export-quality
regressions) or cutting the palette-contrast/illustration-quality fixes
that were this build's highest-evidence, highest-value work.
