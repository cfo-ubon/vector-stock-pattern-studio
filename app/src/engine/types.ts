// Core shared types for the pattern generation engine.

/** Minimal SVG element AST. This is the single source of truth rendered by
 * both the on-screen preview and the exported .svg file, so "what you see
 * is what you export" is guaranteed by construction rather than by keeping
 * two renderers in sync. */
export type SvgTag =
  | 'g'
  | 'path'
  | 'circle'
  | 'ellipse'
  | 'rect'
  | 'polygon'
  | 'polyline'
  | 'line'
  | 'clipPath'
  | 'defs'
  | 'pattern'
  | 'svg';

export interface SvgNode {
  tag: SvgTag;
  attrs?: Record<string, string | number>;
  children?: SvgNode[];
}

/** A deterministic PRNG function producing floats in [0, 1). */
export type Rng = () => number;

/** One motif "instance": a self-contained SVG node tree plus the local
 * bounding radius used for wrap-around overflow decisions. */
export interface Motif {
  node: SvgNode;
  /** Radius (in tile units, pre-transform) of the motif's bounding circle
   * around its own origin (0,0). Used to decide which of the 8 neighbour
   * copies could possibly overlap the tile edge. */
  radius: number;
}

/** A generator produces one random motif each time it's called, drawing
 * from its own pool of shape variants. Implementations live in /generators. */
export interface PatternGenerator {
  id: string;
  label: string;
  description: string;
  /** Suggested default motif size (diameter, in tile units) for this
   * category — layouts use this to size their grid/spacing. */
  defaultMotifSize: number;
  /** Optional density (0..1) the UI switches to when this category is
   * selected. Most categories look fine at whatever density the user left
   * the slider at, so they leave this unset — but "field" patterns like
   * checkerboard/gingham/houndstooth are built as motifs sized to exactly
   * fill their grid cell, and only read as a proper edge-to-edge check at
   * high density; at a typical ~50% density they'd show visible gaps. */
  recommendedDensity?: number;
  /** Grid/brick/half-drop normally shrink every other cell ~20-30% for a
   * "large/small" rhythm that makes icon-style categories read as
   * deliberately designed. Field patterns like checkerboard/gingham need
   * every cell exactly the same size — the color alternation itself *is*
   * the pattern, and any size variation just looks like a rendering bug —
   * so those generators opt out of the rhythm entirely. */
  disableGridRhythm?: boolean;
  /** Optional per-tile setup called once before the motif loop. Lets a
   * generator make tile-wide decisions (e.g. Seasonal picking "christmas"
   * vs "halloween" so one tile never mixes both) deterministically from
   * the same seeded rng. */
  beginTile?(rng: Rng): void;
  /** `colorSeed` carries the placement's row+col grid position (for grid/
   * brick/half-drop layouts) or plain sequence index (scatter/radial,
   * which have no 2D grid). Most generators ignore it and pick colors
   * randomly per motif — but a few patterns are only recognizable if their
   * color alternates by *position*, not randomly: checkerboard and gingham
   * are broken if every square gets an independent random color instead of
   * strictly alternating. Those generators read `colorSeed % 2` (etc.) to
   * get that positional alternation; everyone else can ignore the param. */
  createMotif(rng: Rng, colors: string[], size: number, colorSeed?: number): Motif;
}

/** Where a motif instance is placed within the tile, before wrap cloning. */
export interface Placement {
  x: number;
  y: number;
  rotationDeg: number;
  scale: number;
  /** Index into the resolved palette colour array used to seed this
   * placement's motif (generators may use more than one internally). */
  colorSeed: number;
}

export type LayoutId =
  | 'grid'
  | 'brick'
  | 'radial'
  | 'scatter'
  | 'halfDrop'
  | 'heroFlow'
  | 'heroScatter'
  | 'sCurve'
  | 'bouquet'
  | 'airy'
  | 'toss'
  | 'densePremium'
  | 'gridMinimal'
  | 'stripe';

export interface LayoutParams {
  tileSize: number;
  motifSize: number;
  density: number; // 0..1
  rotationJitter: number; // degrees, max random +/- rotation
  scaleJitter: number; // 0..1, max random +/- scale fraction
  mirror: boolean;
  radialSymmetry: number; // 1 = off, N = N-fold rotational symmetry
  /** From the active generator's `disableGridRhythm` — see PatternGenerator. */
  disableGridRhythm: boolean;
}

export interface PatternLayout {
  id: LayoutId;
  label: string;
  generate(params: LayoutParams, rng: Rng): Placement[];
}

export interface GenerateParams {
  categoryId: string;
  /** Asset-Based Pattern mode: when set with 2+ ids, the engine draws each
   * individual motif from a randomly-picked generator among these
   * categories (a fresh pick per placement, not once per tile) instead of
   * from `categoryId` alone — an eclectic pattern built from a mixed
   * "asset library" rather than one consistent style. `categoryId` is
   * still kept in sync (first entry) for display/filename purposes when
   * this is active. Unset or single-entry means normal single-category
   * mode. */
  mixCategoryIds?: string[];
  layoutId: LayoutId;
  paletteId: string;
  /** When set (e.g. from the AI-assist JSON), overrides the palette:
   * first color is the background, the rest are motif accents. */
  customColors?: string[];
  colorCount: number;
  tileSize: number;
  density: number;
  motifSize: number;
  /** Color story: instead of every motif picking uniformly from the whole
   * palette, each tile chooses 2 dominant accents that most motifs use,
   * with the remaining colors appearing only as occasional pops — the way
   * designers actually build a coherent colorway. Undefined = on. */
  colorStory?: boolean;
  /** Background filler layer: tiny dots/rings/plus/diamond accents
   * scattered between the main motifs — the professional surface-design
   * touch that makes a pattern read as "designed" instead of icons on an
   * empty canvas. 'subtle' = sparse and low-contrast, 'rich' = denser and
   * a bit stronger. Undefined = 'none' (backward compatible with saved
   * patterns from before this option existed). */
  fillerStyle?: 'none' | 'subtle' | 'rich';
  /** Flat "sticker" shadow: a solid-color offset silhouette under every
   * motif (no blur, no transparency — EPS-safe by construction). */
  flatShadow?: boolean;
  /** Post-generation pattern scale (1 = as generated). Multiplies the
   * effective motif size while the density *value* stays fixed — and since
   * layout spacing is itself proportional to motif size (see
   * spacingForDensity), the spacing-to-motif ratio (the visual density
   * proportion) is preserved automatically: the same composition simply
   * repeats finer (<1) or bolder (>1) within the fixed export canvas.
   * Kept separate from motifSize so the slider is absolute, not
   * compounding, and resets cleanly. */
  patternScale?: number;
  rotationJitter: number;
  scaleJitter: number;
  mirror: boolean;
  radialSymmetry: number;
  seed: string;
}

export interface TileData {
  params: GenerateParams;
  backgroundColor: string;
  colors: string[];
  svg: SvgNode;
}
