import type { Motif, PatternGenerator, Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { accentColors } from '../palettes/palettes';
import { rngPick, rngInt, rngBool } from '../engine/rng';

// Textile / Damask-inspired generator (flat — no gradients or shading).
// Classic damask ornaments are bilaterally symmetric, so every variant
// draws one half and mirrors it with scale(-1,1). Works best on half-drop
// or grid layouts with 2-3 colors, mimicking traditional woven repeats.

type Variant = (rng: Rng, colors: string[], size: number) => { node: ReturnType<typeof h>; radius: number };

/** Draw `half` once and again mirrored across the vertical axis — the
 * bilateral symmetry that makes an ornament read as damask. */
function mirrored(half: ReturnType<typeof h>[]): ReturnType<typeof h> {
  return h('g', {}, [h('g', {}, half), h('g', { transform: 'scale(-1 1)' }, half)]);
}

const ogeeOrnament: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const main = rngPick(rng, accents);
  const detail = rngPick(rng, accents);
  const half = [
    // Pointed-oval (ogee) body half
    h('path', {
      d: `M 0 ${round(-r)} C ${round(r * 0.55)} ${round(-r * 0.5)} ${round(r * 0.55)} ${round(r * 0.5)} 0 ${round(r)} L 0 ${round(-r)} Z`,
      fill: main,
    }),
    // Inner accent half-oval
    h('path', {
      d: `M 0 ${round(-r * 0.6)} C ${round(r * 0.3)} ${round(-r * 0.3)} ${round(r * 0.3)} ${round(r * 0.3)} 0 ${round(r * 0.6)} L 0 ${round(-r * 0.6)} Z`,
      fill: detail,
    }),
    // Side flourish curl
    h('path', {
      d: `M ${round(r * 0.5)} ${round(-r * 0.15)} Q ${round(r * 0.85)} ${round(-r * 0.3)} ${round(r * 0.8)} ${round(r * 0.1)}`,
      fill: 'none',
      stroke: main,
      'stroke-width': round(size * 0.035),
      'stroke-linecap': 'round',
    }),
  ];
  const children = [mirrored(half), h('circle', { cx: 0, cy: 0, r: round(r * 0.08), fill: colors[0] })];
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const acanthusSprig: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const main = rngPick(rng, accents);
  const leafPairs = rngInt(rng, 2, 3);
  const half: ReturnType<typeof h>[] = [
    // Central stem
    h('path', {
      d: `M 0 ${round(r)} C ${round(r * 0.08)} ${round(r * 0.3)} ${round(r * 0.08)} ${round(-r * 0.3)} 0 ${round(-r * 0.9)}`,
      fill: 'none',
      stroke: main,
      'stroke-width': round(size * 0.04),
      'stroke-linecap': 'round',
    }),
  ];
  for (let i = 0; i < leafPairs; i++) {
    const t = (i + 1) / (leafPairs + 1);
    const y = r * 0.7 - size * t * 0.75;
    const len = r * (0.62 - i * 0.14);
    // Curled acanthus leaf: swings out then hooks back in
    half.push(
      h('path', {
        d: `M 0 ${round(y)} C ${round(len * 0.7)} ${round(y - len * 0.1)} ${round(len)} ${round(y - len * 0.55)} ${round(len * 0.55)} ${round(y - len * 0.75)} C ${round(len * 0.75)} ${round(y - len * 0.4)} ${round(len * 0.45)} ${round(y - len * 0.15)} 0 ${round(y - len * 0.12)} Z`,
        fill: main,
        opacity: 0.94,
      }),
    );
  }
  // Bud tip
  half.push(h('ellipse', { cx: 0, cy: round(-r * 0.9), rx: round(r * 0.1), ry: round(r * 0.16), fill: rngPick(rng, accents) }));
  // Bud ellipse top reaches -0.9r - 0.16r = -1.06r.
  return { node: mirrored(half), radius: r * 1.1 };
};

const damaskDiamond: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const main = rngPick(rng, accents);
  const detail = rngPick(rng, accents);
  const children = [
    // Curved-edge diamond (ogee frame)
    h('path', {
      d: `M 0 ${round(-r)} Q ${round(r * 0.55)} ${round(-r * 0.45)} ${round(r)} 0 Q ${round(r * 0.55)} ${round(r * 0.45)} 0 ${round(r)} Q ${round(-r * 0.55)} ${round(r * 0.45)} ${round(-r)} 0 Q ${round(-r * 0.55)} ${round(-r * 0.45)} 0 ${round(-r)} Z`,
      fill: main,
    }),
    h('path', {
      d: `M 0 ${round(-r * 0.62)} Q ${round(r * 0.34)} ${round(-r * 0.28)} ${round(r * 0.62)} 0 Q ${round(r * 0.34)} ${round(r * 0.28)} 0 ${round(r * 0.62)} Q ${round(-r * 0.34)} ${round(r * 0.28)} ${round(-r * 0.62)} 0 Q ${round(-r * 0.34)} ${round(-r * 0.28)} 0 ${round(-r * 0.62)} Z`,
      fill: detail,
    }),
  ];
  if (rngBool(rng)) {
    children.push(
      h('circle', { cx: 0, cy: 0, r: round(r * 0.14), fill: main }),
      h('circle', { cx: 0, cy: 0, r: round(r * 0.06), fill: colors[0] }),
    );
  } else {
    const fl = [
      h('path', {
        d: `M 0 ${round(r * 0.18)} C ${round(r * 0.16)} ${round(r * 0.02)} ${round(r * 0.16)} ${round(-r * 0.18)} 0 ${round(-r * 0.3)} L 0 ${round(r * 0.18)} Z`,
        fill: main,
      }),
    ];
    children.push(mirrored(fl));
  }
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const fleurOrnament: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const main = rngPick(rng, accents);
  const half: ReturnType<typeof h>[] = [
    // Central petal half
    h('path', {
      d: `M 0 ${round(r * 0.35)} C ${round(r * 0.28)} ${round(r * 0.05)} ${round(r * 0.28)} ${round(-r * 0.5)} 0 ${round(-r * 0.95)} L 0 ${round(r * 0.35)} Z`,
      fill: main,
    }),
    // Side petal curling outward
    h('path', {
      d: `M ${round(r * 0.12)} ${round(r * 0.25)} C ${round(r * 0.6)} ${round(r * 0.1)} ${round(r * 0.75)} ${round(-r * 0.35)} ${round(r * 0.5)} ${round(-r * 0.55)} C ${round(r * 0.6)} ${round(-r * 0.15)} ${round(r * 0.4)} ${round(r * 0.05)} ${round(r * 0.1)} ${round(r * 0.12)} Z`,
      fill: main,
      opacity: 0.92,
    }),
  ];
  const children = [
    mirrored(half),
    // Band + base
    h('rect', { x: round(-r * 0.34), y: round(r * 0.38), width: round(r * 0.68), height: round(r * 0.14), rx: round(r * 0.06), fill: rngPick(rng, accents) }),
    h('circle', { cx: 0, cy: round(r * 0.72), r: round(r * 0.12), fill: main }),
  ];
  return { node: h('g', {}, children), radius: r * 1.05 };
};

const VARIANTS: Variant[] = [ogeeOrnament, acanthusSprig, damaskDiamond, fleurOrnament];

export const damaskGenerator: PatternGenerator = {
  id: 'damask',
  label: 'Textile / Damask',
  description: 'Flat classic textile ornaments: ogee medallions, acanthus sprigs, curved diamonds and fleur motifs.',
  defaultMotifSize: 80,
  createMotif(rng: Rng, colors: string[], size: number): Motif {
    const variant = rngPick(rng, VARIANTS);
    const { node, radius } = variant(rng, colors, size);
    return { node, radius };
  },
};
