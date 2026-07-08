import type { Motif, PatternGenerator, Rng } from '../engine/types';
import { h, round } from '../engine/svgAst';
import { accentColors } from '../palettes/palettes';
import { rngPick, rngInt, rngRange, rngBool } from '../engine/rng';

// Retro 70s / Groovy generator: rainbow arches, round-petal daisies,
// suns, mushrooms and wavy bars — the seventies revival look that sells
// steadily on stock sites. Flat fills only.

type Variant = (rng: Rng, colors: string[], size: number) => { node: ReturnType<typeof h>; radius: number };

const rainbowArch: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const bands = Math.min(rngInt(rng, 3, 4), accents.length);
  const bandW = (r * 0.75) / bands;
  const children = [];
  for (let i = 0; i < bands; i++) {
    const bandR = r * 0.9 - i * bandW;
    children.push(
      h('path', {
        d: `M ${round(-bandR)} ${round(r * 0.35)} A ${round(bandR)} ${round(bandR)} 0 0 1 ${round(bandR)} ${round(r * 0.35)}`,
        fill: 'none',
        stroke: accents[i % accents.length],
        'stroke-width': round(bandW * 0.82),
      }),
    );
  }
  return { node: h('g', {}, children), radius: r * 1.0 };
};

const grooveDaisy: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const petalColor = rngPick(rng, accents);
  const centerColor = rngPick(rng, accents);
  const petals = rngInt(rng, 6, 8);
  const children = [];
  for (let i = 0; i < petals; i++) {
    children.push(
      h('g', { transform: `rotate(${round((360 / petals) * i)})` }, [
        h('circle', { cx: 0, cy: round(-r * 0.52), r: round(r * 0.34), fill: petalColor }),
      ]),
    );
  }
  children.push(h('circle', { cx: 0, cy: 0, r: round(r * 0.34), fill: centerColor }));
  return { node: h('g', {}, children), radius: r * 0.95 };
};

const retroSun: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const sun = rngPick(rng, accents);
  const rays = rngInt(rng, 12, 16);
  const children = [];
  for (let i = 0; i < rays; i++) {
    children.push(
      h('g', { transform: `rotate(${round((360 / rays) * i)})` }, [
        h('polygon', {
          points: `0,${round(-r * 0.55)} ${round(r * 0.05)},${round(-r * 0.92)} ${round(-r * 0.05)},${round(-r * 0.92)}`,
          fill: sun,
        }),
      ]),
    );
  }
  children.push(h('circle', { cx: 0, cy: 0, r: round(r * 0.45), fill: sun }));
  if (rngBool(rng)) {
    children.push(h('circle', { cx: 0, cy: 0, r: round(r * 0.28), fill: 'none', stroke: colors[0], 'stroke-width': round(size * 0.03) }));
  }
  return { node: h('g', {}, children), radius: r * 0.97 };
};

const grooveMushroom: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const cap = rngPick(rng, accents);
  const stemChoices = accents.filter((c) => c !== cap);
  const stem = stemChoices.length ? rngPick(rng, stemChoices) : accents[0];
  const children = [
    h('path', {
      d: `M ${round(-r * 0.8)} ${round(-r * 0.05)} A ${round(r * 0.8)} ${round(r * 0.8)} 0 0 1 ${round(r * 0.8)} ${round(-r * 0.05)} Z`,
      fill: cap,
    }),
    h('path', {
      d: `M ${round(-r * 0.22)} ${round(-r * 0.05)} L ${round(-r * 0.16)} ${round(r * 0.75)} Q 0 ${round(r * 0.9)} ${round(r * 0.16)} ${round(r * 0.75)} L ${round(r * 0.22)} ${round(-r * 0.05)} Z`,
      fill: stem,
    }),
  ];
  const dots = rngInt(rng, 2, 3);
  for (let i = 0; i < dots; i++) {
    const t = (i + 1) / (dots + 1);
    children.push(h('circle', { cx: round(-r * 0.55 + r * 1.1 * t), cy: round(-r * 0.38), r: round(r * 0.09), fill: colors[0] }));
  }
  return { node: h('g', {}, children), radius: r * 0.95 };
};

const wavyBars: Variant = (rng, colors, size) => {
  const r = size / 2;
  const accents = accentColors(colors);
  const bars = Math.min(rngInt(rng, 3, 4), accents.length);
  const children = [];
  for (let i = 0; i < bars; i++) {
    const y = -r * 0.5 + (r * i) / Math.max(1, bars - 1);
    const amp = size * 0.13;
    children.push(
      h('path', {
        d: `M ${round(-r)} ${round(y)} Q ${round(-r * 0.5)} ${round(y - amp)} 0 ${round(y)} Q ${round(r * 0.5)} ${round(y + amp)} ${round(r)} ${round(y)}`,
        fill: 'none',
        stroke: accents[i % accents.length],
        'stroke-width': round(size * 0.09),
        'stroke-linecap': 'round',
      }),
    );
  }
  return { node: h('g', {}, children), radius: r * 1.1 };
};

const peaceHeart: Variant = (rng, colors, size) => {
  const r = size / 2;
  const color = rngPick(rng, accentColors(colors));
  const inner = rngRange(rng, 0, 1) < 0.5;
  const children = [
    h('path', {
      d: `M 0 ${round(r * 0.7)} C ${round(-r * 1.0)} ${round(r * 0.02)} ${round(-r * 0.55)} ${round(-r * 0.72)} 0 ${round(-r * 0.24)} C ${round(r * 0.55)} ${round(-r * 0.72)} ${round(r * 1.0)} ${round(r * 0.02)} 0 ${round(r * 0.7)} Z`,
      fill: color,
    }),
  ];
  if (inner) {
    children.push(
      h('path', {
        d: `M 0 ${round(r * 0.42)} C ${round(-r * 0.6)} 0 ${round(-r * 0.34)} ${round(-r * 0.44)} 0 ${round(-r * 0.14)} C ${round(r * 0.34)} ${round(-r * 0.44)} ${round(r * 0.6)} 0 0 ${round(r * 0.42)} Z`,
        fill: colors[0],
      }),
    );
  }
  return { node: h('g', {}, children), radius: r * 0.9 };
};

const VARIANTS: Variant[] = [rainbowArch, grooveDaisy, retroSun, grooveMushroom, wavyBars, peaceHeart];

export const retroGenerator: PatternGenerator = {
  id: 'retro',
  label: 'Retro 70s',
  description: 'Groovy seventies motifs: rainbow arches, round-petal daisies, suns, mushrooms and wavy bars.',
  defaultMotifSize: 70,
  createMotif(rng: Rng, colors: string[], size: number): Motif {
    const variant = rngPick(rng, VARIANTS);
    const { node, radius } = variant(rng, colors, size);
    return { node, radius };
  },
};
