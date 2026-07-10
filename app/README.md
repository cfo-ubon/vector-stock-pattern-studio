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

## Testing

`npm test` runs `vitest run` — 127 tests across 8 files:

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
  components/
    ControlPanel.tsx
    PreviewCanvas.tsx
    Gallery.tsx
```
