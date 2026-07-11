import type { LayoutId } from '../engine/types';
import type { CollectionAssetKind, CompositionStyle, DesignColorRoles, SeasonId } from './designSpecTypes';

// Trend Library (Section 3) — editable, JSON-import/export-able quarterly
// market packs. Distinct from the existing engine/trendEngine.ts (a
// single-pattern "style preset" resolved straight into GenerateParams,
// unchanged, still used by the Control Panel's Trend Intelligence
// section): a Trend Pack operates one level up, at the
// keyword-bundle/collection level, and is one of several inputs Design
// Intelligence (designIntelligence.ts) merges into a Design Specification
// — it never touches GenerateParams directly.
//
// Every field is grounded in a real, already-existing engine value
// (real category ids from generators/index.ts, real LayoutIds, a real
// Style DNA preset id, real hex colors lifted from an actual
// palettes/palettes.ts entry) rather than invented placeholder data.

export interface TrendPack {
  id: string;
  label: string;
  season: SeasonId;
  theme: string;
  mood: string;
  commercialUses: string[];
  /** Free-text direction fed into the same palette-direction resolution
   * keywordMap.ts's KEYWORD_MAP hints use — kept as text, not a Palette
   * id, so a pack and a keyword bundle compose through the same
   * resolution step in designIntelligence.ts. */
  paletteDirection: string;
  popularMotifs: string[];
  suggestedLayouts: LayoutId[];
  negativeSpace: number;
  compositionStyle: CompositionStyle;
  styleDnaId: string;
  colorRoles: DesignColorRoles;
  patternTypes: string[];
  collectionRecommendations: {
    size: number;
    assetTypes: CollectionAssetKind[];
  };
}

export const TREND_PACK_SCHEMA_VERSION = 1;

export const DEFAULT_COLLECTION_ASSET_TYPES: CollectionAssetKind[] = [
  'heroPattern',
  'secondaryPattern',
  'miniPattern',
  'stripePattern',
  'borderPattern',
  'cornerPattern',
  'spotMotifSheet',
];

export const TREND_PACKS: Record<string, TrendPack> = {
  '2026-Q1': {
    id: '2026-Q1',
    label: '2026 Q1 — Quiet Luxury Botanical',
    season: 'winter',
    theme: 'Quiet Luxury Botanical',
    mood: 'elevated, calm, refined',
    commercialUses: ['wallpaper', 'stationery', 'packaging'],
    paletteDirection: 'muted green',
    popularMotifs: ['botanical'],
    suggestedLayouts: ['airy', 'scatter'],
    negativeSpace: 0.4,
    compositionStyle: 'airy',
    styleDnaId: 'luxuryFloral',
    colorRoles: { background: '#F6F4EF', primary: '#7C9A92', secondary: '#A9BBA6', accent: '#4E6E64' },
    patternTypes: ['botanical'],
    collectionRecommendations: { size: 8, assetTypes: DEFAULT_COLLECTION_ASSET_TYPES },
  },
  '2026-Q2': {
    id: '2026-Q2',
    label: '2026 Q2 — Modern Tropical Editorial',
    season: 'summer',
    theme: 'Modern Tropical Editorial',
    mood: 'lush, vibrant, exotic',
    commercialUses: ['textile', 'wallpaper', 'apparel'],
    paletteDirection: 'citrus',
    popularMotifs: ['tropical', 'botanical'],
    suggestedLayouts: ['heroFlow', 'scatter'],
    negativeSpace: 0.15,
    compositionStyle: 'editorial',
    styleDnaId: 'modernTropical',
    colorRoles: { background: '#FFFDF5', primary: '#FF8C42', secondary: '#FFD166', accent: '#06A77D' },
    patternTypes: ['tropical', 'botanical'],
    collectionRecommendations: { size: 8, assetTypes: DEFAULT_COLLECTION_ASSET_TYPES },
  },
  '2026-Q3': {
    id: '2026-Q3',
    label: '2026 Q3 — Vintage Herbarium',
    season: 'autumn',
    theme: 'Vintage Herbarium',
    mood: 'nostalgic, warm, pressed botanical',
    commercialUses: ['stationery', 'packaging', 'homeDecor'],
    paletteDirection: 'earth tone',
    popularMotifs: ['botanical', 'damask'],
    suggestedLayouts: ['bouquet', 'sCurve'],
    negativeSpace: 0.25,
    compositionStyle: 'balanced',
    styleDnaId: 'vintageHerbarium',
    colorRoles: { background: '#F4EDE4', primary: '#A9714B', secondary: '#D9A566', accent: '#8F9E7B' },
    patternTypes: ['botanical', 'damask'],
    collectionRecommendations: { size: 8, assetTypes: DEFAULT_COLLECTION_ASSET_TYPES },
  },
  '2026-Q4': {
    id: '2026-Q4',
    label: '2026 Q4 — Dark Academia Maximalist',
    season: 'winter',
    theme: 'Dark Academia Maximalist',
    mood: 'moody, dramatic, ornate',
    commercialUses: ['wallpaper', 'giftWrap', 'packaging'],
    paletteDirection: 'midnight botanical',
    popularMotifs: ['botanical', 'mandala', 'damask'],
    suggestedLayouts: ['densePremium', 'bouquet'],
    negativeSpace: 0.1,
    compositionStyle: 'maximalist',
    styleDnaId: 'darkBotanical',
    colorRoles: { background: '#EDE9DD', primary: '#4A6B57', secondary: '#8FA68E', accent: '#1C2E2A' },
    patternTypes: ['botanical', 'mandala', 'damask'],
    collectionRecommendations: { size: 8, assetTypes: DEFAULT_COLLECTION_ASSET_TYPES },
  },
};

export const TREND_PACK_LIST: TrendPack[] = Object.values(TREND_PACKS);

export interface TrendPackExport {
  schemaVersion: number;
  exportedAt: number;
  trendPack: TrendPack;
}

export function exportTrendPackJson(pack: TrendPack): string {
  const doc: TrendPackExport = { schemaVersion: TREND_PACK_SCHEMA_VERSION, exportedAt: Date.now(), trendPack: pack };
  return JSON.stringify(doc, null, 2);
}

/** Structural validation only (same "check the shape, not the exact
 * schemaVersion number" convention project/projectJson.ts already
 * established) — accepts any object with the required fields in roughly
 * the right shape so a hand-edited or older-export Trend Pack JSON still
 * imports. Throws with a Thai-language message on failure, matching this
 * app's other user-facing import validators (ai/aiAssist.ts). */
export function importTrendPackJson(json: string): TrendPack {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('ไฟล์ Trend Pack ไม่ใช่ JSON ที่ถูกต้อง');
  }
  const doc = parsed as Partial<TrendPackExport> & Partial<TrendPack>;
  const pack = (doc.trendPack ?? doc) as Partial<TrendPack>;
  if (
    typeof pack.id !== 'string' ||
    typeof pack.label !== 'string' ||
    typeof pack.theme !== 'string' ||
    typeof pack.mood !== 'string' ||
    !Array.isArray(pack.commercialUses) ||
    !Array.isArray(pack.popularMotifs) ||
    !Array.isArray(pack.suggestedLayouts) ||
    !Array.isArray(pack.patternTypes) ||
    typeof pack.paletteDirection !== 'string' ||
    typeof pack.compositionStyle !== 'string' ||
    typeof pack.styleDnaId !== 'string' ||
    typeof pack.colorRoles !== 'object' ||
    pack.colorRoles === null ||
    typeof pack.collectionRecommendations !== 'object' ||
    pack.collectionRecommendations === null
  ) {
    throw new Error('โครงสร้างไฟล์ Trend Pack ไม่ครบถ้วน — ตรวจสอบว่ามีทุกฟิลด์ที่จำเป็น');
  }
  return pack as TrendPack;
}
