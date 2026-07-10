# Vector Stock Pattern Studio (React app)

A client-only React + TypeScript + Vite app that generates seamless,
fully-editable SVG surface patterns for stock sites (Adobe Stock,
Shutterstock, Freepik, Creative Fabrica, ...). Everything is procedural —
no AI image API calls, no backend, no per-generation cost.

This app lives alongside the original static-site prototype in the repo
root (`/index.html`, `/js`, `/css`); the two are independent and this one
does not replace it.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
npm run lint
npm test         # vitest run — 98 tests, see "Testing" below
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
Adobe Stock, Freepik, Creative Fabrica, Creative Market) — each with that
site's own character caps, keyword counts and category picks. The
`MetadataPanel` renders these as tabs with per-field copy buttons.

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
- `engine/scoring.ts` — `computeMetrics(tileData)` returns 19 metrics
  (composition, spacing, quadrant/horizontal/vertical balance, visual
  center offset, occupancy ratio, density variance, **largest empty
  region**, hierarchy, scale/rotation diversity, color balance, palette
  contrast — real relative-luminance range across the actual palette
  colors, not a placeholder — overlap quality, **hero separation**, edge
  density, adjacency repetition, seamless integrity, SVG technical
  health), each 0-100 and derived purely from `extractInstances`/
  `tileData.colors`/the serialized SVG string. `findNearest` computes the
  nearest-neighbor distance/instance for every motif *once* per
  `computeMetrics` call and is shared by spacing, overlap quality,
  adjacency repetition and hero separation (previously each of those ran
  its own duplicate O(n^2) pass).
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

## Testing

`npm test` runs `vitest run` — 246 tests across 16 files:

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
  generators/       one file per pattern category
  layouts/          one file per placement strategy
  palettes/         flat-design color palettes
  export/
    svgExporter.ts    single-tile / pre-tiled SVG string builders + download
    previewMarkup.ts  <pattern>-based markup for on-screen preview/thumbnails
  storage/
    savedStore.ts       IndexedDB-backed saved pattern library (localStorage fallback)
    styleDnaStore.ts    localStorage-backed custom Style DNA + favorites
  components/
    ControlPanel.tsx
    StyleDnaPanel.tsx
    PreviewCanvas.tsx
    Gallery.tsx
```
