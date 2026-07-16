import q1 from './2026-Q1.json';
import q2 from './2026-Q2.json';
import q3 from './2026-Q3.json';
import q4 from './2026-Q4.json';

// Trend Pack data loader — the JSON files in this folder are the actual
// editable data (Design Intelligence Core Phase 1's "no hardcoded trend
// logic" requirement); this module just imports and re-exports them typed
// and indexed. Vite/TS both support static JSON imports natively (see
// tsconfig's resolveJsonModule), so no runtime fetch/parse step is needed.

export interface TrendPackData {
  id: string;
  label: string;
  season: 'spring' | 'summer' | 'autumn' | 'winter' | 'yearRound';
  theme: string;
  mood: string;
  commercialUses: string[];
  paletteDirection: string;
  popularMotifs: string[];
  suggestedLayouts: string[];
  negativeSpace: number;
  compositionStyle: 'airy' | 'balanced' | 'dense' | 'editorial' | 'maximalist' | 'minimal';
  styleDnaId: string;
  colorRoles: { background: string; primary: string; secondary: string; accent: string };
  patternTypes: string[];
  collectionRecommendations: { size: number; assetTypes: string[] };
}

export const TREND_PACK_DATA: TrendPackData[] = [q1, q2, q3, q4] as TrendPackData[];

export const TREND_PACK_DATA_BY_ID: Record<string, TrendPackData> = Object.fromEntries(
  TREND_PACK_DATA.map((pack) => [pack.id, pack]),
);
