import type { GenerateParams } from './types';
import { createRng, randomSeed, rngPick, rngInt } from './rng';
import { GENERATORS } from '../generators';
import { LAYOUT_LIST } from '../layouts';
import { PALETTES } from '../palettes/palettes';

/** Pick `count` distinct random elements from `arr`. */
function pickDistinct<T>(rng: () => number, arr: readonly T[], count: number): T[] {
  const pool = [...arr];
  const picked: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

export function defaultParams(): GenerateParams {
  const generator = GENERATORS.geometric;
  return {
    categoryId: generator.id,
    layoutId: 'grid',
    paletteId: PALETTES[0].id,
    colorCount: 4,
    // Vector art scales losslessly, so tile size doesn't affect sharpness —
    // but patterns are sold as single 10000x10000px images, and buyers
    // expect that canvas to read as a rich, detailed all-over print rather
    // than a handful of oversized shapes. A larger tile at the same
    // motif-size/density fits proportionally more repeats into one export
    // (see spacingForDensity in layouts/shared.ts — motif count scales with
    // tileSize / spacing, independent of the fixed export pixel size).
    tileSize: 1200,
    density: 0.55,
    motifSize: generator.defaultMotifSize,
    patternScale: 1,
    rotationJitter: 15,
    scaleJitter: 0.15,
    mirror: false,
    radialSymmetry: 6,
    seed: randomSeed(),
  };
}

export function randomizedParams(base: GenerateParams): GenerateParams {
  const rng = createRng(`${Date.now()}-${Math.random()}`);
  const generators = Object.values(GENERATORS);
  const generator = rngPick(rng, generators);
  const palette = rngPick(rng, PALETTES);
  // ~25% of the time, exercise Asset-Based Pattern mixing so "Randomize
  // All" itself samples that part of the (much larger) combined space
  // instead of only ever landing on single-category patterns.
  const useMix = rng() < 0.25;
  const mixCategoryIds = useMix ? pickDistinct(rng, generators, rngInt(rng, 2, 4)).map((g) => g.id) : undefined;
  return {
    ...base,
    categoryId: generator.id,
    mixCategoryIds,
    layoutId: rngPick(rng, LAYOUT_LIST).id,
    paletteId: palette.id,
    customColors: undefined,
    colorCount: 2 + Math.floor(rng() * 5),
    // Floor raised from the old 0.15 — a single 10000x10000px sale image
    // needs to stay visually rich even at "Randomize All"'s sparse end.
    density: 0.35 + rng() * 0.55,
    motifSize: generator.defaultMotifSize * (0.7 + rng() * 0.7),
    patternScale: 1,
    rotationJitter: Math.floor(rng() * 90),
    scaleJitter: rng() * 0.4,
    mirror: rng() < 0.4,
    radialSymmetry: 3 + Math.floor(rng() * 9),
    seed: randomSeed(),
  };
}
