import type { GenerateParams, PatternGenerator, Placement, Rng, SvgNode, TileData } from './types';
import { createRng, rngPick } from './rng';
import { h, round, computeBoundingRadius } from './svgAst';
import { GENERATORS } from '../generators';
import { LAYOUTS } from '../layouts';
import { poissonDiscPoints } from '../layouts/shared';
import { getPalette, resolveColors, blendHex } from '../palettes/palettes';
import { applyHierarchy, HIERARCHY_EXEMPT_LAYOUTS, REGULAR_LATTICE_LAYOUTS, sortByLayerPriority } from './hierarchy';
import { applyCompositionIntelligence } from './compositionIntelligence';
import { STYLE_DNA_PRESETS, STYLE_DNA_SCHEMA_VERSION } from './styleDna';
import { applyHeroDetailOverlay } from './heroComplexity';
import { countNodes } from './svgGeometry';
import { buildPremiumHero } from '../generators/premiumHero';
import {
  resolveNegativeSpaceForProduct,
  applyProductSpacingStrategy,
  resolveCompositionZoneForProduct,
  resolveDepthStrengthForProduct,
  resolvePremiumRhythmForProduct,
  resolveProfessionalRulesForProduct,
} from './negativeSpaceDesigner';
import { speciesForProductTarget } from '../generators/botanicalFamilies';
import { applyDepthColorShift } from './depthEngine';

// Build 002, Section 10 — Performance and SVG Safety. A real safety margin
// under candidateEngine.ts's hard 8000-node ceiling (HARD_NODE_BUDGET) —
// deliberately well under it, not "7898/8000 and call it healthy". This is
// the *only* generation-time safety net: the Candidate Engine's own
// reject-and-retry only runs in pool-generation mode (`generateBest`),
// never for a single direct `buildTile()` call, which is exactly the path
// every layout/generator combination goes through at least once.
//
// Deliberately measures the REAL, already-built per-instance node cost
// (summed from the actual `motifGroups`/`shadowGroups` SvgNode trees) rather
// than estimating it from one sampled reference motif — some categories
// (botanical's growth-variant system especially) swing widely in per-motif
// node count from one random draw to the next, so a single-sample estimate
// is not a reliable predictor of the *tile's own* real average and would
// either under- or over-thin. Using the real measured total means this pass
// is a strict no-op for every tile that doesn't need it (the overwhelming
// majority) and thins to a provably accurate target on the ones that do.
const NODE_BUDGET_SAFETY_MARGIN = 6000;

/** Evenly spaced (never random) selection of `count` values out of `pool`,
 * so thinning stays deterministic and spatially representative — shared by
 * both the ordinary (thin non-protected instances only) and the rare
 * (protected instances alone exceed budget) node-budget-safety cases below. */
function evenStrideSelect(pool: number[], count: number): number[] {
  if (count >= pool.length) return pool;
  const stride = pool.length / count;
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(pool[Math.min(pool.length - 1, Math.floor(i * stride))]);
  return out;
}

// Same coarse 8x8 grid every coverage/density/corner metric in `scoring.ts`
// measures (gridCoverage/computeCornerContinuity/computeEdgeDensity) — see
// `stratifiedSelect` below for why thinning distributes proportionally
// across every cell instead of exempting the 4 corner blocks outright: an
// absolute exemption preserves the corner blocks' *raw count* while every
// other cell gets cut, which pushes the corner-vs-overall density *ratio*
// (computeCornerContinuity's real measurement, and computeEdgeDensity's
// border/interior ratio) just as far out of balance in the other direction
// — corners end up over-represented once the tile-wide average has been
// cut hard. Keeping every cell's survivor count proportional to its own
// original share is what actually preserves the ratio these metrics check.
function gridCellOf(p: Placement, tileSize: number, gridN: number): number {
  const cell = tileSize / gridN;
  const gx = Math.min(gridN - 1, Math.floor((((p.x % tileSize) + tileSize) % tileSize) / cell));
  const gy = Math.min(gridN - 1, Math.floor((((p.y % tileSize) + tileSize) % tileSize) / cell));
  return gy * gridN + gx;
}

/** Selects `count` survivors out of `indices` (indices into `placements`)
 * spread proportionally across the same coarse 8x8 spatial grid every
 * coverage/density/corner metric in `scoring.ts` measures, rather than a
 * blind stride over array/generation order. A severe cut (this pass only
 * ever fires when the real node count is already well over budget, often
 * needing to keep well under a third of placements) can otherwise empty out
 * whole regions of the tile purely by chance of which *index* happened to
 * survive the stride — this tile's own real spatial layout decides survivor
 * counts instead, so occupancy/edge-density/corner-continuity stay
 * representative of the original composition even under a heavy cut. Uses
 * the Largest Remainder Method so per-cell survivor counts sum to exactly
 * `count`. */
function stratifiedSelect(indices: number[], placements: Placement[], tileSize: number, count: number): number[] {
  if (count >= indices.length) return indices;
  const gridN = 8;
  const byCell = new Map<number, number[]>();
  for (const i of indices) {
    const cell = gridCellOf(placements[i], tileSize, gridN);
    let bucket = byCell.get(cell);
    if (!bucket) {
      bucket = [];
      byCell.set(cell, bucket);
    }
    bucket.push(i);
  }
  const cells = [...byCell.entries()];
  const shareRaw = cells.map(([, idxs]) => (idxs.length / indices.length) * count);
  const shareFloor = shareRaw.map(Math.floor);
  let remaining = count - shareFloor.reduce((a, b) => a + b, 0);
  const remainders = shareRaw.map((s, i) => ({ i, frac: s - shareFloor[i] })).sort((a, b) => b.frac - a.frac);
  for (const { i } of remainders) {
    if (remaining <= 0) break;
    shareFloor[i]++;
    remaining--;
  }
  const out: number[] = [];
  cells.forEach(([, idxs], i) => out.push(...evenStrideSelect(idxs, Math.min(shareFloor[i], idxs.length))));
  return out;
}

const WRAP_OFFSETS = [-1, 0, 1];

/** Deep-clone a subtree with every visible fill/stroke replaced by one
 * color — used to draw a motif's flat shadow silhouette. */
function recolorNode(node: SvgNode, color: string): SvgNode {
  const attrs = node.attrs ? { ...node.attrs } : undefined;
  if (attrs) {
    if (attrs.fill !== undefined && attrs.fill !== 'none') attrs.fill = color;
    if (attrs.stroke !== undefined && attrs.stroke !== 'none') attrs.stroke = color;
  }
  return { ...node, attrs, children: node.children?.map((c) => recolorNode(c, color)) };
}

/** Background filler layer: tiny dots/rings/plus/diamonds scattered in the
 * gaps between main motifs, in low-contrast pre-blended colors, with the
 * same periodic wrap-clone treatment as real motifs so seamlessness holds.
 * Drawn behind the motif layer. Consumes rng only after all motifs are
 * built, so enabling/disabling it never changes the main pattern of a
 * given seed. */
function buildFillerLayer(
  style: 'subtle' | 'rich',
  rng: Rng,
  colors: string[],
  tileSize: number,
): SvgNode {
  const bg = colors[0];
  const accents = colors.length > 1 ? colors.slice(1) : colors;
  const target = Math.round((style === 'subtle' ? 90 : 190) * (tileSize / 1200) ** 2);
  const minDist = (tileSize / Math.sqrt(Math.max(1, target))) * 0.62;
  const alpha = style === 'subtle' ? 0.28 : 0.42;
  const pts = poissonDiscPoints(tileSize, minDist, target, rng);
  const shapes: SvgNode[] = [];
  for (const [x, y] of pts) {
    const color = blendHex(accents[Math.floor(rng() * accents.length)], alpha, bg);
    const r = tileSize * (0.0045 + rng() * 0.005);
    const kind = Math.floor(rng() * 4);
    const rot = Math.floor(rng() * 90);
    const pad = r * 2.2;
    for (const oi of WRAP_OFFSETS) {
      for (const oj of WRAP_OFFSETS) {
        const wx = x + oi * tileSize;
        const wy = y + oj * tileSize;
        if (wx + pad < 0 || wx - pad > tileSize || wy + pad < 0 || wy - pad > tileSize) continue;
        if (kind === 0) {
          shapes.push(h('circle', { cx: round(wx), cy: round(wy), r: round(r), fill: color }));
        } else if (kind === 1) {
          shapes.push(h('circle', { cx: round(wx), cy: round(wy), r: round(r * 0.9), fill: 'none', stroke: color, 'stroke-width': round(r * 0.55) }));
        } else if (kind === 2) {
          shapes.push(
            h('g', { transform: `translate(${round(wx)} ${round(wy)}) rotate(${rot})` }, [
              h('rect', { x: round(-r), y: round(-r * 0.3), width: round(r * 2), height: round(r * 0.6), fill: color }),
              h('rect', { x: round(-r * 0.3), y: round(-r), width: round(r * 0.6), height: round(r * 2), fill: color }),
            ]),
          );
        } else {
          shapes.push(
            h('polygon', {
              points: `${round(wx)},${round(wy - r)} ${round(wx + r)},${round(wy)} ${round(wx)},${round(wy + r)} ${round(wx - r)},${round(wy)}`,
              fill: color,
            }),
          );
        }
      }
    }
  }
  return h('g', { id: 'layer-filler' }, shapes);
}

/** Build one seamless tile as an SvgNode tree, wrapped in a <g id="tile-content">
 * so it can be embedded directly (single-tile export), referenced from a
 * native <pattern> (live preview), or cloned with remapped ids (pre-tiled
 * export). See ARCHITECTURE note in README for the wrap-and-clip approach:
 * every motif is drawn up to 9 times at (x + i*tileSize, y + j*tileSize) for
 * i,j in {-1,0,1}, then the whole layer is clipped to the tile rect. Because
 * placements are periodic by construction, this guarantees the pattern is
 * seamless regardless of how close a motif sits to the tile edge. */
export function buildTile(params: GenerateParams): TileData {
  const rng = createRng(params.seed);
  // Asset-Based Pattern mode: 2+ mixCategoryIds means every placement draws
  // its motif from a fresh random pick among those generators (a genuinely
  // mixed "asset library" pattern), instead of one generator for the whole
  // tile. disableGridRhythm/recommendedDensity are per-generator hints that
  // don't have a single obvious owner when mixing, so mixed patterns just
  // use plain grid rhythm and whatever density the user set.
  const mixIds = params.mixCategoryIds?.filter((id) => GENERATORS[id]) ?? [];
  const isMix = mixIds.length >= 2;
  const activeGenerators: PatternGenerator[] = isMix
    ? mixIds.map((id) => GENERATORS[id])
    : [GENERATORS[params.categoryId] ?? Object.values(GENERATORS)[0]];
  const layout = LAYOUTS[params.layoutId] ?? Object.values(LAYOUTS)[0];
  const isValidHex = (c: string) => /^#[0-9a-fA-F]{6}$/.test(c);
  const custom = params.customColors?.filter(isValidHex) ?? [];
  const colors = custom.length >= 2 ? custom.slice(0, 6) : resolveColors(getPalette(params.paletteId), params.colorCount);
  const backgroundColor = colors[0];
  const { tileSize } = params;
  // Color story: pick 2 dominant accents once per tile; most placements
  // draw with just those, the rest keep the full palette as accent pops.
  // Skipped when there are <=2 accents (nothing to curate) and applied
  // constantly (not per-placement) for "field" generators like Plaid,
  // whose position-based color alternation needs one stable accent list.
  const accentsAll = colors.length > 1 ? colors.slice(1) : colors;
  const useStory = (params.colorStory ?? true) && accentsAll.length > 2;
  let storyColors = colors;
  if (useStory) {
    const i1 = Math.floor(rng() * accentsAll.length);
    let i2 = Math.floor(rng() * accentsAll.length);
    if (i2 === i1) i2 = (i2 + 1) % accentsAll.length;
    storyColors = [colors[0], accentsAll[i1], accentsAll[i2]];
  }
  const isFieldPattern = !isMix && (activeGenerators[0].disableGridRhythm ?? false);
  // Post-gen pattern scale: same seed + same density value + scaled motif
  // size = the identical composition proportion at a finer/bolder repeat,
  // because every layout's spacing is proportional to motif size.
  const effectiveMotifSize = params.motifSize * Math.min(4, Math.max(0.2, params.patternScale ?? 1));
  activeGenerators.forEach((g) => g.beginTile?.(rng));

  // Negative Space / Overlap: nudge the *density* fed to the layout (every
  // layout already reads this to compute its own spacing/point-count), in
  // opposite directions, rather than reaching into each layout's spacing
  // math individually. Both default to 0, so effectiveDensity ===
  // params.density exactly when neither is set — zero behavior change for
  // every pattern saved before these controls existed.
  // Build 006, Section 5 (Negative Space Designer): resolves the real
  // per-product nudge on top of the user's own `negativeSpace` dial before
  // it enters the existing spacing-adjust pipeline -- `productTarget`
  // undefined reproduces `params.negativeSpace` exactly (see
  // `resolveNegativeSpaceForProduct`'s own doc comment).
  const effectiveNegativeSpace = resolveNegativeSpaceForProduct(params.negativeSpace ?? 0, params.productTarget);
  const spacingAdjust = (params.overlapAmount ?? 0) - effectiveNegativeSpace;
  const effectiveDensity = Math.max(0, Math.min(1, params.density + spacingAdjust * 0.4));

  // Build 008B, Section 8 (Product-aware Species Selection): a real
  // `productTarget` (collection/productTargets.ts) with no Style DNA
  // family already resolved falls back to that product's own best-fit
  // species (see `speciesForProductTarget`'s own doc comment) instead of
  // leaving `botanicalFamily` unset -- never overrides an explicit
  // style/user family choice, and `productTarget` undefined reproduces
  // `params.botanicalFamily` exactly.
  const effectiveBotanicalFamily =
    params.botanicalFamily ?? (params.productTarget ? speciesForProductTarget(params.productTarget)[0] : undefined);

  // Build 009, Section 8 (Product-aware Composition): a real `productTarget`
  // with no Style-DNA-resolved `compositionZone` of its own falls back to
  // that product's own best-fit composition zone (see
  // `resolveCompositionZoneForProduct`'s own doc comment) -- the same
  // "product's own best fit, only when nothing more specific already chose"
  // convention as `effectiveBotanicalFamily` just above. Never overrides an
  // explicit Style DNA zone choice, and `productTarget` undefined reproduces
  // `params.compositionZone` exactly.
  const effectiveCompositionZone = params.compositionZone ?? resolveCompositionZoneForProduct(params.productTarget);

  const placements: Placement[] = layout.generate(
    {
      tileSize,
      motifSize: effectiveMotifSize,
      density: effectiveDensity,
      rotationJitter: params.rotationJitter,
      scaleJitter: params.scaleJitter,
      mirror: params.mirror,
      radialSymmetry: params.radialSymmetry,
      disableGridRhythm: !isMix && (activeGenerators[0].disableGridRhythm ?? false),
      preferredZone: effectiveCompositionZone,
      preferredClusterArchetypes: params.clusterArchetypes,
    },
    rng,
  );

  // Visual Hierarchy Engine: a layout-agnostic post-process pass that
  // assigns hero/secondary/filler/accent roles and scales placements
  // accordingly — skipped for layouts that already build their own
  // explicit tiers (see HIERARCHY_EXEMPT_LAYOUTS) to avoid compounding an
  // already-large hero motif by heroScale a second time. Undefined
  // params.hierarchy (the default for every pre-existing saved pattern)
  // means this is a no-op and `placements` passes through unchanged.
  // Build 010, Section 7 (Product-aware Composition Engine): a product's
  // own Premium Rhythm Engine preference only takes effect when hierarchy
  // is already configured (see `resolvePremiumRhythmForProduct`'s own doc
  // comment) -- it never turns hierarchy on by itself, and an explicit
  // `hierarchy.premiumRhythm` always wins over the product fallback.
  const effectiveHierarchy =
    params.hierarchy && params.hierarchy.premiumRhythm === undefined
      ? { ...params.hierarchy, premiumRhythm: resolvePremiumRhythmForProduct(params.productTarget) }
      : params.hierarchy;
  const roledPlacements =
    effectiveHierarchy && !HIERARCHY_EXEMPT_LAYOUTS.has(params.layoutId)
      ? applyHierarchy(placements, effectiveHierarchy, rng)
      : placements;

  // Composition Intelligence Engine: a deterministic geometry-only pass
  // that corrects severe quadrant-weight imbalance and smooths isolated
  // spacing outliers left by the layout+hierarchy stages above. No rng
  // consumption, so it never affects seed determinism upstream or
  // downstream; undefined params is a strict no-op (see
  // engine/compositionIntelligence.ts).
  // Composition Intelligence V2's flow-bias/negative-space/attraction
  // passes exist to make organic or scattered compositions read as more
  // intentional — for a strict, evenly-spaced lattice layout (Grid, Grid
  // Minimal) the "flaw" they'd correct is the deliberate point of the
  // layout, so only the original V1 fields (balance/rhythm, neither of
  // which ever fired on a genuinely regular grid) apply there.
  const latticeTrimmedCompositionIntelligence =
    params.compositionIntelligence && REGULAR_LATTICE_LAYOUTS.has(params.layoutId)
      ? { balanceStrength: params.compositionIntelligence.balanceStrength, rhythmStrength: params.compositionIntelligence.rhythmStrength }
      : params.compositionIntelligence;
  // Build 009, Section 3 (Negative Space Designer V2): the same real
  // per-product rhythm/cluster-looseness strategy `resolveNegativeSpaceForProduct`
  // already nudges spacing with -- `productTarget` undefined is a strict
  // no-op (see `applyProductSpacingStrategy`'s own doc comment).
  const effectiveCompositionIntelligence = applyProductSpacingStrategy(latticeTrimmedCompositionIntelligence, params.productTarget);
  const refinedPlacements = params.compositionIntelligence
    ? applyCompositionIntelligence(roledPlacements, tileSize, effectiveCompositionIntelligence)
    : roledPlacements;

  // Layer Priority (Composition Intelligence Foundation V2, Section 2): a
  // stable sort so higher-priority roles (hero) always paint last, i.e. on
  // top. A no-op for every placement with no role — a stable sort of an
  // all-equal-priority array never reorders — so patterns that never opted
  // into the Hierarchy Engine are unaffected.
  const paintOrderedPlacements = sortByLayerPriority(refinedPlacements);

  // Flat "sticker" shadow setup: a solid tone slightly darker than the
  // background, offset down-right, drawn in its own layer *under* all
  // motifs so a shadow never sits on top of a neighboring motif.
  const useShadow = !!params.flatShadow;
  const shadowColor = blendHex('#000000', 0.16, backgroundColor);
  const shadowDx = effectiveMotifSize * 0.07;
  const shadowDy = effectiveMotifSize * 0.09;
  const shadowGroups: SvgNode[] = [];

  // Flat highlight ("shine"): a small solid ellipse baked into each
  // motif's own local frame (before the placement transform) so it
  // rotates/scales along with the piece, near the upper-left, mimicking a
  // glossy sticker light-catch. Lightened from the background — accents
  // are always more saturated/darker than the background (accentColors
  // excludes it), so this reliably reads as a lighter patch on top.
  const useHighlight = !!params.flatHighlight;
  const highlightColor = blendHex('#ffffff', 0.6, backgroundColor);

  // Build 004, Section 9 fix: a cluster-based layout (bouquet/heroScatter)
  // can place MANY hero-role anchors across one tile (one per cluster, not
  // one "the" hero for the whole tile) -- assembling every single one as a
  // full multi-part bouquet was measured to balloon the tile's real node
  // count past NODE_BUDGET_SAFETY_MARGIN below, triggering that budget's
  // own "protect every hero, drop everything else" thinning so hard it
  // gutted the whole composition (quadrant balance collapsing from ~95 to
  // ~0 in the frozen quality harness). A premium hero is meant to be a
  // real centerpiece object, not a repeated-many-times motif, so only the
  // first few hero placements encountered get the full assembly; any
  // further ones fall back to the plain single-variant path exactly as
  // before this feature existed.
  const MAX_PREMIUM_HEROES_PER_TILE = 3;
  let premiumHeroesBuilt = 0;
  // Build 009, Section 6 (Silhouette Optimization): collects the real
  // internal archetype of every premium hero this tile actually builds
  // (see `Motif.heroArchetype`'s own doc comment) -- stays empty for any
  // tile with no premium heroes.
  const premiumHeroArchetypesUsed: string[] = [];

  const motifGroups: SvgNode[] = paintOrderedPlacements.map((placement, index) => {
    const generator = activeGenerators.length > 1 ? rngPick(rng, activeGenerators) : activeGenerators[0];
    // Field patterns always get the stable story palette; everything else
    // leans dominant ~72% of the time with full-palette pops in between.
    const storyOrDefaultColors = !useStory ? colors : isFieldPattern ? storyColors : rng() < 0.72 ? storyColors : colors;
    // Build 010, Section 3 (Multi-layer Depth Engine): a real background-
    // receding color shift for filler/accent roles only — see
    // engine/depthEngine.ts's own doc comment. `params.depthStrength`
    // undefined/0 is a strict no-op (same array reference), so every
    // pattern that doesn't opt in keeps its exact original motif colors.
    // Build 010, Section 7 (Product-aware Composition Engine): a product's
    // own depth-strength preference only fills in when the caller never set
    // one explicitly -- see `resolveDepthStrengthForProduct`'s own doc
    // comment.
    const effectiveDepthStrength = params.depthStrength ?? resolveDepthStrengthForProduct(params.productTarget) ?? 0;
    const motifColors = applyDepthColorShift(storyOrDefaultColors, placement.role, effectiveDepthStrength);
    // Build 004, Section 1: threads the placement's real hierarchy role into
    // createMotif so a botanical-aware generator can pick a role-appropriate
    // shape (Section 2+) instead of a flat random pick — every other
    // generator still ignores this hint exactly as before. Section 9 adds
    // the preferred Botanical Family (see engine/styleDna.ts) the same way.
    // Build 004, Section 9 (Premium Hero Builder): a hero placement whose
    // active generator is the botanical one gets assembled as a full
    // multi-part bouquet instead of one independent variant, when the
    // resolved Style DNA opts in — undefined/false `premiumHero` (every
    // style that doesn't declare it, and every pattern with no Style DNA
    // applied) leaves this exactly the single createMotif call it always was.
    const usePremiumHero =
      !!params.premiumHero && placement.role === 'hero' && generator.id === 'botanical' && premiumHeroesBuilt < MAX_PREMIUM_HEROES_PER_TILE;
    if (usePremiumHero) premiumHeroesBuilt++;
    // Build 010, Section 7: a product's own Professional Illustrator Rules
    // preference reaches the premium hero's own member-count/tangent
    // resolution only where that hero is already being built (see
    // `resolveProfessionalRulesForProduct`'s own doc comment).
    const motif = usePremiumHero
      ? buildPremiumHero(rng, {
          colors: motifColors,
          size: effectiveMotifSize,
          family: effectiveBotanicalFamily,
          designRules: params.designRules,
          preferOddCount: params.professionalRules ?? resolveProfessionalRulesForProduct(params.productTarget),
        })
      : generator.createMotif(rng, motifColors, effectiveMotifSize, placement.colorSeed, { role: placement.role, family: effectiveBotanicalFamily });
    if (motif.heroArchetype) premiumHeroArchetypesUsed.push(motif.heroArchetype);
    // Never trust the generator's hand-estimated radius alone — a motif
    // with an off-center appendage (an ear, a ray, a curling leaf) is easy
    // to under-measure by hand, and an underestimate here means a missing
    // wrap-clone at the tile edge, i.e. a visible seam. The geometric bound
    // computed straight from the shape's own coordinates can't be wrong in
    // that direction, so take whichever is larger.
    const safeRadius = Math.max(motif.radius, computeBoundingRadius(motif.node));
    // Hero Motif Complexity (Project Phoenix V2, Section 3): hero/secondary
    // placements get a real, bounded detail overlay (inner ring, texture
    // lines, decorative dots, nested contour) layered onto the generator's
    // own shape — filler/accent/unroled placements pass through unchanged.
    // Every overlay primitive stays within `safeRadius`, computed above
    // from the *undetailed* shape, so the wrap-inclusion bound below still
    // holds without needing to re-measure after the overlay is added. A
    // premium hero already applies its own Micro Details overlay
    // internally, so it isn't run through this a second time.
    const detailedNode = usePremiumHero ? motif.node : applyHeroDetailOverlay(
      motif.node,
      { role: placement.role, radius: safeRadius, colors: motifColors, instanceCount: paintOrderedPlacements.length, relativeScale: placement.scale },
      rng,
    );
    // The shadow copy extends the reach of a placement — include its
    // offset in the wrap-inclusion test so edge shadows stay seamless too.
    const effectiveRadius = safeRadius * placement.scale + (useShadow ? Math.hypot(shadowDx, shadowDy) : 0);
    const shadowNode = useShadow ? recolorNode(detailedNode, shadowColor) : null;
    const highlightNode = useHighlight
      ? h('g', { transform: `translate(${round(-safeRadius * 0.3)} ${round(-safeRadius * 0.32)}) rotate(-28)` }, [
          h('ellipse', { cx: 0, cy: 0, rx: round(safeRadius * 0.3), ry: round(safeRadius * 0.18), fill: highlightColor }),
        ])
      : null;
    const instances: SvgNode[] = [];
    const shadowInstances: SvgNode[] = [];

    for (const oi of WRAP_OFFSETS) {
      for (const oj of WRAP_OFFSETS) {
        const wx = placement.x + oi * tileSize;
        const wy = placement.y + oj * tileSize;
        // Skip copies that can't possibly intersect the tile rect — keeps
        // exported markup lean without affecting seamlessness (see note
        // above: this is a conservative bounding-circle vs. expanded-rect
        // test, never under-inclusive).
        const intersects =
          wx + effectiveRadius >= 0 &&
          wx - effectiveRadius <= tileSize &&
          wy + effectiveRadius >= 0 &&
          wy - effectiveRadius <= tileSize;
        if (!intersects) continue;
        const placeTransform = (dx: number, dy: number) =>
          `translate(${round(wx + dx)} ${round(wy + dy)}) rotate(${round(placement.rotationDeg)}) scale(${round(placement.scale)})`;
        if (shadowNode) {
          shadowInstances.push(h('g', { transform: placeTransform(shadowDx, shadowDy) }, [shadowNode]));
        }
        instances.push(
          h('g', { transform: placeTransform(0, 0) }, highlightNode ? [detailedNode, highlightNode] : [detailedNode]),
        );
      }
    }

    if (shadowInstances.length > 0) shadowGroups.push(h('g', { id: `shadow-${index + 1}` }, shadowInstances));
    // data-role carries the hierarchy tier into the exported SVG (Affinity
    // Designer shows unknown data-* attributes as harmless metadata, so
    // this is safe there) — omitted entirely when no role was assigned,
    // instead of writing a literal "undefined" string.
    return h('g', { id: `motif-${index + 1}`, ...(placement.role ? { 'data-role': placement.role } : {}) }, instances);
  });

  // Filler goes behind everything except the background; built right after
  // the motif/shadow layers (still before the Section 10 budget check
  // below) so its own real node count is included in that check, but after
  // every motif's own rng draws so enabling/disabling it never shifts the
  // main pattern for a given seed — thinning the motif/shadow layers below
  // is a pure post-hoc filter that consumes no rng, so this ordering still
  // preserves that guarantee exactly.
  const fillerStyle = params.fillerStyle ?? 'none';
  const fillerLayer = fillerStyle !== 'none' ? buildFillerLayer(fillerStyle, rng, useStory ? storyColors : colors, tileSize) : null;
  const fixedOverheadNodeCount = (fillerLayer ? countNodes(fillerLayer) : 0) + 4; // + defs/clipPath/background/tile-content wrapper

  // Build 002, Section 10: check the REAL, already-built node count of the
  // whole tile (motif + shadow + filler + fixed structural overhead)
  // against the safety margin and thin the motif/shadow layers only if it's
  // actually exceeded — see NODE_BUDGET_SAFETY_MARGIN's own doc comment for
  // why this measures the real total rather than estimating it up front.
  // Filler/background overhead is left untouched by thinning (it doesn't
  // scale with placement count and isn't tied to any role/hierarchy
  // decision), so only the motif+shadow budget is reduced to compensate.
  //
  // Cost is split by role rather than using one blended average: hero
  // instances are drawn at a much larger scale (more wrap-clone copies
  // near tile edges) plus the Hero Complexity detail overlay, so they cost
  // far more per instance than the many small filler/accent instances that
  // dominate a blended average — spending that whole blended average on
  // "keep every hero, fill the rest with non-heroes" would systematically
  // overshoot the budget by however much heroes cost above average.
  const shadowByIndex = new Map<number, SvgNode>();
  for (const g of shadowGroups) {
    const m = /^shadow-(\d+)$/.exec(String(g.attrs?.id ?? ''));
    if (m) shadowByIndex.set(Number(m[1]) - 1, g);
  }
  const perIndexCost = paintOrderedPlacements.map((_, i) => countNodes(motifGroups[i]) + (shadowByIndex.has(i) ? countNodes(shadowByIndex.get(i)!) : 0));
  const realInstanceNodeCount = perIndexCost.reduce((a, b) => a + b, 0);
  const instanceBudget = NODE_BUDGET_SAFETY_MARGIN - fixedOverheadNodeCount;
  let finalMotifGroups = motifGroups;
  let finalShadowGroups = shadowGroups;
  if (realInstanceNodeCount > instanceBudget && paintOrderedPlacements.length > 0) {
    const protectedIndices: number[] = [];
    const thinnableIndices: number[] = [];
    paintOrderedPlacements.forEach((p, i) => (p.role === 'hero' ? protectedIndices : thinnableIndices).push(i));
    const protectedCost = protectedIndices.reduce((sum, i) => sum + perIndexCost[i], 0);

    let keptIndices: Set<number>;
    if (protectedCost >= instanceBudget) {
      // Even every hero instance alone exceeds the budget — the rare edge
      // case where the layout's own hero count/scale is the problem, not
      // the filler layer. Thin the hero set itself (evenly, not randomly)
      // rather than silently leaving the tile over budget.
      const protectedAvg = protectedCost / protectedIndices.length;
      const protectedTarget = Math.max(1, Math.floor(instanceBudget / protectedAvg));
      keptIndices = new Set(stratifiedSelect(protectedIndices, paintOrderedPlacements, tileSize, protectedTarget));
    } else {
      const thinnableCost = realInstanceNodeCount - protectedCost;
      const thinnableAvg = thinnableIndices.length > 0 ? thinnableCost / thinnableIndices.length : 0;
      const remainingBudget = instanceBudget - protectedCost;
      const thinnableTarget = thinnableAvg > 0 ? Math.max(0, Math.floor(remainingBudget / thinnableAvg)) : thinnableIndices.length;
      keptIndices = new Set([...protectedIndices, ...stratifiedSelect(thinnableIndices, paintOrderedPlacements, tileSize, thinnableTarget)]);
    }

    if (keptIndices.size < paintOrderedPlacements.length) {
      finalMotifGroups = motifGroups.filter((_, i) => keptIndices.has(i));
      finalShadowGroups = shadowGroups.filter((g) => {
        const m = /^shadow-(\d+)$/.exec(String(g.attrs?.id ?? ''));
        return m ? keptIndices.has(Number(m[1]) - 1) : true;
      });
    }
  }

  const patternLayers: SvgNode[] = [];
  if (fillerLayer) patternLayers.push(fillerLayer);
  if (finalShadowGroups.length > 0) patternLayers.push(h('g', { id: 'layer-shadows' }, finalShadowGroups));
  patternLayers.push(...finalMotifGroups);

  // Style DNA metadata: Affinity Designer and every SVG viewer show unknown
  // data-* attributes as harmless metadata (same convention already used for
  // per-motif data-role) — the built-in preset's label is looked up here
  // since engine/styleDna.ts is a pure static data module already several
  // layers down this file's own import graph (no browser/localStorage
  // coupling introduced). A custom (user-created) style id that isn't in the
  // built-in table falls back to embedding the id itself as the name.
  const styleDnaMeta: Record<string, string> = params.styleDnaId
    ? {
        'data-style-dna-id': params.styleDnaId,
        'data-style-dna-name': STYLE_DNA_PRESETS[params.styleDnaId]?.label ?? params.styleDnaId,
        'data-style-dna-version': String(STYLE_DNA_SCHEMA_VERSION),
      }
    : {};

  const content: SvgNode = h('g', { id: 'tile-content', ...styleDnaMeta }, [
    h('defs', {}, [
      h('clipPath', { id: 'tile-clip' }, [h('rect', { x: 0, y: 0, width: tileSize, height: tileSize })]),
    ]),
    h('g', { id: 'layer-background' }, [h('rect', { x: 0, y: 0, width: tileSize, height: tileSize, fill: backgroundColor })]),
    h('g', { id: 'layer-pattern', 'clip-path': 'url(#tile-clip)' }, patternLayers),
  ]);

  return {
    params,
    backgroundColor,
    colors,
    svg: content,
    premiumHeroArchetypes: premiumHeroArchetypesUsed.length > 0 ? premiumHeroArchetypesUsed : undefined,
  };
}
