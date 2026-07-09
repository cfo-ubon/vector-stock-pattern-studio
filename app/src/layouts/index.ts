import type { LayoutId, PatternLayout } from '../engine/types';
import { gridLayout } from './grid';
import { brickLayout } from './brick';
import { radialLayout } from './radial';
import { scatterLayout } from './scatter';
import { halfDropLayout } from './halfDrop';
import { heroFlowLayout } from './heroFlow';
import { heroScatterLayout } from './heroScatter';
import { sCurveLayout } from './sCurve';
import { bouquetLayout } from './bouquet';
import { airyLayout } from './airy';
import { tossLayout } from './toss';
import { densePremiumLayout } from './densePremium';
import { gridMinimalLayout } from './gridMinimal';
import { stripeLayout } from './stripe';

export const LAYOUTS: Record<LayoutId, PatternLayout> = {
  grid: gridLayout,
  brick: brickLayout,
  radial: radialLayout,
  scatter: scatterLayout,
  halfDrop: halfDropLayout,
  heroFlow: heroFlowLayout,
  heroScatter: heroScatterLayout,
  sCurve: sCurveLayout,
  bouquet: bouquetLayout,
  airy: airyLayout,
  toss: tossLayout,
  densePremium: densePremiumLayout,
  gridMinimal: gridMinimalLayout,
  stripe: stripeLayout,
};

export const LAYOUT_LIST: PatternLayout[] = Object.values(LAYOUTS);
