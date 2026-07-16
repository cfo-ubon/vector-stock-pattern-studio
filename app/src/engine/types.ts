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
  /** Build 009, Section 6 (Silhouette Optimization): only set by
   * `generators/premiumHero.ts`'s `buildPremiumHero` -- the real internal
   * arrangement archetype (`ClusterArchetype`, see `engine/clusterEngine.ts`)
   * `resolveHeroArchetype` resolved for this hero, threaded back so
   * portfolio-level tooling can measure real silhouette diversity (Build
   * 008B, Section 7's own deferred §15.2 recommendation) instead of only
   * ever measuring it indirectly. A loose string (not the real
   * `ClusterArchetype` union) to avoid `types.ts` importing from
   * `clusterEngine.ts`, the same convention `MotifCreateHints` already
   * established for `family`/`part`. Every non-premium-hero motif leaves
   * this undefined. */
  heroArchetype?: string;
}

/** Build 004, Section 1 (Botanical DNA Engine foundation): optional hints a
 * caller can pass to `createMotif` so a generator that understands a real
 * botanical taxonomy (see `generators/botanical.ts`'s `Variant` tagging,
 * added in Section 2) can pick a role- and family-appropriate shape instead
 * of a flat random pick over its whole variant pool. `family`/`part` are
 * loose strings rather than the real `BotanicalFamily`/`BotanicalPart`
 * unions (introduced in Sections 2-3) so this interface doesn't force every
 * one of the 15 pattern categories to import botanical-specific types they
 * have no use for. Every existing generator ignores hints it doesn't
 * understand — this field is purely additive, so all non-botanical
 * categories behave identically to before it existed. */
export interface MotifCreateHints {
  role?: string;
  family?: string;
  part?: string;
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
  createMotif(rng: Rng, colors: string[], size: number, colorSeed?: number, hints?: MotifCreateHints): Motif;
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
  /** Visual-hierarchy role, set by engine/hierarchy.ts's post-process pass
   * (or left undefined when no hierarchy is configured / the layout builds
   * its own tiers — see HIERARCHY_EXEMPT_LAYOUTS). Carried through to the
   * exported SVG as a `data-role` attribute for Affinity Designer editing. */
  role?: 'hero' | 'secondary' | 'filler' | 'accent';
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
  /** Build 003, Part 7 (Style Grammar) — see GenerateParams.compositionZone.
   * Layouts that pick a composition zone use this when set instead of a
   * random pick, so a Style DNA preset's own zone preference actually
   * reaches the layout that places anchors. */
  preferredZone?: import('./compositionZones').CompositionZone;
  /** Build 004, Section 9 (Style DNA botanical grammar) — see
   * GenerateParams.clusterArchetypes. Cluster-based layouts that pick among
   * several archetypes use this directly (no further random narrowing) when
   * set, instead of their own hardcoded default pool. */
  preferredClusterArchetypes?: import('./clusterEngine').ClusterArchetype[];
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
  /** Flat highlight ("shine"): a small solid-color ellipse baked into
   * every motif's own local frame near its upper-left, mimicking a soft
   * glossy-sticker light catch. No blur/transparency — EPS-safe. */
  flatHighlight?: boolean;
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
  /** Visual Hierarchy Engine: hero/secondary/filler/accent proportions and
   * per-role scale multipliers, applied as a layout-agnostic post-process
   * pass (see engine/hierarchy.ts). Undefined = no hierarchy pass runs —
   * identical output to every version before this existed, so old saved
   * patterns/seeds reproduce exactly. */
  hierarchy?: import('./hierarchy').HierarchyParams;
  /** Negative Space (0..1): shifts effective layout spacing looser without
   * changing the density *value* shown to the user — 0 = no change.
   * Undefined/0 = no change from pre-existing behavior. */
  negativeSpace?: number;
  /** Overlap Amount (0..1): shifts effective layout spacing tighter (the
   * opposite direction from negativeSpace) for a more naturally overlapping
   * composition — 0 = no change. Undefined/0 = no change from pre-existing
   * behavior. Applied after negativeSpace in the same spacing-multiplier
   * pipeline; the two partially offset if both are set. */
  overlapAmount?: number;
  /** Build 006, Section 5 (Negative Space Designer): which real commercial
   * product this tile targets (see collection/productTargets.ts) — when
   * set, nudges the *effective* negative space up or down for that
   * product's own real spacing convention (see
   * engine/negativeSpaceDesigner.ts) on top of (never replacing) the
   * `negativeSpace` field above. Undefined = no nudge, zero behavior
   * change from every pre-Build-006 pattern/preset/test. */
  productTarget?: import('../collection/productTargets').ProductUseId;
  /** Named Art Direction preset id applied (informational — the preset's
   * resolved values are written into the other fields above, so replaying
   * these params doesn't require re-resolving the preset). Undefined when
   * no preset was used or the user has since hand-edited values away from it. */
  artDirection?: string;
  /** Named Trend Intelligence preset id applied (see engine/trendEngine.ts)
   * — same round-tripping rationale as `artDirection`. Independent of
   * `artDirection`: applying one doesn't clear the other, since a saved
   * pattern may have started from an Art Direction preset and then had a
   * Trend preset layered on top (or vice versa) before further hand edits. */
  trend?: string;
  /** Composition Intelligence Engine (see engine/compositionIntelligence.ts):
   * a deterministic, geometry-only post-process pass that runs after
   * hierarchy role assignment and corrects severe quadrant-weight imbalance
   * plus smooths isolated-motif spacing outliers. Undefined = no-op —
   * identical output to every version before this existed, same
   * backward-compatibility precedent as `hierarchy`. */
  compositionIntelligence?: import('./compositionIntelligence').CompositionIntelligenceParams;
  /** Named Style DNA preset id applied (see engine/styleDna.ts) — same
   * round-tripping rationale as `artDirection`/`trend`: the preset's
   * resolved values are written into the other fields above, so replaying
   * these params doesn't require re-resolving the style. Undefined for
   * every pattern created before Style DNA existed. */
  styleDnaId?: string;
  /** Build 003, Part 7 (Style Grammar): a Style DNA preset's preferred
   * composition zone (see engine/compositionZones.ts), resolved once per
   * seed the same way categoryId/layoutId/paletteId already are — so each
   * preset's own "design language" includes a real compositional identity,
   * not just density/palette/rotation numbers. Undefined (no Style DNA
   * applied, or the style has no zone preference) means every zone-picking
   * layout falls back to its existing random pick. */
  compositionZone?: import('./compositionZones').CompositionZone;
  /** Build 004, Section 9 (Style DNA botanical grammar): a Style DNA
   * preset's preferred Botanical Family (see generators/botanicalFamilies.ts),
   * resolved once per seed the same way compositionZone already is.
   * Undefined means every botanical variant pick stays a plain,
   * family-unrestricted random pick, identical to every pattern generated
   * before this field existed. */
  botanicalFamily?: import('../generators/botanicalFamilies').BotanicalFamily;
  /** Build 004, Section 9: a Style DNA preset's preferred cluster-archetype
   * pool — passed straight through to whichever cluster-based layout the
   * style resolves to (see LayoutParams.preferredClusterArchetypes).
   * Undefined = every layout's own existing default/random pick. */
  clusterArchetypes?: import('./clusterEngine').ClusterArchetype[];
  /** Build 004, Section 9 (Premium Hero Builder): when true and a hero
   * placement's active generator is the botanical one, the hero is
   * assembled as a full multi-part bouquet (generators/premiumHero.ts)
   * instead of one independent variant. Undefined/false leaves every hero
   * placement completely unaffected — the default for every style that
   * doesn't explicitly opt in. */
  premiumHero?: boolean;
  /** Build 005, Section 2 (Design Rule Engine): the concrete generation
   * rules `engine/designKnowledge.ts` resolves from the active Style
   * DNA's own Design Knowledge Profile (Section 1) — consumed by
   * `buildPremiumHero` so a style's own hero-count/bouquet-size/stem-
   * length/leaf-density knowledge genuinely shapes the assembled hero.
   * Undefined = every existing default (no Style DNA active, or a style
   * whose resolved rules happen to be the same as the defaults). */
  designRules?: import('./designKnowledge').DesignGenerationRules;
  /** Build 010, Section 3 (Multi-layer Depth Engine, 0..1): blends filler/
   * accent motifs' own colors toward the background color (see
   * engine/depthEngine.ts's `applyDepthColorShift`), giving the tile a real
   * background-reading plane distinct from hero/secondary's foreground —
   * expressed as a solid pre-blended color (this codebase's EPS-safe
   * convention forbids real opacity/blur), not transparency. Undefined/0 =
   * every motif's colors are completely unaffected, identical to every
   * pattern generated before this field existed. */
  depthStrength?: number;
  /** Build 010, Section 7/8: this generation's own Professional Illustrator
   * Rules preference (rule of odds — see `generators/premiumHero.ts`'s
   * `preferOddCount`), reaching `buildPremiumHero` whenever a premium hero
   * is actually built. Explicit here always wins over
   * `resolveProfessionalRulesForProduct`'s product fallback (Section 7);
   * a Style DNA preset's own signature (Section 8) sets this directly for
   * every style that opts into `premiumHero`. Undefined = every pre-
   * Build-010 pattern's exact prior member-count roll. */
  professionalRules?: boolean;
  seed: string;
}

export interface TileData {
  params: GenerateParams;
  backgroundColor: string;
  colors: string[];
  svg: SvgNode;
  /** Build 009, Section 6 (Silhouette Optimization): the real internal
   * arrangement archetype of every premium hero this tile actually built
   * (see `Motif.heroArchetype`'s own doc comment) -- empty/undefined for a
   * tile with no premium heroes, never a fabricated placeholder. */
  premiumHeroArchetypes?: string[];
}
