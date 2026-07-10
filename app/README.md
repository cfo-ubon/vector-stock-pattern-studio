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

## Filler layer & flat shadow

`buildFillerLayer` in `engine/tile.ts` scatters tiny dots/rings/plus/
diamond accents (poisson-disc placed, periodic wrap-cloned, colors
pre-blended toward the background) behind the motif layer —
`GenerateParams.fillerStyle: 'none' | 'subtle' | 'rich'`. It consumes rng
only after all motifs are built, so toggling it never changes the main
pattern of a seed. `flatShadow` draws a solid recolored silhouette of
every motif (via `recolorNode`) offset down-right in a dedicated layer
under all motifs; the shadow offset is added to each placement's
effective radius so edge shadows stay seamless.

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
