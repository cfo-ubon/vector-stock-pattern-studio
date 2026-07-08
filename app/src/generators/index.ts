import type { PatternGenerator } from '../engine/types';
import { geometricGenerator } from './geometric';
import { botanicalGenerator } from './botanical';
import { organicGenerator } from './organic';
import { tropicalGenerator } from './tropical';
import { bohoGenerator } from './boho';
import { lineArtGenerator } from './lineart';
import { mandalaGenerator } from './mandala';
import { damaskGenerator } from './damask';
import { cuteGenerator } from './cute';
import { seasonalGenerator } from './seasonal';
import { retroGenerator } from './retro';

// Registry of implemented categories. To add a new category, implement the
// PatternGenerator interface in a new file under /generators and add it
// here — nothing else in the engine, layouts, or UI needs to change.
export const GENERATORS: Record<string, PatternGenerator> = {
  geometric: geometricGenerator,
  botanical: botanicalGenerator,
  organic: organicGenerator,
  tropical: tropicalGenerator,
  boho: bohoGenerator,
  lineart: lineArtGenerator,
  mandala: mandalaGenerator,
  damask: damaskGenerator,
  cute: cuteGenerator,
  seasonal: seasonalGenerator,
  retro: retroGenerator,
};

export const GENERATOR_LIST: PatternGenerator[] = Object.values(GENERATORS);
