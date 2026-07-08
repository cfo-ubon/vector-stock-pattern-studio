import type { GenerateParams } from './types';
import { createRng, randomSeed, rngPick } from './rng';
import { GENERATORS } from '../generators';
import { PALETTES } from '../palettes/palettes';

export function defaultParams(): GenerateParams {
  const generator = GENERATORS.geometric;
  return {
    categoryId: generator.id,
    layoutId: 'grid',
    paletteId: PALETTES[0].id,
    colorCount: 4,
    tileSize: 400,
    density: 0.5,
    motifSize: generator.defaultMotifSize,
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
  const layouts: GenerateParams['layoutId'][] = ['grid', 'brick', 'radial', 'scatter', 'halfDrop'];
  const palette = rngPick(rng, PALETTES);
  return {
    ...base,
    categoryId: generator.id,
    layoutId: rngPick(rng, layouts),
    paletteId: palette.id,
    customColors: undefined,
    colorCount: 2 + Math.floor(rng() * 5),
    density: 0.15 + rng() * 0.75,
    motifSize: generator.defaultMotifSize * (0.7 + rng() * 0.7),
    rotationJitter: Math.floor(rng() * 90),
    scaleJitter: rng() * 0.4,
    mirror: rng() < 0.4,
    radialSymmetry: 3 + Math.floor(rng() * 9),
    seed: randomSeed(),
  };
}
