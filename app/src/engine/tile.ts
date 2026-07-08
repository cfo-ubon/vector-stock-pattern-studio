import type { GenerateParams, Placement, SvgNode, TileData } from './types';
import { createRng } from './rng';
import { h, round, computeBoundingRadius } from './svgAst';
import { GENERATORS } from '../generators';
import { LAYOUTS } from '../layouts';
import { getPalette, resolveColors } from '../palettes/palettes';

const WRAP_OFFSETS = [-1, 0, 1];

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
  const generator = GENERATORS[params.categoryId] ?? Object.values(GENERATORS)[0];
  const layout = LAYOUTS[params.layoutId] ?? Object.values(LAYOUTS)[0];
  const isValidHex = (c: string) => /^#[0-9a-fA-F]{6}$/.test(c);
  const custom = params.customColors?.filter(isValidHex) ?? [];
  const colors = custom.length >= 2 ? custom.slice(0, 6) : resolveColors(getPalette(params.paletteId), params.colorCount);
  const backgroundColor = colors[0];
  const { tileSize } = params;
  generator.beginTile?.(rng);

  const placements: Placement[] = layout.generate(
    {
      tileSize,
      motifSize: params.motifSize,
      density: params.density,
      rotationJitter: params.rotationJitter,
      scaleJitter: params.scaleJitter,
      mirror: params.mirror,
      radialSymmetry: params.radialSymmetry,
    },
    rng,
  );

  const motifGroups: SvgNode[] = placements.map((placement, index) => {
    const motif = generator.createMotif(rng, colors, params.motifSize);
    // Never trust the generator's hand-estimated radius alone — a motif
    // with an off-center appendage (an ear, a ray, a curling leaf) is easy
    // to under-measure by hand, and an underestimate here means a missing
    // wrap-clone at the tile edge, i.e. a visible seam. The geometric bound
    // computed straight from the shape's own coordinates can't be wrong in
    // that direction, so take whichever is larger.
    const safeRadius = Math.max(motif.radius, computeBoundingRadius(motif.node));
    const effectiveRadius = safeRadius * placement.scale;
    const instances: SvgNode[] = [];

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
        instances.push(
          h(
            'g',
            {
              transform: `translate(${round(wx)} ${round(wy)}) rotate(${round(placement.rotationDeg)}) scale(${round(placement.scale)})`,
            },
            [motif.node],
          ),
        );
      }
    }

    return h('g', { id: `motif-${index + 1}` }, instances);
  });

  const content: SvgNode = h('g', { id: 'tile-content' }, [
    h('defs', {}, [
      h('clipPath', { id: 'tile-clip' }, [h('rect', { x: 0, y: 0, width: tileSize, height: tileSize })]),
    ]),
    h('g', { id: 'layer-background' }, [h('rect', { x: 0, y: 0, width: tileSize, height: tileSize, fill: backgroundColor })]),
    h('g', { id: 'layer-pattern', 'clip-path': 'url(#tile-clip)' }, motifGroups),
  ]);

  return { params, backgroundColor, colors, svg: content };
}
