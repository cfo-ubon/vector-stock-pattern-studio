# Vector Stock Pattern Studio (React app)

A client-only React + TypeScript + Vite app that generates seamless,
fully-editable SVG surface patterns for stock sites (Adobe Stock,
Shutterstock, Freepik, Creative Fabrica, ...). Everything is procedural —
no AI image API calls, no backend, no per-generation cost.

This app lives alongside the original static-site prototype in the repo
root (`/index.html`, `/js`, `/css`); the two are independent and this one
does not replace it.

A parallel, data-first foundation (JSON Schemas, editable trend/marketplace/
style-DNA/pattern-grammar/motif-grammar/color-role data, a validation
engine, and a query/service layer — not yet wired into this app's UI or SVG
generation) lives under `src/schemas/`, `src/trend-packs/`,
`src/marketplaces/`, `src/style-dna/`, `src/pattern-grammar/`,
`src/motif-grammar/`, `src/color-roles/`, `src/validators/`, and
`src/services/`. See [`DESIGN_INTELLIGENCE_CORE.md`](./DESIGN_INTELLIGENCE_CORE.md)
for its architecture, schema reference, and developer guide.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
npm run lint
npm test         # vitest run — 1047 tests, see "Testing" below
```

## How a pattern is built

1. A **layout** (`src/layouts/*`) decides where motifs go inside one square
   tile — 14 total: the original grid, brick/offset, half-drop,
   radial/mandala and random scatter, plus 9 named "composition systems"
   modeled on real surface-pattern-design arrangements: Hero + Editorial
   Flow and Hero + Scatter (a few large focal motifs plus smaller fillers —
   scale hierarchy via `Placement.scale`, not a generator concept), S-Curve
   Botanical and Bouquet (motifs strung along a serpentine path / gathered
   into tumbled clusters), Airy Botanical and Dense Premium (density
   compressed or amplified regardless of the slider, for a deliberately
   sparse or deliberately rich composition), Toss Pattern, Grid Minimal,
   and Stripe (banded rows with gaps, not a uniform fill).
2. A **generator** (`src/generators/*`) supplies the actual shape for each
   placement — currently Geometric, Botanical/Floral, Abstract Organic,
   Tropical, Boho/Tribal, Line Art, Mandala, Textile/Damask, Cute/Kids,
   Seasonal/Holiday, Retro 70s, Plaid & Check, Animal Print, Paisley & Ikat,
   and Terrazzo. Each call returns one randomly-varied motif from that
   category's pool. A generator can optionally lock its whole tile to one
   sub-style via `beginTile()` (Seasonal picks christmas-or-halloween once;
   Plaid/Animal Print/Paisley pick one check style/animal/family once) so a
   single pattern never mixes visually incompatible motifs — the equivalent
   of a real fabric never being half-leopard-print, half-zebra-print.
3. The **engine** (`src/engine/tile.ts`) combines the two: for every
   placement it draws the motif not just once but at every periodic offset
   `(x ± tileSize, y ± tileSize)` that could overlap the tile edge, then
   clips the whole layer to the tile rectangle. Because the underlying
   placements are periodic, this guarantees the tile is seamless — a motif
   that overhangs the right edge reappears correctly cut off on the left.
4. The result is a plain **SVG AST** (`src/engine/svgAst.ts`, a small
   `{tag, attrs, children}` tree) — not markup strings — serialized once by
   `serialize()`. Preview and export both consume the exact same tree, so
   what you see on screen is guaranteed to match what gets exported.

## Export

- **Single tile** (`Export single tile`): one `<svg>` sized exactly to the
  tile, ready to drop into a repeat/pattern fill.
- **Pre-tiled 3×3** (`Export 3x3 tiled`): nine literal, independently
  editable copies of the tile (not `<use>` references) laid out edge to
  edge, useful for previewing/selling a bigger swatch.

Both exports use only SVG 1.1 primitives (`path`, `circle`, `rect`,
`polygon`, `line`, `g`, `clipPath`) with plain `fill`/`stroke`/`transform`
attributes — no CSS filters or classes — so they open cleanly in Affinity
Designer 2 with real, separately-selectable groups (`layer-background`,
`layer-pattern`, `motif-1`, `motif-2`, ...).

## Asset-Based Pattern (Asset Mix mode)

`GenerateParams.mixCategoryIds` (`src/engine/types.ts`) is an optional array
of 2-5 category ids. When set, `buildTile()` (`src/engine/tile.ts`) picks a
random generator from that set for **each individual placement** — not once
per tile — instead of using `categoryId` alone. This produces genuinely
eclectic patterns blended from multiple generators' motif pools within one
tile, without any changes to the individual generator files. `categoryId` is
kept in sync to the first entry for display/filename purposes when mix mode
is active.

The control panel exposes this as the "🧩 Asset Mix" toggle
(`ControlPanel.tsx`), which switches the category chip row from single-select
to multi-select (capped at 5). `defaults.ts`'s `randomizedParams()` also
samples mix mode ~25% of the time so "Randomize All" exercises this part of
the parameter space. `metadata/shutterstock.ts` interleaves each mixed
category's keyword list round-robin (instead of concatenating) so no single
category hogs the high-weight early keyword slots, and truncates
title/description to a hard word-boundary cap so a 5-way mix never exceeds
Shutterstock's character limits.

Combined with layout (14), palette (18), color count (2-6) and density
(0-100% in 5% steps), the discrete category-selection space alone (15 single
+ C(15,2..5) mixes = 4,943 options) yields a conservative lower bound of
≈130.7 million distinct configurations from just those 5 dimensions —
excluding motif size, rotation/scale jitter, mirror, radial symmetry, custom
colors and seed, which multiply it further. See
`docs/USER_GUIDE.md` § "แอปสร้างลายไม่ซ้ำกันได้กี่แบบ" for the full breakdown.

## Per-site SEO metadata

`metadata/shutterstock.ts` exports `buildSiteMetadata(tileData)`, which
computes one shared keyword/title/description core and then shapes it into
upload-form-ready fields per stock site (`STOCK_SITES`: Shutterstock,
Adobe Stock, Freepik, Creative Fabrica, Creative Market, Etsy) — each with
that site's own character caps, keyword counts and category picks. The
`MetadataPanel` renders these as tabs with per-field copy buttons. The
Marketplace Profile System (see its own section below) builds on this same
copy with per-marketplace *rules* — filename templates, validation,
export packages, and a place to persist manual overrides per asset.

## Color story

With `GenerateParams.colorStory` (default on, needs >2 accents), the engine
picks 2 dominant accents once per tile and passes just `[bg, d1, d2]` to
~72% of placements, the full palette to the rest — generators keep picking
uniformly, so no generator changes are needed. Field patterns
(`disableGridRhythm`, e.g. Plaid) get the story palette on every placement
because their position-parity color alternation requires one stable accent
list. The filler layer follows the story palette for cohesion.

## Filler layer, flat shadow & flat highlight

`buildFillerLayer` in `engine/tile.ts` scatters tiny dots/rings/plus/
diamond accents (poisson-disc placed, periodic wrap-cloned, colors
pre-blended toward the background) behind the motif layer —
`GenerateParams.fillerStyle: 'none' | 'subtle' | 'rich'`. It consumes rng
only after all motifs are built, so toggling it never changes the main
pattern of a seed. `flatShadow` draws a solid recolored silhouette of
every motif (via `recolorNode`) offset down-right in a dedicated layer
under all motifs; the shadow offset is added to each placement's
effective radius so edge shadows stay seamless.

`flatHighlight` takes a different approach from the shadow: instead of a
dedicated layer, a small solid-color ellipse is built once per placement
and pushed as a sibling of `motif.node` *inside* the same per-instance `g`
that carries the placement's own translate/rotate/scale — so the shine
rotates and scales along with its motif automatically, no extra wrap-radius
bookkeeping needed (it's positioned well within `safeRadius`). The color is
`blendHex('#ffffff', 0.6, backgroundColor)`, which reliably reads as
lighter than any accent color since `accentColors()` always excludes the
background. Because this lives at the engine level rather than inside any
one generator, it applies uniformly across all 15 categories.

## EPS export

`export/epsExporter.ts` converts the tile's SvgNode tree straight to
Encapsulated PostScript — the vector format Shutterstock/Adobe Stock/
Freepik actually accept. Every coordinate (including Bézier control
points) is flattened through the accumulated SVG transform plus a final
Y-flip, so the output is plain absolute moveto/lineto/curveto ops; Q
segments are exactly elevated to cubics and A segments go through the
standard endpoint→center arc-to-cubic conversion. Strokes map to
setlinewidth/cap/join with the width scaled by the matrix determinant.
The whole page is clipped to the artboard (identical to the SVG's
tile-clip).

This is only possible because the tile is 100% flat opaque color:
generators never use opacity (pre-blended via `blendHex` in palettes.ts —
gingham/tartan crossings are drawn as explicit intersection rects),
gradients, filters, text or rasters. Verified against Ghostscript across
46 category×layout cases: renders are pixel-identical to Chromium's SVG
rendering (mean channel diff < 0.8/255).

## Batch metadata CSVs

`metadata/csv.ts` builds Shutterstock- and Adobe-Stock-format metadata CSVs
for the whole saved library (both sites match CSV rows to uploaded files by
filename; rows use the `.eps` name each SVG becomes after conversion, Adobe
category = 8 / Graphic Resources). Downloadable standalone from the library
toolbar and included automatically in the move-to-disk zip.

## Colorway batch & JPEG export

"Colorway ทุกชุดสี → คลัง" rebuilds the current pattern once per palette
(same seed/composition) and bulk-saves the set to the library without
per-item downloads. "Export JPEG preview (5000px)" and "Export JPEG 3×3
preview (3000px)" share `rasterizeSvgToJpeg`, which rasterizes an SVG
string onto a canvas in the browser and downloads a JPEG — for sites that
require a JPEG paired with the vector.

## Export sizes

`SINGLE_EXPORT_PIXEL_SIZE` (`export/svgExporter.ts`) = 3000 — the
document size for the single-tile SVG and EPS exports (both scale the
tile's own `tileSize` coordinate system up losslessly, same trick as
SVG's width/height-vs-viewBox). `TILED_EXPORT_PIXEL_SIZE` = 10000 — the
3×3 SVG export's document size. The 3×3 JPEG export rasterizes at 3000.
`epsExporter.ts`'s root matrix combines the SVG Y-flip with this scale
factor in one step (`matrixScale` picks the scale back up automatically
for stroke widths).

## Download bundle

Saving to the library also auto-downloads a zip (re-downloadable per card)
containing the single-tile SVG + EPS (3000×3000), the 3×3 SVG (10000×10000)
and a plain-text dump of every site's SEO fields (`buildSeoTextFile`). The
zip is written by a dependency-free STORE-method writer (`export/zip.ts`)
— files are stored byte-for-byte, so nothing is recompressed or downscaled.

## Saved library with submission tracking

`SavedPanel` (`components/SavedPanel.tsx`) is a persistent library separate
from the rolling Gallery: `SavedItem` stores the full `TileData`, a derived
display name, a free-text note, and a `submissions` map keyed by
`StockSiteId` so the user can tick which sites each pattern has been
submitted to. Persisted to IndexedDB (`storage/savedStore.ts`, uncapped —
IDB quota runs to gigabytes; legacy localStorage libraries migrate in
automatically, and the store falls back to localStorage where IDB is
unavailable); loading an item back restores its params so the SEO panel
shows that pattern's copy again.

"Move library to disk" builds one zip with a numbered folder per item
(single + 3×3 + SEO) plus `library-backup.json` (the raw `SavedItem[]`),
then clears the library — the import button restores/merges a library from
that json, deduped by item id.

## Post-generation pattern scale

`GenerateParams.patternScale` (default 1) multiplies the effective motif
size at build time while the density *value* stays fixed. Because every
layout's spacing is proportional to motif size (`spacingForDensity` in
`layouts/shared.ts`), the spacing-to-motif ratio — the visual density
proportion — is preserved automatically: the same seed and composition
simply repeat finer (<1) or bolder (>1) within the fixed export canvas.
The preview toolbar exposes this as a 40–250% slider that rebuilds the
currently shown tile live without touching the gallery.

## Motif library expansion (Botanical generator, 10 -> 20 variants)

Ten new variants, each carrying genuine seed-driven internal structure
rather than a recolored/rotated copy of one base shape:

- `peonyFlower` — 3 concentric rings of `peonyPetalPath()` (an
  intentionally asymmetric-tip petal via a `ruffle` parameter), each
  ring's petal count/size/rotation-offset independently randomized.
- `ranunculusRosette` — 5-7 rings of small cupped petals spiraling
  outward, each ring's petal count increasing and rotated by its own
  random spiral offset — the tightly-packed rosette look, distinct from
  peony's looser ruffle.
- `poppyFlower` — `poppyPetalPath()` samples the petal envelope at 5
  points with per-sample radius jitter for a crinkled/papery edge, around
  a dark seed-pod center with radiating star lines (the poppy's
  signature trait).
- `anemoneFlower` — smooth (non-crinkled) rounded petals around a dark
  fuzzy center built from randomly-positioned stamen dots.
- `daisyFlower` — 12-16 thin petals around a flat disc with a *stippled*
  texture (randomly scattered dots, not a uniform ring — real stipple).
- `cosmosFlower` — `cosmosPetalPath()` cuts a small V-notch into each
  petal tip via two extra `L` points, cosmos's one distinguishing trait
  among the otherwise-similar radial-petal flowers here.
- `eucalyptusSprig` / `oliveBranch` / `laurelSprig` / `sageSprig` — four
  new leaf silhouettes (`roundedLeafPath`, `lanceLeafPath`,
  `laurelLeafPath`, `sageLeafPath`) spanning round → narrow-lance, each
  carried in pairs along a stem like `leafyBranch`/`eucalyptusSprig`
  already did, so the branch-with-paired-leaves construction is reused
  rather than duplicated per leaf shape.

## Curve Quality Engine & Botanical Growth Engine (`engine/curveEngine.ts`, `generators/growth.ts`)

Motif Quality Upgrade pass: consolidates curve math that used to be
hand-duplicated per-motif, and replaces "leaves at an independently-random
angle" placement with real tangent-following growth.

- `engine/curveEngine.ts` — shared, additive curve utilities (does **not**
  replace `svgAst.smoothClosedPath`, which mandala/organic/animalprint
  still use unchanged): `smoothPathD()` generalizes it to open paths
  (needed for stem splines); `buildArcSampler()` densifies a Catmull-Rom
  spline and answers "position + unit tangent/normal at t=0..1 of arc
  length"; `tangentToUpAngleDeg()` converts a tangent into the same
  0deg-is-up rotate() convention the rest of the app uses; `wobbleEnvelope()`
  is the shared implementation behind "papery crinkled" / "softly wobbled"
  edges (previously three near-identical hand-rolled copies in
  `poppyPetalPath`/`sageLeafPath`/`serratedLeafPath` — the first two now
  use it, `serratedLeafPath` keeps its own straight-line zigzag since real
  leaf teeth are deliberately sharp); `radialAsymmetry()` gives ring-based
  flowers a small seeded angle/scale jitter; `validatePoints`/`validatePathD`
  catch NaN/zero-length-segment bugs (used by tests).
- `generators/growth.ts` — `generateStem(rng, length, curvature)` builds a
  gently curved (C or S sway) stem spline instead of a straight line or one
  hand-tuned `Q` curve; `growLeaves(rng, stem, preset)` samples leaf
  positions along the stem's real arc length and orients each leaf to the
  stem's *local tangent* at that point (falling back to the original fixed
  "fan upward" look when the stem is nearly straight, but genuinely
  following the curve where it bends) — replacing the old approach of
  rotating each leaf by an angle picked independently of the stem's shape.
  `GROWTH_PRESETS` bundles the tuned leaf-count/arrangement/angle/taper
  values per species (eucalyptus, olive, laurel, sage, fern, leafyBranch) —
  **these must match each species' original hand-tuned density**; an early
  version of this preset table used different leaf-count ranges and
  `arrangement` values than the original code, which produced a visibly
  denser/overlapping "chain of blobs" look instead of a legible spray —
  caught via rendered-PNG visual QA, not by tests (tests only check
  determinism/validity, not "does it look like a plant").
- `generators/petals.ts` — `organicPetalPath()` is a rounded-tip petal
  built from `smoothPathD`, replacing the `<ellipse>` petals `flowerBloom`,
  `layeredBloom`, `ranunculusRosette`, `anemoneFlower` and `daisyFlower`
  used to draw (previously those families only differed by petal *count*
  and *scale*, never silhouette). `petalRing()` places a ring of them with
  `radialAsymmetry()` jitter per petal.
- `eucalyptusSprig`, `oliveBranch`, `laurelSprig`, `sageSprig`, `fernFrond`,
  `leafyBranch` in `generators/botanical.ts` were rewritten on top of the
  growth engine. `wildflowerSprig` keeps its own hand-built head/bud logic
  but now derives its main stem and leaf angles from `generateStem`/
  `tangentToUpAngleDeg` too.
- `bellFlower` — new flower family: a raceme of small drooping bell shapes
  (foxglove/campanula style) alternating along a growth-engine stem, each
  connected by a short pedicel stroke. The bell anchor is offset along the
  stem's local *normal* (not a fixed x-shift), so it stays correctly
  offset to the side even where the stem curves, instead of sitting on top
  of the stem and reading as one blob (an early version did exactly that —
  caught the same way, via rendered PNGs, not tests).
- SVG grouping: every motif touched this round emits
  `<g data-part="stem">` / `data-part="leaves"` / `data-part="petals-outer"`
  / `data-part="petals-inner"` / `data-part="center"` sub-groups instead of
  one flat `<g>` — select/recolor one anatomical part at a time in
  Affinity Designer without ungrouping everything first.
- `BOTANICAL_VARIANTS` is exported from `generators/botanical.ts`
  specifically so tests/tooling can exercise every named variant directly
  rather than relying on random seeds happening to hit all 21 of them.

**Not done this round** (descoped, see USER_GUIDE.md v1.25 changelog for
the full list): a formal typed Motif Anatomy data model, a Motif Family
Generator UI (hero/secondary/filler/accent regenerate/save/load), a
separate Motif Quality Analyzer panel, the 8 named Shape Language controls,
and a debug-overlay mode.

## Realistic leaf shapes (Botanical generator)

`generators/botanical.ts` builds leaf silhouettes from two shape
functions instead of a single symmetric almond: `ovateLeafPath` (pointed
tip, widest below center, tapered rounded base — four cubic segments) and
`serratedLeafPath` (samples the same envelope but alternates each
boundary point in/out for a toothed edge, connected with plain `L`
segments). `leafNode()` picks between them per motif and pairs either
with `pinnateVeins()` — one midrib plus branching side-vein pairs, all
solid pre-blended strokes via `blendHex` (no SVG opacity, so it stays
EPS-safe). `mapleLeaf` and `heartLeaf` are standalone variants built the
same way: a 5-lobed palmate silhouette with veins radiating from the
base, and a cordate (heart) silhouette with a midrib + two vein pairs.
`computeBoundingRadius`'s path-command walk covers all of these
automatically, so no manual radius tuning was needed.

## Nested paisley echoes & ikat fringe (Paisley & Ikat generator)

`generators/paisley.ts` adds one shared helper, `edgeFringe(points, close,
color, count, len, width)`: for each edge of a point list (closed for a
polygon, open for a polyline) it computes the outward normal — the edge's
perpendicular, sign-corrected by checking which side points away from the
origin (every motif here is centered on it) — and draws `count` short
radial `<line>` ticks along that edge. This is the frayed-thread fringe
real ikat weaving leaves at a color-band boundary; applied to only the
outermost layer of `ikatDiamond`/`ikatChevron`, it reads as woven rather
than printed. Both variants also jitter each vertex independently now
(previously one shared offset moved the whole shape), for a hand-dyed,
non-mechanical edge.

`paisleyTeardrop`/`paisleySwirl` re-stroke their own `paisleyPath()`
outline at 0.5-0.74 scale as a `fill: none` echo line inside the main
body — the concentric "paisley within paisley" contour every real boteh
print carries, free from any extra geometry. `paisleyTeardrop` also nests
a small filled copy of the same path near the head as a miniature paisley-
in-paisley curl. The echo color is `blendHex(colors[0], 0.4, body)` —
blended toward the *background*, not toward the motif's own `detail`
accent — because `detail` is picked independently from `body` and can
land on a visually identical accent, which made the echo invisible against
the fill in testing until this fix (confirmed via a zoomed-in render before
and after).

## Ornate lace mandalas (Mandala generator)

`generators/mandala.ts` adds two shared helpers used across all 4 variants:
- `scallopRingPath(bumpCount, baseR, amp)` — samples a circle with radius
  modulated by `baseR + amp * sin(theta * bumpCount)` densely (72+ points)
  and joins them with `smoothClosedPath` (the same Catmull-Rom helper the
  Botanical/Tropical generators use for organic outlines). Rendered with
  `fill: 'none'` as a thin stroke, it gives the fine wavy lace trim real
  mandala art uses between petal tiers instead of a plain circle.
- `spokeTicks(count, r0, r1, color, width)` — a ring of short radial line
  segments, for the fine tick marks that fill the gap between a dot ring
  and a border ring instead of leaving it empty.

`petal()` gained an optional `vein` parameter: when passed, it returns a
`<g>` with the filled petal plus a single centerline stroke (the crease
real flower petals have) instead of a flat silhouette.

`lotusRing` changed the most: previously one full petal ring plus one
95%-transparent half-offset ring, it's now a proper **three-tier layered
lotus** — large outer petals (with vein) → scalloped ring → medium petals
at a half-fold offset (with vein) → a `fold * 2` ring of small inner
petals → core. `petalRosette`, `dotMedallion` and `sunMandala` each gained
a scalloped ring (and `dotMedallion`/`sunMandala` also spoke ticks) between
existing layers to remove the empty space that read as unfinished.

### SVG node-count optimization (Project Phoenix — Quality First milestone)

`engine/svgStructuralAudit.test.ts` (see Testing below) surfaced a real,
reproducible finding: `mandala` is the heaviest per-motif generator in the
app (~76 nodes/motif on average) — running it through the `radial` layout's
own placement math (13 sub-motifs per medallion cell: 2 rings x
`radialSymmetry`-fold + 1 center) at default density produced 36,340 total
nodes, 4.5x over the Candidate Engine's `HARD_NODE_BUDGET=8000`. Traced the
weight to `mandala.ts`'s `ring()` helper: every single-point child (a dot,
a spoke tick, a ray triangle) was wrapped in its own
`<g transform="rotate(...)">`, doubling that child's node cost for no
visual reason — rotating one point (or a small fixed set of points) around
the origin is arithmetic, not something that needs an SVG transform.

Added three helpers that bake each ring item's rotation directly into its
own coordinates instead:
- `circleRing(count, offsetDeg, radius, attrs)` — `cx/cy` computed via
  `(radius * sin(angle), -radius * cos(angle))` per item, no wrapping `<g>`.
- `polygonRing(count, offsetDeg, points, attrs)` — rotates every local
  point of a small fixed shape (e.g. a sun-ray triangle) the same way.
- `spokeTicks` rewritten to compute each tick's rotated endpoints directly
  instead of routing through `ring()`.
- `ring()` itself also got smarter for its remaining callers (petal rings,
  which still need per-item `<g>`s since paths carry real curve geometry
  that can't be trivially re-pointed): when a ring item is already a plain
  `<g>` with no transform of its own (a veined petal's `<g>{path,
  veinPath}}`), the rotation is merged directly into that existing `<g>`
  instead of adding a second wrapping one.

Every replacement was verified **mathematically identical** to the
`<g transform="rotate(...)">` approach it replaced — `engine/svgAst.ts`'s
own `parseTransform`/`applyMat` were used to compute what the old approach
would have produced for a spread of radii and angles, and compared against
the new baked coordinates (`toBeCloseTo` within rounding) — not just
eyeballed. Also verified visually via a live Playwright render of
`mandala` + `radial` at default settings: identical composition, same
density and richness, zero regression.

Net effect: mandala's average per-motif node count dropped from ~76 to
~47.5 (~38%), with pixel-identical output. `mandala + radial` at default
density dropped from 36,340 to ~25,700 nodes — a real, measured
improvement, but **still over the 8000 hard-reject budget** by a wide
margin. The remaining gap is architectural, not an SVG-optimization
problem: `radial`'s own 13-motifs-per-medallion placement math (used by
every category, not just mandala) is what actually explains the node
count at this layout — closing it the rest of the way means either
reducing that placement count for detail-heavy generators specifically, or
giving `spacingForDensity` a per-generator complexity factor, both real
composition/architecture decisions intentionally left as a recommendation
rather than decided unilaterally in this pass (see `svgStructuralAudit
.test.ts`'s node-budget-headroom suite, which tracks the current numbers
as a loud `console.warn` plus a generous sanity ceiling that would catch a
true regression).

## Realistic animal markings (Animal Print generator)

`generators/animalprint.ts` adds a `taperedBlotchPath(rng, spine, widthFn,
samples, edgeJitter)` helper: it samples a spine curve, offsets each sample
perpendicular to the local tangent (finite-difference estimate) by a width
envelope, and closes the two offset rails into one path. `widthFn(t)` is
typically `maxWidth * sin(PI * t) ** power` so the shape pinches to a point
at both ends — `power` around 0.5 gives zebra's rounder taper, ~1.3 gives
tiger's sharper one. `edgeJitter` perturbs each rail sample independently
for a slightly ragged, fur-like edge instead of a perfectly smooth offset.

- `leopardRosette` — the ring is 5-7 `taperedBlotchPath` segments placed
  **tangentially** around a circle: for each segment's angle `theta`, the
  tangent unit vector `(-sin theta, cos theta)` is the spine's long axis and
  the radial unit vector is the bulge direction, all computed directly in
  absolute coordinates (no nested `rotate`/`translate` transforms — an
  earlier attempt composed three chained transforms to align each segment
  and got the axis wrong, so segments pointed radially outward and rendered
  as flower petals instead of a ring; confirmed via rendered screenshot
  before the fix). A segment is skipped at random for the broken-ring look
  real rosettes have. Dark inner blotches keep the original
  `irregularBlob` + `smoothClosedPath` approach.
- `zebraStripe` / `tigerStripe` — spine is a sine-wave curve
  (`sin(t * PI * cycles)`), rendered via `taperedBlotchPath` instead of a
  constant-width `stroke` with round caps, so both taper to points instead
  of ending in a rounded blob.
- `giraffePatch` — switched from `smoothClosedPath` (Catmull-Rom curves) to
  a new `polygonPath()` that joins the same jittered radial points with
  plain `L` segments — real reticulated giraffe markings are angular
  "cracked mud" cells, not soft blobs.
- `cowPatch` — 50% chance of a second, smaller `irregularBlob` overlapping
  the main one, for the asymmetric clustered look of real Holstein patches.

## Realistic tropical shapes (Tropical generator)

`generators/tropical.ts` has 5 variants, all rewritten for organic shape
realism:
- `palmFrond` (fan palm) — unchanged blade fan, now with a center crease
  stroke per blade for visual depth.
- `pinnateFrond` (feather/coconut palm, new) — a curved rachis built from a
  single quadratic-bezier path; leaflets are placed by evaluating that same
  quadratic at each `t` (so leaflet position always matches the rachis
  curve), with length and droop angle both increasing toward the tip.
- `monsteraLeaf` / `monsteraOutline` — samples 36 points per side (not 4-5)
  and combines two sine frequencies: a low-frequency `envelope =
  sin(PI * t)` for the overall leaf silhouette and a higher-frequency
  `ripple` term for the wavy/scalloped margin. Points are joined with plain
  `L` segments — dense sampling reads as smooth curves without needing
  curve math per segment. (An earlier attempt used ~4 point Q-curves plus a
  string-reversal mirror hack and rendered as a hexagon/kite, not a leaf —
  confirmed visually via rendered screenshot before the rewrite.)
  Fenestration holes vary in size/position per hole instead of a fixed
  grid. Venation uses the shared `pinnateVeins()` helper.
- `hibiscusBloom` — paddle-shaped petals (`hibiscusPetalPath`) plus a long
  curved stamen column with a 5-dot anther cluster at the tip, replacing a
  short center line.
- `citrusSlice` — added a pith ring layer between rind and flesh, and
  alternating-tone wedge segments (SVG arc paths) for texture instead of a
  flat circle with only radial divider lines.

`pinnateVeins()` moved out of `botanical.ts` into `generators/shared.ts` so
both leaf-bearing generators share one venation implementation.

## Visual Hierarchy Engine (`engine/hierarchy.ts`)

`applyHierarchy(placements, hierarchy, rng)` is a **layout-agnostic
post-process pass**: given the `Placement[]` array any layout already
produced, it deterministically assigns each one a `role`
(`hero`/`secondary`/`filler`/`accent`) from the seeded rng according to
`HierarchyParams`'s four ratios (normalized to sum to 1 regardless of what
the caller passes in), then multiplies that placement's existing `scale`
by the role's own scale multiplier — composing with whatever scale
variation the layout itself already produced rather than replacing it.

`tile.ts` calls this once, right after `layout.generate()`, only when
`params.hierarchy` is set — undefined is a complete no-op, so every
pattern saved before this existed reproduces pixel-identically. It's also
skipped for `HIERARCHY_EXEMPT_LAYOUTS` (`bouquet`, `densePremium`,
`heroFlow`, `heroScatter`) since those already build their own explicit
hero/secondary/filler tiers internally; applying this pass on top would
multiply an already-large hero motif by `heroScale` a second time.

The resolved role is written back onto the exported SVG as a `data-role`
attribute on each `motif-N` group (Affinity Designer shows unknown
`data-*` attributes as harmless metadata, so this is safe to open there).

`HIERARCHY_PRESETS` ships 7 named bundles (Hero Focus, Balanced Editorial,
Dense Layered, Airy Premium, Ditsy Floral, All-over Textile, Minimal
Repeat) — `defaultParams()` uses Balanced Editorial for every new pattern.

## Negative Space & Overlap

`params.negativeSpace` and `params.overlapAmount` (both `0..1`, both
default `0`) nudge the **`density` value fed into `layout.generate()`** in
opposite directions — `effectiveDensity = clamp(density + (overlapAmount -
negativeSpace) * 0.4, 0, 1)` — rather than reaching into each of the 14
layout files' own spacing math individually. Every layout already reads
`params.density` to compute its own spacing/point-count, so this is a
single, layout-agnostic lever. Both default to 0, so `effectiveDensity ===
density` exactly when neither is set — zero behavior change for every
pattern saved before these controls existed.

## Quality Score (`engine/qualityScore.ts`)

`computeQualityScore(tileData)` is a deterministic heuristic scorer — no
machine learning, no external calls — computed by regex-parsing each
`motif-N` group's `translate(x y) rotate(deg) scale(s)` transform back out
of the already-generated SVG tree (the "primary" instance among a motif's
up-to-9 wrap-clone copies is the one whose center falls inside the tile).
From those `{x, y, rot, scale}` tuples it derives:

- **Spacing** — coefficient of variation of periodic nearest-neighbor
  distance (lower CV = more evenly spaced).
- **Composition** — combines coarse 8×8-grid *coverage* (catches
  accidental big empty holes) with *crowding* (average instances per
  touched cell — coverage alone saturates near 100% for almost any
  grid/scatter layout past a couple dozen motifs, since those layouts span
  the whole tile by construction regardless of density; crowding is what
  actually distinguishes "100 motifs" from "400 motifs" at the same
  coverage). Peaks in a lively-but-not-cluttered middle band.
- **Hierarchy** — coefficient of variation of motif *scale* directly (not
  `data-role` presence) — a layout-agnostic measure that works whether the
  size tiers came from the Hierarchy Engine or from a layout's own
  internal tiering (bouquet, densePremium, ...).
- **Color balance** — structural proxy from resolved accent count +
  whether Color Story is on.
- **Seamless integrity** — always 100: the wrap-clone (9×) plus
  `computeBoundingRadius` safety net in `tile.ts` guarantees this
  structurally for every tile this engine produces, so it isn't
  re-derived from geometry.
- **Motif diversity** — how many of 12 rotation buckets (30° each) are
  actually used.

`QualityPanel.tsx` renders these six sub-scores plus a weighted overall
(0-100) under the preview. This is explicitly **not** a copyright/
originality checker and doesn't claim to predict real stock-site review
outcomes — it's a same-engine, same-metric way to compare two generated
patterns against each other.

## Art Direction presets (`engine/artDirection.ts`)

`ART_DIRECTION_PRESETS` is a lookup table of 15 named bundles (Editorial
Botanical, Luxury Floral, Airy Scandinavian, ...), each mapping to **only
real, already-implemented `GenerateParams` fields** — category, layout,
optionally a palette, a `HIERARCHY_PRESETS` key, negative space, overlap,
color story, and filler style. `resolveArtDirection(id)` turns one into a
`Partial<GenerateParams>` patch. No preset introduces a control that
doesn't map to something the engine actually reads.

## Composition Candidate Engine & Scoring Engine (`engine/candidateEngine.ts`, `engine/scoring.ts`, `engine/svgGeometry.ts`)

Design Intelligence Milestone 1: replaces "generate once -> render" with
"generate a candidate pool -> score from real geometry -> reject invalid ->
rank -> render the winner" for the new **Generate Best** button. The plain
single-shot `buildTile` path (Generate / Generate 9 Variations) is
untouched — this is an additive, opt-in pipeline.

- `engine/svgGeometry.ts` — `extractInstances(tileData)` parses motif
  position/rotation/scale (and `data-role` when the Hierarchy Engine set
  one) back out of the actual generated SVG's `translate/rotate/scale`
  transforms. `periodicDist` and `gridCoverage` are the shared spatial
  primitives every metric below builds on. This code previously lived only
  inside `qualityScore.ts`; it's factored out here so the new, much wider
  scoring engine doesn't duplicate it — `qualityScore.ts` now imports from
  here too, with zero change to its own six-number output (verified by the
  existing `qualityScore.test.ts` still passing unchanged).
- `engine/scoring.ts` — `computeMetrics(tileData)` returns 24 metrics
  (composition, spacing, quadrant/horizontal/vertical balance, visual
  center offset, occupancy ratio, density variance, **largest empty
  region**, hierarchy, scale/rotation diversity, color balance, palette
  contrast — real relative-luminance range across the actual palette
  colors, not a placeholder — overlap quality, **hero separation**, edge
  density, adjacency repetition, seamless integrity, SVG technical
  health, **flow coherence**, **rhythm regularity**, **motif shape
  diversity**, **corner continuity**), each 0-100 and derived purely from
  `extractInstances`/`tileData.colors`/the serialized SVG string.
  `findNearest` computes the nearest-neighbor distance/instance for every
  motif *once* per `computeMetrics` call and is shared by spacing, overlap
  quality, adjacency repetition and hero separation (previously each of
  those ran its own duplicate O(n^2) pass).
  - **SVG Intelligence Engine Phase 3** (real, non-proxy geometry — the
    previous versions of these four were documented averages of
    *unrelated* metrics, not actual measurements): `flowCoherence` walks a
    greedy nearest-neighbor chain through every motif instance and
    averages the cosine similarity of consecutive direction vectors — a
    pattern whose motifs read as flowing in a consistent direction scores
    high, a scattered cloud scores low. `rhythmRegularity` bins the
    nearest-neighbor spacing distances into a histogram and scores by
    Shannon-entropy peakiness — evenly-spaced motifs produce a tight
    histogram (high score), chaotic spacing spreads flat (low score).
    `motifShapeDiversity` builds a rotation/scale/position/color-invariant
    "shape signature" per motif (its path command-letter sequence, or a
    recursive signature for `<g>` groups) and scores the Shannon entropy
    of the signature distribution — this is the first metric that can
    tell "the same shape spun around" from "a genuinely different shape",
    which `scaleDiversity`/`rotationDiversity` alone cannot. `cornerContinuity`
    compares motif density in the four tile-corner regions (where the
    seamless wrap-clone creates a compositional seam) against the tile's
    overall average density. All four are wired into
    `QUALITY_PRESET_WEIGHTS` for every preset and into two new
    `SOFT_PENALTY_RULES` (`cornerDeadZone`, `repetitiveMotifShapes`).
  - `largestEmptyRegion` — a periodic (tile-wrap-aware) flood fill over the
    coarse occupancy grid finds the single largest contiguous empty
    region; only penalizes once it gets large relative to the tile (some
    negative space is desirable). Grid-based layouts saturate this near
    100 at almost any density (motifs are distributed across the whole
    tile by construction) — a real difference only shows up with a
    scatter-style layout at low density and a large motif size, which the
    test suite uses deliberately.
  - `heroSeparation` — compares the mean nearest-neighbor distance among
    hero-role instances against the pattern's overall typical spacing;
    neutral (100) when there are 0-1 hero instances.
  - `computeOverallScore(metrics, presetId)` weights the metrics per
    `QUALITY_PRESET_WEIGHTS` (`stockClean` / `textilePremium` /
    `editorialBotanical` / `denseLuxury`), then applies
    `applySoftPenalties` — named, fixed-point-deduction rules
    (`SOFT_PENALTY_RULES`: severe quadrant imbalance, a large empty hole,
    hero clustering, adjacent-motif repetition, edge imbalance, muddy
    palette contrast) distinct from the ordinary weighted average. A
    candidate can trigger any number of these and still not be hard-
    rejected — soft penalties reduce rank, they never remove a candidate
    from consideration.
  - **Known limitation**: `adjacencyRepetition` approximates "does the same
    motif keep sitting next to itself" using the rotation-bucket + role
    signals actually available on a `Placement` — `Placement` doesn't
    track which internal shape *variant* a generator drew (e.g. which of
    Botanical's 21 variants), so this can't detect literal shape
    repetition, only a rotation/role proxy. Documented in the source
    rather than silently overclaiming.
- `engine/candidateEngine.ts` — `deriveSeed(baseSeed, purpose, index)`
  produces deterministic sub-seeds (`${baseSeed}::${purpose}::${index}`,
  hashed the same way any seed string is via `createRng`'s cyrb53 hash) —
  no `Math.random` anywhere in this pipeline, so seed + settings + mode +
  quality preset always produces the same candidate pool and therefore the
  same winner. `generateCandidates`/`pickBestCandidate` are synchronous
  (used by tests); `generateCandidatesChunked` is the async, cancellable,
  one-candidate-per-macrotask version the UI actually uses, since a heavy
  category/layout/density combination (Botanical + Dense Premium at high
  density can place 800+ motifs, each running the growth engine's arc
  sampling) measured ~0.5-1.5s *per candidate* — synchronous generation of
  a 12-candidate Premium pool would otherwise freeze the tab for several
  seconds. Hard-reject rules run per candidate: empty pattern, NaN/Infinity
  coordinates, a raster `<image>` element, an external resource reference,
  duplicate motif ids, node count over an 8000-node safety budget — all
  checked against the actual serialized SVG, not guessed. A final
  pool-wide pass (`rejectExactDuplicates`) additionally hard-rejects any
  candidate whose *rendered SVG string* is byte-identical to an earlier,
  still-valid one in the same pool.
  - **Bug caught and fixed during this work**: an earlier version compared
    candidates' aggregate `CompositionMetrics` (a coarse RMS distance)
    instead of rendered output to detect duplicates. That produced false
    positives — candidates drawn from the same base settings naturally
    score similarly (consistent settings -> consistent scores), which
    isn't duplication at all; it hard-rejected 3 of 4 candidates from a
    perfectly normal default-params pool. Caught by the existing
    regression test, fixed by switching to exact rendered-SVG comparison
    (zero false-positive risk since it only matches truly identical
    output), and a new regression test (`never hard-rejects a small pool
    of visually distinct real candidates as false-positive duplicates`)
    guards against reintroducing it.
- `engine/designModel.ts` — the Shared Design Model utilities beyond
  `GenerateParams` itself: `cloneParams` (a safe, field-by-field deep
  clone — not a JSON round-trip, which would silently drop `undefined`
  optional fields), `hashParams` (a deterministic settings hash via
  canonical, sorted-key JSON serialization — key insertion order and
  explicit-`undefined`-vs-absent keys never change the hash, both
  verified by tests), and `normalizeParams` (defensive numeric clamping
  for every field — protects paths that bypass the UI's own range-input
  validation, like a hand-edited JSON import, against NaN/negative/absurd
  values).
- UI: `ControlPanel.tsx` adds a Quality Mode (Fast=4/Standard=8/Premium=12)
  and Quality Preset selector, the **Generate Best** button (shows
  "กำลังสร้าง candidate n/N…" with a Cancel button while running), and a
  dedicated **🏆 Generate Best of 12** shortcut that always runs the
  12-candidate pool regardless of the mode dropdown's current selection;
  `QualityPanel.tsx` shows a one-line summary ("selected from N candidates,
  M passed") when the currently-shown tile came from Generate Best,
  explicitly distinguishing its preset-weighted score from the unrelated,
  unchanged six-metric Quality Score below it (the two are intentionally
  different scoring systems measuring different things, not a bug).

**Not done this round** (Milestones 2-6 of the full Design Intelligence
Engine spec, explicitly out of scope per this round's instructions — Visual
Weight Solver, Flow/Rhythm Engines, real Cluster objects, Asset DNA, Shape
Grammar, Motif Family Generator, Pattern Evolution, Auto Improve, SVG
Beautifier, Designer Assistant, category-specific scoring — see
`docs/USER_GUIDE.md`'s v1.28 changelog for the full list).

## SVG Optimizer (`engine/svgOptimizer.ts`)

SVG Intelligence Engine Phase 3. Runs automatically on every real download —
`export/svgExporter.ts`'s `buildSingleTileSvg` and `buildTiledSvg` both call
`optimizeSvgTree` before serializing (once per tile, before the 3×3 cloning
loop, not 9 times redundantly). It performs two lossless structural
cleanups, nothing else:

- **Collapses redundant `<g>` wrappers**: a `<g>` whose *only* attribute is
  `transform`, wrapping exactly one `<g>` child, is collapsed into that
  child — but only when the outer `<g>` has no `id`/`data-role`/`clip-path`
  of its own, so `motif-N` and `layer-*` identity (what Affinity Designer's
  layers panel and this app's own geometry parsing rely on) is never
  touched. Transforms are combined by **string concatenation**
  (`"translate(1 0) rotate(5)"`), not matrix reconstruction — SVG 1.1 §7.6
  defines a `transform` attribute's function list as exactly equivalent to
  nesting two elements with one function each, so concatenation is lossless
  by spec, and it also means the optimizer's output stays parseable by
  `svgGeometry.ts`'s own regex-based transform extraction (a matrix-
  reconstructed `matrix(...)` string would not have been).
- **Strips identity transforms**: any `transform` attribute that resolves
  to the identity matrix (e.g. a leftover `translate(0 0)`) is removed.

Both passes only touch `<g>`/attribute structure — path `d` geometry,
colors, and node ordering are never modified, and precision was already
rounded once at generation time (`svgAst.ts`'s `round()`), so there is no
re-rounding to do. Measured on real generated tiles across the app's
categories, the optimizer's node-count reduction ranges roughly 2-17%
depending on how deeply layouts nest their placement groups, averaging
around 5-6%. `optimizeSvgTree(root)` returns both the optimized tree and an
`OptimizationReport` (`nodesBefore`/`nodesAfter`/`nodesRemoved`/
`reductionPercent`/`groupsCollapsed`/`transformsStripped`) for callers that
want the numbers, not just the smaller tree.

**Not wired in yet**: the core `buildTile()` pipeline itself (left
untouched — dozens of existing tests assert its exact output structure,
and preview must stay pixel-identical to what a subsequent optimized export
produces) and Collection Studio's asset SVGs (`collection/
collectionGenerator.ts` serializes its own asset SVGs on a separate path
that doesn't currently route through the exporter — a Phase 4 item, not a
regression, since Collection assets didn't go through any optimizer before
this phase either).

## Cluster Composition Engine — Project Phoenix V2 (`engine/clusterEngine.ts`, `engine/heroComplexity.ts`, extends `layouts/scatter.ts` + `layouts/toss.ts` + `layouts/bouquet.ts` + `engine/scoring.ts`)

Replaces "scatter individual motifs independently" — literally true of
`scatter.ts`'s pre-Phoenix implementation, and a gap `engine/styleDna.ts`'s
own module comment already named ("the roadmap's Cluster Engine... [does]
not exist yet") — with a real Cluster Composition Engine. Full
architecture, all 8 named archetypes, the Hero Motif Complexity detail
overlay, and the 12-penalty Quality Inspector are documented in
[`CLUSTER_COMPOSITION_ENGINE.md`](./CLUSTER_COMPOSITION_ENGINE.md);
summary:

- **`engine/clusterEngine.ts`** — `generateCluster` builds one hero +
  an archetype-shaped ring of secondary/filler/accent members (Bouquet,
  Radial, Cascade, Editorial, Organic Scatter, S-Curve, Diagonal,
  Asymmetric), with ~30% of members deliberately pulled into a real
  overlap band and both angle and radius jittered so spacing is never
  equal. `evaluateCluster` scores real cohesion (isolation + mechanical-
  uniformity penalties); `buildClusterPlacements` retries a cluster up to
  3 times against that score before accepting the best attempt. `scatter.ts`
  and `toss.ts` now route through it (same `PatternLayout` id/label/
  interface — no UI change); `bouquet.ts` was unified onto the same shared
  engine instead of keeping its own bespoke duplicate.
- **`engine/heroComplexity.ts`** — a generator-agnostic detail overlay
  (inner ring, texture lines, nested contour) applied universally from one
  integration point in `tile.ts`, scaled by hierarchy role (hero 100%,
  secondary 55%, filler/accent 0%) — real, measurable extra node geometry
  on hero motifs, tuned to stay within the Candidate Engine's node budget
  even for the heaviest layout/category combinations.
- **Bug fix**: `heroFlow`/`heroScatter`/`densePremium`/`bouquet` build
  their own hero/secondary/filler tiers internally but never wrote
  `Placement.role` onto the result — every hero those layouts produced was
  silently untagged in the exported SVG. Fixed for all four.
- **`engine/scoring.ts`** gained 5 new real metrics (`heroDetailRatio`,
  `isolationScore`, `clusterCohesion`, `gridAppearanceScore`,
  `spacingUniformity`) and the brief's 12 named `SOFT_PENALTY_RULES` at
  their exact point values (Zero Motif Overlap -20, Hero Insufficient
  Detail -15, Equal Spacing Detected -15, Too Many Isolated Objects -10,
  Weak Hierarchy -15, Low Cluster Cohesion -15, Repeated Motif Orientation
  -10, Grid Appearance -20, Visual Dead Zones -10, Monotonous Scale -10,
  Low Motif Diversity -10, Mechanical Composition -20).

## Trend Intelligence Engine (`engine/trendEngine.ts`, `engine/colorAnalysis.ts`)

Roadmap "Version 60". A rule-based, curated set of named surface-design
style profiles — explicitly **not** real-time trend scraping (this is a
static GitHub Pages site with no backend/API and no AI API calls, per the
project's hard constraints). Architecturally identical to
`engine/artDirection.ts`'s preset system (`TREND_PRESETS` bundles real,
already-implemented `GenerateParams` fields — category/layout/palette/
hierarchy preset/negative space/overlap/density/color story/filler —
`resolveTrend(id)` turns one into a patch), but adds a capability Art
Direction doesn't have: **Trend Fit scoring**.

- `engine/colorAnalysis.ts` — `hexToHsl`, and `meanHue`/`circularHueDistance`
  for hue statistics that wrap correctly at the 0/360 seam (a plain
  arithmetic mean of e.g. 350° and 10° would wrongly give 180°/green
  instead of 0°/red). `colorSetStats(colors)` returns the circular mean hue
  plus mean saturation/lightness across a resolved palette's accent colors
  (excluding the background).
- `engine/trendEngine.ts` — each `TrendPreset` carries both its resolved
  settings *and* a `TrendSignature` (declared hue/saturation/lightness/
  density/overlap reference ranges). `computeTrendFit(tileData, trendId)`
  measures the tile's *actual* generated colors and params against that
  signature and returns 5 sub-scores + an overall 0-100 — real numbers
  from real geometry/color data, not a static label. Right after applying
  a trend preset (before any hand-editing) density/overlap fit read 100
  by construction, since the preset's own density/overlap values are
  defined to sit inside its own declared range; hand-editing the palette
  or density afterward changes the fit score for real.
  - 6 presets: `quietLuxury`, `y2kRevival`, `coastalCalm`,
    `darkAcademiaBotanical`, `softMaximalism`, `cleanScandiMinimal`.
- UI: a new "📈 Trend Intelligence" chip row in `ControlPanel.tsx` (same
  pattern as Art Direction's chip row) and `TrendPanel.tsx`, rendered only
  when `params.trend` is set, showing the 5 sub-scores with an explicit
  disclaimer that this is an internal heuristic comparison, not real trend
  data or a market-popularity guarantee.
- `GenerateParams.trend?: string` is a new optional field (undefined for
  every pre-existing saved pattern — fully backward compatible) and is
  independent of `artDirection`: applying one doesn't clear the other.

## Composition Intelligence Engine (`engine/compositionIntelligence.ts`)

Roadmap "Phase 2". Where the Design Intelligence Engine (Phase 1 —
`candidateEngine.ts`/`scoring.ts`) only *measures* composition quality after
a tile is fully built, this is a pass that *acts* on the raw `Placement[]`
list the layout + `applyHierarchy` stages already produced — after role
assignment, before the placements become SVG groups — and corrects it with
two deterministic, geometry-only refinements. No rng consumption, so it
never affects seed determinism upstream or downstream.

- **Balance correction**: bins placements into the same 2x2 quadrant scheme
  `scoring.ts`'s `quadrantBalance` metric uses, weighted by
  `scale^2 * roleWeight` (a hero motif reads as visually heavier than its
  raw area alone suggests — a documented perceptual bump, not a hardcoded
  score). Only fires when the imbalance is severe (mild unevenness reads as
  designed, not machine-stamped); moves a bounded number (≤15% of
  placements) of the *lightest* placements out of the heaviest quadrant,
  lightest-first so a quadrant's own hero/anchor motif is never disturbed.
  - **Bug caught during development**: the first version blended each
    selected placement a fixed 40% of the way toward the target quadrant's
    *center point*. For a placement that started far from the tile's
    mid-line, a 40% blend could land it short of the mid-line — still in
    the original quadrant, with the imbalance score completely unchanged.
    Caught by the `reduces quadrant-weight imbalance...` test failing
    (`expected 10 to be less than 10`). Fixed by reflecting the placement's
    coordinate across whichever mid-line separates the source and target
    quadrant (`reflectIntoQuadrant`), then blending **more than 50%** of the
    way there — a mathematical guarantee that any move which fires actually
    crosses into the target quadrant, since the exact 50% point is the
    mid-line itself.
- **Rhythm smoothing**: computes each placement's nearest-neighbor distance
  using the same wrap-aware `periodicDist` the Scoring Engine uses for
  `spacing`/`adjacencyRepetition`, then pulls placements whose distance is a
  statistical outlier (`> mean + 1.25 * stdev`) a bounded fraction toward
  their nearest neighbor along the shortest periodic vector
  (`shortestOffset`, a `periodicDist` variant that returns the offset
  instead of just its length).
- `CompositionIntelligenceParams { balanceStrength, rhythmStrength }`, both
  0..1; `applyCompositionIntelligence(placements, tileSize, params?)` is the
  orchestrator — undefined `params` is a strict no-op returning the exact
  same array reference, matching the `hierarchy`/`negativeSpace` backward-
  compatibility precedent: any saved pattern from before this field existed
  reproduces identically.
- `GenerateParams.compositionIntelligence?: CompositionIntelligenceParams`
  is on by default for new patterns (`defaultParams()`), same rationale as
  `hierarchy`. `designModel.ts`'s `cloneParams`/`normalizeParams` were
  extended to deep-clone and clamp this new nested field.
- UI: new "🧭 Composition Intelligence" checkbox + Balance/Rhythm strength
  sliders in `ControlPanel.tsx`, same accordion pattern as Visual Hierarchy.
- Verified with a real before/after comparison (not just unit tests): the
  same seed/layout/density with the feature off vs. on moved the
  `quadrantBalance` score from 71 to 98/100 in a constructed scatter-layout
  scenario — screenshots and metrics captured during development.

## Style DNA Engine (`engine/styleDna.ts`, `storage/styleDnaStore.ts`, `components/StyleDnaPanel.tsx`)

Turns "category + layout + palette + density + hierarchy + flow + overlap +
cluster" — a dozen separate manual choices — into one choice: a named design
identity. Same architectural pattern `artDirection.ts`/`trendEngine.ts`
already established (plain structured-data presets, one generic resolver
function, no if-else branching over style names), extended with a much
richer field set and a first-class Manager.

- `StyleDna` interface: `categories`/`layouts`/`paletteIds` (preferred
  lists, first = default), `hierarchyPreset` (references the existing
  `HIERARCHY_PRESETS` table rather than duplicating 8 numbers per style),
  `density`/`negativeSpace`/`overlapMode`+`overlapAmount`, `flowProfile`/
  `rhythmProfile` (feed `rotationJitter` and Composition Intelligence's
  `rhythmStrength`), `clusterStyle`+`clusterDensity` (approximate today via
  Composition Intelligence's `balanceStrength` + `overlapAmount` — see scope
  note below), `motifComplexity` (feeds `scaleJitter`/`rotationJitter`/
  `colorCount`), `botanicalGrowthPreset` (reserved, see scope note),
  `colorStrategy` (feeds `colorStory`/`colorCount`), `backgroundStrategy`
  (feeds `fillerStyle`), `svgDepthMode` (feeds `flatShadow`/`flatHighlight`),
  `exportRecommendation` (`tileSize`/`patternScale`/`recommendedSites` —
  reuses `StockSiteId` from `metadata/shutterstock.ts`).
- **15 built-in presets** (`STYLE_DNA_PRESETS`): editorialBotanical,
  luxuryFloral, scandinavianOrganic, minimalBotanical, vintageHerbarium,
  darkBotanical, modernTropical, boutiquePackaging, luxuryWallpaper,
  premiumTextile, kidsPlayful, retroOrganic, organicAbstract, bohoFloral,
  softWatercolorInspired.
- `resolveStyleDna(dna, seed)`: turns a style into the concrete
  `GenerateParams` patch. When a style lists more than one preferred
  category/layout/palette, which one is picked is derived from
  `createRng('styledna::<id>::<field>::<seed>')` (the same cyrb53-hash
  family every other seed in this engine uses — never `Math.random`), so a
  given seed + style always resolves identically, but a different seed can
  explore other family members.
- `computeStyleDrift(params, dna)`: diffs the current params against a
  fresh `resolveStyleDna` call for the same seed, field by field — powers
  the "differs from style defaults" readout. `resetToStyleDna` re-resolves
  from scratch, discarding hand-edits.
- `deriveStyleDnaFromParams(params, label)` / `duplicateStyleDna(dna, label)`:
  reverse-map the *current* settings into a new custom style ("Create
  Style") via `nearestKeyByValue` — a generic nearest-match lookup over the
  same tables `resolveStyleDna` uses, not a chain of hardcoded numeric-range
  if/else. Intentionally lossy (Style DNA is a higher-level abstraction by
  design, not a pixel-exact snapshot).
- `exportStyleDnaJson`/`importStyleDnaJson`: JSON round-trip with a
  `schemaVersion` (`STYLE_DNA_SCHEMA_VERSION`); import validates required
  fields and calls `isStyleDnaCompatible` (every referenced category/
  palette/hierarchy-preset id must exist in the currently-registered engine
  tables) before accepting, returning `null` (not throwing) for malformed
  or incompatible input.
- **Style DNA Manager** (`components/StyleDnaPanel.tsx` +
  `storage/styleDnaStore.ts`): create/duplicate/rename/delete-custom/
  favorite/export/import, rendered as the first section in
  `ControlPanel.tsx`. Custom styles and favorites persist in `localStorage`
  (not IndexedDB like `storage/savedStore.ts` — a Style DNA is a small
  plain-JSON config object, nowhere near the size of a saved SVG pattern).
- **Candidate Engine integration** (`candidateEngine.ts`'s
  `styleAwareCandidatePatch`): when a *built-in* style is active and the
  user hasn't hand-overridden category/layout/palette away from what the
  style itself resolved, each candidate re-resolves that field from its own
  derived seed instead of reusing one fixed value for the whole pool —
  candidates genuinely explore different family members within the style's
  identity. Any field the user *has* pinned away from the style is left
  completely alone. (Custom styles live in `localStorage` and aren't visible
  to this pure engine module, so this only applies to built-ins today.)
- **Collection Generator integration** (`App.tsx`'s `handleGenerateBatch`,
  the existing "Generate 9 variations" flow): when a style is active, every
  variant re-resolves that *same* style from a fresh random seed instead of
  calling `randomizedParams` (which would randomize category/layout/palette/
  hierarchy/etc. independently per item) — the 9 patterns explore one
  style's family and read as a real collection. No style active = unchanged
  prior behavior.
- **SVG metadata**: `tile.ts` embeds `data-style-dna-id`/`data-style-dna-name`/
  `data-style-dna-version` on the root `tile-content` group when
  `params.styleDnaId` is set (same convention as the existing per-motif
  `data-role` attribute — harmless to Affinity Designer and any SVG viewer).
  The name is looked up from the built-in `STYLE_DNA_PRESETS` table; a
  custom style id not found there falls back to embedding the id itself.
- `GenerateParams.styleDnaId?: string` is a new optional field, undefined
  for every pattern created before Style DNA existed — same round-tripping
  precedent as `artDirection`/`trend`.
- **Scope, agreed with the project owner before starting**: the roadmap's
  Cluster Engine (Phase 3), Pattern Evolution (Phase 6), and a dedicated
  Designer Assistant (Phase 8) don't exist yet, and the project's own rule
  is to never build ahead of the current phase. `clusterStyle`/
  `clusterDensity` are therefore approximated today through real, already-
  implemented levers (Composition Intelligence's `balanceStrength` +
  `overlapAmount`) rather than a true clustering placement algorithm, and
  `botanicalGrowthPreset` is stored/round-tripped as a reserved,
  informational field — wiring it to which botanical shape variant gets
  drawn would require a new hook into `generators/botanical.ts`'s internal
  variant selection that belongs to Phase 4 (Botanical Geometry). Every
  other field maps to a real engine parameter and visibly changes the
  generated SVG (verified directly: `STYLE_DNA_LIST` fixture test asserts
  two different styles produce different serialized SVG for the same seed).

## Collection Studio Engine (`engine/motifFactory.ts`, `engine/borderCornerAssets.ts`, `collection/collectionGenerator.ts`, `collection/collectionScore.ts`, `components/CollectionWorkspace.tsx`)

Turns the app from a single-pattern generator into a commercial collection
studio: one click on "🏭 Generate Collection" turns the current design
concept (params + active Style DNA) into a full 10-asset collection —
5 pattern variants, border + corner assets, 2 motif sheets, a Collection
Preview composite, a PNG preview, per-site metadata + SEO CSVs, and a
Collection Manifest — all zipped together, *and* opens an in-app Collection
Workspace to browse/switch between every asset and see a real Collection
Score without opening the zip. The whole content-generation pipeline is
DOM-free and unit-testable the same way every other engine module is; only
PNG rasterization and the final `buildZip`/download call live in `App.tsx`,
exactly like every other raster export in this app.

v1.33 restructured this in place from what shipped in v1.31 as the
"Professional Asset Factory Engine" (PAF): same underlying idea, renamed/
consolidated to a leaner 10-asset shape (`coordinatePattern` → 
`blenderPattern`; `backgroundElements` + `decorativeIcons` +
`singleMotifLibrary` consolidated into one `decorativeElementsSheet`; new
`collectionPreview` asset), plus the first-ever in-app browsing UI and a
real 5-dimension Collection Score — v1.31 only ever auto-downloaded a zip,
nothing was browsable in-app and there was no scoring beyond a binary
`consistency.consistent` flag. `COLLECTION_SCHEMA_VERSION` bumped 1 → 2
since the asset-type rename is a breaking change to the manifest shape.

### Motif Factory (`engine/motifFactory.ts`)

Every other engine module treats a "motif" as purely ephemeral —
`engine/tile.ts`'s placement loop calls a generator's `createMotif` once
per placement and immediately wraps/discards the result; nothing stores an
individual motif as a standalone object. This module is what's genuinely
new: it calls the exact same `createMotif` functions independently of any
tile placement and keeps the result as a tagged, inspectable `FactoryMotif`:

- `id`, `family` (`familyForCategory(categoryId)` — a plain lookup table,
  not per-motif branching), `role`, `category`, `styleDnaId`, `node`
  (the real SvgNode geometry), `radius`, `bounds` (a real axis-aligned
  bounding box — see below), `anchors` (`base`/`tip`/`center`, derived
  purely from that real bounding box, not hand-authored attachment
  metadata — no such data exists in any generator), `complexity` (0-100,
  `countNodes(node) / COMPLEXITY_NODE_CEILING`, a real structural measure),
  `colorRoles` (hex colors from the resolved palette this specific motif's
  SVG actually references, scanned from its own fill/stroke attributes —
  not just "the full palette"), `tags`.
- `engine/svgAst.ts` gained `computeBoundingBox` alongside the existing
  `computeBoundingRadius` — both now share one `collectWorldPoints` tree
  walk (refactored out to avoid duplicating the per-tag point-extraction
  switch), folded differently (max-distance-from-origin vs. min/max
  axis-aligned box).
- `createFactoryMotif(opts)` takes an explicit `index` (not a module-level
  counter) for its id suffix and `colorSeed` — deliberately, so the exact
  same call always produces the exact same motif regardless of how many
  other motifs were generated earlier in the app's lifetime; a global
  mutable counter would have silently broken the "same seed -> same result"
  guarantee every other engine module upholds.
- `generateMotifSet(params, {count, role, baseSeed, sizeMul})` — the basis
  for every non-tile Collection asset, deterministically derived from
  `baseSeed` via `createRng` (never `Math.random`).
- `buildMotifSheet(motifs, opts)` — lays a motif set out in a simple
  reference grid, transparent background, each motif in its own identified
  group; the shared layout behind Spot Motif Sheet and Decorative Elements
  Sheet (they differ only in which motif set/cell size feeds this one
  function, not in duplicated layout code).

### Border & Corner assets (`engine/borderCornerAssets.ts`)

Genuinely new layout algorithms — no precedent existed anywhere in
`/layouts` (every layout there builds a seamless *square* tile wrapped in
both axes; a border strip only repeats along its running axis, and a
corner unit doesn't repeat at all).

- `buildBorderStrip({edge, length, band, motifs, rng, count})` — evenly
  spaces motifs along the running axis at the band's centerline, wrap-
  cloned only along that one axis (the 1D analogue of `tile.ts`'s 2D
  wrap-and-clip technique) so the strip tiles seamlessly end-to-end.
  `top`/`bottom` run horizontally, `left`/`right` run vertically (axis-
  swapped in the same builder, not a separate rotated copy).
- `buildCornerUnit({corner, band, motifs, rng, count})` — builds one
  cluster of motifs concentrated near the corner point and tapering
  outward (density biased toward the origin via a squared random radius)
  once in "top-left" convention, then mirrors it into whichever corner was
  requested via `scale(-1)` — so all 4 corners are visually consistent with
  each other rather than 4 independently-random clusters, matching how
  real textile/wallpaper border sets mirror one master corner.
- `export/svgExporter.ts` gained `buildSvgDocument(content, width, height, viewBoxWidth?, viewBoxHeight?)`,
  the shared `<svg>`-document wrapper `buildSingleTileSvg` was refactored
  to call — reused by every Collection asset that isn't a `TileData` (border/
  corner/sheets don't have one).

### Collection Generator (`collection/collectionGenerator.ts`)

`generateCollection(baseParams, styleDna?)` orchestrates all of the above
into one `GeneratedCollection` (`{ manifest, assets, motifs, patternParams }`
— `patternParams` is the resolved params behind each of the 5 pattern
assets, kept alongside the manifest so `collectionScore.ts` can score
without re-deriving anything):

- **5 pattern-type assets** — Hero (base params as-is), Secondary (an
  alternate layout — from the active Style DNA's own family if one is set,
  else the next real layout in the registry — plus `denseLayered`
  hierarchy), Blender (`scatter` layout, lower density, more negative
  space, `minimalRepeat` hierarchy — an open coordinate/blender print),
  Mini (half tile size, smaller motifs, higher density — a ditsy-scale
  repeat), Stripe (`layoutId: 'stripe'`, already a real existing layout).
  All 5 are ordinary `buildTile` calls sharing
  `categoryId`/`paletteId`/`styleDnaId`, each with its own deterministic
  seed via `candidateEngine.ts`'s existing `deriveSeed` (reused, not
  reimplemented). ("Coordinate Pattern" was renamed to "Blender Pattern" in
  v1.33 to match the Collection Studio spec's naming — same generation
  logic, no behavior change.)
- **Border (4 edges) + Corner (4 corners)** — built from a shared Motif
  Factory set via `borderCornerAssets.ts`.
- **2 motif sheets** — Spot Motif Sheet (12 hero-role motifs) and
  Decorative Elements Sheet (16 accent-role motifs) — each a
  `generateMotifSet` + `buildMotifSheet` pair. (v1.33 consolidated v1.31's
  three separate sheets — Single Motif Library, Background Elements,
  Decorative Icons — into this one Decorative Elements Sheet, matching the
  Collection Studio spec's leaner 10-asset structure.)
- **Collection Preview** (`buildCollectionPreview`, new in v1.33) — a
  composite grid of scaled-down, non-destructive thumbnails of the other 9
  assets (5 pattern tiles + 1 representative border edge + 1 representative
  corner + both sheets), each namespaced via `export/svgExporter.ts`'s
  `namespaceIds` before being placed in its cell (patterns reuse fixed ids
  like `tile-clip` per `tile.ts`, which would collide once several tiles
  share one document). Deliberately has no embedded SVG `<text>` labels —
  the `SvgNode`/`SvgTag` model has no text-content node type today and
  extending it was judged out of scope for this asset; labels are plain
  HTML in `CollectionWorkspace.tsx` instead, the same way Gallery/other
  panels already label thumbnails outside the SVG itself.
- **Metadata + SEO Package** — 100% reuse of the existing per-site
  metadata builders: `buildSiteMetadata`/`buildSeoTextFile`
  (`metadata/shutterstock.ts`) for the hero pattern, and
  `buildShutterstockCsv`/`buildAdobeStockCsv` (`metadata/csv.ts`) across
  all 5 pattern-type assets (via lightweight `SavedItem`-shaped wrapper
  objects, the same public shape those functions already consume for the
  saved library).
- **Collection Manifest** (`CollectionManifest`, `COLLECTION_SCHEMA_VERSION`,
  bumped 1 → 2 in v1.33 for the asset-type rename/restructure) —
  `collectionId`/`collectionName`/`createdAt`/`styleDnaId`/`seed`/`palette`/
  `motifFamily`, every asset's id/type/label/filename/motifIds, every
  Motif Factory motif's id/family/role/category/complexity/tags, an
  explicit `relationships` list (the flattened asset->motif pairs — only
  border/corner/sheet assets carry real motif relationships; the 5
  pattern-type tiles draw motifs through `tile.ts`'s own inline
  `createMotif` calls, which aren't tracked as `FactoryMotif` objects, so
  they're honestly left with an empty `motifIds` list rather than a fake
  one), and a `consistency` check.
- **`verifyConsistency(patternParams)`** — a lightweight, real, rule-based
  check (exported and directly unit-tested, including the negative path)
  that the 5 pattern-type assets genuinely share one palette, one Style
  DNA, and one category — the same "Designer Assistant must verify
  collection consistency" requirement, scoped the same way Style DNA
  scoped its own not-yet-built-engine dependencies: a real, useful check
  built now, not a placeholder waiting on the still-nonexistent Phase 8
  Designer Assistant engine.
- **`App.tsx`'s `handleGenerateCollection`/`buildAndDownloadCollectionZip`**
  adds the one DOM-dependent step the pure `collection/` module can't do
  itself — rasterizing the hero pattern to a PNG preview via a
  Promise-based `rasterizeSvgToPngBlob` (same `<canvas>` technique as the
  existing JPEG export, just returning a Blob instead of calling
  `downloadBlobFile` directly) — then zips everything with
  `export/zip.ts`'s existing `buildZip` into `svg/patterns/`,
  `svg/border/`, `svg/corner/`, `svg/spot/`, `svg/sheets/`, `svg/preview/`,
  `metadata/`, `preview/`, plus `Collection.json` (renamed from
  `manifest.json` in v1.33) at the root. The zip-building step is now its
  own reusable `useCallback` so `CollectionWorkspace`'s "Export ZIP" button
  can re-trigger it without regenerating the collection.

### Collection Score (`collection/collectionScore.ts`)

`computeCollectionScore(collection)` — 5 dimensions (0-100 each) + an
overall average + a real `issues` list, all computed from the collection's
own already-generated data, no placeholder numbers:

- **Style/Palette/Motif Consistency** — `majorityFraction` (fraction of the
  5 pattern assets' `styleDnaId`/`paletteId`/`categoryId` matching the most
  common value) instead of a binary flag, so e.g. 4/5 patterns agreeing
  scores 80, not 0.
- **Flow Consistency** — same `majorityFraction` technique over
  `[rotationJitter, scaleJitter, mirror, radialSymmetry, overlapAmount]`.
  These flow-governing fields are deliberately inherited unchanged from
  `baseParams` for every pattern asset (only layout/density/hierarchy vary
  per asset type), so a drop below 100 here is a genuine structural signal
  that something accidentally diverged one of these shared identity
  fields — not a fabricated metric.
- **Commercial Readiness** — averages two real fractions: (a) the fraction
  of SVG-based assets that pass `engine/candidateEngine.ts`'s new exported
  `checkSvgStringValidity(svgStr)` (NaN/Infinity, raster `<image>`,
  external href — extracted from `applyHardRejectRules` so Collection Score
  runs the exact same structural checks the Candidate Engine already uses,
  applied to non-`TileData` assets like border/corner/sheet/preview that
  can't run `extractInstances`), and (b) completeness — whether all 10
  `REQUIRED_ASSET_TYPES` are present.
- Directly unit-tested: a clean collection scores 100 on every dimension;
  fully deterministic for the same params; a simulated palette drift is
  genuinely caught and lowers `paletteConsistency` (regression guard); a
  missing required asset type or a corrupted SVG genuinely lowers
  `commercialReadiness`.

### Collection browsing UI — now `components/ProjectPanel.tsx` (v1.34)

v1.33 shipped this browsing/scoring layer as a standalone
`components/CollectionWorkspace.tsx`, holding one ephemeral
`GeneratedCollection` in `App.tsx` state (lost on refresh, nothing else
browsable). v1.34's Project Studio Engine (see its own section below)
folded this exact UI (asset switcher, Collection Score readout, per-asset
download, "Export ZIP") into `ProjectPanel.tsx`'s `CollectionAndAssetBrowser`
sub-component, now reading from a **persisted** `ProjectCollectionEntry`
inside the active Project instead of ephemeral state — same rendering
technique throughout (raw SVG via `dangerouslySetInnerHTML` after stripping
the XML declaration, `<pre>`-formatted JSON for `metadata`/`seoPackage`
assets, `downloadSvgFile`/`downloadBlobFile` reused directly from
`export/svgExporter.ts`), just no longer disappears on refresh or when a
second Collection is generated. `CollectionWorkspace.tsx` was deleted, not
kept alongside it — see the Project Studio Engine section for the full
Playwright verification.

## Commercial Collection Engine — Phase 4 (`collection/colorStory.ts`, `collection/productTargets.ts`, `collection/motifReuse.ts`, `palettes/colorTransform.ts`, `trend/collectionPlan.ts`, extends `collection/collectionGenerator.ts` + `collection/collectionScore.ts`)

Extends the Collection Studio Engine above (unmodified generation
algorithms — this phase adds coordination and planning around it, it does
not rebuild it) with a real Color Story Engine, real Product Targets, two
new coordinated asset types, guaranteed per-asset layout diversity, and a
Design-Spec-driven Collection Planner. Full architecture, algorithms, JSON
schemas, and test coverage in
[`COLLECTION_ENGINE.md`](./COLLECTION_ENGINE.md); summary:

- **Color Story Engine** (`palettes/colorTransform.ts` + `collection/colorStory.ts`)
  — `buildColorStory(colors)` derives all 10 named variants (Original/
  Light/Dark/Spring/Summer/Autumn/Winter/Monochrome/Muted/Bold) from one
  base color set via real HSL math (hue rotation + saturation/lightness
  adjustment per variant, standard "4-season color analysis" convention),
  never a re-roll — every variant keeps the same color count and
  background/accent ordering as the input.
- **Product Targets** (`collection/productTargets.ts`) — `evaluateProductTargets`
  scores all 10 named product uses (Wallpaper/Fabric/Wrapping Paper/Gift
  Wrap/Packaging/Notebook Covers/Stationery/Home Decor/Textile/Digital
  Paper) against real signals (keyword-intent matches, well-suited
  categories, tile-size/density fit), each score traceable to the rules
  that actually fired — no invented "AI confidence".
- **Two new coordinated assets** (`collection/collectionGenerator.ts`,
  `COLLECTION_SCHEMA_VERSION` 2 → 3, additive) — **Background Texture**
  (a subtle, low-contrast wash using the Color Story Engine's own "Light"
  variant of the collection's real resolved colors) and **Individual
  Motifs** (6 of the collection's own hero motifs, each exported
  standalone, reusing — not regenerating — the existing Spot Motif set).
- **Layout Variation** — every pattern-type asset (Hero/Secondary/Blender/
  Mini/Stripe/Background Texture) is now guaranteed a genuinely distinct
  layout (`allocateLayout`); Mini Pattern no longer silently inherits
  whichever layout Hero Pattern picked.
- **Motif Consistency** — `verifyConsistency` now optionally checks that
  every factory-generated motif (border/corner/spot/decorative) shares one
  motif family, not just the 5 core pattern assets.
- **Collection Score** (`collection/collectionScore.ts`) gained two real
  dimensions — **Layout Diversity** (distinct-layout fraction across
  `patternTiles`) and **Motif Shape Diversity** (Shannon-entropy diversity
  of shape-topology signatures pooled across the whole collection, reusing
  `engine/svgGeometry.ts`'s `extractMotifShapeSignatures` from the SVG
  Intelligence Engine) — `overall` is now a 7-dimension average, and
  `REQUIRED_ASSET_TYPES` grew to the 12 core creative asset types.
- **Collection Planner** (`trend/collectionPlan.ts`) — `buildCollectionPlan`
  assembles Section 1's Collection Plan (name/theme/category/marketplace/
  Style DNA/Color Story/recommended product uses/size/version) straight
  from a Design Specification, no generated collection required.
  `buildCollectionSpecification` assembles the full Section 7 Collection
  Specification JSON (metadata/assets/colorVariants/layoutVariants/
  motifRelationships/marketplaceTargets/commercialNotes) from a spec +
  its generated collection. `buildCollectionPreviewMetadata` (Section 8)
  and `prepareCollectionExport` (Section 10 — structured data only, no zip/
  download logic added) round out the module.
- **Backward compatibility**: `GeneratedCollection.patternTiles` (the new
  field these scores/plans read) is additive; `patternParams`'s fixed
  5-element hero/secondary/blender/mini/stripe order
  `components/ProjectPanel.tsx` indexes into is untouched.
  `project/projectManager.ts`'s `normalizeProject` was extended to
  backfill `patternTiles` (via a real `buildTile` reconstruction from the
  always-present `patternParams`) for collections persisted before this
  phase, the same "fill in fields added after the record could already be
  on disk" convention `designSpecs` already established.
- **Deliberately not built this phase** (per the brief's own
  constraints): no new UI (`components/CollectionWorkspace.tsx`-equivalent
  for the planner does not exist; every addition is DOM-free
  engine/orchestration code, consistent with the SVG Intelligence Engine
  Phase 3 precedent of staying engine-only when a brief doesn't explicitly
  ask for UI), no actual export/zip wiring for Section 10 (structured data
  only, as instructed), no SEO, no Prompt Factory, no SVG generation
  algorithm changes.

**Phase 4b** (a follow-up, more detailed brief for the same milestone,
`COLLECTION_SCHEMA_VERSION` 3 → 4, additive) closed the remaining gaps:

- **Color Story Engine** grew from 10 to 13 variants — added **Earth
  Tone**, **Luxury**, **Pastel**.
- **Two more coordinated assets** — **Dense Pattern** and **Airy Pattern**,
  built from the already-registered `densePremium`/`airy` layouts (Project
  PHOENIX's Cluster Composition Engine), rounding Section 2's asset list
  out to all 12 named kinds. `REQUIRED_ASSET_TYPES` grew to 14.
- **Motif Reuse Engine** (`collection/motifReuse.ts`, new) — Border,
  Corner, and part of the Decorative Elements Sheet now draw from one real
  shared `fillerMotifPool` instead of 3 independently-generated sets, and
  `engine/borderCornerAssets.ts`'s builders now report the real rotation/
  scale variant each placement got. `GeneratedCollection.motifReuse` and
  `CollectionSpecification.motifVariants` surface the report (shared hero
  motifs / shared leaves / shared fillers / shared decorative elements,
  reuse ratio).
- **Collection Plan gained a plural `marketplaceTargets` field** (Section
  1's own field, previously only computed on the Specification/Export-prep
  level), and **Collection Preview Metadata gained Section 10's remaining
  fields** — `coverAssetId`, `assetOrder`, `paletteStory`, `layoutStory`,
  `motifFamily` description — all real, fact-derived data.
- **Collection size actually scales generation now** (Section 12) — the
  Design Spec's own `collection.size` is wired into `generateCollection`,
  which pads Individual Motif count reuse-first (already-generated,
  unused-so-far motif pools before any new geometry) up to a 100-asset
  cap, without ever shrinking the required structural asset types.
- **Deliberately not built in 4b either**: no new `LayoutId`s for Section
  5's Editorial/Organic Scatter/Diagonal strategies (already real, one
  layer down, as Cluster Composition Engine archetypes — adding new
  standalone layout ids would duplicate engine work outside this
  milestone's remit), no UI, no export wiring beyond what already existed.

## Stock Submission Center (`metadata/contributorLinks.ts`, `metadata/submissionCenter.ts`, `components/StockSubmissionCenter.tsx`)

Turns the SEO page into a full pre-flight checklist for actually submitting
to stock sites — not just generating copy-paste metadata (which
`metadata/shutterstock.ts` already did and still does, unchanged).

- **Contributor Portal** (`metadata/contributorLinks.ts`): one config file,
  `CONTRIBUTOR_LINKS: ContributorLink[]`, each `{id, label, url, verified}`.
  Adding a future site is one new object — nothing else in the UI changes.
  Rendered as `target="_blank" rel="noopener noreferrer"` buttons above
  `MetadataPanel` (which is where "Product Title" actually lives — see
  below), so it satisfies "above Product Title" regardless of which site
  tab is active. Adobe Stock (`contributor.stock.adobe.com`) and
  Shutterstock (`submit.shutterstock.com`) URLs are marked `verified: true`
  (stable, well-known contributor-portal domains); Freepik/Creative
  Fabrica/Creative Market are marked `verified: false` — general "become a
  contributor" landing pages used because the exact upload-dashboard URL
  wasn't confidently known at authoring time (per the project's rule to
  never guess a URL without confidence). Unverified links render with a ⚠️
  and a tooltip pointing at the one line to fix in the config file.
- **Submission Checklist** (`buildSubmissionChecklist`): the 11 required
  items (SVG Generated, Preview Generated, Metadata Ready, Title Ready,
  Description Ready, Keywords Ready, Filename Ready, Collection Ready, ZIP
  Ready, SVG Valid, Originality Checklist), each `ready`/`warning`/
  `missing` — computed from real data, reusing existing modules rather than
  reimplementing: `SVG Valid` calls `candidateEngine.ts`'s
  `applyHardRejectRules` (now exported) directly on the current tile;
  `Filename Ready` calls the new shared `buildFilenameParts`
  (`export/svgExporter.ts` — factored out of what used to be a private
  `filenameParts` closure inside `App.tsx`, so the checklist computes the
  *exact* filename the app would actually export, not a second drifting
  copy); `Originality Checklist` hashes the current params with
  `designModel.ts`'s existing `hashParams` and checks it against the saved
  library — a real, honestly-scoped check (only ever catches "you already
  saved this exact configuration," never "someone else on the internet
  already sold this," since the app has no external image database, same
  disclaimer the Quality Score panel already carries); `Collection Ready`
  compares the current pattern's seed against a new `collectionGeneratedForSeed`
  state in `App.tsx` (replacing a latent bug in the pre-existing generic
  `collectionStatus` flag, which never reset when the user switched to a
  different pattern and would silently keep reporting "done" for an
  unrelated pattern).
- **SEO Analyzer** (`analyzeSeo`): score (0-100, a weighted blend of title/
  description/keyword-count/commercial-tag/coverage sub-scores minus a
  duplicate-keyword penalty — same "weighted average" convention
  `scoring.ts`'s `computeOverallScore` uses), keyword count, duplicate
  keywords (real Map-based counting over the actual generated keyword
  list — always empty against this app's own output since
  `shutterstock.ts`'s keyword builder already dedupes upstream, a
  documented and tested invariant, not a fake always-passing check),
  title/description/filename length, commercial tags present (checked
  against real generated keywords, not a static claim), keyword coverage
  (fraction of technique/use-case/format keyword buckets actually touched).
- **Stock Readiness** (`computeStockReadiness`): one card per site,
  `ready`/`needsReview`/`issues`, each with real `issues`/`recommendations`
  derived from that site's own documented field-length/keyword-count
  limits (`SITE_LIMITS` — the shutterstock/adobestock/freepik values are
  the sites' own documented upload-form caps, already implicitly present
  as `meta` display strings in `shutterstock.ts` and now restated as
  structured numbers; creativefabrica/creativemarket have no publicly
  documented hard cap, so those two use a clearly-labeled *practical*
  ceiling instead of a claimed platform limit).
- **Recommendations** (`buildSubmissionRecommendations`): the "Designer
  Assistant" requirement for this page — a real, rule-based function
  derived directly from the checklist/analyzer/readiness results (missing/
  warning checklist items, duplicate keywords, low coverage, thin
  commercial tags, per-site issues), same scoping precedent as every other
  not-yet-a-full-Phase-8-engine Designer Assistant check in this app
  (Style DNA's drift display, the Collection's `verifyConsistency`): a
  genuinely useful function built now, not a placeholder.
- `components/StockSubmissionCenter.tsx` composes all of the above above
  the existing, completely unmodified `MetadataPanel` (rendered as its last
  child) — `App.tsx` now renders `<StockSubmissionCenter>` where
  `<MetadataPanel>` used to render directly.
- Verified live via Playwright (desktop + mobile): all 5 contributor
  buttons present with correct `href`/`target="_blank"`/`rel`, clicking one
  genuinely opens a new tab/popup (network-blocked in the sandbox, which is
  expected — the point verified is that a real new tab opens, not that the
  sandbox has internet access), 11 checklist items render, SEO Analyzer
  shows a real computed score, 5 readiness cards render, zero console
  errors on either viewport.

## Project Studio Engine (`project/`, `storage/db.ts`, `storage/projectStore.ts`, `components/ProjectBar.tsx`, `components/ProjectDashboard.tsx`, `components/ProjectPanel.tsx`)

Transforms the app from a pattern generator into a Commercial Design
Workspace: every Concept/Moodboard/Style DNA/Collection/Asset/Metadata/SEO/
Export History/Upload Status/Note now belongs to a persisted **Project**
(`project/projectTypes.ts`), not scattered ephemeral state. Navigation model
was an explicit product decision (`AskUserQuestion`): an **Active-Project
bar** — the pattern editor stays the default screen exactly as before, no
forced "open a project first" gate — rather than a Figma/Canva-style
dashboard-first app shell, which would have been a much larger and riskier
rewrite of every existing feature's entry point for the same acceptance
criterion ("everything belongs to a Project").

### Shared IndexedDB plumbing (`storage/db.ts`)

Previously `storage/savedStore.ts` owned its own private `indexedDB.open('vsp-db', 1)`
call. Project System needed a second object store in the same database, and
two independent `indexedDB.open` calls with different version numbers would
race/conflict — so the opening logic (the one `onupgradeneeded` allowed to
create object stores), `idbAvailable`, `requestAsPromise`, and the generic
localStorage-fallback `lsLoad`/`lsStore` helpers were extracted into
`storage/db.ts`, bumping `DB_VERSION` 1 → 2 to add the new `projects` store
alongside the existing `saved` store (untouched — no data migration, no
shape change, `savedStore.ts` now just imports the shared helpers instead of
defining its own copies).

### Project data model (`project/projectTypes.ts`)

`Project` = `{ id, name, favorite, archived, createdAt, updatedAt, concept,
styleDnaId?, moodboard, notes, savedItemIds, collections, exportHistory }`.
Deliberately doesn't duplicate data that already has a real home elsewhere:
`savedItemIds` references `storage/savedStore.ts`'s existing Saved Library
by id rather than copying `SavedItem`s; `collections` holds real
`ProjectCollectionEntry` objects (`{ id, createdAt, collection:
GeneratedCollection, uploadStatus }`) — the *actual* `GeneratedCollection`
from `collection/collectionGenerator.ts`, not a summary, so a Collection
persists exactly as generated and every existing Collection Studio Engine
function (`computeCollectionScore`, asset SVGs, `patternParams`) keeps
working unmodified against it. Moodboard items are lightweight color/note
entries (no image upload — kept in scope with the app's "everything runs in
your browser, no external calls, no file-storage-size concerns" convention,
the same kind of scope call the Collection Preview's "no embedded SVG text"
decision made in v1.33).

### Project Manager (`project/projectManager.ts`)

Pure, DOM-free functions for every Project Manager action — `createProject`,
`duplicateProject` (new id, `(copy)` suffix, independently-cloned nested
arrays so editing the duplicate never mutates the original), `renameProject`,
`toggleFavorite`, `toggleArchive`, `updateConcept`/`updateNotes`,
`addMoodboardItem`/`removeMoodboardItem`, `addCollectionToProject` (appends
the collection *and* records one `ProjectExportHistoryEntry` in the same
call, since a Collection only ever enters a Project by being generated —
the two can't drift out of sync), `removeCollectionFromProject`,
`setCollectionUploadStatus`, `addSavedItemToProject`/`removeSavedItemFromProject`.
Every function returns a new object (never mutates its input), the same
immutable-update convention as every other reducer-shaped helper in this
app — `App.tsx`'s `updateProject(projectId, fn)` applies one of these and
writes the result through to `storage/projectStore.ts` in one place, so
state and IndexedDB never drift apart.

`migrateLegacyDataIntoProject(savedItems)` builds the one-time migration
Project (`LEGACY_PROJECT_NAME` = "คลังลายเดิม (ก่อนมี Project)") that
adopts every pre-existing Saved Library item by id — run once, on `App.tsx`'s
mount effect, only when `loadProjects()` returns empty, so "everything
belongs to a Project" holds immediately for existing users too, not just
data created going forward.

### Project Dashboard stats + Asset Browser (`project/projectStats.ts`)

`listProjectAssets(project)` flattens every asset across every Collection in
the project into one browsable list (the Asset Browser's data source — real
assets from already-generated collections, not a separate cross-collection
asset library; same "per-collection, not a persistent cross-session
library" scope the Style DNA milestone's Motif Factory decision set).
`computeProjectStats(project)` derives the Dashboard's 6 stat fields purely
from the project's own data: `collectionsCount`, `assetsCount`, `svgCount`,
`metadataStatus` (complete/partial/missing, based on how many collections
carry a `metadata` asset), `exportStatus` (exported/never), `uploadStatus`
(allReady/inProgress/notStarted/noCollections, aggregated across every site
on every collection) — no separate stored counters that could drift from
reality.

### Designer Assistant (`project/designerAssistant.ts`)

`reviewProject(project)` — same scoping precedent as every other
not-yet-a-full-Phase-8-engine Designer Assistant check in this app (Style
DNA's drift display, the Collection's `verifyConsistency`, the Stock
Submission Center's recommendations): a real, rule-based review computed
from the project's own already-generated data, reusing
`collection/collectionScore.ts`'s `computeCollectionScore` per collection
rather than re-deriving its checks. Flags an empty project, aggregates every
collection's own score issues, genuinely detects a Style DNA mismatch
*across* collections in the same project (a check that doesn't exist at the
single-collection level), and recommends filling in Concept/Moodboard when
empty.

### Project JSON (`project/projectJson.ts`)

`exportProjectJson(project)` serializes a `Project` (wrapped with
`schemaVersion`/`exportedAt`) to one JSON document — "everything must save
inside one project" holds literally, since a Collection's full manifest+
assets already live on the `Project` object itself, nothing external needs
joining in. `importProjectJson(json)` parses and structurally validates it
back (checks `id`/`name`/array-shaped `collections`/`savedItemIds`/
`exportHistory` are present — deliberately lenient about `schemaVersion`
itself, since the shape is what's actually checked).

### UI (`components/ProjectBar.tsx`, `components/ProjectDashboard.tsx`, `components/ProjectPanel.tsx`)

- **ProjectBar** — persistent header strip: active-project `<select>`
  switcher, "+ โปรเจกต์ใหม่" (`window.prompt` for a name — the same
  confirm/prompt convention `SavedPanel`'s delete flow already uses), and
  "📊 Project Dashboard" to open the full-screen Project Manager.
- **ProjectDashboard** — the Project Manager: a card grid (thumbnail = the
  most recent collection's hero SVG, inline via `dangerouslySetInnerHTML`)
  with real per-project stats from `computeProjectStats` and every CRUD
  action, an archived-projects toggle, and Project JSON export/import
  (`<input type="file">` reusing the same pattern `SavedPanel`'s "นำเข้า
  backup" already established).
- **ProjectPanel** — renders in the editor's main column whenever a Project
  is active: Collection Browser (every `ProjectCollectionEntry` in the
  project), the selected collection's `CollectionAndAssetBrowser`
  sub-component (Asset Browser + Collection Score + new Metadata Browser +
  new Upload Tracker), project-wide Export History, and the Designer
  Assistant review — this is the direct evolution of v1.33's
  `CollectionWorkspace.tsx` (see the note above). `App.tsx`'s
  `handleGenerateCollection` now attributes every newly generated Collection
  to `activeProjectId` (creating a fresh project on the fly in the
  pathological case where none is active, so a Collection is never silently
  dropped) instead of holding it in isolated ephemeral state.

- Verified end-to-end via Playwright against the real dev server: fresh
  load auto-migrates into one default project (visible in the Active-Project
  bar immediately, no existing data lost), clicking "Generate Collection"
  downloads the real zip *and* attributes the collection to the active
  project (Collection Browser, Asset Browser, Metadata Browser with a real
  SEO score, Upload Tracker all populate correctly), cycling an upload
  status persists it, opening the Project Dashboard shows correct real
  stats, Create/Duplicate/Rename/Export JSON/Archive/un-Archive all work
  against the real UI, returning to the editor keeps the Project Panel
  intact — zero console errors throughout.

## Marketplace Profile System (`metadata/marketplaceProfiles.ts`, `metadata/filenameEngine.ts`, `metadata/marketplaceSeo.ts`, `metadata/marketplaceValidation.ts`, `metadata/exportPackage.ts`, `components/MarketplaceProfileSelector.tsx`)

v1.9's `metadata/shutterstock.ts` already generated per-site *copy*
(title/description/keywords text); this milestone adds the layer that spec
asked for explicitly: no single generic SEO profile — each marketplace has
its own **rules** (title/description/keyword limits, filename template,
category mapping, which files belong in its export package) driving a
one-click, marketplace-specific Title/Description/Keywords/Filename/Export
Package, plus validation against those rules and a place to persist manual
overrides per asset.

### Config layer (`metadata/marketplaceProfiles.ts`)

`MarketplaceId` (= `shutterstock.ts`'s existing `StockSiteId`, now widened
to 6 values — see below) indexes `MARKETPLACE_PROFILES: Record<MarketplaceId,
MarketplaceProfile>`, one object per marketplace with `titleRules`,
`descriptionRules`, `keywordRules` (`termLabel: 'keywords' | 'tags'`,
optional `maxKeywordLength`), `filenameRules` (template + max length +
`svg`/`eps` extension), `defaultCategory`, `exportPackageFiles`, and the
`contributorUrl`/`contributorUrlVerified` pulled straight from
`contributorLinks.ts` (single source of truth, not duplicated). Adding a
7th marketplace is one new object in this file — nothing else changes,
satisfying the spec's "profiles must be easy to extend, not hardcoded."
**Etsy** is added as the 6th, explicitly `future: true` (Etsy sells
finished physical/digital *products*, not raw vector files the way the
other 5 sites do — the UI marks it 🔜 and shows a hint) but with its real
platform limits used (140-char title, 13 tags max at 20 chars each,
`.svg` extension) rather than guessed values.

### Filename Engine (`metadata/filenameEngine.ts`)

`resolveFilenameTemplate(template, params, marketplaceId)` fills a
`{palette}-{category}-{layout}-seamless-pattern-{seed}`-style template (the
default, but every profile can override it) from the tile's real params;
`buildMarketplaceFilenameBase` truncates at the last hyphen if the result
would exceed the profile's `maxLength` (never mid-word); `dedupeFilename`
appends `-2`, `-3`, … against a `Set` of already-used names — "avoid
duplicate filenames" from the spec, usable wherever a batch of assets is
being named. `customTemplate` threads through every layer above it so
"allow user customization" is real, not aspirational.

### SEO generator (`metadata/marketplaceSeo.ts`)

`generateMarketplaceSeo(tileData, marketplaceId, customFilenameTemplate?)`
returns one flat `MarketplaceSeo` (`title`/`description`/`keywords`/
`filename`) — reshapes `buildSiteMetadata`'s existing per-site fields
(still the single source of title/description/keyword *text*, unchanged)
and attaches the Filename Engine's output, the one piece
`buildSiteMetadata` never had. `generateAllMarketplaceSeo` returns the same
for every marketplace in one call.

### Validation (`metadata/marketplaceValidation.ts`)

`validateMarketplaceSeo(seo, profile)` checks exactly the spec's warning
list — title too short/long, duplicate keywords, missing/too-many
keywords, a keyword over a marketplace's own length cap (Etsy), missing
description where required, invalid/too-long filename (`^[a-z0-9-]+\.(svg|eps)$`)
— and returns `ValidationIssue[]` (`error` | `warning`). `isMarketplaceReady`
collapses that to a single ready/not-ready boolean (only `error`-severity
issues block readiness; warnings don't).

### Export Package (`metadata/exportPackage.ts`)

`buildMarketplacePackageTextFiles(tileData, marketplaceId, customFilenameTemplate?)`
generates fresh SEO and returns the spec's file set (`title.txt`,
`description.txt` when the marketplace actually has one,
`keywords.txt`, `filename.txt`, `metadata.json` — SVG and the rasterized
PNG preview are added one layer up in `App.tsx`, same pattern as every
other zip export in this app). It delegates to
`buildPackageTextFilesFromSeo(tileData, marketplaceId, seo)`, which takes
an *already-resolved* `MarketplaceSeo` instead of regenerating one — used
by every UI call site that might carry user edits (the Marketplace Profile
Selector, the Asset SEO Editor below), so clicking "Download Package"
never silently discards a manual title/description/keyword edit made
seconds earlier.

### SEO Storage — "Project > Collection > Asset > SEO > {marketplace}" (`collection/collectionGenerator.ts`, `project/projectManager.ts`)

Per the spec's storage example, each `CollectionAsset` gained an optional
`seo?: AssetSeoStore` field (`AssetSeoStore = Partial<Record<MarketplaceId,
AssetSeoOverride>>`, `AssetSeoOverride = {title?, description?, keywords?,
filename?}`) — additive and backward-compatible, so a collection generated
before this milestone simply has no `seo` field on any asset and every
reader treats a missing marketplace entry as "use the generated default."
`projectManager.ts` gained `setAssetSeoOverride`/`clearAssetSeoOverride`,
pure immutable-update functions in the same style as the existing
`setCollectionUploadStatus`, reached through `App.tsx`'s
`handleSetAssetSeoOverride`/`handleClearAssetSeoOverride` (which persist
through the same `updateProject`/`putProject` IndexedDB path every other
project mutation already uses).

### UI

- **Marketplace Profile Selector** (`components/MarketplaceProfileSelector.tsx`,
  rendered in `StockSubmissionCenter.tsx` above the existing
  `MetadataPanel`): 6 marketplace chips (Etsy shows 🔜); selecting one
  instantly regenerates Title/Description (only shown where the profile
  actually has one)/Keywords/Filename with per-field character/count
  budgets shown against that marketplace's own limits; every field is
  editable (edits are local overrides layered on the generated defaults,
  reset when switching marketplace or pattern — a one-off touch-up before
  download, not a saved record, consistent with the rest of this page); a
  custom filename template input; a Ready/Issues indicator and a full list
  of validation messages; a "📦 ดาวน์โหลด Export Package" button.
- **Stock Readiness cards** (existing `StockSubmissionCenter.tsx` section)
  gained an SEO/Validation status line and a "📦 Download Package" action
  per marketplace, next to the existing Contributor Link button.
- **Asset SEO Editor** (new sub-component inside `components/ProjectPanel.tsx`,
  under the Asset Browser's selected-asset preview): the actual UI for the
  "Project > Collection > Asset > SEO > {marketplace}" storage tree — per
  asset, per marketplace, manual Title/Description/Keywords/Filename
  fields backed by `setAssetSeoOverride`/`clearAssetSeoOverride`. The 5
  pattern-type assets (Hero/Secondary/Blender/Mini/Stripe) additionally get
  an "✨ Auto-fill จากที่ระบบสร้าง" shortcut that pulls from
  `generateMarketplaceSeo` for that asset's own resolved params; every
  other asset type (border/corner/sheets/preview/metadata/seoPackage) is
  manual-entry-only, since there's no underlying pattern to generate SEO
  copy from. A "↺ ล้างค่าที่แก้ไข" button clears the override back to the
  generated default (or back to empty, for manual-only assets).
- Verified live via Playwright against the real dev server: switching
  marketplace chips regenerates every field correctly (Etsy's 140-char
  title / 13-tag / `.svg` limits, `.eps` for Shutterstock/Adobe/Freepik,
  `.svg` for Creative Fabrica/Creative Market), Ready indicator reflects
  real validation state, generating a real Collection and opening its
  Project Panel shows the Asset SEO Editor for every asset, editing a
  non-pattern asset's title (Border Pattern) persists across switching to
  a different asset and back, Auto-fill on a pattern asset (Hero Pattern)
  pulls the real generated title and Clear correctly reverts to it, zero
  console errors throughout.

## Marketplace Intelligence Engine — Phase 5 (`metadata/readinessScore.ts`, `trend/seoHintEngine.ts`, extends `metadata/marketplaceProfiles.ts` + `metadata/contributorLinks.ts` + `metadata/marketplaceValidation.ts` + `metadata/exportPackage.ts` + `trend/collectionPlan.ts`)

Closes the remaining gaps in the Marketplace Profile System above against
a more detailed brief for the same territory. Full architecture,
algorithms, JSON schemas, and test coverage in
[`MARKETPLACE_INTELLIGENCE.md`](./MARKETPLACE_INTELLIGENCE.md); summary:

- **Profiles are now real, editable JSON — no hardcoded marketplace logic**
  (`src/marketplaces/*.json`) — `metadata/marketplaceProfiles.ts` now
  *builds* `MARKETPLACE_PROFILES` from that JSON instead of a hardcoded TS
  object literal, closing a gap Design Intelligence Core Phase 1's own
  report had flagged as a "Phase 2 recommendation." Every existing
  consumer (SEO generation, validation, filenames, export packages, UI)
  keeps working unchanged — only the data source moved.
- **Profile Content grows to all 17 named fields** — added Help/
  Guidelines/Submission/Analytics/Support URLs (previously only
  Contributor Portal existed), Collection Naming Rules, Supported File
  Types, Preview Requirements, and a real Category Mapping (Shutterstock
  only, ported from its own pre-existing table; every other marketplace
  honestly falls back to `defaultCategory` rather than a fabricated
  mapping).
- **Validation grows from 4 to all 9 named fields** — Collection Name,
  Asset Name, Preview, Export Package, and Display validation added
  (`metadata/marketplaceValidation.ts`), plus a third `'suggestion'`
  severity tier alongside error/warning.
- **SEO Hint Engine** (`trend/seoHintEngine.ts`, new) — deliberately
  distinct from the final SEO generators above: runs from a Design
  Specification alone, before any pattern is generated, and returns
  candidate keyword pools/target ranges/advisory notes, never one
  committed answer ("do not generate final SEO yet" from the brief,
  taken literally).
- **Contributor Center grows from 1 to all 6 named link types** (Portal/
  Submission/Analytics/Help/Guidelines/Support) — `metadata/
  contributorLinks.ts`'s new `MARKETPLACE_LINK_SETS`, rendered in the
  existing Stock Readiness cards with the same honest unverified-URL
  marker the original Contributor Portal link already used.
- **Marketplace Package Profile** (`buildMarketplacePackageProfile` in
  `metadata/exportPackage.ts`) — structured required-files/supported-
  formats/preview-requirements metadata for a future export engine, no
  export/zip logic added.
- **Readiness Score** (`metadata/readinessScore.ts`, new) — one real,
  per-marketplace score across all 5 named dimensions (SEO/filename/
  metadata/marketplace-compatibility/commercial readiness), assembled
  from data the existing SEO/validation/hard-reject modules already
  compute.
- **Collection-aware filenames** (`buildCollectionMarketplaceFilenames`
  in `trend/collectionPlan.ts`) — a marketplace-optimized, deduped
  filename for every pattern-type asset in an already-generated
  Collection, consuming the Collection Specification per the brief's
  explicit instruction.
- **Deliberately not built this phase**: no upload automation anywhere
  (every new link just opens in a new tab, same as the pre-existing
  Contributor Portal link), no SVG Engine changes, no new marketplaces
  beyond the existing 6.

## Design Workbench — Phase 6 (dockable multi-panel workspace, `components/workbench/*`, `workbench/workspaceSettings.ts`, `workbench/globalSearch.ts`)

Restructures the Phase 3 Design Workbench shell into a dockable
multi-panel workspace and integrates every engine built in the
intervening phases (Trend Library, Marketplace Intelligence, Collection
Engine, Prompt Factory, Cluster Composition/Overlap Engine) into one
place. Full architecture and scope decisions in
[`DESIGN_WORKBENCH.md`](./DESIGN_WORKBENCH.md)'s Phase 6 addendum;
summary:

- **Resizable, hideable panels** — real pointer-drag sidebar resize
  (`ResizeHandle.tsx`) and per-panel hide/restore
  (`PanelVisibilityBar.tsx`) across 11 dockable panels, backed by one
  serializable `WorkspaceSettings` object, persisted and
  exportable/importable as JSON.
- **Project Explorer** (`ProjectExplorer.tsx`, new) — browses Projects →
  Collections/Assets, Trend Packs, and Marketplace Profiles in one tree,
  with real HTML5 drag-and-drop to apply a Trend Pack to the current
  spec.
- **Marketplace Panel** (`MarketplacePanel.tsx`, new) — the first UI
  consumer of Phase 5's Readiness Score and SEO Hint engines, both
  previously unused by any component: Readiness Score, Validation, SEO
  Hints, Filename Hints, Submission Checklist, Contributor Links.
- **Quality Panel** (`QualityPanel.tsx`, new) — all 6 named quality
  dimensions including a new `overlap` field (a real 1:1 read of the
  Overlap Engine's `overlapQuality`) plus a new rule-based
  `buildQualityRecommendations` engine turning weak dimensions into
  actionable advice.
- **Prompt Panel** (`PromptPanel.tsx`, new) — the existing Prompt Factory
  promoted out of Live Preview into its own dockable panel; no new prompt
  logic.
- **Design Inspector** gains Hierarchy/Flow/Rhythm controls and a
  read-only Cluster Archetype info line (no fabricated editable control
  for data the engine doesn't expose as a spec field).
- **Live Preview** gains a Pattern Repeat tab (real 3×3 tiled SVG
  seamlessness check).
- **Global Search** (`globalSearch.ts` + `GlobalSearchBar.tsx`, new) —
  searches Projects, Collections, Motifs, Trend Packs, and Marketplace
  Profiles from their existing registries/state.
- **Import/Export** gains Workspace Settings export/import, Collection
  Specification export, and Marketplace Profile export/validate-import.
- **Performance**: the four Phase-6-only panels are `React.lazy`-loaded;
  Project Explorer paginates its Projects/Trend Packs lists.
- **Deliberately not built this phase**: no floating/rearrangeable
  docking system (scoped to resizable + hide/restore instead), no
  editable Cluster Settings control, no live registration of an imported
  Marketplace Profile (validate-and-inspect only — the profile registry
  is a static build-time array).

## Design Knowledge Engine — Phase 6.5 (`src/knowledge/*`)

Centralizes structured design knowledge under `src/knowledge/` so every
engine can consume one consistent API instead of importing 7+ different
`services/*`/data-library paths directly. Full architecture, schema, and
scope decisions in
[`DESIGN_KNOWLEDGE_ENGINE.md`](./DESIGN_KNOWLEDGE_ENGINE.md); summary:

- **10 knowledge domains, all thin facades over already-real engines** —
  `style/`, `motif/`, `palette/`, `composition/`, `pattern/`,
  `collection/`, `marketplace/` wrap Style DNA, Motif/Pattern Grammar,
  Color Roles/Color Story, Flow/Rhythm/Cluster Engine/Layouts, Collection
  Plan/Product Targets, and Marketplace Profiles respectively — no
  business logic moved, no rules duplicated. `composition/` is now also
  the single source of truth for `LAYOUT_CLUSTER_ARCHETYPES`, removing a
  hand-copied duplicate that used to live inside `PropertyInspector.tsx`.
- **Design Rules** (`rules/rejectRules.json`, new) — the Candidate
  Engine's hard-reject node-count threshold, externalized from a bare
  TypeScript literal into editable JSON; `engine/candidateEngine.ts` now
  reads `HARD_NODE_BUDGET` from `knowledge/rules` instead of hardcoding it.
- **Recommendation Engine** (`recommendation/`, new) — a real aggregator
  over 4 previously-independent recommenders (Style DNA export
  recommendation, Product Targets, Trend Pack Auto-match, Quality Loop
  recommendations), with optional Learning-History-based personalization.
  Never hardcodes a recommendation.
- **Learning History** (`history/`, new) — usage-frequency tracking for
  Style DNA/Palette/Motif categories, recent collections, disable/clear/
  export/import — distinct from `workbench/workbenchFavorites.ts`'s
  explicit starring. `DesignWorkbench.tsx` records usage on every spec
  change and on "Generate Collection".
- **Validation** (`validation.ts`, new) — `validateAllKnowledge()` runs
  every real knowledge file through its existing JSON Schema validator in
  one call; `validateKnowledgeRelationships()` is a genuinely new check
  that every cross-domain id reference (Style DNA → Palette/Motif/Layout/
  Hierarchy, Motif Grammar → Pattern Grammar, etc.) actually resolves.
- **Two new JSON Schemas** (`rejectRules.schema.json`,
  `learningHistory.schema.json`) registered in the same
  `validators/index.ts` `SCHEMA_REGISTRY` every other domain already uses
  — no second validation engine.
- **Deliberately not built this phase**: no UI panel (the brief explicitly
  asks not to move business logic into the UI — this is a backend/
  architecture milestone), no live registration path for an imported
  Marketplace Profile (unchanged from Phase 6 — still validate-only).

## Design Critic & Art Direction Engine — Phase 7 (`src/critic/*`)

Reviews an already-generated tile like an experienced surface pattern
designer and turns that review into scores, named problems, and
recommendations. Full architecture and scope decisions in
[`DESIGN_CRITIC.md`](./DESIGN_CRITIC.md); summary:

- **Design Critique** (`designCritique.ts`) — 11 named dimensions
  (Composition/Hierarchy/Balance/Rhythm/Flow/Cluster Quality/Negative
  Space/Overlap/Repeat Quality/Motif Diversity/Commercial Readiness) +
  overall, reshaped from the existing `DesignSpecQualityReport` +
  `CompositionMetrics` — no new scoring math.
- **Visual Analysis** (`visualAnalysis.ts`) — 10 detectors (Weak Hero,
  Crowded Areas, Dead Space, Mechanical Spacing, Grid Appearance, Weak
  Clusters, Low Detail, Repeated Rotation, Repeated Scale, Weak Flow); 7
  reuse existing `CompositionMetrics` thresholds, 3 are new detectors
  built directly on real per-instance geometry.
- **Penalty System** (`problems.ts`) — severity-banded (high/medium/low)
  filter over the existing `SOFT_PENALTY_RULES` (19 named, exact-point
  rules) — no duplicate penalty logic.
- **Art Direction Engine** (`artDirection.ts`) — one recommendation rule
  per visual issue; only proposes a `DesignSpecification` patch when a
  real field lever exists (e.g. Increase Hero Detail, Reduce Density,
  Rotate Leaves, Improve Rhythm), otherwise advisory-only.
- **Style Coach** (`styleCoach.ts`) — 7 categories (Luxury/Minimal/
  Botanical/Kids/Scandinavian/Retro/Editorial), grounded in real
  `knowledge/style` records, not hand-written copy.
- **Collection Critic** (`collectionCritic.ts`) — thin wrap of
  `collection/collectionScore.ts`; Thai issue strings preserved verbatim.
- **Design Report** (`designReport.ts`) — aggregates the above into
  Problems/Recommendations/Expected Improvements/Priority order.
- **Improvement Loop** (`improvementLoop.ts`) — the only module that
  mutates a spec: Evaluate -> Recommend -> Patch -> Re-generate ->
  Evaluate Again, up to 3 rounds, with guards against a grid-layout
  rhythm-patch dead end and against ever returning a round whose winning
  candidate got hard-rejected by the patch it just applied.
- **Quality Gate** (`qualityGate.ts`) — fails on an unmet commercial bar,
  any high-severity problem, or overall score below 50; wired into
  `LivePreviewPanel.tsx`'s "Download Marketplace Package" and "Generate
  Collection" actions via a `window.confirm` the designer can override.
- **New UI**: `components/workbench/DesignCriticPanel.tsx` — a dockable
  Critic tab reusing the same `qualityResult` the Quality Panel computes.

## Design Evolution Engine — Phase 8 (`src/evolution/*`)

A genetic-algorithm-style layer that generates a population of Design
Specification variants from one starting spec, scores them with the real
Design Critic, and evolves that population across generations toward
higher measurable quality. Full architecture, algorithms, and empirical
verification in [`DESIGN_EVOLUTION_ENGINE.md`](./DESIGN_EVOLUTION_ENGINE.md);
summary:

- **Candidate Generator** (`candidateGenerator.ts`) — configurable
  population size; candidate 0 is always the untouched seed spec
  (elitism baseline), every other candidate carries 1+ real mutations.
- **Mutation Engine** (`mutationEngine.ts`) — 6 named operators
  (cluster density, motif scale, overlap, hierarchy, palette weighting,
  negative space), each patching one real spec field, bounded to real
  reference data (`HIERARCHY_PRESETS`) where one exists. `styleDnaId` is
  never touched by any operator.
- **Crossover Engine** (`crossoverEngine.ts`) — 4 trait groups
  (composition, palette, cluster, motif), each taken wholly from one
  parent, never blended field-by-field within a group.
- **Fitness Evaluation** (`fitnessEvaluation.ts`) — scores every
  candidate via the real Design Critic (Phase 7), never a second scoring
  implementation; transparent 11-dimension critique travels with every
  score, and a real hard-reject sentinel (`fitness.rejected`) is surfaced
  explicitly rather than hidden behind a suspicious `-1`.
- **Selection Strategy** (`selectionStrategy.ts`) — elitist, tournament,
  and roulette-wheel algorithms, all configurable.
- **Diversity Control** (`diversityControl.ts`) — candidate similarity
  measured with the real `workbench/jsonDiff.ts` diff utility; near-
  duplicates are pruned with a soft top-up so pruning can never stall
  evolution below the target population size.
- **Evolution Timeline** (`evolutionTimeline.ts`) — one record per
  generation, with `compareGenerations` for a real field-level diff
  between any two generations' best candidates.
- **Design DNA** (`types.ts`) — every candidate's lineage (parent ids,
  applied mutations, crossover record) travels with it.
- **Stopping Conditions** (`stoppingConditions.ts`) — quality threshold,
  max generations (always enforced), wall-clock budget, and evaluation
  budget, each independently configurable.
- **Empirically verified convergence**: elitism makes the timeline's
  best score structurally non-decreasing (a provable guarantee, not a
  hope); a real empirical run also found and now tests a genuine
  recovery from a fully hard-rejected generation 0 to a real 46/100
  candidate by generation 1.
- **New UI**: `components/workbench/EvolutionPanel.tsx` — a dockable
  Evolution tab with population/generation/selection controls, a
  browsable timeline, and an "Apply Winning Design" action.

## Asset Ecosystem Engine — Phase 9 (`src/assets/*`)

Turns already-generated Collection geometry into reusable, first-class
Asset records — searchable, scoreable, relatable, and remixable
independently of the Collection they came from. Full architecture,
schema, and empirical findings in
[`ASSET_ECOSYSTEM_ENGINE.md`](./ASSET_ECOSYSTEM_ENGINE.md); summary:

- **Asset Extraction** (`extraction.ts`) — 9 kinds (Hero Motif, Leaf,
  Flower, Branch, Texture, Border, Frame, Icon, Decorative Shape) from a
  real `GeneratedCollection`; Border/Frame assets are reconstructed
  byte-identically from the Collection's own real seed derivation and
  `buildBorderStrip`/`buildCornerUnit` calls — no duplicate SVG
  generation logic.
- **Asset Metadata** (`types.ts`) — id/name/family/Style DNA/complexity/
  pattern types/compatibility/editable/version, all sourced from real
  `FactoryMotif`/`knowledge/*` data, never fabricated.
- **Asset Relationships** (`relationships.ts`) — 5 types
  (flowerToLeaf, leafToBranch, borderToCorner, collectionToAsset,
  sameFamily), all derived from real fields; flowerToLeaf/leafToBranch
  are pool-wide (cross-collection) since a single generator category
  can never span two families.
- **Asset Variants** (`variants.ts`) — 7 reusable variants (Outline,
  Filled, Minimal, Detailed, Bold, Monoline, Vintage); `detailed` reuses
  the real Hero Motif Complexity engine, `vintage` reuses the real color
  transform utilities.
- **Smart Search** (`search.ts`) — by keyword, family, kind, Style DNA,
  marketplace, color, pattern type, and complexity range.
- **Smart Recommendation** (`recommendation.ts`) — reuses the Design
  Knowledge Engine's real family-combination compatibility data, never a
  second compatibility scheme.
- **Asset Collections** (`library.ts` + `storage/assetStore.ts`) —
  Favorites and Packs (Collections/Templates) in `localStorage`, plus a
  full IndexedDB-backed Asset Library (`storage/db.ts` bumped to
  `DB_VERSION: 3`) that persists extracted assets across sessions and
  future Collections.
- **SVG Decomposition** (`decomposition.ts`) — splits a rendered tile
  into per-instance editable assets, maintaining full SVG editability.
- **Quality Score** (`qualityScore.ts`) — Reusability, Complexity (reused
  verbatim), Commercial Usefulness, Compatibility, and Overall, all
  0-100 and scaled against real Design Knowledge Engine denominators.
- **New JSON Schema** (`asset.schema.json`) registered in the same
  `validators/index.ts` `SCHEMA_REGISTRY` every other domain uses, plus
  `assets/validation.ts` for schema + cross-domain relationship
  integrity checks.
- **New UI**: `components/workbench/AssetLibraryPanel.tsx` — a dockable
  "🗃 Assets" tab to extract, browse, search, favorite, and vary assets,
  with real Quality Score, Relationships, and Recommendation panels for
  the selected asset.

## Testing

`npm test` runs `vitest run` — 1301 tests (jsdom environment, component
tests use React Testing Library) across 107 files. The list below predates
the Design Intelligence Core, Design Workbench (Phase 3 and Phase 6), SVG
Intelligence Engine Phase 3, Commercial Collection Engine Phase 4 (+ 4b),
Project Phoenix V2, Marketplace Intelligence Engine Phase 5, Design
Knowledge Engine Phase 6.5, Design Critic Phase 7, Design Evolution
Engine Phase 8, and Asset Ecosystem Engine Phase 9 milestones and
covers the original engine/metadata/trend suites in detail; see
[`DESIGN_INTELLIGENCE_CORE.md`](./DESIGN_INTELLIGENCE_CORE.md),
[`DESIGN_WORKBENCH.md`](./DESIGN_WORKBENCH.md),
[`DESIGN_KNOWLEDGE_ENGINE.md`](./DESIGN_KNOWLEDGE_ENGINE.md),
[`SVG_INTELLIGENCE_ENGINE.md`](./SVG_INTELLIGENCE_ENGINE.md),
[`COLLECTION_ENGINE.md`](./COLLECTION_ENGINE.md),
[`CLUSTER_COMPOSITION_ENGINE.md`](./CLUSTER_COMPOSITION_ENGINE.md),
[`MARKETPLACE_INTELLIGENCE.md`](./MARKETPLACE_INTELLIGENCE.md), and
[`ASSET_ECOSYSTEM_ENGINE.md`](./ASSET_ECOSYSTEM_ENGINE.md) for
what their own test suites (`schemas/validators/services`, `workbench/` +
`components/workbench/`, `engine/svgOptimizer.test.ts` +
`engine/scoring.test.ts` + `engine/styleDna.test.ts`,
`palettes/colorTransform.test.ts` + `collection/colorStory.test.ts` +
`collection/productTargets.test.ts` + `collection/motifReuse.test.ts` +
`trend/collectionPlan.test.ts`, `engine/clusterEngine.test.ts` +
`engine/heroComplexity.test.ts`, and `metadata/marketplaceProfiles.test.ts` +
`metadata/marketplaceValidation.test.ts` + `metadata/contributorLinks.test.ts` +
`metadata/readinessScore.test.ts` + `trend/seoHintEngine.test.ts`
respectively) cover:

- `engine/rng.test.ts` — seeded reproducibility, range bounds.
- `engine/hierarchy.test.ts` — role-distribution matches configured
  ratios over a large sample, scale multipliers apply correctly, ratio
  normalization.
- `engine/tile.test.ts` — byte-identical output for the same seed, no
  raster/filter/mask content (would break EPS export), unique SVG ids,
  every layout × a sample of categories builds without throwing (with
  hierarchy/negativeSpace/overlapAmount all set), backward compatibility
  with a pre-v1.23-shaped params object, `data-role` presence/absence on
  exempt vs. non-exempt layouts.
- `engine/qualityScore.test.ts` — determinism, score bounds, seamless
  integrity is always 100, differently-composed tiles score differently.
- `ai/aiAssist.test.ts` — old-format JSON still parses (no v2 fields
  present in the result), markdown-fence tolerance, `artDirection`
  resolution, manual `hierarchy` object validation/clamping, unknown
  fields ignored safely, Thai error messages for invalid/empty input.
- `engine/curveEngine.test.ts` — `smoothPathD` open/closed correctness and
  determinism, `buildArcSampler` places t=0/t=1 at the spline endpoints
  with a unit tangent everywhere, `tangentToUpAngleDeg` convention,
  `wobbleEnvelope`/`radialAsymmetry` determinism and bounds,
  `validatePoints`/`removeDegenerate` catch NaN and zero-length segments.
- `generators/growth.test.ts` — `generateStem` determinism, valid path (no
  NaN), spans roughly the requested length, `terminalPoint` matches
  `sampler.at(1)`; `growLeaves` determinism, leaf count respects each
  preset's range, only finite placement values, opposite arrangement pairs
  share the same `t`.
- `generators/botanical.test.ts` — motif determinism, valid/finite SVG and
  radius across 60 seeds, node-count ceiling (no runaway path bloat),
  variant coverage across many seeds, growth-based motifs emit
  `data-part="stem"`/`"leaves"` groups.
- `engine/svgGeometry.test.ts` — `extractInstances` determinism and finite
  values, `data-role` carried through when the Hierarchy Engine set one,
  `periodicDist` wrap-around correctness and symmetry, `gridCoverage`
  occupancy math, `countNodes`.
- `engine/scoring.test.ts` — `computeMetrics` determinism and 0-100 bounds
  for all 17 metrics, `svgHealth`/`seamlessIntegrity` are 100 for a normal
  tile, `paletteContrast` genuinely responds to the actual colors used,
  differently-composed tiles score differently, `computeOverallScore`
  determinism/bounds/penalty-reason generation across every quality
  preset, every preset's weight keys exist on `CompositionMetrics`.
- `engine/candidateEngine.test.ts` — `deriveSeed` determinism, candidate
  pool size matches each mode, full-pipeline determinism (same seed +
  settings + mode + preset -> identical pool and winner), every candidate
  has a valid score or documented rejection reasons, different base seeds
  produce different pools, `pickBestCandidate` picks the true max and
  falls back safely if everything were rejected, the chunked async version
  matches the synchronous one exactly and both reports progress and
  respects cancellation.
- `engine/colorAnalysis.test.ts` — `hexToHsl` correctness for known
  primaries/grayscale/black/white, `meanHue` circular-wrap correctness
  (350°/10° averages to 0°, not the naive-mean 180°), `circularHueDistance`
  symmetry, `colorSetStats` excludes the background color and is
  deterministic.
- `engine/trendEngine.test.ts` — `resolveTrend` returns null for an unknown
  id and a valid buildable patch for every real preset, determinism;
  `computeTrendFit` returns null for an unknown trend, is deterministic
  and bounded for every preset, scores a perfect density/overlap match
  right after applying a preset unmodified, degrades when density is
  pushed outside the trend's range, and handles a hue-wrapping signature
  without throwing.
- `engine/designModel.test.ts` — `cloneParams` deep-equal-but-independent
  copies (mutating a clone never touches the original), preserves
  `undefined` optional fields as `undefined` rather than dropping them;
  `hashParams` determinism, changes on any field change, independent of
  object key insertion order; `normalizeParams` clamps out-of-range/NaN
  values, leaves already-valid params byte-identical, never mutates its
  input.
- `engine/scoring.test.ts` (extended) — `largestEmptyRegion` and
  `heroSeparation` determinism/bounds and real differentiation on
  constructed scenarios that actually produce a large hole / hero role;
  `applySoftPenalties` deducts nothing when no rule triggers, deducts and
  stacks real point values when rules do, never drops below 0, every rule
  is deterministic; `computeOverallScore` applies soft-penalty deductions
  on top of the weighted average end-to-end.
- `engine/candidateEngine.test.ts` (extended) — `rejectExactDuplicates`
  hard-rejects a later candidate with byte-identical rendered SVG to an
  earlier one, does not compare against a candidate already rejected for
  another reason, and — the regression guard for the RMS-distance false-
  positive bug described above — never hard-rejects a real, diverse
  candidate pool as duplicates.
- `engine/compositionIntelligence.test.ts` — `computeWeight` scales with
  scale^2 and role weighting; `applyBalanceCorrection` is a no-op below the
  minimum placement count/strength/imbalance threshold, measurably reduces
  quadrant-weight imbalance on a constructed lopsided layout, never moves
  more than ~15% of placements, and is deterministic; `applyRhythmSmoothing`
  is a no-op on an already-even grid, measurably pulls a constructed
  isolated outlier closer to its nearest neighbor, and is deterministic;
  `applyCompositionIntelligence` is a strict same-reference no-op when
  `params` is undefined.
- `engine/tile.test.ts` (extended) — Composition Intelligence Engine
  backward compatibility with a pre-v1.29-shaped params object, undefined
  vs. absent field produce byte-identical output, the feature genuinely
  changes generated geometry for at least one real scenario (not a silent
  no-op), determinism is preserved with it enabled, and it never introduces
  NaN/Infinity or duplicate ids across several layouts at full strength.
- `engine/designModel.test.ts` (extended) — `cloneParams` deep-clones the
  new `compositionIntelligence` field independently of the original;
  `normalizeParams` clamps its `balanceStrength`/`rhythmStrength` to [0, 1].
- `engine/styleDna.test.ts` — style loading (≥15 built-in presets, every one
  buildable and internally compatible, deterministic resolution, a multi-
  option style picks different family members across seeds, styleDnaId
  round-trips, changing style visibly changes the serialized SVG);
  migration (a pre-v1.30-shaped params object still builds and
  `computeStyleDrift` doesn't throw on it); overrides/drift (no drift right
  after applying a style, drift reported on exactly the hand-edited fields);
  reset (`resetToStyleDna` matches a fresh resolve exactly); export/import
  (valid JSON with schema version, round-trips to an equivalent resolver
  output, marks imports custom, returns `null` for malformed/incomplete
  JSON); compatibility (`isStyleDnaCompatible` rejects an unknown category/
  palette id or an empty preferred list); create/duplicate (
  `deriveStyleDnaFromParams` produces a compatible custom style with a
  fresh id, `duplicateStyleDna` copies a built-in into an independent
  custom style).
- `engine/candidateEngine.test.ts` (extended) — Style DNA integration:
  candidates explore different family members (layout/palette) across the
  pool when a multi-option style is active and untouched, a hand-picked
  override stays pinned across every candidate, and the pool stays fully
  deterministic with a style active.
- `engine/tile.test.ts` (extended) — Style DNA SVG metadata: no
  `data-style-dna-*` attributes when `styleDnaId` is unset (backward
  compatible), id/name/version embedded correctly when it's set, and an
  unknown/custom style id falls back to embedding the id itself as the name.
- `engine/motifFactory.test.ts` — `familyForCategory` covers every
  registered category; `createFactoryMotif` produces a real positive-area
  bounding box/finite radius, is deterministic for the same rng state,
  produces base/tip/center anchors consistent with the real bounding box,
  complexity is bounded [0, 100] for every category, `colorRoles` is always
  a subset of the input palette, tags always include category/role/family,
  and id is derived from category/role/index (not a global counter, so
  repeat calls never collide or drift); `generateMotifSet` covers count,
  determinism, seed sensitivity, `sizeMul` scaling, and role/styleDnaId
  propagation.
- `engine/borderCornerAssets.test.ts` — `buildBorderStrip` produces
  correct wide-vs-tall dimensions per edge, is deterministic, never emits
  NaN/Infinity, and places at least the requested motif count;
  `buildCornerUnit` is always a square `band x band` unit, is deterministic,
  never emits NaN/Infinity for any of the 4 corners, and the 3 mirrored
  corners genuinely differ in structure from the un-mirrored top-left base.
- `engine/svgStructuralAudit.test.ts` (Quality First / SVG structural audit
  milestone) — every one of the 15 registered categories, built with its
  *own* `defaultMotifSize` (matching how `ControlPanel`'s category-switch
  handler actually pairs the two), passes the same `applyHardRejectRules`
  the Candidate Engine runs in production; every coordinate in the
  serialized output stays within 3 decimal places (`svgAst.ts`'s `round()`
  discipline, scanned directly on the real serialized string — not
  asserted, checked); default-density node count for every category stays
  under the 8000 hard-reject budget; every registered layout produces
  structurally valid output with the `geometric` generator (isolates layout
  *mechanics* from per-generator node-count headroom, which the next suite
  covers separately); every motif placement is wrapped in its own unique,
  non-empty top-level group; no generator ever emits an internal element id
  (tile.ts's wrap-clone technique nests the *same* motif `SvgNode` object by
  reference into up to 9 sibling `<g>` copies, so an internal id would be
  duplicated verbatim across every copy); output is byte-identical for the
  same seed+params. A node-budget-headroom suite runs `mandala` (the
  heaviest shipped generator) and `botanical` across every layout against a
  generous 40000-node sanity ceiling (catches a true runaway/regression)
  and `console.warn`s — without failing the suite — for any combo that
  exceeds the *production* `HARD_NODE_BUDGET`: `mandala` + `radial`
  (~25700 nodes after the Project Phoenix optimization to `mandala.ts`,
  see above — was 36340 before it), `+ heroScatter` (~10450),
  `+ densePremium` (~10820), `botanical` + `radial` (~19400),
  `+ heroScatter` (~8600), `+ densePremium` (~9400) all still exceed it at
  default density — a real, reproducible finding whose root cause is
  `radial`'s own placement math (13 sub-motifs/medallion), tracked here
  rather than fully closed by further touching layout/generator math (a
  real composition/architecture decision, left as a recommendation). A
  separate regression-guard test locks in `mandala`'s optimized ~47.5
  average per-motif node count (was ~76) so a future change can't silently
  reintroduce the old per-ring-item `<g transform="rotate(...)">` pattern.
- `collection/collectionGenerator.test.ts` — every required asset type is
  present at least once, exactly 4 border + 4 corner assets, full
  determinism (excluding the real-wall-clock `createdAt`), a different seed
  produces a genuinely different collection, every SVG asset is a well-
  formed document with no NaN/Infinity/raster; every pattern asset shares
  category/palette (the manifest's own consistency check reports
  `consistent: true`), the active Style DNA id carries through, the
  positive-path guarantee holds across a sample of built-in styles, and
  `verifyConsistency` genuinely flags a real palette/style/category
  disagreement when given deliberately-mismatched params (the negative-path
  regression guard for the Designer-Assistant-style consistency check);
  every border/corner/sheet asset's `motifIds` reference real ids in the
  returned motif set, and the manifest's `relationships` list is exactly
  the flattened asset->motif pairs; the manifest schema version, unique
  filenames, and seed/palette fields; the metadata asset carries all 5
  stock sites' fields, and the SEO Package asset's CSVs cover all 5
  pattern-type assets; exactly one `collectionPreview` asset with a
  non-trivial SVG document, and its composite has no duplicate ids (every
  namespaced source tile stays unique within the one document).
- `collection/collectionScore.test.ts` — a normal collection scores 100 on
  every dimension; carrying an active Style DNA still scores 100; fully
  deterministic for the same params; a simulated palette drift genuinely
  lowers `paletteConsistency` and surfaces in `issues` (regression guard); a
  missing required asset type or a corrupted SVG genuinely lowers
  `commercialReadiness`; `REQUIRED_ASSET_TYPES` is exactly the 10 core
  creative types.
- `metadata/submissionCenter.test.ts` — `buildSubmissionChecklist` returns
  exactly the 11 required items with real non-empty labels/statuses/
  details; SVG Generated/Preview Generated/SVG Valid are ready for a
  normal tile; Collection Ready correctly reflects whether the current
  seed matches the last-generated collection's seed (including the stale-
  seed case); Originality Checklist warns on a real duplicate in the saved
  library and stays ready otherwise; full determinism. `analyzeSeo`: score
  bounded [0, 100], keyword count matches real generated data, never
  reports duplicates against this app's own (already-deduped) keyword
  output, all lengths reflect real non-zero content, commercial tags are a
  real subset of generated keywords, coverage bounded [0, 100],
  determinism. `computeStockReadiness`: exactly 5 cards, a healthy pattern
  is ready with no issues on every site, a deliberately-invalid SVG
  checklist produces real issues on every card.
  `buildSubmissionRecommendations`: empty for a fully healthy pattern, and
  produces a real recommendation that names the specific missing checklist
  item when one is missing.
- `project/projectManager.test.ts` — `createProject` starts empty;
  `duplicateProject` gets a new id, `(copy)` name, and independently-cloned
  (non-shared-reference) nested arrays; rename/favorite/archive toggle
  correctly and independently; `addCollectionToProject` appends the
  collection and records exactly one export history entry, a second
  addition prepends (newest-first) and accumulates history;
  `removeCollectionFromProject` removes without touching history;
  `setCollectionUploadStatus` updates one site without disturbing others;
  saved-item id references dedupe on add and remove cleanly;
  `migrateLegacyDataIntoProject` references every pre-existing saved item
  id (and handles an empty library); `setAssetSeoOverride` saves a
  marketplace override on the targeted asset only, without mutating the
  input project, and different marketplaces on the same asset stay
  independent; re-setting the same marketplace overwrites it;
  `clearAssetSeoOverride` removes only the targeted marketplace (leaving
  others intact) and is a safe no-op on an asset with no `seo` store yet;
  backward compatibility — a freshly generated collection's assets all
  start with `seo: undefined`.
- `project/projectStats.test.ts` — `listProjectAssets` is empty for a
  collection-less project and flattens every asset across every collection,
  tagged with its own collection; `computeProjectStats` reports
  zeroed/empty stats for a brand-new project, real counts and
  complete/exported status once a collection exists, and correctly
  transitions upload status through notStarted → inProgress → allReady as
  sites are marked; fully deterministic.
- `project/designerAssistant.test.ts` — `reviewProject` flags an empty
  project and recommends generating a collection; a healthy single-
  collection project has no issues and a 100 average score; still
  recommends filling in Concept/Moodboard until they're set, then stops
  recommending once they are; genuinely flags a real Style DNA mismatch
  *across* multiple collections in the same project (regression guard);
  fully deterministic.
- `project/projectJson.test.ts` — round-trips a project (with a collection)
  through export/import back to an equivalent object (compared against the
  JSON-normalized shape, since serialization legitimately drops explicit
  `undefined` fields); the exported document carries the current schema
  version and a real `exportedAt` timestamp; rejects invalid JSON,
  well-formed-but-wrong-shape JSON, and a project object missing required
  array fields.
- `metadata/marketplaceProfiles.test.ts` — all 6 marketplaces present and
  match `STOCK_SITES`; only Etsy is `future`; every profile has complete
  title/description/keyword/filename rules and a category mapping;
  contributor URLs match `contributorLinks.ts` and unverified ones are
  flagged consistently; Etsy's 13-tag/20-char-each rule is present;
  backward compatibility — the 5 pre-existing marketplaces' numbers are
  byte-identical to what `submissionCenter.ts` used before this milestone.
- `metadata/filenameEngine.test.ts` — filename generation for every
  marketplace, correct `.svg`/`.eps` extension per profile, determinism,
  varies with seed, truncates at a hyphen (never mid-word) when over a
  profile's max length, template resolution (including an unrecognized
  placeholder left as-is), a custom template overrides the default, and
  `dedupeFilename` appends `-2`/`-3` and handles a no-extension filename.
- `metadata/marketplaceSeo.test.ts` — every marketplace produces non-empty
  fields where its profile expects them, description presence correctly
  differentiates by marketplace, Etsy's tag-count/length limits are
  respected, generation is deterministic, `generateAllMarketplaceSeo`
  covers every marketplace, and a custom filename template doesn't leak
  into other marketplaces' results.
- `metadata/marketplaceValidation.test.ts` — a healthy SEO object produces
  zero issues; every individual validation code (title too short/long,
  description missing, keywords missing/too many, duplicate keywords, a
  keyword over Etsy's length cap, invalid/too-long filename) triggers on a
  constructed input designed to hit it; `isMarketplaceReady` is true with
  only warnings and false with any error.
- `metadata/exportPackage.test.ts` — every marketplace's package contains
  at minimum `title.txt`/`keywords.txt`/`filename.txt`/`metadata.json`;
  `description.txt` is present only where the marketplace actually has
  one; `metadata.json` is valid JSON carrying the real generated SEO and
  validation result; content matches what the SEO generator/Filename
  Engine would produce; fully deterministic; respects a custom filename
  template; `buildPackageTextFilesFromSeo` uses a caller-supplied
  `MarketplaceSeo` verbatim (hand-edited title/description/keywords/
  filename that deliberately differ from what generation would produce)
  instead of silently regenerating and discarding it, including inside
  `metadata.json`'s embedded validation result; `buildMarketplacePackageTextFiles`
  is confirmed to be a thin wrapper that delegates to
  `buildPackageTextFilesFromSeo` with a freshly generated SEO.
- `trend/keywordMap.test.ts`, `trend/keywordBundle.test.ts`,
  `trend/trendPacks.test.ts`, `trend/designIntelligence.test.ts`,
  `trend/designSpecValidation.test.ts`, `trend/designSpecToParams.test.ts`,
  `trend/designSpecSeo.test.ts`, `trend/designSpecPackage.test.ts`,
  `trend/promptTemplates.test.ts`, `trend/designSpecQuality.test.ts`,
  `trend/designSpecCollection.test.ts` — see "Trend Intelligence Studio"
  below.

## Trend Intelligence Studio (Phase 1 — Design Specification foundation) (`trend/`)

Phase 1 of a larger, explicitly phased milestone (agreed with the user via
`AskUserQuestion` given its size — 16 sections in the original brief). This
phase builds only the foundation everything else depends on: the **Design
Specification JSON** schema and the pure, DOM-free logic that assembles one
from a **Keyword Bundle** + an optional **Trend Pack**. No UI yet (no new
page, no JSON editor) and no wiring into the SVG/SEO/export engines yet —
those are later phases, once this schema is proven stable and tested.

Distinct from the pre-existing `engine/trendEngine.ts` (v1.27, unchanged):
that module is a single-pattern "style preset" resolved straight into
`GenerateParams` for one tile, still used by the Control Panel's Trend
Intelligence section. A **Trend Pack** here operates one level up, at the
keyword-bundle/collection level, and never touches `GenerateParams`
directly — it's one of several inputs `designIntelligence.ts` merges into
a `DesignSpecification`.

### Design Specification schema (`trend/designSpecTypes.ts`)

`DesignSpecification` — `schemaVersion`, `project`, `collection`,
`marketplace`, `trend`, `keywordBundle`, `styleDnaId`, `palette`,
`colorRoles`, `composition`, `repeatType`, `density`, `hierarchy`, `flow`,
`rhythm`, `negativeSpace`, `heroMotifs`/`secondaryMotifs`/`fillers`,
`background`, `svgHints`, `seoHints`, `exportHints`, `qualityTargets` —
exactly the Section 5 field list. Every field re-uses a real existing
engine type instead of inventing a parallel one specifically so a later
"SVG Engine consumes the Design Specification directly, no duplicated
logic" phase is a mechanical mapping, not a redesign:
`repeatType` is `LayoutId` unchanged, `hierarchy` is `HierarchyParams`
unchanged, `flow`/`rhythm` are engine/styleDna.ts's `FlowProfile`/
`RhythmProfile` enums (that module's `FLOW_ROTATION_JITTER`/
`RHYTHM_STRENGTH` tables were exported, not duplicated, so resolving them
into numbers reuses the exact values Style DNA already uses),
`negativeSpace` is the same `GenerateParams.negativeSpace`, and every
`svgHints` field maps 1:1 onto a remaining `GenerateParams` field.
`colorRoles` (named background/primary/secondary/accent roles) is a new,
small concept — deliberately distinct from `engine/motifFactory.ts`'s
unrelated `colorRoles` field (that one is a per-motif "which colors did
this motif actually use" audit list; this one is a palette-level role
assignment for moodboard/SEO copy) — always derived from the *actually
resolved* palette's own colors, so `colorRoles` values are guaranteed to
be a subset of `palette.colors` (asserted by tests).

### Keyword Bundle + relationship resolution (`trend/keywordMap.ts`, `trend/keywordBundle.ts`)

`KEYWORD_MAP` (Section 14's "no hardcoded data" config) maps individual
keyword tokens (matched case-insensitively, multi-word keys like "muted
green" checked before falling back to single words) to palette/motif/
Style DNA/composition/mood hints, each with a relative weight. Section 2's
explicit requirement — "understand the relationship between keywords
instead of treating them independently" — is `COMBO_RULES`: a curated set
of token-pair rules (e.g. Luxury + Botanical -> `luxuryFloral` + editorial
composition, overriding what either keyword alone would suggest) applied
*in addition to* the individual signals, not instead of them.
`resolveKeywordBundle(bundle)` merges every keyword in a `KeywordBundle`
(primary weighted 2x over secondary, on top of each token's own
`KEYWORD_MAP` weight), applies matching combo bonuses, and returns every
hint category ranked by aggregated score — deterministic, pure, no
randomness.

### Trend Library (`trend/trendPacks.ts`)

`TREND_PACKS` — 4 real, grounded quarterly packs for 2026 (Q1 Quiet Luxury
Botanical, Q2 Modern Tropical Editorial, Q3 Vintage Herbarium, Q4 Dark
Academia Maximalist), each with every Section 3 field (theme, mood,
commercial uses, palette direction, popular motifs, suggested layouts,
negative space, composition style, Style DNA id, color roles, pattern
types, collection recommendations) — every category/layout/Style-DNA id
referenced is real and verified by tests, every `colorRoles` hex is lifted
directly from a real `palettes/palettes.ts` entry, not invented.
`exportTrendPackJson`/`importTrendPackJson` provide the "editable,
import/export as JSON" requirement (same structural-validation-only, Thai-
error-message convention `project/projectJson.ts` established).

### Design Intelligence (`trend/designIntelligence.ts`)

`buildDesignSpecification({ keywordBundle, trendPackId?, ... })` is the
Section 5 core — Market Research -> Keyword Bundle -> Trend Analysis ->
Design Intelligence -> Design Specification JSON. `resolveTrendPack`
either honors an explicit `trendPackId` (returning `null` if it doesn't
exist — never silently falling back) or auto-matches by season, then
pattern type. Every other field resolves through a clear, tested priority
order — e.g. `styleDnaId`: an explicit `keywordBundle.styleDnaId` always
wins, then the top keyword-derived Style DNA signal, then the matched
Trend Pack's own `styleDnaId`, then a sensible default — so a strong
keyword signal (e.g. "Luxury Botanical") can outrank a Trend Pack's
generic default, while a Trend Pack still supplies sensible values when
keywords alone don't produce a strong signal. `composition` (a
Section 3-style descriptive label) resolves to a real `HIERARCHY_PRESETS`
key via `COMPOSITION_STYLE_TO_HIERARCHY`, and `density` comes from the
Keyword Bundle's `difficulty` input (`simple`/`moderate`/`complex` ->
distinct density values).

### Schema Check / Validation (`trend/designSpecValidation.ts`)

Two layers, matching Section 6's "Validation" + "Schema Check" JSON Editor
requirements (the editor UI itself is a later phase): `parseDesignSpecificationJson`
rejects a document that isn't even shaped like a `DesignSpecification`
(missing required top-level keys) on import; `validateDesignSpecification`
accepts an already shape-valid spec and reports *semantic* problems —
every id referenced (category, layout, palette, Style DNA, marketplace)
checked against the real registry it should exist in, every 0..1-ranged
number range-checked, `colorRoles` checked against the actual palette —
as `error`/`warning`-severity `ValidationIssue[]`, so a future JSON Editor
can highlight problems without hard-blocking editing.

### SVG Engine adapter — "no duplicated logic" (`trend/designSpecToParams.ts`)

Section 8's explicit requirement ("The SVG generator must consume the
Design Specification directly. No duplicated logic.") — the first
downstream consumer wired to the Phase 1 schema. `buildGenerateParamsFromDesignSpec(spec, seed)`
maps every `GenerateParams` field straight off the spec (mostly the exact
same value under the exact same name, by design from Phase 1) and
`buildTileFromDesignSpec(spec, seed)` hands that straight to the existing,
completely unmodified `buildTile` — no generation logic re-implemented
here, only the mapping. `seed` is a separate argument (not read from the
spec) so one Design Specification can deterministically generate many
distinct collection assets via distinct derived seeds, the same convention
`collectionGenerator.ts` already uses for Hero/Secondary/Blender/Mini/
Stripe. Verified for every one of the 4 Trend Packs: builds a valid,
non-empty tile without throwing, is deterministic for the same spec+seed,
and two different Trend Packs (with no keyword-derived signal pinning the
palette/Style DNA) genuinely produce different generated output — proof
the mapping isn't a no-op.

### SEO Engine — market-driven Title/Description/Keywords/Filename/Collection Name/Asset Name (`trend/designSpecSeo.ts`)

Section 9's requirement, layered on top of the *already-existing* v1.35
Marketplace Profile System rather than duplicating it: metadata/
marketplaceSeo.ts's `generateMarketplaceSeo` (itself built on
`buildSiteMetadata`, still the single source of truth for the base per-
site copy) stays exactly as-is; this module's whole job is blending the
Design Specification's own `seoHints` (the Keyword Bundle's primary/
secondary keywords, commercial category, audience, season) into that
generated copy, so the result reflects real market keywords instead of
only generic category text.

- `blendKeywordIntoTitle(baseTitle, primaryKeyword, maxLength)` — front-
  loads the primary keyword (marketplaces weight earlier words more
  heavily, the same fact `metadata/submissionCenter.ts`'s own UI copy
  documents) unless it's already naturally present in the generated
  title; truncates only the *generated* portion at a word boundary to
  respect the marketplace's `titleRules.maxLength` — the keyword itself
  is never the part that gets cut.
- `blendKeywordsIntoList(baseKeywords, bundleKeywords, maxCount, maxKeywordLength?)`
  — puts every Keyword Bundle term at the front of the keyword list,
  case-insensitively deduped against the generated list, trimmed to the
  marketplace's own count/length limits (Etsy's 20-char tag cap included).
- `buildDesignSpecCollectionName`/`buildDesignSpecAssetName` — the
  Section 9 "Collection Name"/"Asset Name" outputs, both keyword-led
  human-readable display names (distinct from the Filename Engine's
  slugified, extension-bearing output below).
- `buildDesignSpecSeo(spec, tileData, marketplaceId, assetLabel?, customFilenameTemplate?)`
  assembles the complete package for one marketplace — title/description/
  keywords blended as above, plus a filename built from a new default
  template, `{keyword}-{palette}-{category}-seamless-pattern-{seed}`
  (leading with the keyword; the plain Marketplace Profile System's own
  default template has no keyword placeholder at all, which would defeat
  the point of a *market-driven* filename). `buildAllDesignSpecSeo`
  covers every marketplace in one call — Section 4/9's "store SEO
  independently for every marketplace," mirroring
  `generateAllMarketplaceSeo`. The result is a strict superset of
  `MarketplaceSeo` (`collectionName`/`assetName` added), so it passes
  straight through the *existing, unmodified* `validateMarketplaceSeo`/
  `isMarketplaceReady` — verified for every one of the 6 marketplaces.
- `metadata/filenameEngine.ts`'s `resolveFilenameTemplate`/
  `buildMarketplaceFilenameBase`/`buildMarketplaceFilename` gained an
  additive, optional `extra?: Record<string, string>` parameter (the
  `{keyword}` placeholder's actual resolution mechanism) — fully backward
  compatible, verified by a dedicated test that omitting it behaves
  exactly as before. `metadata/shutterstock.ts`'s private `truncateWords`
  helper was exported (no behavior change) so this module reuses the
  exact same word-boundary truncation instead of a second copy.

### Marketplace Package (`trend/designSpecPackage.ts`)

Section 10's "For every marketplace generate SVG, PNG Preview, SEO,
Filename, Metadata, Manifest, ZIP" — reuses the *existing, unmodified*
`metadata/exportPackage.ts`'s `buildPackageTextFilesFromSeo` for the
standard title/description/keywords/filename/metadata.json set (fed the
Design-Spec-driven `DesignSpecSeo` from `designSpecSeo.ts`, which is a
strict superset of the `MarketplaceSeo` shape that function already
expects — no new package-building logic needed there at all) and adds the
one file this flow specifically needs on top: **`manifest.json`** — the
schema version, a real ISO timestamp, the seed used, the marketplace id,
the Project id/name, the matched Trend Pack (or `null`), the full Keyword
Bundle summary, the resolved Collection Name/Asset Name, and the complete
list of files the finished package will contain (including `pattern.svg`/
`preview.png`, which are added one layer up — see below — so the manifest
accurately documents the *actual* zip contents even though this module
never touches the SVG/PNG itself). `buildAllDesignSpecPackageTextFiles`
covers every marketplace in one call, mirroring `designSpecSeo.ts`'s
`buildAllDesignSpecSeo`.

SVG generation, PNG rasterization, and ZIP assembly stay exactly where
every other export in this app already puts them — one layer up, in
`App.tsx` — since this module (like every other engine-layer module) is
deliberately kept DOM-free and unit-testable; wiring an actual "Download
Package" button for this Design-Spec-driven flow is a later phase once
the Trend Studio UI exists to trigger it from.

### Prompt Factory (`trend/promptTemplates.ts`)

Section 7's "Generate prompts from the Design Specification. Support
ChatGPT, Claude, Gemini, Adobe Firefly, Midjourney, Stable Diffusion,
FLUX. Prompt templates must be stored externally. Do not hardcode
prompts." `PROMPT_TEMPLATES` is the one config object every template
lives in (never inlined in a UI component) — same "one editable config,
not scattered magic strings" convention `marketplaceProfiles.ts`/
`trendPacks.ts`/`keywordMap.ts` already established for this app's
no-server-backend architecture, with the same JSON export/import escape
hatch `trendPacks.ts` provides (`exportPromptTemplateJson`/
`importPromptTemplateJson`) so a user can hand-tune a platform's wording
without touching source code.

Two platform kinds, since they serve genuinely different purposes for a
surface-pattern designer: **conversational** (ChatGPT/Claude/Gemini) asks
the LLM for creative brainstorming help — additional motif ideas, a
refined title, marketing copy — since none of the three generate images.
**imageGeneration** (Adobe Firefly/Midjourney/Stable Diffusion/FLUX) is an
actual txt2img prompt for moodboard/reference art (none of these tools
produce an editable seamless *vector* pattern directly — that's still
this app's own SVG Engine); Midjourney's prompt additionally carries its
real `--tile --ar 1:1 --v 6` generation flags as a `suffix`, since seamless
tiling is an actual Midjourney parameter worth setting correctly.
`resolvePromptTemplate(template, spec)` fills every `{placeholder}`
(`primaryKeyword`, `secondaryKeywords`, `mood`, `theme`, `styleDna`,
`patternType`, `composition`, `colorList`, `season`, `audience`,
`commercialCategory`, `marketplace`) from a real `DesignSpecification` —
an unrecognized placeholder is left as literal text rather than throwing,
the same graceful-degradation convention `filenameEngine.ts`'s
`resolveFilenameTemplate` uses. `buildPrompt`/`buildAllPrompts` resolve
one platform / every platform in one call.

### UI — the original Trend Intelligence Studio page (superseded by the Design Workbench)

> **Superseded**: this single-file panel (`components/TrendStudioPanel.tsx`)
> was replaced by the modular Design Workbench
> (`components/workbench/DesignWorkbench.tsx` + its subcomponents — see
> [`DESIGN_WORKBENCH.md`](./DESIGN_WORKBENCH.md)) and the file has been
> deleted. Every generator this section describes (`buildDesignSpecification`,
> `buildTileFromDesignSpec`, `buildDesignSpecSeo`, `buildPrompt`,
> `buildDesignSpecPackageTextFiles`) is unchanged and still what the new UI
> calls — this section is kept as a historical record of how the feature
> originally shipped, not a description of the current UI.

The first UI for this whole milestone, closing the loop Sections 1/6/13
asked for: every generator above (`buildDesignSpecification`,
`buildTileFromDesignSpec`, `buildDesignSpecSeo`, `buildPrompt`,
`buildDesignSpecPackageTextFiles`) already existed and was independently
unit-tested before this component was written — the component is purely
UI wiring, no new generation logic.

- **Section 1/2 — Keyword Bundle form**: every `KeywordBundle` field as a
  real input (Primary/Secondary Keywords, Marketplace, Season, Audience,
  Commercial Category, Pattern Type, Style DNA — "let the system choose"
  is a real option, not a forced pick — Palette Direction, Difficulty,
  Collection Size).
- **Section 3 — Trend Pack picker**: a chip row (`TREND_PACK_LIST` +
  "✨ Auto-match", which leaves `trendPackId` unset so
  `designIntelligence.ts`'s own season/pattern-type auto-match resolves it
  — the exact same function the pure-logic layer already tests).
- **"🧠 Generate Design Specification"** calls `buildDesignSpecification`
  directly and pushes the result onto a local undo/redo history stack
  (`history: DesignSpecification[]` + `historyIndex`).
- **Section 6 — JSON Editor**: a **Code View** (a controlled `<textarea>`
  synced to `JSON.stringify(spec, null, 2)`, with an "✅ Apply Edits"
  button that runs the edited text through the existing
  `parseDesignSpecificationJson` — a shape-invalid edit shows the real
  Thai error message inline instead of silently discarding the edit) and
  a **Tree View** (`JsonTreeNode`, a small recursive read-only renderer
  over the actual spec object — no separate schema description to drift
  out of sync). **Validation**/**Schema Check**: `validateDesignSpecification`'s
  real issues rendered live, with a Ready/Issues indicator matching the
  same visual language the Marketplace Profile Selector already
  established. **Undo/Redo**: plain history-stack navigation, re-syncing
  the Code View's textarea on each step.
- **Section 13 — Live Preview**: Trend Summary (theme/mood/composition/
  density/negative space), Moodboard (`colorRoles` swatches), Palette
  (`palette.colors` swatches), Motif Preview (hero/secondary category
  labels + resolved Style DNA label) — all read directly off the spec, no
  separate preview-only computation.
- **Real SVG generation**: `buildTileFromDesignSpec(spec, seed)` renders
  the actual pattern inline (`buildSingleTileSvg`, same
  `dangerouslySetInnerHTML` pattern `ProjectPanel.tsx`'s Asset Browser
  already uses) — this is a real generated tile, not a mockup, and reuses
  the exact same underlying `buildTile` the main editor's own "Generate"
  button calls (so it's also subject to the same existing safety-net UI —
  a Design Spec that lands on a known-heavy category/layout combination
  shows up as ❌ in the Submission Checklist after being applied, exactly
  as it would for any other pattern; this page doesn't special-case or
  hide that, it's the same real quality signal every other pattern gets).
  **"✍️ ใช้ค่านี้ในหน้าสร้างลาย"** applies `buildGenerateParamsFromDesignSpec`'s
  result straight to the main editor's `params`/`tileData` (same
  `setTileData`+`setParams` pairing `handleRescale` already uses) and
  switches back to the editor view — the actual "Review & Edit" handoff
  into the app's one real generation surface.
- **SEO Preview / Marketplace Package**: a marketplace chip row drives
  `buildDesignSpecSeo` for a live Title/Description/Keywords/Filename/
  Collection Name/Asset Name preview with copy buttons and a real
  Ready/Issues indicator (`validateMarketplaceSeo`, unmodified); "📦
  ดาวน์โหลด Marketplace Package" is wired in `App.tsx`
  (`handleDownloadDesignSpecPackage`) the same way every other zip export
  in this app is — PNG rasterization is DOM-dependent and lives there,
  every text/JSON file comes from the DOM-free `buildDesignSpecPackageTextFiles`.
- **Prompt Preview**: a platform chip row drives `buildPrompt` for a live,
  copyable prompt per platform.
- **"🎯 Run Quality Loop"** (in the Composition Diagram card) and
  **"🏭 Generate Collection จาก Design Spec"** — see their own sections
  below (`trend/designSpecQuality.ts`, `trend/designSpecCollection.ts`).
- **Navigation**: `App.tsx`'s `view` state gained a third mode,
  `'trendStudio'` (alongside the existing `'editor'`/`'dashboard'`), opened
  via a new "🧠 Trend Intelligence Studio" button in `ProjectBar.tsx`
  (next to the existing "📊 Project Dashboard" button) — same top-level
  view-switch convention the Project Dashboard already established.
- Verified live via Playwright against the real dev server: filling the
  form and generating a spec renders a real, correct Design Specification
  JSON; switching Trend Pack chips changes the resolved theme/mood/
  palette/Style DNA; Tree View and Code View both render correctly and
  toggle cleanly; the Composition Diagram shows a genuinely rendered
  pattern; switching marketplace/prompt-platform chips updates the SEO/
  prompt preview live; "ใช้ค่านี้ในหน้าสร้างลาย" correctly returns to the
  editor with the Design Spec's category/layout/palette actually applied
  (visible in the Control Panel's own selection state); "Run Quality Loop"
  produces a real 10-metric report and correctly replaces the previewed
  tile with the winning candidate; "Generate Collection จาก Design Spec"
  produces a real downloaded zip and attributes it to the active project;
  zero console errors throughout the whole flow.

### Design Quality auto-improve loop (`trend/designSpecQuality.ts`)

Section 12's "Run automatic quality analysis... if quality is below
threshold: Improve automatically, Re-evaluate, Repeat." Reuses the
*existing* `engine/candidateEngine.ts`'s `generateBest` (the same pool-
generate-then-pick-the-highest-scoring-candidate pipeline the main
editor's own "Generate Best" quality mode already uses) and
`engine/scoring.ts`'s real `CompositionMetrics` — no second scoring
implementation. "Improve automatically" means exactly what this app's
existing Candidate Engine already means: generate a fresh deterministic
candidate pool from a new derived seed (`deriveSeed`, reused) and keep
whichever round scored higher, up to a bounded `maxRounds` (default 3,
never unbounded).

`runDesignSpecQualityLoop(spec, seed, mode?, maxRounds?)` builds a
`DesignSpecQualityReport` covering all 10 of Section 12's named metrics —
resolved against the real `CompositionMetrics` wherever an exact match
exists (Composition, Hierarchy, "Repeat Quality" = `seamlessIntegrity`,
"SVG Health" = `svgHealth`, "Balance" = the 3 balance metrics averaged,
"Negative Space" = `largestEmptyRegion`, a real *measured* proxy — not the
spec's own *input* `negativeSpace` number) and a clearly-labeled averaged
proxy for the 3 that have no single existing metric (Flow, Rhythm, Motif
Diversity) plus Commercial Readiness — then checks it against the spec's
own `qualityTargets` (the 4 fields Phase 1 deliberately named to line up
with this exact wiring). `checkDesignSpecQuality` reports which specific
targets weren't met. `qualityPresetForDesignSpec` maps the spec's
`composition` style onto a real `QualityPresetId` for `generateBest`'s
scoring weights.

UI: the Trend Studio's "🎯 Run Quality Loop" button (in the Composition
Diagram card) runs the loop against the currently-shown seed and replaces
the previewed tile with the winning round's real generated output,
alongside the full 10-metric report and any shortfalls — the same
pattern applied elsewhere in this app of never special-casing or hiding a
real quality signal.

### Collection Generator (`trend/designSpecCollection.ts`)

Section 11's "Generate Hero Pattern, Secondary Pattern, Mini Pattern,
Stripe, Border, Corner, Spot Motifs. All assets share Style DNA, Palette,
Motif Family, Collection Identity." Reuses the *existing, unmodified*
`collection/collectionGenerator.ts`'s `generateCollection` for every
asset (no duplicated asset-building logic) — Style DNA/Palette/Motif
Family sharing across every asset is already guaranteed by that
function's own existing consistency mechanism (`verifyConsistency`),
untouched here. `generateCollection` gained one small additive parameter,
`collectionNameOverride?: string` (defaults to the pre-existing generic
"{family} collection — {categoryId}" name when omitted, so every other
caller is unaffected) — the "Collection Identity" this section asks for
is the Design Specification's own market-driven name
(`designSpecSeo.ts`'s `buildDesignSpecCollectionName`) instead of that
generic default. `resolveDesignSpecStyleDna` resolves the spec's
`styleDnaId` into a real `StyleDna` (built-in presets by default; a
caller with access to `storage/styleDnaStore.ts`, i.e. the UI layer, can
pass a resolved custom style in — this pure engine module never reads
localStorage itself, same "custom styles aren't visible to pure engine
code" precedent `engine/candidateEngine.ts` already documents).

UI: the Trend Studio's "🏭 Generate Collection จาก Design Spec" button
(`App.tsx`'s `handleGenerateCollectionFromDesignSpec`) mirrors the main
editor's existing `handleGenerateCollection` exactly — build, download
the zip, attribute it to the active project (creating a fresh one on the
spot in the pathological case where none is active) — just driven by a
Design Specification + seed through `buildCollectionFromDesignSpec`
instead of the main editor's own `params`.

## Adding a new pattern category

Implement the `PatternGenerator` interface in a new file under
`src/generators/` (see `geometric.ts` for the smallest example) and add it
to the registry in `src/generators/index.ts`. Nothing in the engine,
layouts, or UI needs to change — the control panel picks up new categories
automatically.

Two optional generator fields exist specifically for "field" patterns
(checkerboard, gingham, stripes — a solid grid of touching cells, not
scattered icons):
- `recommendedDensity` — the UI switches the density slider to this value
  when the category is selected, since field patterns look broken with
  gaps at a typical ~50% density but need ~90%+ to look tight.
- `disableGridRhythm` — grid/brick/half-drop normally shrink every other
  cell for visual rhythm; field patterns need every cell exactly the same
  size instead, since the size variation reads as a rendering glitch when
  the *color* alternation is the whole point of the pattern.

`createMotif` also receives an optional `colorSeed` (the placement's grid
row+col for grid/brick/half-drop) so a generator can alternate color by
true position instead of randomly — required for a checkerboard/gingham to
actually alternate correctly rather than just picking random per-square
colors, which looks broken for that specific pattern family.

## Adding a new layout

Implement the `PatternLayout` interface under `src/layouts/` (returns an
array of `{x, y, rotationDeg, scale, colorSeed}` placements given tile size/
density/jitter params) and register it in `src/layouts/index.ts`.

## Project structure

```
src/
  engine/
    types.ts       shared types (SvgNode AST, Placement, GenerateParams, ...)
    rng.ts          seeded PRNG (mulberry32) + helpers
    svgAst.ts       SvgNode builder + serializer + path-building helpers
    tile.ts         combines layout + generator + wrap/clip into one tile
    defaults.ts     default & randomized GenerateParams
    svgOptimizer.ts SVG Intelligence Engine Phase 3: lossless node-count optimizer (runs at export)
    clusterEngine.ts Project Phoenix V2: Cluster Composition Engine (8 archetypes, generate/evaluate/place/connect)
    heroComplexity.ts Project Phoenix V2: generator-agnostic hero-motif detail overlay
  generators/       one file per pattern category
  layouts/          one file per placement strategy
  palettes/         flat-design color palettes
    colorTransform.ts   Commercial Collection Engine Phase 4: hex<->HSL math (Color Story Engine's building block)
  export/
    svgExporter.ts    single-tile / pre-tiled SVG string builders + download
    previewMarkup.ts  <pattern>-based markup for on-screen preview/thumbnails
  storage/
    db.ts               shared IndexedDB open/tx helpers + localStorage fallback (used by both stores below)
    savedStore.ts       IndexedDB-backed saved pattern library
    projectStore.ts     IndexedDB-backed Project store
    styleDnaStore.ts    localStorage-backed custom Style DNA + favorites
  collection/
    collectionGenerator.ts   Collection Studio Engine: builds a full Collection (assets + manifest)
    collectionScore.ts       7-dimension Collection Score (consistency + diversity + commercial readiness)
    colorStory.ts            Phase 4/4b: 13 named palette variants (Light/Dark/seasons/Monochrome/Muted/Bold/Earth Tone/Luxury/Pastel)
    productTargets.ts        Phase 4: real rule-based scoring of the 10 named product uses
    motifReuse.ts            Phase 4b: Motif Reuse Engine — shared-motif reporting across assets
  project/
    projectTypes.ts        Project/ProjectCollectionEntry/ProjectExportHistoryEntry types
    projectManager.ts      pure Project CRUD + legacy-data migration
    projectStats.ts        Dashboard stats + Asset Browser data source
    designerAssistant.ts   project-wide Designer Assistant review
    projectJson.ts         Project JSON export/import
  metadata/
    shutterstock.ts         per-site SEO metadata (title/description/keywords)
    contributorLinks.ts     Contributor Center: all 6 link types (Portal/Submission/Analytics/Help/Guidelines/Support) per marketplace
    submissionCenter.ts     submission checklist + SEO analyzer + stock readiness
    marketplaceProfiles.ts  Marketplace Profile System: per-marketplace rules, loaded from ../marketplaces/*.json (Phase 5)
    filenameEngine.ts       marketplace-specific filename templates + dedupe
    marketplaceSeo.ts       generates one marketplace's Title/Description/Keywords/Filename
    marketplaceValidation.ts validates generated SEO against a marketplace's own rules (9 fields, Phase 5)
    exportPackage.ts        builds a marketplace's Export Package text/JSON files + Package Profile (Phase 5)
    readinessScore.ts       Phase 5: unified 5-dimension Readiness Score per marketplace
  trend/
    designSpecTypes.ts      Design Specification JSON schema + Keyword Bundle types
    keywordMap.ts            keyword -> engine signal config (palette/motif/Style DNA/mood hints)
    keywordBundle.ts         merges a Keyword Bundle's signals (+ combo rules) into ranked hints
    trendPacks.ts            Trend Library: quarterly market packs + JSON import/export
    designIntelligence.ts    assembles one Design Specification from a Keyword Bundle + Trend Pack
    designSpecValidation.ts  Design Spec JSON parsing + semantic validation/schema-check
    designSpecToParams.ts    SVG Engine adapter: Design Spec -> GenerateParams -> buildTile
    designSpecSeo.ts         SEO Engine: market-driven Title/Description/Keywords/Filename
    designSpecPackage.ts     Marketplace Package text/JSON files, driven by a Design Spec
    promptTemplates.ts       Prompt Factory: AI prompt templates for 7 platforms
    designSpecQuality.ts     Design Quality auto-improve loop (reuses the Candidate Engine)
    designSpecCollection.ts  Collection Generator, driven directly by a Design Spec
    collectionPlan.ts        Phase 4/4b/5 Collection Planner: Plan/Specification JSON/preview metadata/export prep/marketplace filenames
    seoHintEngine.ts         Phase 5: SEO Hint Engine — non-final marketplace-specific suggestions from a Design Spec alone
  components/
    ControlPanel.tsx
    StyleDnaPanel.tsx
    StockSubmissionCenter.tsx
    MarketplaceProfileSelector.tsx
    ProjectBar.tsx
    ProjectDashboard.tsx
    ProjectPanel.tsx
    PreviewCanvas.tsx
    Gallery.tsx
    workbench/             Design Workbench — see DESIGN_WORKBENCH.md
      DesignWorkbench.tsx
      TrendStudioForm.tsx
      DesignSpecPanel.tsx
      JsonTreeView.tsx
      PropertyInspector.tsx
      ValidationPanel.tsx
      LivePreviewPanel.tsx
      HistoryPanel.tsx
      FavoritesPanel.tsx
      ImportExportBar.tsx
      ResizeHandle.tsx       Phase 6: real pointer-drag sidebar resize
      PanelVisibilityBar.tsx Phase 6: panel hide/restore chips
      GlobalSearchBar.tsx    Phase 6: Section 9 Global Search UI
      ProjectExplorer.tsx    Phase 6: Section 2 Project Explorer panel
      MarketplacePanel.tsx   Phase 6: Section 5 Marketplace Panel
      PromptPanel.tsx        Phase 6: Section 6 Prompt Panel
      QualityPanel.tsx       Phase 6: Section 7 Quality Panel
      workbench.css
```

### Design Intelligence Core (data + validation layer, consumed by the Design Workbench)

See [`DESIGN_INTELLIGENCE_CORE.md`](./DESIGN_INTELLIGENCE_CORE.md) for the
full architecture/schema/developer-guide writeup and
[`DESIGN_WORKBENCH.md`](./DESIGN_WORKBENCH.md) for how the Design
Workbench UI consumes it (via `services/*` and `validators/*`). Folder
summary:

```
src/
  schemas/            10 JSON Schema (draft-07 subset) documents
  trend-packs/         Trend Pack data (JSON) + index.ts loader
  marketplaces/         Marketplace Profile data (JSON) + index.ts loader — Phase 5:
                        the real, single source of truth metadata/marketplaceProfiles.ts
                        now builds MARKETPLACE_PROFILES from (no longer a parallel mirror)
  style-dna/            Style DNA data (JSON) + index.ts loader
  pattern-grammar/      Pattern Grammar Library (JSON, new) + index.ts loader
  motif-grammar/        Motif Grammar Library (JSON, new) + index.ts loader
  color-roles/          Color Role System + palette mirror (JSON, new) + index.ts loader
  validators/           JSON Schema validation engine + schema registry +
                         relationship/marketplace-compatibility validator
  services/              Query/lookup layer + Keyword Bundle Engine
  workbench/              Design Workbench's pure logic layer — see
                          DESIGN_WORKBENCH.md
  knowledge/              Design Knowledge Engine — see
                          DESIGN_KNOWLEDGE_ENGINE.md
    style/ motif/ palette/ composition/ pattern/ collection/
    marketplace/ rules/ recommendation/ history/  (10 domains)
    index.ts               Top-level barrel
    validation.ts          Cross-domain validation
```
