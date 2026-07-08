import type { LayoutId, PatternLayout } from '../engine/types';
import { gridLayout } from './grid';
import { brickLayout } from './brick';
import { radialLayout } from './radial';
import { scatterLayout } from './scatter';
import { halfDropLayout } from './halfDrop';

export const LAYOUTS: Record<LayoutId, PatternLayout> = {
  grid: gridLayout,
  brick: brickLayout,
  radial: radialLayout,
  scatter: scatterLayout,
  halfDrop: halfDropLayout,
};

export const LAYOUT_LIST: PatternLayout[] = Object.values(LAYOUTS);
