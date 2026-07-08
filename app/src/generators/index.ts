import type { PatternGenerator } from '../engine/types';
import { geometricGenerator } from './geometric';
import { botanicalGenerator } from './botanical';
import { organicGenerator } from './organic';

// Registry of implemented categories. To add a new category (e.g. Boho,
// Tropical, Mandala, Seasonal...), implement the PatternGenerator interface
// in a new file under /generators and add it here — nothing else in the
// engine, layouts, or UI needs to change.
export const GENERATORS: Record<string, PatternGenerator> = {
  geometric: geometricGenerator,
  botanical: botanicalGenerator,
  organic: organicGenerator,
};

export const GENERATOR_LIST: PatternGenerator[] = Object.values(GENERATORS);
