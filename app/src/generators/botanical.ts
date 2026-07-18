import type { Motif, MotifCreateHints, PatternGenerator, Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { accentColors, blendHex } from '../palettes/palettes';
import { rngPick, rngInt, rngRange, rngBool } from '../engine/rng';
import { pinnateVeins } from './shared';
import { smoothPathD, wobbleEnvelope, radialAsymmetry, tangentToUpAngleDeg, type Pt } from '../engine/curveEngine';
import { generateStem, growLeaves, terminalPoint, GROWTH_PRESETS } from './growth';
import { organicPetalPath, petalRing, layeredPetalRing } from './petals';
import { BOTANICAL_FAMILIES, type BotanicalFamily } from './botanicalFamilies';
import { BOTANICAL_PARTS, shapeCategoryForPart, type BotanicalPart, type PartShapeCategory } from './botanicalParts';
import { palmFrond, monsteraLeaf } from './tropical';

// Botanical / Floral generator. Flat, minimal leaf/flower/branch shapes —
// no gradients or texture, matching the flat-illustration look common in
// stock florals. Stem-bearing motifs (branches, sprigs) are built with the
// growth engine (generators/growth.ts): a continuously-curved stem spline
// with leaves placed tangent to the local curve direction, instead of a
// straight/simple-curve stem with independently-rotated leaves. Ring-based
// flowers use the shared organic petal builder (generators/petals.ts) and
// a small seeded asymmetry jitter instead of perfectly even `<ellipse>`
// rings, so they read as hand-drawn rather than a stamped pattern.

type Variant = (rng: Rng, colors: string[], size: number) => { node: ReturnType<typeof h>; radius: number };

// Realistic leaf silhouettes: a botanically-inspired ovate shape (pointed
// tip, widest below center, tapered rounded base — the classic leaf
// outline) and a toothed/serrated variant (birch/elm-like edge), each
// paired with proper pinnate venation (one midrib + branching side veins)
// instead of a single straight line — the detail that reads as "a real
// leaf" rather than a flat almond icon.

/** Pointed-tip ovate leaf: asymmetric taper (fuller below center, tapered
 * base) built from four cubic segments for a natural curve. Exported for
 * `generators/leafAnatomy.ts` (Build 007, Section 2), which reuses this
 * exact shape as one of its real per-species leaf silhouettes rather than
 * re-deriving the same ovate curve a second time. */
export function ovateLeafPath(length: number, width: number): string {
  const h2 = length / 2;
  const w = width / 2;
  const wy = -h2 * 0.12; // widest point sits slightly below center
  return (
    `M 0 ${round(-h2)} ` +
    `C ${round(w * 0.55)} ${round(-h2 * 0.55)} ${round(w)} ${round(wy - w * 0.35)} ${round(w)} ${round(wy)} ` +
    `C ${round(w)} ${round(wy + w * 0.95)} ${round(w * 0.4)} ${round(h2 * 0.85)} 0 ${round(h2)} ` +
    `C ${round(-w * 0.4)} ${round(h2 * 0.85)} ${round(-w)} ${round(wy + w * 0.95)} ${round(-w)} ${round(wy)} ` +
    `C ${round(-w)} ${round(wy - w * 0.35)} ${round(-w * 0.55)} ${round(-h2 * 0.55)} 0 ${round(-h2)} Z`
  );
}

/** Toothed leaf edge: samples the same ovate envelope but alternates each
 * boundary point in/out to cut small teeth, connected with straight
 * segments (a jagged edge reads correctly even without curves — real leaf
 * teeth are sharp, so this is a deliberate exception to "smooth curves
 * everywhere"). */
export function serratedLeafPath(length: number, width: number, rng: Rng): string {
  const h2 = length / 2;
  const w = width / 2;
  const teeth = rngInt(rng, 9, 13);
  const envelope = (t: number) => Math.sin(Math.PI * t) * (1 - 0.15 * Math.cos(Math.PI * t));
  const pts: string[] = [];
  for (let i = 1; i < teeth; i++) {
    const t = i / teeth;
    const y = -h2 + length * t;
    const baseR = w * envelope(t);
    const toothR = baseR * (i % 2 === 0 ? 1 : 0.8);
    pts.push(`${round(toothR)} ${round(y)}`);
  }
  const rightSide = pts.join(' L ');
  const leftSide = pts
    .slice()
    .reverse()
    .map((p) => {
      const [x, y] = p.split(' ');
      return `${round(-Number(x))} ${y}`;
    })
    .join(' L ');
  return `M 0 ${round(-h2)} L ${rightSide} L 0 ${round(h2)} L ${leftSide} Z`;
}

function leafNode(rng: Rng, colors: string[], length: number, width: number): ReturnType<typeof h> {
  const fill = rngPick(rng, accentColors(colors));
  const veinColor = rngPick(rng, accentColors(colors));
  const shape = rngBool(rng) ? ovateLeafPath(length, width) : serratedLeafPath(length, width, rng);
  return h('g', {}, [h('path', { d: shape, fill }), ...pinnateVeins(length, width, veinColor, fill)]);
}

const singleLeaf: Variant = (rng, colors, size) => {
  const length = size * rngRange(rng, 0.75, 1);
  const width = length * rngRange(rng, 0.42, 0.6);
  const node = h('g', { transform: `rotate(${round(rngRange(rng, -20, 20))})` }, [leafNode(rng, colors, length, width)]);
  return { node, radius: length * 0.55 };
};

// Build 007, Section 1 (Flower Anatomy Engine): this was the app's own
// "generic star-shaped flower" the brief warns against by name -- a single
// flat ring of petals around a bare circle, used as the untagged fallback
// bloom across most families with no dedicated species variant. A real
// flower has petal HIERARCHY (an outer whorl plus a smaller inner whorl,
// interleaved, not stacked), so this now uses `layeredPetalRing` (see
// petals.ts) instead of one flat ring -- genuinely different geometry, not
// a re-labeled single ring. `openness` (a real bloom-stage value, seeded
// per instance) makes the inner whorl read anywhere from "just starting to
// open" to "fully open", the same natural variety a bouquet's blooms show
// at different ages instead of every bloom looking identically staged.
// Build 018 ("Revenue First", Priority 4 — Botanical composition): an
// empirical audit (`scripts/build018BotanicalAudit.ts`) found Botanical
// Realism (`engine/botanicalBeautyMetrics.ts`'s `computeBotanicalRealism`
// — the % of motif instances with a real `data-part="stem"`/`"leaves"`
// group) averaging just ~31/100 across a diverse 60-pattern sample, far
// below every other dimension. This variant's own doc comment above
// states it is "the untagged fallback bloom across most families with
// no dedicated species variant" — i.e. the single most common bare
// (stem-less) motif in the whole generator. A stem beneath a bloom is
// also just accurate: a cut/growing flower head is rarely drawn
// floating with nothing beneath it. The stem is optional (not every
// instance) so bare, floating-petal blooms — a legitimate accent
// look — stay in the mix; the stem line reuses the exact drawing idiom
// `flowerBud` above already established (plain `<line>`,
// `data-part="stem"`, same stroke-width convention), not a new shape.
const flowerBloom: Variant = (rng, colors, size) => {
  const r = size / 2;
  const outerCount = rngInt(rng, 5, 7);
  const innerCount = rngInt(rng, 4, 6);
  const petalColor = rngPick(rng, accentColors(colors));
  const innerColor = rngPick(rng, accentColors(colors));
  const centerColor = rngPick(rng, accentColors(colors));
  const openness = rngRange(rng, 0.4, 1);
  const { outer, inner } = layeredPetalRing(rng, {
    outerCount,
    innerCount,
    outerLength: r * 0.85,
    outerWidth: r * 0.85 * 0.5,
    innerScale: 0.58,
    outerColor: petalColor,
    innerColor,
    curvature: 0.55,
    openness,
    variants: ['rounded', 'rounded', 'pointed', 'folded'],
  });
  const hasStem = rngBool(rng, 0.6);
  const stemColor = rngPick(rng, accentColors(colors));
  const node = h('g', {}, [
    ...(hasStem
      ? [
          h('g', { 'data-part': 'stem' }, [
            h('line', {
              x1: 0,
              y1: round(r * 0.75),
              x2: 0,
              y2: round(r * 1.35),
              stroke: stemColor,
              'stroke-width': round(size * 0.045),
              'stroke-linecap': 'round',
            }),
          ]),
        ]
      : []),
    h('g', { 'data-part': 'petals-outer' }, outer),
    h('g', { 'data-part': 'petals-inner' }, inner),
    h('g', { 'data-part': 'center' }, [h('circle', { cx: 0, cy: 0, r: round(r * 0.16), fill: centerColor })]),
  ]);
  return { node, radius: hasStem ? r * 1.35 : r * 1.05 };
};

const flowerBud: Variant = (rng, colors, size) => {
  const r = size / 2;
  const stemColor = rngPick(rng, accentColors(colors));
  const budColor = rngPick(rng, accentColors(colors));
  const budPath = `M 0 ${round(-r * 0.75)} C ${round(r * 0.42)} ${round(-r * 0.55)} ${round(r * 0.4)} ${round(r * 0.1)} 0 ${round(r * 0.3)} C ${round(-r * 0.4)} ${round(r * 0.1)} ${round(-r * 0.42)} ${round(-r * 0.55)} 0 ${round(-r * 0.75)} Z`;
  const node = h('g', {}, [
    h('g', { 'data-part': 'stem' }, [
      h('line', {
        x1: 0,
        y1: round(r * 0.2),
        x2: 0,
        y2: round(r),
        stroke: stemColor,
        'stroke-width': round(size * 0.05),
        'stroke-linecap': 'round',
      }),
    ]),
    h('g', { 'data-part': 'center' }, [h('path', { d: budPath, fill: budColor })]),
    ...(rngBool(rng)
      ? [
          h('g', { 'data-part': 'leaves' }, [
            h('g', { transform: `translate(0 ${round(r * 0.55)}) rotate(${round((rngBool(rng) ? 1 : -1) * rngRange(rng, 35, 50))})` }, [
              leafNode(rng, colors, r * 0.65, r * 0.32),
            ]),
          ]),
        ]
      : []),
  ]);
  return { node, radius: r * 1.05 };
};

const fernFrond: Variant = (rng, colors, size) => {
  const preset = GROWTH_PRESETS.fern;
  const stem = generateStem(rng, size, preset.curvature);
  const stemColor = rngPick(rng, accentColors(colors));
  const leafletColor = rngPick(rng, accentColors(colors));
  const leaflets = growLeaves(rng, stem, preset);
  const leafletPath = (len: number) =>
    `M 0 0 Q ${round(len * 0.55)} ${round(-len * 0.35)} 0 ${round(-len)} Q ${round(-len * 0.55)} ${round(-len * 0.35)} 0 0 Z`;
  const leafNodes = leaflets.map((leaf) =>
    h('g', { transform: `translate(${round(leaf.point.x)} ${round(leaf.point.y)}) rotate(${round(leaf.angle)}) scale(${round(leaf.scale)})` }, [
      h('path', { d: leafletPath(size * 0.17), fill: leafletColor }),
    ]),
  );
  const node = h('g', {}, [
    h('g', { 'data-part': 'stem' }, [
      h('path', { d: stem.path, fill: 'none', stroke: stemColor, 'stroke-width': round(size * 0.025), 'stroke-linecap': 'round' }),
    ]),
    h('g', { 'data-part': 'leaves' }, leafNodes),
  ]);
  return { node, radius: size * 0.58 };
};

const simpleTulip: Variant = (rng, colors, size) => {
  const r = size / 2;
  const stemColor = rngPick(rng, accentColors(colors));
  const petalColor = rngPick(rng, accentColors(colors));
  const petalW = r * 0.4;
  const petalH = r * 0.85;
  const petals: ReturnType<typeof h>[] = [];
  for (const [dx, rot] of [[0, 0], [-petalW * 0.75, -18], [petalW * 0.75, 18]] as const) {
    petals.push(
      h('path', {
        d: `M 0 0 C ${round(petalW / 2)} ${round(-petalH * 0.4)} ${round(petalW / 2)} ${round(-petalH * 0.85)} 0 ${round(-petalH)} C ${round(-petalW / 2)} ${round(-petalH * 0.85)} ${round(-petalW / 2)} ${round(-petalH * 0.4)} 0 0 Z`,
        // Side petals were 90%-transparent — pre-blend against background.
        fill: dx === 0 ? petalColor : blendHex(petalColor, 0.9, colors[0]),
        transform: `translate(${round(dx)} ${round(r * 0.15)}) rotate(${rot})`,
      }),
    );
  }
  const node = h('g', {}, [
    h('g', { 'data-part': 'stem' }, [
      h('path', { d: `M 0 ${round(r * 0.15)} Q ${round(r * 0.2)} ${round(r * 0.5)} 0 ${round(r)}`, fill: 'none', stroke: stemColor, 'stroke-width': round(size * 0.045), 'stroke-linecap': 'round' }),
    ]),
    h('g', { 'data-part': 'petals-outer' }, petals),
  ]);
  return { node, radius: r * 1.1 };
};

const leafyBranch: Variant = (rng, colors, size) => {
  const preset = GROWTH_PRESETS.leafyBranch;
  const stem = generateStem(rng, size, preset.curvature);
  const stemColor = rngPick(rng, accentColors(colors));
  const leaves = growLeaves(rng, stem, preset);
  const leafNodes = leaves.map((leaf) => {
    const leafLen = size * rngRange(rng, 0.32, 0.45) * leaf.scale;
    return h('g', { transform: `translate(${round(leaf.point.x)} ${round(leaf.point.y)}) rotate(${round(leaf.angle)})` }, [
      leafNode(rng, colors, leafLen, leafLen * 0.48),
    ]);
  });
  const node = h('g', {}, [
    h('g', { 'data-part': 'stem' }, [
      h('path', { d: stem.path, fill: 'none', stroke: stemColor, 'stroke-width': round(size * 0.045), 'stroke-linecap': 'round' }),
    ]),
    h('g', { 'data-part': 'leaves' }, leafNodes),
  ]);
  return { node, radius: size * 0.58 };
};

/** Two-layer bloom: an outer petal ring, an inner offset petal ring in a
 * second color, and a detailed center — reads as a "premium" flower next
 * to the flat single-ring blooms. */
const layeredBloom: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const outer = rngPick(rng, accents);
  let inner = rngPick(rng, accents);
  if (inner === outer && accents.length > 1) inner = accents[(accents.indexOf(outer) + 1) % accents.length];
  const core = rngPick(rng, accents);
  const petals = rngInt(rng, 7, 9);
  const outerPetals = petalRing(rng, {
    count: petals,
    distance: r * 0.16,
    length: r * 0.84,
    width: r * 0.4,
    color: outer,
    curvature: 0.5,
    angleJitter: 4,
  });
  const innerPetals = petalRing(rng, {
    count: petals,
    distance: r * 0.07,
    length: r * 0.54,
    width: r * 0.26,
    color: blendHex(inner, 0.92, colors[0]),
    curvature: 0.55,
    angleJitter: 4,
    rotationOffset: 180 / petals,
  });
  const details: ReturnType<typeof h>[] = [];
  const dots = 6;
  for (let i = 0; i < dots; i++) {
    const a = ((Math.PI * 2) / dots) * i;
    details.push(h('circle', { cx: round(Math.cos(a) * r * 0.09), cy: round(Math.sin(a) * r * 0.09), r: round(r * 0.028), fill: colors[0] }));
  }
  const node = h('g', { transform: `rotate(${round(rngRange(rng, 0, 45))})` }, [
    h('g', { 'data-part': 'petals-outer' }, outerPetals),
    h('g', { 'data-part': 'petals-inner' }, innerPetals),
    h('g', { 'data-part': 'center' }, [h('circle', { cx: 0, cy: 0, r: round(r * 0.17), fill: core }), ...details]),
  ]);
  return { node, radius: r * 1.05 };
};

/** Wildflower sprig: a curved stem (growth engine) carrying a small round
 * flower head at its tip, two tangent-oriented leaves and a bud — the
 * loose hand-picked look that sells in ditsy/meadow patterns. */
const wildflowerSprig: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const stemColor = rngPick(rng, accents);
  const headColor = rngPick(rng, accents);
  const budColor = rngPick(rng, accents);
  const stem = generateStem(rng, size * 0.95, rngRange(rng, 0.08, 0.18));
  const head = terminalPoint(stem);
  const headPetals: ReturnType<typeof h>[] = [];
  const petals = 6;
  for (let i = 0; i < petals; i++) {
    const a = ((Math.PI * 2) / petals) * i;
    headPetals.push(
      h('circle', { cx: round(head.x + Math.cos(a) * r * 0.17), cy: round(head.y + Math.sin(a) * r * 0.17), r: round(r * 0.11), fill: headColor }),
    );
  }
  headPetals.push(h('circle', { cx: round(head.x), cy: round(head.y), r: round(r * 0.09), fill: blendHex(stemColor, 0.85, colors[0]) }));

  const leafNodes: ReturnType<typeof h>[] = [];
  for (const [t, side] of [[0.35, 1], [0.62, -1]] as const) {
    const sample = stem.sampler.at(t);
    const angle = tangentToUpAngleDeg(sample.tangent) - 180 + side * rngRange(rng, 40, 60);
    const leafLen = size * rngRange(rng, 0.2, 0.28);
    leafNodes.push(
      h('g', { transform: `translate(${round(sample.point.x)} ${round(sample.point.y)}) rotate(${round(angle)})` }, [
        h('path', { d: organicPetalPath(leafLen, leafLen * 0.44, 0.35), fill: rngPick(rng, accents) }),
      ]),
    );
  }

  const budSample = stem.sampler.at(0.82);
  const budSide: 1 | -1 = rngBool(rng) ? -1 : 1;
  const budAngle = tangentToUpAngleDeg(budSample.tangent) - 180 + budSide * rngRange(rng, 25, 40);
  const budRad = (budAngle * Math.PI) / 180;
  const budTipX = budSample.point.x + Math.sin(budRad) * r * 0.28;
  const budTipY = budSample.point.y - Math.cos(budRad) * r * 0.28;
  const budNodes = [
    h('path', {
      d: `M ${round(budSample.point.x)} ${round(budSample.point.y)} Q ${round((budSample.point.x + budTipX) / 2)} ${round(budSample.point.y - r * 0.05)} ${round(budTipX)} ${round(budTipY)}`,
      fill: 'none',
      stroke: stemColor,
      'stroke-width': round(size * 0.03),
      'stroke-linecap': 'round',
    }),
    h('ellipse', {
      cx: round(budTipX),
      cy: round(budTipY),
      rx: round(r * 0.07),
      ry: round(r * 0.1),
      fill: budColor,
      transform: `rotate(${round(budAngle)} ${round(budTipX)} ${round(budTipY)})`,
    }),
  ];

  const node = h('g', {}, [
    h('g', { 'data-part': 'stem' }, [
      h('path', { d: stem.path, fill: 'none', stroke: stemColor, 'stroke-width': round(size * 0.04), 'stroke-linecap': 'round' }),
    ]),
    h('g', { 'data-part': 'petals-outer' }, headPetals),
    h('g', { 'data-part': 'leaves' }, leafNodes),
    h('g', { 'data-part': 'buds' }, budNodes),
  ]);
  return { node, radius: r * 1.15 };
};

/** Five-lobed maple-leaf silhouette: a center lobe, two angled side lobes
 * and two smaller basal lobes, connected by concave valleys (the notches
 * between real maple lobes) and closing through a shallow base notch at
 * the stem — plus palmate veins radiating from that base to every tip. */
function mapleLeafPath(r: number): string {
  const tips = [
    { a: -80, len: r * 0.62 },
    { a: -42, len: r * 0.88 },
    { a: 0, len: r * 1.0 },
    { a: 42, len: r * 0.88 },
    { a: 80, len: r * 0.62 },
  ];
  const pt = (aDeg: number, len: number): [number, number] => {
    const a = (aDeg * Math.PI) / 180;
    return [Math.sin(a) * len, -Math.cos(a) * len];
  };
  const valley = (a1: number, l1: number, a2: number, l2: number): [number, number] => pt((a1 + a2) / 2, Math.min(l1, l2) * 0.42);
  const first = pt(tips[0].a, tips[0].len);
  let d = `M ${round(first[0])} ${round(first[1])} `;
  for (let i = 0; i < tips.length - 1; i++) {
    const v = valley(tips[i].a, tips[i].len, tips[i + 1].a, tips[i + 1].len);
    const next = pt(tips[i + 1].a, tips[i + 1].len);
    d += `Q ${round(v[0])} ${round(v[1])} ${round(next[0])} ${round(next[1])} `;
  }
  const stem: [number, number] = [0, r * 0.78];
  const lastTip = pt(tips[tips.length - 1].a, tips[tips.length - 1].len);
  d += `Q ${round(lastTip[0] * 0.55)} ${round(r * 0.9)} ${round(stem[0])} ${round(stem[1])} `;
  d += `Q ${round(first[0] * 0.55)} ${round(r * 0.9)} ${round(first[0])} ${round(first[1])} Z`;
  return d;
}

const mapleLeaf: Variant = (rng, colors, size) => {
  const r = size / 2;
  const fill = rngPick(rng, accentColors(colors));
  const veinColor = rngPick(rng, accentColors(colors));
  const stroke = blendHex(veinColor, 0.5, fill);
  const tipAngles = [-80, -42, 0, 42, 80];
  const tipLens = [r * 0.62, r * 0.88, r * 1.0, r * 0.88, r * 0.62];
  const children: ReturnType<typeof h>[] = [h('path', { d: mapleLeafPath(r), fill })];
  tipAngles.forEach((a, i) => {
    const rad = (a * Math.PI) / 180;
    children.push(
      h('path', {
        d: `M 0 ${round(r * 0.7)} L ${round(Math.sin(rad) * tipLens[i])} ${round(-Math.cos(rad) * tipLens[i])}`,
        fill: 'none',
        stroke,
        'stroke-width': round(size * 0.012),
      }),
    );
  });
  children.push(
    h('path', {
      d: `M 0 ${round(r * 0.78)} L 0 ${round(r * 1.05)}`,
      fill: 'none',
      stroke: blendHex(veinColor, 0.7, colors[0]),
      'stroke-width': round(size * 0.03),
      'stroke-linecap': 'round',
    }),
  );
  return { node: h('g', { transform: `rotate(${round(rngRange(rng, -15, 15))})` }, children), radius: r * 1.2 };
};

/** Cordate (heart-shaped) leaf — the philodendron/anthurium silhouette:
 * pointed tip at the stem, two rounded lobes with a top notch, plus a
 * midrib and two vein pairs branching toward the lobes. */
function heartLeafPath(r: number): string {
  return `M 0 ${round(r * 0.95)} C ${round(-r * 1.05)} ${round(r * 0.15)} ${round(-r * 0.65)} ${round(-r * 0.85)} 0 ${round(-r * 0.3)} C ${round(r * 0.65)} ${round(-r * 0.85)} ${round(r * 1.05)} ${round(r * 0.15)} 0 ${round(r * 0.95)} Z`;
}

const heartLeaf: Variant = (rng, colors, size) => {
  const r = size / 2;
  const fill = rngPick(rng, accentColors(colors));
  const veinColor = rngPick(rng, accentColors(colors));
  const stroke = blendHex(veinColor, 0.5, fill);
  const children: ReturnType<typeof h>[] = [
    h('path', { d: heartLeafPath(r), fill }),
    h('path', {
      d: `M 0 ${round(-r * 0.22)} L 0 ${round(r * 0.82)}`,
      fill: 'none',
      stroke: blendHex(veinColor, 0.55, fill),
      'stroke-width': round(size * 0.02),
      'stroke-linecap': 'round',
    }),
    h('path', {
      d: `M 0 ${round(r * 0.95)} L 0 ${round(r * 1.2)}`,
      fill: 'none',
      stroke: blendHex(veinColor, 0.7, colors[0]),
      'stroke-width': round(size * 0.03),
      'stroke-linecap': 'round',
    }),
  ];
  for (const t of [0.15, 0.45]) {
    const y = -r * 0.22 + r * 1.04 * t;
    for (const side of [-1, 1] as const) {
      children.push(
        h('path', {
          d: `M 0 ${round(y)} Q ${round(side * r * 0.22)} ${round(y - r * 0.1)} ${round(side * r * 0.42)} ${round(y - r * 0.22)}`,
          fill: 'none',
          stroke,
          'stroke-width': round(size * 0.012),
        }),
      );
    }
  }
  return { node: h('g', {}, children), radius: r * 1.25 };
};

// --- Motif library expansion: named flowers + leaves, each with genuine
// seed-driven internal variation (petal/ring count, curvature, spiral
// offset, edge wobble, asymmetry) rather than only recolor/rotate of one
// base shape — so they read as different species, not palette swaps of the
// same icon. ---

/** Ruffled petal with an asymmetric, slightly uneven tip — the "messy
 * layered" silhouette peonies are known for, as opposed to a clean
 * pointed or rounded petal. `ruffle` controls how lopsided the tip is. */
function peonyPetalPath(len: number, width: number, ruffle: number): string {
  const w = width / 2;
  return (
    `M 0 0 C ${round(w * 1.1)} ${round(-len * 0.25)} ${round(w * (1 + ruffle))} ${round(-len * 0.6)} ${round(w * 0.3)} ${round(-len)} ` +
    `C ${round(w * 0.1)} ${round(-len * 1.05)} ${round(-w * 0.1)} ${round(-len * 1.05)} ${round(-w * 0.3)} ${round(-len)} ` +
    `C ${round(-w * (1 + ruffle * 0.8))} ${round(-len * 0.6)} ${round(-w * 1.1)} ${round(-len * 0.25)} 0 0 Z`
  );
}

/** Peony: 3 concentric rings of ruffled petals, each ring's petal count,
 * size, rotation offset and per-petal angle/scale jitter drawn fresh from
 * the seed — real layered-bloom fullness with controlled asymmetry rather
 * than a perfectly even radial stamp. */
const peonyFlower: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const outer = rngPick(rng, accents);
  const mid = rngPick(rng, accents);
  const core = rngPick(rng, accents);
  const rings = [
    { count: rngInt(rng, 8, 10), len: r * rngRange(rng, 0.85, 1.0), width: r * 0.55, color: outer, dist: r * 0.15, outerRing: true },
    { count: rngInt(rng, 6, 8), len: r * rngRange(rng, 0.6, 0.75), width: r * 0.42, color: blendHex(mid, 0.9, colors[0]), dist: r * 0.1, outerRing: false },
    { count: rngInt(rng, 5, 6), len: r * rngRange(rng, 0.35, 0.48), width: r * 0.32, color: blendHex(mid, 0.7, outer), dist: r * 0.05, outerRing: false },
  ];
  const outerPetals: ReturnType<typeof h>[] = [];
  const innerPetals: ReturnType<typeof h>[] = [];
  for (const ring of rings) {
    const offset = rngRange(rng, 0, 360 / ring.count);
    for (let i = 0; i < ring.count; i++) {
      const asym = radialAsymmetry(rng, 4, 0.06);
      const angle = (360 / ring.count) * i + offset + asym.angle;
      const ruffle = rngRange(rng, 0.1, 0.35);
      const petal = h('g', { transform: `rotate(${round(angle)}) translate(0 ${round(-ring.dist)})` }, [
        h('path', { d: peonyPetalPath(ring.len * asym.lengthScale, ring.width * asym.widthScale, ruffle), fill: ring.color }),
      ]);
      (ring.outerRing ? outerPetals : innerPetals).push(petal);
    }
  }
  const node = h('g', {}, [
    h('g', { 'data-part': 'petals-outer' }, outerPetals),
    h('g', { 'data-part': 'petals-inner' }, innerPetals),
    h('g', { 'data-part': 'center' }, [h('circle', { cx: 0, cy: 0, r: round(r * 0.1), fill: core })]),
  ]);
  return { node, radius: r * 1.05 };
};

/** Ranunculus: a tight spiral of small cupped petals — 5-7 rings, each
 * ring larger and with more petals than the last, twisted by a random
 * spiral offset per ring — the densely-packed rosette look real
 * ranunculus/garden-rose blooms have, distinct from peony's looser ruffle. */
const ranunculusRosette: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const color = rngPick(rng, accents);
  const core = rngPick(rng, accents);
  const ringCount = rngInt(rng, 5, 7);
  const outerPetals: ReturnType<typeof h>[] = [];
  const innerPetals: ReturnType<typeof h>[] = [];
  for (let ring = 0; ring < ringCount; ring++) {
    const t = ringCount > 1 ? ring / (ringCount - 1) : 0;
    const dist = r * (0.08 + t * 0.7);
    const petalLen = r * (0.15 + t * 0.22);
    const count = rngInt(rng, 5, 7) + ring;
    const spiralOffset = ring * rngRange(rng, 15, 25);
    const tone = blendHex(color, 0.5 + t * 0.5, colors[0]);
    const ringPetals = petalRing(rng, {
      count,
      distance: dist,
      length: petalLen,
      width: petalLen * 0.85,
      color: tone,
      curvature: 0.75,
      angleJitter: 4,
      scaleJitter: 0.06,
      rotationOffset: spiralOffset,
    });
    (t < 0.5 ? outerPetals : innerPetals).push(...ringPetals);
  }
  const node = h('g', {}, [
    h('g', { 'data-part': 'petals-outer' }, outerPetals),
    h('g', { 'data-part': 'petals-inner' }, innerPetals),
    h('g', { 'data-part': 'center' }, [h('circle', { cx: 0, cy: 0, r: round(r * 0.06), fill: core })]),
  ]);
  return { node, radius: r * 0.95 };
};

/** Build 005, Section 4 (Botanical Species Engine): a classic Rose bloom —
 * a tight swirled inner "rolled bud" core (a few tightly-overlapping small
 * petals right at center, distinct from Ranunculus's uniform tight spiral
 * all the way out) surrounded by 2-3 looser, larger ruffled outer rings
 * (distinct from Peony's loose ruffle all the way to the center). Gives
 * the `'rose'` family its own real geometry instead of sharing
 * Ranunculus's shape under a second name. */
const roseFlower: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const color = rngPick(rng, accents);
  const core = blendHex(color, 0.35, colors[0]);
  const innerCount = rngInt(rng, 5, 7);
  const innerPetals = petalRing(rng, {
    count: innerCount,
    distance: r * 0.05,
    length: r * 0.3,
    width: r * 0.26,
    color: blendHex(color, 0.6, colors[0]),
    curvature: 0.85,
    angleJitter: 6,
    scaleJitter: 0.08,
  });
  const outerPetals: ReturnType<typeof h>[] = [];
  const ringCount = rngInt(rng, 2, 3);
  for (let ring = 0; ring < ringCount; ring++) {
    const t = ringCount > 1 ? ring / (ringCount - 1) : 0;
    const dist = r * (0.15 + t * 0.55);
    const len = r * (0.5 + t * 0.35);
    const count = rngInt(rng, 6, 8) + ring * 2;
    const tone = blendHex(color, 0.85 - t * 0.2, colors[0]);
    outerPetals.push(
      ...petalRing(rng, {
        count,
        distance: dist,
        length: len,
        width: len * 0.8,
        color: tone,
        curvature: 0.6,
        angleJitter: 5,
        scaleJitter: 0.07,
        rotationOffset: rngRange(rng, 0, 360 / count),
      }),
    );
  }
  const node = h('g', {}, [
    h('g', { 'data-part': 'petals-outer' }, outerPetals),
    h('g', { 'data-part': 'petals-inner' }, innerPetals),
    h('g', { 'data-part': 'center' }, [h('circle', { cx: 0, cy: 0, r: round(r * 0.04), fill: core })]),
  ]);
  return { node, radius: r * 1.05 };
};

/** Build 005, Section 4: Protea — a tight upright cone of long, stiff,
 * pointed, overlapping bracts (built from the same rigid petal shape as
 * Peony's ruffle with `ruffle=0` for a stiffer, un-ruffled edge) around a
 * fuzzy pincushion center of radiating bristle strokes — the layered-cone-
 * plus-fuzzy-center silhouette that reads as recognizably "protea" rather
 * than a generic large bloom. */
const proteaFlower: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const bractColor = rngPick(rng, accents);
  const centerColor = rngPick(rng, accents);
  const ringCount = rngInt(rng, 3, 4);
  const bracts: ReturnType<typeof h>[] = [];
  for (let ring = 0; ring < ringCount; ring++) {
    const t = ringCount > 1 ? ring / (ringCount - 1) : 0;
    const dist = r * (0.1 + t * 0.35);
    const len = r * (0.55 + t * 0.3);
    const width = len * 0.32;
    const count = rngInt(rng, 7, 9);
    const tone = blendHex(bractColor, 0.75 - t * 0.25, colors[0]);
    const offset = rngRange(rng, 0, 360 / count);
    for (let i = 0; i < count; i++) {
      const angle = (360 / count) * i + offset;
      bracts.push(
        h('g', { transform: `rotate(${round(angle)}) translate(0 ${round(-dist)})` }, [
          h('path', { d: peonyPetalPath(len, width, 0), fill: tone }),
        ]),
      );
    }
  }
  const bristleCount = rngInt(rng, 14, 20);
  const bristles: ReturnType<typeof h>[] = [];
  for (let i = 0; i < bristleCount; i++) {
    const angle = (360 / bristleCount) * i + rngRange(rng, -4, 4);
    const len2 = r * rngRange(rng, 0.12, 0.2);
    const rad = (angle * Math.PI) / 180;
    bristles.push(
      h('line', {
        x1: 0,
        y1: 0,
        x2: round(Math.sin(rad) * len2),
        y2: round(-Math.cos(rad) * len2),
        stroke: centerColor,
        'stroke-width': round(r * 0.02),
        'stroke-linecap': 'round',
      }),
    );
  }
  const node = h('g', {}, [h('g', { 'data-part': 'petals-outer' }, bracts), h('g', { 'data-part': 'center' }, bristles)]);
  return { node, radius: r * 1.1 };
};

/** Papery petal with a soft crinkled edge — a smooth Catmull-Rom curve
 * through seeded-wobbled sample points (previously a straight-line polygon
 * through the same samples, which could read as unintentionally jagged at
 * large export sizes). */
function poppyPetalPath(rng: Rng, len: number, width: number): string {
  const w = width / 2;
  const samples = 6;
  const radii = wobbleEnvelope(rng, samples, 0.12, (t) => Math.sin(Math.PI * t) * w);
  const right: Pt[] = [];
  for (let i = 1; i <= samples; i++) right.push({ x: radii[i], y: -len * (i / samples) });
  const left = right
    .slice(0, -1)
    .reverse()
    .map((p) => ({ x: -p.x, y: p.y }));
  const points: Pt[] = [{ x: 0, y: 0 }, ...right, ...left];
  return smoothPathD(points, { closed: true, tension: 7 });
}

/** Poppy: 4-6 crinkled petals around the iconic dark seed-pod center with
 * radiating star lines (the trait that makes a poppy read as a poppy and
 * not a generic 5-petal flower). */
const poppyFlower: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const petalColor = rngPick(rng, accents);
  const centerColor = rngPick(rng, accents);
  const petals = rngInt(rng, 4, 6);
  const petalNodes: ReturnType<typeof h>[] = [];
  for (let i = 0; i < petals; i++) {
    const angle = (360 / petals) * i + rngRange(rng, -8, 8);
    petalNodes.push(
      h('g', { transform: `rotate(${round(angle)})` }, [
        h('path', { d: poppyPetalPath(rng, r * rngRange(rng, 0.75, 0.95), r * rngRange(rng, 0.65, 0.85)), fill: petalColor }),
      ]),
    );
  }
  const centerNodes: ReturnType<typeof h>[] = [h('circle', { cx: 0, cy: 0, r: round(r * 0.16), fill: blendHex('#000000', 0.55, centerColor) })];
  const rays = rngInt(rng, 8, 10);
  for (let i = 0; i < rays; i++) {
    const a = ((360 / rays) * i * Math.PI) / 180;
    centerNodes.push(
      h('line', { x1: 0, y1: 0, x2: round(Math.cos(a) * r * 0.14), y2: round(Math.sin(a) * r * 0.14), stroke: colors[0], 'stroke-width': round(size * 0.012) }),
    );
  }
  const node = h('g', {}, [
    h('g', { 'data-part': 'petals-outer' }, petalNodes),
    h('g', { 'data-part': 'center' }, centerNodes),
  ]);
  return { node, radius: r * 1.0 };
};

/** Anemone: rounder, smoother petals than poppy (organic curve, no
 * crinkle) around a distinctive fuzzy dark center — a ring of tiny stamen
 * dots at randomized distance/angle around a dark core, the anemone's
 * signature trait. */
const anemoneFlower: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const petalColor = rngPick(rng, accents);
  const centerColor = rngPick(rng, accents);
  const petals = rngInt(rng, 6, 8);
  const petalLen = r * rngRange(rng, 0.7, 0.85);
  // Build 007, Section 5 (Petal Variation Library): an anemone's own soft,
  // slightly irregular petals read correctly as a real mix of rounded and
  // occasionally folded/curled shapes -- not every petal in the ring
  // sharing one identical curvature.
  const petalNodes = petalRing(rng, {
    count: petals,
    distance: 0,
    length: petalLen,
    width: petalLen * 0.64,
    color: petalColor,
    curvature: 0.65,
    angleJitter: 5,
    scaleJitter: 0.07,
    variants: ['rounded', 'rounded', 'folded', 'curled'],
  });
  const centerNodes: ReturnType<typeof h>[] = [h('circle', { cx: 0, cy: 0, r: round(r * 0.14), fill: blendHex('#1a1006', 0.6, centerColor) })];
  const stamens = rngInt(rng, 10, 14);
  for (let i = 0; i < stamens; i++) {
    const a = ((360 / stamens) * i * Math.PI) / 180;
    const dist = r * rngRange(rng, 0.16, 0.2);
    centerNodes.push(h('circle', { cx: round(Math.cos(a) * dist), cy: round(Math.sin(a) * dist), r: round(r * 0.02), fill: colors[0] }));
  }
  const node = h('g', {}, [
    h('g', { 'data-part': 'petals-outer' }, petalNodes),
    h('g', { 'data-part': 'center' }, centerNodes),
  ]);
  return { node, radius: r * 0.95 };
};

/** Daisy: many thin radiating organic-curve petals around a flat stippled
 * disc center — the stipple (randomly scattered tiny dots, not a uniform
 * ring) is the texture real daisy/sunflower centers have. */
const daisyFlower: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const petalColor = rngPick(rng, accents);
  const centerColor = rngPick(rng, accents);
  const petals = rngInt(rng, 12, 16);
  const petalLen = r * 0.9;
  // Build 007, Section 5: a real daisy ring is mostly uniform pointed
  // petals with the occasional weathered/immature one mixed in -- a
  // genuine field daisy is never perfectly identical petal-for-petal.
  const petalNodes = petalRing(rng, {
    count: petals,
    distance: r * 0.12,
    length: petalLen,
    width: petalLen * 0.22,
    color: petalColor,
    curvature: 0.2,
    angleJitter: 3,
    scaleJitter: 0.05,
    variants: ['pointed', 'pointed', 'pointed', 'damaged', 'immature'],
  });
  const centerNodes: ReturnType<typeof h>[] = [h('circle', { cx: 0, cy: 0, r: round(r * 0.22), fill: centerColor })];
  const dots = rngInt(rng, 10, 14);
  for (let i = 0; i < dots; i++) {
    const a = rngRange(rng, 0, Math.PI * 2);
    const dist = rngRange(rng, 0, r * 0.18);
    centerNodes.push(h('circle', { cx: round(Math.cos(a) * dist), cy: round(Math.sin(a) * dist), r: round(r * 0.02), fill: blendHex(colors[0], 0.4, centerColor) }));
  }
  const node = h('g', {}, [
    h('g', { 'data-part': 'petals-outer' }, petalNodes),
    h('g', { 'data-part': 'center' }, centerNodes),
  ]);
  return { node, radius: r * 1.02 };
};

/** Petal with a small V-notch cut into the tip — cosmos's signature trait
 * that distinguishes it from every other simple radial-petal flower here. */
function cosmosPetalPath(len: number, width: number, notch: number): string {
  const w = width / 2;
  return (
    `M 0 0 C ${round(w)} ${round(-len * 0.4)} ${round(w * 0.9)} ${round(-len * 0.85)} ${round(w * 0.25)} ${round(-len)} ` +
    `L ${round(notch)} ${round(-len * 0.9)} L ${round(-notch)} ${round(-len * 0.9)} ` +
    `L ${round(-w * 0.25)} ${round(-len)} C ${round(-w * 0.9)} ${round(-len * 0.85)} ${round(-w)} ${round(-len * 0.4)} 0 0 Z`
  );
}

const cosmosFlower: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const petalColor = rngPick(rng, accents);
  const centerColor = rngPick(rng, accents);
  const petals = 8;
  const petalLen = r * rngRange(rng, 0.75, 0.9);
  const petalW = petalLen * 0.55;
  const notch = petalW * 0.1;
  const petalNodes: ReturnType<typeof h>[] = [];
  for (let i = 0; i < petals; i++) {
    const asym = radialAsymmetry(rng, 4, 0.05);
    petalNodes.push(
      h('g', { transform: `rotate(${round((360 / petals) * i + asym.angle)})` }, [
        h('path', { d: cosmosPetalPath(petalLen * asym.lengthScale, petalW * asym.widthScale, notch), fill: petalColor }),
      ]),
    );
  }
  const node = h('g', {}, [
    h('g', { 'data-part': 'petals-outer' }, petalNodes),
    h('g', { 'data-part': 'center' }, [h('circle', { cx: 0, cy: 0, r: round(r * 0.13), fill: centerColor })]),
  ]);
  return { node, radius: r * 1.0 };
};

/** Bell flower: a raceme of small drooping bell-shaped blooms alternating
 * along a growth-engine stem — the tubular hanging silhouette (foxglove /
 * campanula style) that's structurally distinct from every radial-petal
 * flower above. */
function bellPath(len: number, width: number): string {
  const w = width / 2;
  return (
    `M ${round(-w)} 0 ` +
    `C ${round(-w)} ${round(len * 0.55)} ${round(-w * 0.6)} ${round(len)} 0 ${round(len)} ` +
    `C ${round(w * 0.6)} ${round(len)} ${round(w)} ${round(len * 0.55)} ${round(w)} 0 ` +
    `C ${round(w * 0.5)} ${round(-len * 0.12)} ${round(-w * 0.5)} ${round(-len * 0.12)} ${round(-w)} 0 Z`
  );
}

const bellFlower: Variant = (rng, colors, size) => {
  const r = size / 2;
  const stem = generateStem(rng, size * 0.9, rngRange(rng, 0.05, 0.12));
  const stemColor = rngPick(rng, accentColors(colors));
  const bellColor = rngPick(rng, accentColors(colors));
  const count = rngInt(rng, 3, 5);
  const offset = size * 0.12;
  const bells: ReturnType<typeof h>[] = [];
  const pedicels: ReturnType<typeof h>[] = [];
  for (let i = 0; i < count; i++) {
    const t = 0.18 + 0.72 * (count > 1 ? i / (count - 1) : 0.5);
    const sample = stem.sampler.at(t);
    const side: 1 | -1 = i % 2 === 0 ? 1 : -1;
    const scale = 1 - t * 0.3;
    const bellLen = size * 0.17 * scale;
    const bellW = bellLen * 0.6;
    const asym = radialAsymmetry(rng, 8, 0.1);
    // Offset each bell off the stem along its local normal (not a fixed
    // x-shift) so it hangs clearly beside the stem — and stays correctly
    // offset even where the stem curves — instead of sitting on top of it.
    const anchorX = sample.point.x + sample.normal.x * side * offset;
    const anchorY = sample.point.y + sample.normal.y * side * offset;
    pedicels.push(
      h('path', {
        d: `M ${round(sample.point.x)} ${round(sample.point.y)} L ${round(anchorX)} ${round(anchorY)}`,
        fill: 'none',
        stroke: stemColor,
        'stroke-width': round(size * 0.012),
        'stroke-linecap': 'round',
      }),
    );
    bells.push(
      h('g', { transform: `translate(${round(anchorX)} ${round(anchorY)}) rotate(${round(14 * side + asym.angle)})` }, [
        h('path', { d: bellPath(bellLen * asym.lengthScale, bellW * asym.widthScale), fill: bellColor }),
      ]),
    );
  }
  const node = h('g', {}, [
    h('g', { 'data-part': 'stem' }, [
      h('path', { d: stem.path, fill: 'none', stroke: stemColor, 'stroke-width': round(size * 0.025), 'stroke-linecap': 'round' }),
      ...pedicels,
    ]),
    h('g', { 'data-part': 'petals-outer' }, bells),
  ]);
  return { node, radius: r * 1.1 };
};

/** Rounded (near-circular) leaf — eucalyptus's distinctive juvenile-leaf
 * silhouette, much rounder than the ovate/serrated shapes above. */
function roundedLeafPath(length: number, width: number): string {
  const h2 = length / 2;
  const w = width / 2;
  return `M 0 ${round(-h2)} C ${round(w * 1.05)} ${round(-h2 * 0.5)} ${round(w * 1.05)} ${round(h2 * 0.5)} 0 ${round(h2)} C ${round(-w * 1.05)} ${round(h2 * 0.5)} ${round(-w * 1.05)} ${round(-h2 * 0.5)} 0 ${round(-h2)} Z`;
}

const eucalyptusSprig: Variant = (rng, colors, size) => {
  const preset = GROWTH_PRESETS.eucalyptus;
  const stem = generateStem(rng, size, preset.curvature);
  const stemColor = rngPick(rng, accentColors(colors));
  const leaves = growLeaves(rng, stem, preset);
  const leafNodes = leaves.map((leaf) => {
    const leafLen = size * rngRange(rng, 0.3, 0.4) * leaf.scale;
    return h('g', { transform: `translate(${round(leaf.point.x)} ${round(leaf.point.y)}) rotate(${round(leaf.angle)})` }, [
      h('path', { d: roundedLeafPath(leafLen, leafLen * 0.62), fill: rngPick(rng, accentColors(colors)) }),
    ]);
  });
  const node = h('g', {}, [
    h('g', { 'data-part': 'stem' }, [
      h('path', { d: stem.path, fill: 'none', stroke: stemColor, 'stroke-width': round(size * 0.035), 'stroke-linecap': 'round' }),
    ]),
    h('g', { 'data-part': 'leaves' }, leafNodes),
  ]);
  return { node, radius: size * 0.6 };
};

/** Long narrow lance-shaped leaf — olive's characteristic silhouette,
 * much narrower than eucalyptus's rounded leaf or the ovate/heart shapes. */
function lanceLeafPath(length: number, width: number): string {
  const h2 = length / 2;
  const w = width / 2;
  return (
    `M 0 ${round(-h2)} C ${round(w * 0.7)} ${round(-h2 * 0.6)} ${round(w)} 0 ${round(w * 0.15)} ${round(h2 * 0.9)} L 0 ${round(h2)} ` +
    `L ${round(-w * 0.15)} ${round(h2 * 0.9)} C ${round(-w)} 0 ${round(-w * 0.7)} ${round(-h2 * 0.6)} 0 ${round(-h2)} Z`
  );
}

const oliveBranch: Variant = (rng, colors, size) => {
  const preset = GROWTH_PRESETS.olive;
  const stem = generateStem(rng, size, preset.curvature);
  const stemColor = rngPick(rng, accentColors(colors));
  const leaves = growLeaves(rng, stem, preset);
  const leafNodes = leaves.map((leaf) => {
    const leafLen = size * rngRange(rng, 0.28, 0.38) * leaf.scale;
    return h('g', { transform: `translate(${round(leaf.point.x)} ${round(leaf.point.y)}) rotate(${round(leaf.angle)})` }, [
      h('path', { d: lanceLeafPath(leafLen, leafLen * 0.28), fill: rngPick(rng, accentColors(colors)) }),
    ]);
  });
  const node = h('g', {}, [
    h('g', { 'data-part': 'stem' }, [
      h('path', { d: stem.path, fill: 'none', stroke: stemColor, 'stroke-width': round(size * 0.03), 'stroke-linecap': 'round' }),
    ]),
    h('g', { 'data-part': 'leaves' }, leafNodes),
  ]);
  return { node, radius: size * 0.6 };
};

/** Elongated oval, pointed at both ends — laurel's silhouette, always
 * paired opposite each other along the stem (the classic wreath-sprig
 * arrangement), between eucalyptus's round leaf and olive's narrow lance. */
function laurelLeafPath(length: number, width: number): string {
  const h2 = length / 2;
  const w = width / 2;
  return `M 0 ${round(-h2)} C ${round(w)} ${round(-h2 * 0.4)} ${round(w)} ${round(h2 * 0.4)} 0 ${round(h2)} C ${round(-w)} ${round(h2 * 0.4)} ${round(-w)} ${round(-h2 * 0.4)} 0 ${round(-h2)} Z`;
}

const laurelSprig: Variant = (rng, colors, size) => {
  const preset = GROWTH_PRESETS.laurel;
  const stem = generateStem(rng, size, preset.curvature);
  const stemColor = rngPick(rng, accentColors(colors));
  const leaves = growLeaves(rng, stem, preset);
  const leafNodes: ReturnType<typeof h>[] = [];
  for (let i = 0; i < leaves.length; i += 2) {
    const color = rngPick(rng, accentColors(colors));
    for (const leaf of leaves.slice(i, i + 2)) {
      const leafLen = size * rngRange(rng, 0.3, 0.4) * leaf.scale;
      leafNodes.push(
        h('g', { transform: `translate(${round(leaf.point.x)} ${round(leaf.point.y)}) rotate(${round(leaf.angle)})` }, [
          h('path', { d: laurelLeafPath(leafLen, leafLen * 0.36), fill: color }),
        ]),
      );
    }
  }
  const node = h('g', {}, [
    h('g', { 'data-part': 'stem' }, [
      h('path', { d: stem.path, fill: 'none', stroke: stemColor, 'stroke-width': round(size * 0.03), 'stroke-linecap': 'round' }),
    ]),
    h('g', { 'data-part': 'leaves' }, leafNodes),
  ]);
  return { node, radius: size * 0.58 };
};

/** Rounded leaf with a gently wobbled edge, built as a smooth Catmull-Rom
 * curve through seeded-wobbled sample points (previously straight-line
 * segments) — sage's velvety-textured look without unintended sharp
 * corners. */
function sageLeafPath(length: number, width: number, rng: Rng): string {
  const h2 = length / 2;
  const w = width / 2;
  const samples = 6;
  const radii = wobbleEnvelope(rng, samples, 0.08, (t) => Math.sin(Math.PI * t) * w);
  const right: Pt[] = [];
  for (let i = 0; i <= samples; i++) right.push({ x: radii[i], y: -h2 + length * (i / samples) });
  const left = right
    .slice(1, -1)
    .reverse()
    .map((p) => ({ x: -p.x, y: p.y }));
  const points: Pt[] = [...right, ...left];
  return smoothPathD(points, { closed: true, tension: 6 });
}

const sageSprig: Variant = (rng, colors, size) => {
  const preset = GROWTH_PRESETS.sage;
  const stem = generateStem(rng, size, preset.curvature);
  const stemColor = rngPick(rng, accentColors(colors));
  const leaves = growLeaves(rng, stem, preset);
  const leafNodes = leaves.map((leaf) => {
    const leafLen = size * rngRange(rng, 0.32, 0.42) * leaf.scale;
    return h('g', { transform: `translate(${round(leaf.point.x)} ${round(leaf.point.y)}) rotate(${round(leaf.angle)})` }, [
      h('path', { d: sageLeafPath(leafLen, leafLen * 0.46, rng), fill: rngPick(rng, accentColors(colors)) }),
    ]);
  });
  const node = h('g', {}, [
    h('g', { 'data-part': 'stem' }, [
      h('path', { d: stem.path, fill: 'none', stroke: stemColor, 'stroke-width': round(size * 0.035), 'stroke-linecap': 'round' }),
    ]),
    h('g', { 'data-part': 'leaves' }, leafNodes),
  ]);
  return { node, radius: size * 0.6 };
};

/** Magnolia: a small number of large, thick waxy tepals (fewer and bigger
 * than peony's many ruffled petals, rounder than anemone's) around a
 * distinctive columnar/conical center built as a stack of shrinking
 * ellipses rather than a flat disc — the trait that most separates a real
 * magnolia silhouette from every other large bloom in this file. */
const magnoliaFlower: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const tepalColor = rngPick(rng, accents);
  const coreColor = rngPick(rng, accents);
  const outerCount = rngInt(rng, 6, 8);
  const hasInnerLayer = rngBool(rng);
  const innerCount = hasInnerLayer ? rngInt(rng, 3, 4) : 0;
  const outerTepals: ReturnType<typeof h>[] = [];
  for (let i = 0; i < outerCount; i++) {
    const asym = radialAsymmetry(rng, 3, 0.05);
    const angle = (360 / outerCount) * i + asym.angle;
    const len = r * rngRange(rng, 0.82, 0.98) * asym.lengthScale;
    const width = len * rngRange(rng, 0.42, 0.52) * asym.widthScale;
    outerTepals.push(
      h('g', { transform: `rotate(${round(angle)})` }, [h('path', { d: organicPetalPath(len, width, 0.8), fill: tepalColor })]),
    );
  }
  const innerTepals: ReturnType<typeof h>[] = [];
  for (let i = 0; i < innerCount; i++) {
    const angle = (360 / innerCount) * i + 360 / (innerCount * 2);
    const len = r * rngRange(rng, 0.48, 0.58);
    innerTepals.push(
      h('g', { transform: `rotate(${round(angle)})` }, [
        h('path', { d: organicPetalPath(len, len * 0.48, 0.7), fill: blendHex(tepalColor, 0.85, colors[0]) }),
      ]),
    );
  }
  const coneSegments = 4;
  const coneNodes: ReturnType<typeof h>[] = [];
  for (let i = 0; i < coneSegments; i++) {
    const t = i / (coneSegments - 1);
    coneNodes.push(
      h('ellipse', {
        cx: 0,
        cy: round(-r * 0.05 - t * r * 0.14),
        rx: round(r * 0.12 * (1 - t * 0.55)),
        ry: round(r * 0.07 * (1 - t * 0.4)),
        fill: blendHex(coreColor, 0.25 + t * 0.35, '#2c2013'),
      }),
    );
  }
  const node = h('g', {}, [
    h('g', { 'data-part': 'petals-outer' }, outerTepals),
    ...(innerTepals.length ? [h('g', { 'data-part': 'petals-inner' }, innerTepals)] : []),
    h('g', { 'data-part': 'center' }, coneNodes),
  ]);
  return { node, radius: r * 1.08 };
};

/** One tiny 4-petal floret — hydrangea's real bloom unit. A hydrangea head
 * is dozens of these packed into one dome, structurally distinct from
 * every other flower here (which is one bloom with many petals, not many
 * tiny blooms forming one head). */
function hydrangeaFloret(rng: Rng, color: string, floretSize: number): ReturnType<typeof h> {
  const petals: ReturnType<typeof h>[] = [];
  const count = 4;
  for (let i = 0; i < count; i++) {
    const angle = (360 / count) * i + rngRange(rng, -6, 6);
    petals.push(
      h('g', { transform: `rotate(${round(angle)})` }, [
        h('path', { d: organicPetalPath(floretSize * 0.5, floretSize * 0.42, 0.85), fill: color }),
      ]),
    );
  }
  return h('g', {}, petals);
}

/** Hydrangea: 16-24 tiny florets packed into a dome via golden-angle
 * (sunflower-seed) spiral placement — fills evenly at any floret count
 * without a visible grid, unlike a plain concentric-ring layout. */
const hydrangeaBloom: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const floretCount = rngInt(rng, 16, 24);
  const goldenAngleDeg = 137.5077;
  const florets: ReturnType<typeof h>[] = [];
  for (let i = 0; i < floretCount; i++) {
    const t = i / floretCount;
    const dist = r * 0.86 * Math.sqrt(t);
    const rad = (i * goldenAngleDeg * Math.PI) / 180;
    const floretSize = size * rngRange(rng, 0.22, 0.3) * (0.65 + 0.35 * (1 - t));
    const color = rngPick(rng, accents);
    florets.push(
      h(
        'g',
        { transform: `translate(${round(Math.cos(rad) * dist)} ${round(Math.sin(rad) * dist)}) rotate(${round(rngRange(rng, 0, 90))})` },
        [hydrangeaFloret(rng, color, floretSize)],
      ),
    );
  }
  const node = h('g', {}, [h('g', { 'data-part': 'petals-outer' }, florets)]);
  return { node, radius: r * 1.02 };
};

/** Lavender: many tiny tubular florets densely alternating up the top ~60%
 * of a near-straight upright spike — structurally distinct from
 * bellFlower's sparse raceme of larger drooping bells (lavender florets
 * are small, upright and tightly packed, not few and hanging). */
const lavenderSpike: Variant = (rng, colors, size) => {
  const stem = generateStem(rng, size * 0.92, rngRange(rng, 0.02, 0.06));
  const stemColor = rngPick(rng, accentColors(colors));
  const floretColor = rngPick(rng, accentColors(colors));
  const floretCount = rngInt(rng, 18, 26);
  const florets: ReturnType<typeof h>[] = [];
  const spikeStart = 0.4;
  for (let i = 0; i < floretCount; i++) {
    const t = spikeStart + (1 - spikeStart) * (i / Math.max(1, floretCount - 1));
    const sample = stem.sampler.at(Math.min(t, 0.99));
    const side: 1 | -1 = i % 2 === 0 ? 1 : -1;
    const reach = size * rngRange(rng, 0.03, 0.075) * (1 - t * 0.3);
    const ox = sample.point.x + sample.normal.x * side * reach;
    const oy = sample.point.y + sample.normal.y * side * reach;
    const floretLen = size * 0.06 * (1 - t * 0.2);
    florets.push(
      h('ellipse', {
        cx: round(ox),
        cy: round(oy),
        rx: round(floretLen * 0.4),
        ry: round(floretLen),
        fill: floretColor,
        transform: `rotate(${round(tangentToUpAngleDeg(sample.tangent))} ${round(ox)} ${round(oy)})`,
      }),
    );
  }
  const node = h('g', {}, [
    h('g', { 'data-part': 'stem' }, [
      h('path', { d: stem.path, fill: 'none', stroke: stemColor, 'stroke-width': round(size * 0.025), 'stroke-linecap': 'round' }),
    ]),
    h('g', { 'data-part': 'petals-outer' }, florets),
  ]);
  return { node, radius: size * 0.55 };
};

/** A small tight cluster of round berries at one point along a stem. */
// Build 007, Section 6 (Luxury Detailing): a real berry "cap" -- a small
// bright highlight dot offset toward one corner of each berry, the flat
// specular read every glossy real berry (holly, rosehip) has and a flat
// solid circle doesn't. Cheap by design (one extra circle per berry, same
// node-budget discipline `calyxBase`/`flowerCenterDetail` already
// established) -- adds real dimensional detail without adding clutter
// (it's a single small dot, not a second shape).
function berryCluster(rng: Rng, color: string, r: number): ReturnType<typeof h>[] {
  const count = rngInt(rng, 3, 5);
  const berries: ReturnType<typeof h>[] = [];
  const highlightColor = blendHex('#ffffff', 0.55, color);
  for (let i = 0; i < count; i++) {
    const angle = rngRange(rng, 0, Math.PI * 2);
    const dist = rngRange(rng, 0, r * 0.55);
    const berryR = r * rngRange(rng, 0.85, 1);
    const cx = Math.cos(angle) * dist;
    const cy = Math.sin(angle) * dist * 0.85;
    berries.push(h('circle', { cx: round(cx), cy: round(cy), r: round(berryR), fill: color }));
    berries.push(
      h('circle', {
        cx: round(cx - berryR * 0.32),
        cy: round(cy - berryR * 0.32),
        r: round(berryR * 0.24),
        fill: highlightColor,
      }),
    );
  }
  return berries;
}

/** Berry Branch: a laurel-style paired-leaf stem plus 2-3 berry clusters
 * near its tip — fruit-bearing, structurally distinct from every
 * flower/leaf-only variant above (reuses laurel's leaf silhouette/
 * arrangement, since real berry branches are usually plain-leaved). */
const berryBranch: Variant = (rng, colors, size) => {
  const preset = GROWTH_PRESETS.laurel;
  const stem = generateStem(rng, size, preset.curvature);
  const stemColor = rngPick(rng, accentColors(colors));
  const berryColor = rngPick(rng, accentColors(colors));
  const leafColor = rngPick(rng, accentColors(colors));
  const leaves = growLeaves(rng, stem, { ...preset, leafCount: [4, 6] });
  const leafNodes = leaves.map((leaf) => {
    const leafLen = size * rngRange(rng, 0.24, 0.32) * leaf.scale;
    return h('g', { transform: `translate(${round(leaf.point.x)} ${round(leaf.point.y)}) rotate(${round(leaf.angle)})` }, [
      h('path', { d: laurelLeafPath(leafLen, leafLen * 0.4), fill: leafColor }),
    ]);
  });
  const clusterCount = rngInt(rng, 2, 3);
  const berryRadius = size * rngRange(rng, 0.045, 0.06);
  const berryNodes: ReturnType<typeof h>[] = [];
  for (let i = 0; i < clusterCount; i++) {
    const t = 0.55 + 0.4 * (clusterCount > 1 ? i / (clusterCount - 1) : 0.5);
    const sample = stem.sampler.at(Math.min(t, 0.98));
    berryNodes.push(
      h('g', { transform: `translate(${round(sample.point.x)} ${round(sample.point.y)})` }, berryCluster(rng, berryColor, berryRadius)),
    );
  }
  const node = h('g', {}, [
    h('g', { 'data-part': 'stem' }, [
      h('path', { d: stem.path, fill: 'none', stroke: stemColor, 'stroke-width': round(size * 0.035), 'stroke-linecap': 'round' }),
    ]),
    h('g', { 'data-part': 'leaves' }, leafNodes),
    h('g', { 'data-part': 'berries' }, berryNodes),
  ]);
  return { node, radius: size * 0.6 };
};

interface TaggedVariant {
  variant: Variant;
  /** Which of the 18 named `BotanicalFamily` values this shape belongs to.
   * Left `undefined` for shapes that read fine alongside any species — a
   * plain leaf or generic 5-petal bloom, the way a real arrangement mixes
   * a featured flower with neutral filler greenery — so a family filter
   * (see `poolForFamily`) never over-narrows to an empty/awkward pool. */
  family?: BotanicalFamily;
  /** Which of the 5 real `PartShapeCategory` values this shape represents
   * (Build 004, Section 3) — every variant gets exactly one, unlike
   * `family` which several deliberately leave unset. */
  category: PartShapeCategory;
}

const TAGGED_VARIANTS: TaggedVariant[] = [
  { variant: singleLeaf, category: 'leaf' },
  { variant: flowerBloom, category: 'flower' },
  { variant: flowerBud, category: 'bud' },
  { variant: leafyBranch, category: 'branch' },
  { variant: fernFrond, family: 'fern', category: 'branch' },
  { variant: simpleTulip, family: 'tulip', category: 'flower' },
  { variant: layeredBloom, category: 'flower' },
  { variant: wildflowerSprig, family: 'wildflower', category: 'branch' },
  { variant: mapleLeaf, category: 'leaf' },
  { variant: heartLeaf, category: 'leaf' },
  { variant: peonyFlower, family: 'peony', category: 'flower' },
  { variant: roseFlower, family: 'rose', category: 'flower' },
  { variant: ranunculusRosette, family: 'ranunculus', category: 'flower' },
  { variant: proteaFlower, family: 'protea', category: 'flower' },
  { variant: palmFrond, family: 'tropicalLeaf', category: 'branch' },
  { variant: monsteraLeaf, family: 'tropicalLeaf', category: 'leaf' },
  { variant: poppyFlower, family: 'wildflower', category: 'flower' },
  { variant: anemoneFlower, family: 'anemone', category: 'flower' },
  { variant: daisyFlower, family: 'daisy', category: 'flower' },
  { variant: cosmosFlower, family: 'cosmos', category: 'flower' },
  { variant: eucalyptusSprig, family: 'eucalyptus', category: 'branch' },
  { variant: oliveBranch, family: 'olive', category: 'branch' },
  { variant: laurelSprig, family: 'herb', category: 'branch' },
  { variant: sageSprig, family: 'herb', category: 'branch' },
  { variant: bellFlower, family: 'wildflower', category: 'flower' },
  { variant: magnoliaFlower, family: 'magnolia', category: 'flower' },
  { variant: hydrangeaBloom, family: 'hydrangea', category: 'flower' },
  { variant: lavenderSpike, family: 'lavender', category: 'flower' },
  { variant: berryBranch, family: 'berryBranch', category: 'berry' },
];

const VARIANTS: Variant[] = TAGGED_VARIANTS.map((t) => t.variant);

/** Exposed for tests/tooling that need to exercise every named variant
 * directly (e.g. "does every variant render without error") rather than
 * relying on random seeds happening to hit all of them. */
export const BOTANICAL_VARIANTS = VARIANTS;

/** Built once so `createMotif` can look up which `PartShapeCategory` the
 * variant `rngPick` just landed on without changing `poolForFamily`/
 * `poolForHints`'s own return type (both stay `Variant[]`, exactly as
 * `botanical.test.ts`/`botanicalFamilies.test.ts` already pin them). */
const CATEGORY_BY_VARIANT: Map<Variant, PartShapeCategory> = new Map(TAGGED_VARIANTS.map((t) => [t.variant, t.category]));

// Build 019 ("Visual Commercial Upgrade"), Priority 2 (Organic Botanical
// Flow) / Priority 4 (Premium Botanical Relationships) — measured
// evidence (docs/build_reports/BUILD_019_VISUAL_AUDIT_before.json) found
// Botanical Realism the single weakest scored dimension across a 96-
// pattern sample spanning every botanical Style DNA preset, 4 seeds and
// 3 density bands (mean 40.79/100, still the weakest after Build 018's
// partial `flowerBloom` fix). Root cause: 14 of the generator's 15
// standalone "flower head" variants (peony/rose/ranunculus/protea/poppy/
// anemone/daisy/cosmos/bell/magnolia/hydrangea/lavender/tulip/
// layeredBloom) draw no stem/leaf structure at all -- unlike the growth-
// engine branch variants (fern/eucalyptus/olive/laurel/sage/leafyBranch/
// wildflowerSprig), which always do, and `flowerBud`, which always does.
// Rather than hand-editing 14 near-duplicate stem blocks into every
// flower variant (the exact kind of business-logic duplication this
// build is told to avoid), this attaches the SAME stem idiom
// `flowerBud`/`flowerBloom` (Build 018) already established -- a
// `<line>` wrapped in `data-part="stem"`, occasionally paired with a
// `data-part="leaves"` accent using the same shared `leafNode` helper --
// once, at the single `createMotif` call site every variant already
// passes through, keyed off the real `category` tag every variant
// already carries. Never applied to `flowerBloom` itself (its own
// internal, already-shipped stem logic) or to any non-'flower' category
// (branch/bud/berry variants already carry their own; a lone 'leaf'
// motif is not a whole flower and shouldn't grow one). Extends the
// motif's own bounding `radius` by the added stem length so downstream
// spacing/placement accounts for the real extra geometry, the same
// convention `flowerBloom`'s own `hasStem` branch already uses.
function attachOptionalStem(rng: Rng, colors: string[], node: ReturnType<typeof h>, radius: number, size: number): Motif {
  if (!rngBool(rng, 0.55)) return { node, radius };
  const stemColor = rngPick(rng, accentColors(colors));
  const stemLength = size * 0.32;
  const stemBaseY = round(radius * 0.8);
  const stem = h('g', { 'data-part': 'stem' }, [
    h('line', {
      x1: 0,
      y1: stemBaseY,
      x2: 0,
      y2: round(radius * 0.8 + stemLength),
      stroke: stemColor,
      'stroke-width': round(size * 0.045),
      'stroke-linecap': 'round',
    }),
  ]);
  const leaves = rngBool(rng, 0.45)
    ? [
        h(
          'g',
          {
            'data-part': 'leaves',
            transform: `translate(0 ${round(radius * 0.8 + stemLength * 0.55)}) rotate(${round((rngBool(rng) ? 1 : -1) * rngRange(rng, 30, 50))})`,
          },
          [leafNode(rng, colors, size * 0.3, size * 0.14)],
        ),
      ]
    : [];
  return { node: h('g', {}, [node, stem, ...leaves]), radius: radius + stemLength };
}

/** Every variant tagged with `family`, plus the untagged universal-foliage
 * variants (see `TaggedVariant.family`'s doc comment) — never the full
 * unfiltered pool, so a family hint genuinely narrows what gets drawn
 * instead of being purely cosmetic. Falls back to the full pool only if a
 * family somehow has zero tagged variants (defensive; doesn't happen for
 * any of the 18 real families today). */
function poolForFamily(family: BotanicalFamily): Variant[] {
  const matches = TAGGED_VARIANTS.filter((t) => t.family === family || t.family === undefined);
  return matches.length > 0 ? matches.map((t) => t.variant) : VARIANTS;
}

/** Build 004, Section 3: narrows by family (as `poolForFamily` does) and
 * then, if `hints.part` maps to a real `PartShapeCategory` (see
 * `shapeCategoryForPart`), narrows further to variants tagged with that
 * category — a `part` hint of `'stem'`/`'connector'`/`'silhouette'` has no
 * dedicated shape category yet, so it's a documented no-op rather than an
 * error (see `shapeCategoryForPart`'s own doc comment). Falls back to the
 * full pool if the combined filter would otherwise be empty. */
function poolForHints(hints?: MotifCreateHints): Variant[] {
  const family = hints?.family as BotanicalFamily | undefined;
  const part = hints?.part as BotanicalPart | undefined;
  const category = part && (BOTANICAL_PARTS as string[]).includes(part) ? shapeCategoryForPart(part) : undefined;
  let matches = TAGGED_VARIANTS;
  if (family && (BOTANICAL_FAMILIES as string[]).includes(family)) {
    matches = matches.filter((t) => t.family === family || t.family === undefined);
  }
  if (category) {
    matches = matches.filter((t) => t.category === category);
  }
  return matches.length > 0 ? matches.map((t) => t.variant) : VARIANTS;
}

/** Exposed for tests: lets a test assert precisely which variants a family
 * hint does/doesn't include, rather than inferring it indirectly from
 * serialized SVG output. `attachOptionalStem`/`CATEGORY_BY_VARIANT`/
 * `flowerBloom`/`proteaFlower` (Build 019) let a test exercise the stem
 * wrapper directly and confirm which variant it is/isn't applied to,
 * rather than trying to infer variant identity from serialized SVG. */
export const __testables = { poolForFamily, poolForHints, TAGGED_VARIANTS, attachOptionalStem, CATEGORY_BY_VARIANT, flowerBloom, proteaFlower };

export const botanicalGenerator: PatternGenerator = {
  id: 'botanical',
  label: 'Botanical / Floral',
  description:
    "Flat minimal leaves, blooms, buds and leafy branches — 29 variants across 19 named botanical species (rose, peony, tulip, anemone, magnolia, hydrangea, cosmos, wildflower, daisy, lavender, eucalyptus, olive, fern, berry branch, herb, ranunculus, protea, tropical leaf, baby's breath), built on a shared curve-quality and botanical-growth engine.",
  defaultMotifSize: 70,
  createMotif(rng: Rng, colors: string[], size: number, _colorSeed?: number, hints?: MotifCreateHints): Motif {
    const pool = poolForHints(hints);
    const variant = rngPick(rng, pool);
    const { node, radius } = variant(rng, colors, size);
    // Build 019: see `attachOptionalStem`'s own doc comment above.
    if (CATEGORY_BY_VARIANT.get(variant) === 'flower' && variant !== flowerBloom) {
      return attachOptionalStem(rng, colors, node, radius, size);
    }
    return { node, radius };
  },
};
