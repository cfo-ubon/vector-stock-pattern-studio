import type { Motif, PatternGenerator, Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { accentColors, blendHex } from '../palettes/palettes';
import { rngPick, rngInt, rngRange } from '../engine/rng';
import { pinnateVeins } from './shared';

// Tropical generator. Palm fronds, monstera leaves, hibiscus blooms and
// citrus slices — flat, saturated shapes typical of tropical/summer stock
// patterns. `colors[0]` doubles as the tile background color (set by the
// engine), which lets monstera leaves "punch" background-colored notches
// into a filled leaf shape for the classic split-leaf silhouette.

type Variant = (rng: Rng, colors: string[], size: number) => { node: ReturnType<typeof h>; radius: number };

/** Single fan-palm blade: narrow at the base, widest around 60% out,
 * tapering to a fine point — an asymmetric taper reads more like a real
 * blade than a symmetric teardrop. */
function bladePath(length: number, width: number): string {
  const w = width / 2;
  const wy = -length * 0.42;
  return (
    `M 0 0 C ${round(w * 0.5)} ${round(-length * 0.15)} ${round(w)} ${round(wy + w * 0.4)} ${round(w * 0.9)} ${round(wy)} ` +
    `C ${round(w * 0.75)} ${round(-length * 0.72)} ${round(w * 0.3)} ${round(-length * 0.92)} 0 ${round(-length)} ` +
    `C ${round(-w * 0.3)} ${round(-length * 0.92)} ${round(-w * 0.75)} ${round(-length * 0.72)} ${round(-w * 0.9)} ${round(wy)} ` +
    `C ${round(-w)} ${round(wy + w * 0.4)} ${round(-w * 0.5)} ${round(-length * 0.15)} 0 0 Z`
  );
}

export const palmFrond: Variant = (rng, colors, size) => {
  const bladeCount = rngInt(rng, 5, 7);
  const length = size * rngRange(rng, 0.55, 0.7);
  const width = length * 0.32;
  const spread = 130;
  const color = rngPick(rng, accentColors(colors));
  const creaseColor = blendHex(color, 0.35, colors[0]);
  const children: ReturnType<typeof h>[] = [];
  for (let i = 0; i < bladeCount; i++) {
    const angle = -spread / 2 + (spread * i) / (bladeCount - 1);
    children.push(
      h('g', { transform: `rotate(${round(angle)})` }, [
        h('path', { d: bladePath(length, width), fill: color }),
        // Center crease: a thin darker line down each blade reads as the
        // fold every real palm blade has.
        h('path', {
          d: `M 0 0 L 0 ${round(-length * 0.94)}`,
          fill: 'none',
          stroke: creaseColor,
          'stroke-width': round(length * 0.012),
          'stroke-linecap': 'round',
        }),
      ]),
    );
  }
  const node = h('g', { transform: `translate(0 ${round(size * 0.4)})` }, children);
  return { node, radius: size * 0.6 };
};

/** Pinnate (feather) frond: the coconut/date-palm silhouette — a curved
 * central rachis with individual pointed leaflets stepping down both
 * sides, drooping outward as they go, instead of a fan of blades from one
 * point. The single most recognizable "palm leaf" shape for tropical
 * prints, and previously missing from the category entirely. */
const pinnateFrond: Variant = (rng, colors, size) => {
  const half = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const bend = size * rngRange(rng, 0.12, 0.22);
  const pairs = rngInt(rng, 6, 8);
  const rachisPath = `M 0 ${round(half)} Q ${round(bend)} 0 0 ${round(-half)}`;
  const children: ReturnType<typeof h>[] = [
    h('path', {
      d: rachisPath,
      fill: 'none',
      stroke: blendHex(color, 0.6, colors[0]),
      'stroke-width': round(size * 0.025),
      'stroke-linecap': 'round',
    }),
  ];
  for (let i = 0; i < pairs; i++) {
    const t = (i + 0.5) / pairs;
    // Point on the curved rachis at parameter t (quadratic Bezier eval).
    const x = 2 * (1 - t) * t * bend;
    const y = half + t * (-half - half);
    const leafletLen = size * (0.34 - t * 0.14) * rngRange(rng, 0.9, 1.05);
    const droop = 55 + t * 25; // leaflets droop more toward the tip
    for (const side of [-1, 1] as const) {
      children.push(
        h('g', { transform: `translate(${round(x)} ${round(y)}) rotate(${round(side * droop)})` }, [
          h('path', {
            d: `M 0 0 C ${round(leafletLen * 0.25)} ${round(-leafletLen * 0.1)} ${round(leafletLen * 0.4)} ${round(-leafletLen * 0.55)} 0 ${round(-leafletLen)} C ${round(-leafletLen * 0.4)} ${round(-leafletLen * 0.55)} ${round(-leafletLen * 0.25)} ${round(-leafletLen * 0.1)} 0 0 Z`,
            fill: color,
          }),
        ]),
      );
    }
  }
  return { node: h('g', {}, children), radius: half * 1.15 };
};

/** Gently scalloped leaf margin instead of a smooth oval — the shallow
 * undulation real monstera leaves have along their edge. A low-frequency
 * envelope (the overall leaf silhouette) is modulated by a higher-
 * frequency ripple sampled densely enough that short straight segments
 * between points read as a smooth wavy line rather than a faceted
 * polygon. */
function monsteraOutline(r: number, rng: Rng): string {
  const waves = rngInt(rng, 4, 5);
  const rippleAmt = 0.07 + rng() * 0.04;
  const phase = rng() * Math.PI * 2;
  const samples = 36;
  const rightPts: Array<[number, number]> = [];
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    const y = -r + 2 * r * t;
    const envelope = Math.sin(Math.PI * t); // 0 at top/bottom tip, 1 at mid-height
    const ripple = 1 + rippleAmt * Math.sin(2 * Math.PI * waves * t + phase);
    rightPts.push([r * 0.82 * envelope * ripple, y]);
  }
  let d = `M 0 ${round(-r)} `;
  for (const [x, y] of rightPts) d += `L ${round(x)} ${round(y)} `;
  d += `L 0 ${round(r)} `;
  for (let i = rightPts.length - 1; i >= 0; i--) {
    const [x, y] = rightPts[i];
    d += `L ${round(-x)} ${round(y)} `;
  }
  d += 'Z';
  return d;
}

export const monsteraLeaf: Variant = (rng, colors, size) => {
  const r = size / 2;
  const leafColor = rngPick(rng, accentColors(colors));
  const holeColor = colors[0];
  const children: ReturnType<typeof h>[] = [h('path', { d: monsteraOutline(r, rng), fill: leafColor })];
  const holePairs = rngInt(rng, 2, 3);
  for (let i = 0; i < holePairs; i++) {
    const t = (i + 1) / (holePairs + 1);
    const y = -r * 0.5 + r * 1.1 * t;
    // Organic size variation and reach-toward-the-edge — real fenestrations
    // aren't uniform, and get closer to the margin lower on the leaf.
    const hw = r * (0.11 + rng() * 0.07);
    const reach = 0.36 + t * 0.14;
    for (const side of [-1, 1]) {
      children.push(
        h('ellipse', {
          cx: round(side * r * reach),
          cy: round(y),
          rx: round(hw),
          ry: round(hw * (1.5 + rng() * 0.4)),
          fill: holeColor,
          transform: `rotate(${round(side * (16 + rng() * 12))} ${round(side * r * reach)} ${round(y)})`,
        }),
      );
    }
  }
  children.push(...pinnateVeins(r * 1.9, r * 1.5, holeColor, leafColor, 3));
  return { node: h('g', {}, children), radius: r * 1.08 };
};

/** Paddle-shaped, slightly pinched petal (overlapping funnel look) instead
 * of a plain ellipse — closer to a real hibiscus petal's silhouette. */
function hibiscusPetalPath(len: number, width: number): string {
  const w = width / 2;
  return `M 0 0 C ${round(w * 0.15)} ${round(-len * 0.2)} ${round(w)} ${round(-len * 0.35)} ${round(w * 0.85)} ${round(-len * 0.7)} C ${round(w * 0.55)} ${round(-len * 0.95)} ${round(w * 0.2)} ${round(-len)} 0 ${round(-len)} C ${round(-w * 0.2)} ${round(-len)} ${round(-w * 0.55)} ${round(-len * 0.95)} ${round(-w * 0.85)} ${round(-len * 0.7)} C ${round(-w)} ${round(-len * 0.35)} ${round(-w * 0.15)} ${round(-len * 0.2)} 0 0 Z`;
}

const hibiscusBloom: Variant = (rng, colors, size) => {
  const r = size / 2;
  const petals = 5;
  const petalColor = rngPick(rng, accentColors(colors));
  const centerColor = rngPick(rng, accentColors(colors));
  const petalLen = r * 1.0;
  const petalW = petalLen * 0.68;
  const children: ReturnType<typeof h>[] = [];
  for (let i = 0; i < petals; i++) {
    const angle = (360 / petals) * i;
    children.push(
      h('g', { transform: `rotate(${round(angle)}) translate(0 ${round(-petalLen * 0.28)})` }, [
        h('path', { d: hibiscusPetalPath(petalLen, petalW), fill: blendHex(petalColor, 0.94, colors[0]) }),
      ]),
    );
  }
  // Hibiscus's signature: a long stamen column protruding well past the
  // petals, with a small cluster of anthers near the tip.
  const stamenLen = r * 0.85;
  children.push(
    h('path', {
      d: `M 0 0 Q ${round(r * 0.06)} ${round(-stamenLen * 0.6)} 0 ${round(-stamenLen)}`,
      fill: 'none',
      stroke: centerColor,
      'stroke-width': round(size * 0.035),
      'stroke-linecap': 'round',
    }),
  );
  const anthers = 5;
  for (let i = 0; i < anthers; i++) {
    const a = (i / (anthers - 1) - 0.5) * 50;
    const rad = (a * Math.PI) / 180;
    children.push(
      h('circle', {
        cx: round(Math.sin(rad) * r * 0.1),
        cy: round(-stamenLen + Math.cos(rad) * r * 0.1 - r * 0.02),
        r: round(r * 0.045),
        fill: rngPick(rng, accentColors(colors)),
      }),
    );
  }
  children.push(h('circle', { cx: 0, cy: 0, r: round(r * 0.16), fill: centerColor }));
  return { node: h('g', {}, children), radius: r * 1.1 };
};

const citrusSlice: Variant = (rng, colors, size) => {
  const r = size / 2;
  const rindColor = rngPick(rng, accentColors(colors));
  const fleshColorA = rngPick(rng, accentColors(colors));
  const fleshColorB = blendHex(fleshColorA, 0.7, colors[0]);
  const pithColor = blendHex(colors[0], 0.75, fleshColorA);
  const segments = rngInt(rng, 8, 11);
  const children: ReturnType<typeof h>[] = [
    h('circle', { cx: 0, cy: 0, r: round(r), fill: rindColor }),
    // Pith: the white membrane ring between rind and flesh.
    h('circle', { cx: 0, cy: 0, r: round(r * 0.9), fill: pithColor }),
    h('circle', { cx: 0, cy: 0, r: round(r * 0.8), fill: fleshColorA }),
  ];
  // Alternate wedge tone per segment for a juicy-vesicle texture instead
  // of flat radial lines only.
  for (let i = 0; i < segments; i++) {
    const a1 = ((360 / segments) * i * Math.PI) / 180;
    const a2 = ((360 / segments) * (i + 1) * Math.PI) / 180;
    if (i % 2 === 0) {
      const large = a2 - a1 > Math.PI ? 1 : 0;
      children.push(
        h('path', {
          d: `M 0 0 L ${round(Math.cos(a1) * r * 0.79)} ${round(Math.sin(a1) * r * 0.79)} A ${round(r * 0.79)} ${round(r * 0.79)} 0 ${large} 1 ${round(Math.cos(a2) * r * 0.79)} ${round(Math.sin(a2) * r * 0.79)} Z`,
          fill: fleshColorB,
        }),
      );
    }
    children.push(
      h('line', {
        x1: 0,
        y1: 0,
        x2: round(Math.cos(a1) * r * 0.79),
        y2: round(Math.sin(a1) * r * 0.79),
        stroke: pithColor,
        'stroke-width': round(size * 0.012),
      }),
    );
  }
  children.push(h('circle', { cx: 0, cy: 0, r: round(r * 0.1), fill: pithColor }));
  return { node: h('g', {}, children), radius: r * 1.02 };
};

const VARIANTS: Variant[] = [palmFrond, pinnateFrond, monsteraLeaf, hibiscusBloom, citrusSlice];

export const tropicalGenerator: PatternGenerator = {
  id: 'tropical',
  label: 'Tropical',
  description: 'Palm fronds (fan and feather), monstera leaves, hibiscus blooms and citrus slices.',
  defaultMotifSize: 75,
  createMotif(rng: Rng, colors: string[], size: number): Motif {
    const variant = rngPick(rng, VARIANTS);
    const { node, radius } = variant(rng, colors, size);
    return { node, radius };
  },
};
