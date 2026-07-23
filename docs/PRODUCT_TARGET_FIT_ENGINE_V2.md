# Product-Target Fit Engine V2

Build 022, Phase 7 (see `BUILD_022_AUDIT.md` Finding 4).

## The problem

`src/collection/productTargets.ts`'s `evaluateProductTargets()` scores a
pattern against all 13 named product uses (wallpaper, fabric, gift wrap,
phone case, etc.). The pre-existing `productTargetFit` metric in
`scripts/qualityReport.ts` averaged all 13 scores uniformly. Each product
rule's score is baseline 40 + up to 35 for a keyword match in free text +
15 for category fit ± up to 20 for tile-size/density/hero-visibility fit.
`qualityReport.ts` passed the Style DNA *label* (e.g. "Minimal Botanical")
as that free text, which never literally contains "wallpaper," "gift
wrap," etc. — so the keyword bonus essentially never fired in this
evaluation path, and the flat 13-way average mathematically regressed
toward ~45–55 for every pattern regardless of how well it actually suited
its best-fit product.

This meant "Product-Target Fit is weak" was measuring "how well does this
pattern fit the average of 13 mostly-irrelevant products," not "how well
does this pattern fit the product it's actually meant for."

## The fix

`src/collection/productTargetFitV2.ts`:

```ts
export interface BestFitProductTargetFit { score: number; products: string[]; }

export function bestFitProductTargetFit(
  evaluations: ProductUseEvaluation[],
): BestFitProductTargetFit
```

Sorts all 13 evaluations by score, takes the `suitable` subset (falling
back to the top 3 by score if none are marked suitable), and averages only
that subset. `products` lists which product ids were included, so the
result is explainable — not just a number.

Wired into `scripts/qualityReport.ts` as an additive `productTargetFitV2`
field (V1's `productTargetFit` is untouched, so any code/report relying on
it keeps working). The same call site now also passes `heroVisibility`
into `evaluateProductTargets` (previously omitted, since 2 of the 13
product rules use it for their ±10 adjustment).

## Measured effect

Portfolio mean: 66 (V2) vs 50.61 (V1), **+15.4**, uniformly higher across
all 15 built-in Style DNA presets (no preset left behind) — see
`reports/build_022/STYLE_DNA_DIAGNOSTIC_MATRIX.json`'s `productTargetFit`
vs `productTargetFitV2` columns.

## What this does *not* do

This fix is measurement-only — it changes how existing product-fit scores
are aggregated, not how patterns are generated. Per the audit
(`BUILD_022_AUDIT.md` Finding 4), a complete Product-Target Fit Engine V2
would also add real generation-time constraints so a pattern generated
*for* a declared product target genuinely fits it better at the source.
That generation-time half was not implemented in this build — only the
measurement-methodology fix was completed and verified.
