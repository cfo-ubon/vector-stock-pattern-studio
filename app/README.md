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
