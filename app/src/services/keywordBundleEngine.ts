import { validateKeywordBundleData } from '../validators';
import type { ValidationIssue } from '../validators/jsonSchemaValidator';
import { MARKETPLACE_DATA_BY_ID } from '../marketplaces';
import { STYLE_DNA_DATA_BY_ID } from '../style-dna';
import { MOTIF_GRAMMAR_DATA_BY_ID } from '../motif-grammar';
import { TREND_PACK_DATA, type TrendPackData } from '../trend-packs';

// Keyword Bundle Engine — Design Intelligence Core Phase 1, deliverable 4.
// Operates entirely on the new JSON data libraries built this milestone
// (marketplaces, style-dna, motif-grammar, trend-packs); it does not read
// or duplicate the already-shipped, hardcoded KEYWORD_MAP token lookup
// table in trend/keywordMap.ts (that table stays the live source for the
// existing Trend Studio UI, unmodified — see Phase 2 recommendations
// about eventually porting it to JSON too). This engine's job is
// validating a Keyword Bundle's own shape + its cross-references into the
// other libraries, and surfacing genuinely compatible Trend Packs/Style
// DNA presets for it — no hardcoded trend logic, every match comes from
// data already on hand.

export interface KeywordBundleLike {
  primaryKeyword: string;
  secondaryKeywords: string[];
  marketplace: string;
  season: 'spring' | 'summer' | 'autumn' | 'winter' | 'yearRound';
  audience: string;
  commercialCategory: string;
  styleDnaId?: string;
  patternType: string;
  paletteDirection: string;
  difficulty: 'simple' | 'moderate' | 'complex';
  collectionSize: number;
}

/** Validates a Keyword Bundle's own shape (via the JSON Schema validator
 * against keywordBundle.schema.json) plus its cross-references into the
 * marketplace/style-dna/motif-grammar libraries: `marketplace` must name a
 * real, non-`future` Marketplace Profile; `styleDnaId` (if set) must name
 * a real Style DNA preset; `patternType` must name a real Motif Grammar
 * category. */
export function validateKeywordBundle(bundle: KeywordBundleLike): ValidationIssue[] {
  const issues: ValidationIssue[] = [...validateKeywordBundleData(bundle)];

  const marketplace = MARKETPLACE_DATA_BY_ID[bundle.marketplace];
  if (!marketplace) {
    issues.push({ path: '$.marketplace', message: `Unknown marketplace "${bundle.marketplace}"` });
  } else if (marketplace.future) {
    issues.push({ path: '$.marketplace', message: `Marketplace "${bundle.marketplace}" is not yet available (future: true)` });
  }

  if (bundle.styleDnaId !== undefined && !STYLE_DNA_DATA_BY_ID[bundle.styleDnaId]) {
    issues.push({ path: '$.styleDnaId', message: `Unknown Style DNA "${bundle.styleDnaId}"` });
  }

  if (!MOTIF_GRAMMAR_DATA_BY_ID[bundle.patternType]) {
    issues.push({ path: '$.patternType', message: `Unknown pattern type "${bundle.patternType}" (no matching Motif Grammar entry)` });
  }

  return issues;
}

export function isKeywordBundleValid(bundle: KeywordBundleLike): boolean {
  return validateKeywordBundle(bundle).length === 0;
}

/** Trend Packs whose `season` matches the bundle's (or is `yearRound`)
 * and whose `patternTypes` includes the bundle's `patternType`, ranked
 * with exact-season matches first. */
export function suggestTrendPacksForBundle(bundle: KeywordBundleLike): TrendPackData[] {
  const matches = TREND_PACK_DATA.filter(
    (pack) => (pack.season === bundle.season || pack.season === 'yearRound') && pack.patternTypes.includes(bundle.patternType),
  );
  return matches.sort((a, b) => {
    const aExact = a.season === bundle.season ? 0 : 1;
    const bExact = b.season === bundle.season ? 0 : 1;
    return aExact - bExact;
  });
}

/** Style DNA ids compatible with the bundle: already-chosen `styleDnaId`
 * if set and real, otherwise every Style DNA preset whose `categories`
 * includes the bundle's `patternType` and (when the marketplace is known)
 * whose `exportRecommendation.recommendedSites` includes it. */
export function suggestStyleDnaIdsForBundle(bundle: KeywordBundleLike): string[] {
  if (bundle.styleDnaId && STYLE_DNA_DATA_BY_ID[bundle.styleDnaId]) return [bundle.styleDnaId];

  const marketplace = MARKETPLACE_DATA_BY_ID[bundle.marketplace];
  return Object.values(STYLE_DNA_DATA_BY_ID)
    .filter((dna) => dna.categories.includes(bundle.patternType))
    .filter((dna) => !marketplace || dna.exportRecommendation.recommendedSites.includes(marketplace.id))
    .map((dna) => dna.id);
}
