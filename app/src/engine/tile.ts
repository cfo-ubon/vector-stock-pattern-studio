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
  const spacingAdjust = (params.overlapAmount ?? 0) - (params.negativeSpace ?? 0);
  const effectiveDensity = Math.max(0, Math.min(1, params.density + spacingAdjust * 0.4));

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
  const roledPlacements =
    params.hierarchy && !HIERARCHY_EXEMPT_LAYOUTS.has(params.layoutId)
      ? applyHierarchy(placements, params.hierarchy, rng)
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
  const effectiveCompositionIntelligence =
    params.compositionIntelligence && REGULAR_LATTICE_LAYOUTS.has(params.layoutId)
      ? { balanceStrength: params.compositionIntelligence.balanceStrength, rhythmStrength: params.compositionIntelligence.rhythmStrength }
      : params.compositionIntelligence;
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

  const motifGroups: SvgNode[] = paintOrderedPlacements.map((placement, index) => {
    const generator = activeGenerators.length > 1 ? rngPick(rng, activeGenerators) : activeGenerators[0];
    // Field patterns always get the stable story palette; everything else
    // leans dominant ~72% of the time with full-palette pops in between.
    const motifColors = !useStory ? colors : isFieldPattern ? storyColors : rng() < 0.72 ? storyColors : colors;
    const motif = generator.createMotif(rng, motifColors, effectiveMotifSize, placement.colorSeed);
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
    // holds without needing to re-measure after the overlay is added.
    const detailedNode = applyHeroDetailOverlay(
      motif.node,
      { role: placement.role, radius: safeRadius, colors: motifColors, instanceCount: paintOrderedPlacements.length },
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

  // Filler goes behind everything except the background; built last so its
  // rng draws never shift the main pattern for an existing seed.
  const fillerStyle = params.fillerStyle ?? 'none';
  const patternLayers: SvgNode[] = [];
  if (fillerStyle !== 'none') patternLayers.push(buildFillerLayer(fillerStyle, rng, useStory ? storyColors : colors, tileSize));
  if (shadowGroups.length > 0) patternLayers.push(h('g', { id: 'layer-shadows' }, shadowGroups));
  patternLayers.push(...motifGroups);

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

  return { params, backgroundColor, colors, svg: content };
}
