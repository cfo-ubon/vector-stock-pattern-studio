import type { GenerateParams, TileData } from '../engine/types';
import { buildTile } from '../engine/tile';
import type { DesignSpecification } from './designSpecTypes';

// Section 8: "The SVG generator must consume the Design Specification
// directly. No duplicated logic." This module is the entire mapping —
// every `GenerateParams` field is read straight off the spec (mostly the
// exact same value under the exact same name, since designSpecTypes.ts
// was deliberately designed in Phase 1 to mirror GenerateParams'
// vocabulary) and handed to the *existing, unmodified* `buildTile`. No
// generation logic is re-implemented here.

/** Maps a `DesignSpecification` onto a real `GenerateParams` object. Pure,
 * deterministic, no defaults invented beyond "fall back to the Keyword
 * Bundle's own pattern type if `heroMotifs` is empty" — a defensive case
 * for a hand-edited spec coming out of a future JSON Editor, since
 * `buildDesignSpecification` itself always populates at least one hero
 * motif. `seed` is passed in separately (not read from the spec) so the
 * same spec can generate many distinct collection assets deterministically
 * via distinct derived seeds, the same convention collectionGenerator.ts
 * already uses for Hero/Secondary/Blender/Mini/Stripe. */
export function buildGenerateParamsFromDesignSpec(spec: DesignSpecification, seed: string): GenerateParams {
  return {
    categoryId: spec.heroMotifs[0]?.categoryId ?? spec.keywordBundle.patternType,
    layoutId: spec.repeatType,
    paletteId: spec.palette.id,
    colorCount: spec.palette.colors.length,
    tileSize: spec.exportHints.tileSize,
    density: spec.density,
    motifSize: spec.svgHints.motifSize,
    colorStory: spec.svgHints.colorStory,
    fillerStyle: spec.svgHints.fillerStyle,
    flatShadow: spec.svgHints.flatShadow,
    flatHighlight: spec.svgHints.flatHighlight,
    patternScale: spec.svgHints.patternScale,
    rotationJitter: spec.svgHints.rotationJitter,
    scaleJitter: spec.svgHints.scaleJitter,
    mirror: spec.svgHints.mirror,
    radialSymmetry: spec.svgHints.radialSymmetry,
    hierarchy: spec.hierarchy,
    negativeSpace: spec.negativeSpace,
    styleDnaId: spec.styleDnaId,
    seed,
  };
}

/** Convenience wrapper: builds the real tile straight from a Design
 * Specification, exactly as any other caller of `buildTile` would — the
 * returned `TileData` feeds every existing downstream consumer (SEO
 * generation, export, collection assembly) unchanged. */
export function buildTileFromDesignSpec(spec: DesignSpecification, seed: string): TileData {
  return buildTile(buildGenerateParamsFromDesignSpec(spec, seed));
}
