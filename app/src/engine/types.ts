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
  /** Optional per-tile setup called once before the motif loop. Lets a
   * generator make tile-wide decisions (e.g. Seasonal picking "christmas"
   * vs "halloween" so one tile never mixes both) deterministically from
   * the same seeded rng. */
  beginTile?(rng: Rng): void;
  createMotif(rng: Rng, colors: string[], size: number): Motif;
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

export type LayoutId = 'grid' | 'brick' | 'radial' | 'scatter' | 'halfDrop';

export interface LayoutParams {
  tileSize: number;
  motifSize: number;
  density: number; // 0..1
  rotationJitter: number; // degrees, max random +/- rotation
  scaleJitter: number; // 0..1, max random +/- scale fraction
  mirror: boolean;
  radialSymmetry: number; // 1 = off, N = N-fold rotational symmetry
}

export interface PatternLayout {
  id: LayoutId;
  label: string;
  generate(params: LayoutParams, rng: Rng): Placement[];
}

export interface GenerateParams {
  categoryId: string;
  layoutId: LayoutId;
  paletteId: string;
  /** When set (e.g. from the AI-assist JSON), overrides the palette:
   * first color is the background, the rest are motif accents. */
  customColors?: string[];
  colorCount: number;
  tileSize: number;
  density: number;
  motifSize: number;
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
