import { TREND_PACK_DATA, TREND_PACK_DATA_BY_ID, type TrendPackData } from '../trend-packs';

// Thin query/lookup service over the Trend Pack data library. Design
// Intelligence Core Phase 1's service layer is deliberately just a query
// surface — no hardcoded trend logic lives here, every value returned
// comes straight from the JSON data files in /trend-packs.

export function listTrendPacks(): TrendPackData[] {
  return TREND_PACK_DATA;
}

export function getTrendPack(id: string): TrendPackData | undefined {
  return TREND_PACK_DATA_BY_ID[id];
}

export function findTrendPacksBySeason(season: TrendPackData['season']): TrendPackData[] {
  return TREND_PACK_DATA.filter((pack) => pack.season === season || pack.season === 'yearRound');
}

export function findTrendPacksByCompositionStyle(compositionStyle: TrendPackData['compositionStyle']): TrendPackData[] {
  return TREND_PACK_DATA.filter((pack) => pack.compositionStyle === compositionStyle);
}

export function findTrendPacksByPatternType(patternType: string): TrendPackData[] {
  return TREND_PACK_DATA.filter((pack) => pack.patternTypes.includes(patternType));
}
