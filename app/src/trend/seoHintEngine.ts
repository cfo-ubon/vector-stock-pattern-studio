import { MARKETPLACE_PROFILES, resolveMarketplaceCategory, type MarketplaceId, type MarketplaceProfile } from '../metadata/marketplaceProfiles';
import { UNIVERSAL, CATEGORY_KEYWORDS } from '../metadata/shutterstock';
import type { DesignSpecification } from './designSpecTypes';

// SEO Hint Engine — Marketplace Intelligence Engine Phase 5, Section 4.
// Deliberately NOT `trend/designSpecSeo.ts`'s job (that module already
// generates *final*, committed Title/Description/Keywords/Filename/
// Collection Name/Asset Name — reused here, never duplicated): this module
// runs *before* a pattern is even generated, straight off the Design
// Specification alone (no `TileData` required), and returns candidates,
// target ranges, and rule-based advisory notes — never one committed
// answer. "Do not generate final SEO yet" (Section 4's own words) means
// exactly that: everything below is something a user or a later step
// chooses from/acts on, not something already decided for them.

export interface SeoHint {
  code: string;
  message: string;
}

export interface MarketplaceSeoHints {
  marketplaceId: MarketplaceId;
  titleTarget: { minLength: number; maxLength: number };
  descriptionTarget: { required: boolean; minLength: number; maxLength: number } | null;
  keywordCountTarget: { minCount: number; maxCount: number; termLabel: 'keywords' | 'tags' };
  /** A generous, ranked candidate pool — real signals from the Keyword
   * Bundle (primary + secondary keywords), the matched generator
   * category's own real keyword set (metadata/shutterstock.ts's
   * `CATEGORY_KEYWORDS`), and the universal seamless-pattern keyword pool
   * (`UNIVERSAL`) — deduped, most-relevant-first. Deliberately larger than
   * `keywordCountTarget.maxCount` so there's real room to choose, not a
   * pre-trimmed final list. */
  keywordCandidates: string[];
  categorySuggestion: string;
  collectionNameSuggestion: string;
  hints: SeoHint[];
}

/** Resolves `{primaryKeyword}`-style placeholders in a human-readable
 * naming template (Collection Naming Rules) — deliberately not
 * `filenameEngine.ts`'s `resolveFilenameTemplate`: that one slugifies for
 * filesystem safety, which would mangle a human-readable display name like
 * "Luxury Botanical Collection" into "luxury-botanical-collection". */
function resolveNamingTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

function truncateToLength(s: string, maxLength: number): string {
  if (s.length <= maxLength) return s;
  const cut = s.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

function buildKeywordCandidates(spec: DesignSpecification, profile: MarketplaceProfile): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const push = (raw: string) => {
    const kw = raw.trim();
    if (!kw) return;
    if (profile.keywordRules.maxKeywordLength && kw.length > profile.keywordRules.maxKeywordLength) return;
    const key = kw.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(kw);
  };

  push(spec.seoHints.primaryKeyword);
  for (const kw of spec.seoHints.secondaryKeywords) push(kw);
  const categoryWords = CATEGORY_KEYWORDS[spec.keywordBundle.patternType];
  if (categoryWords) {
    push(categoryWords.phrase);
    for (const w of categoryWords.words) push(w);
  }
  for (const w of UNIVERSAL) push(w);

  // A generous pool (2x the marketplace's own max) so there's real room to
  // choose from — never trimmed down to exactly what's required, since
  // this is a candidate list, not the final answer.
  return result.slice(0, profile.keywordRules.maxCount * 2);
}

function buildHints(spec: DesignSpecification, profile: MarketplaceProfile, candidates: string[]): SeoHint[] {
  const hints: SeoHint[] = [];

  if (candidates.length < profile.keywordRules.minCount) {
    hints.push({
      code: 'lowKeywordCandidates',
      message: `มีคำค้นที่แนะนำแค่ ${candidates.length} คำ ยังไม่ถึงขั้นต่ำ ${profile.keywordRules.minCount} ของเว็บนี้ — ลองเพิ่ม secondaryKeywords ใน Keyword Bundle`,
    });
  }

  if (profile.future) {
    hints.push({
      code: 'futureMarketplace',
      message: `${profile.label} ยังเป็นสถานะ "future-ready" — โปรไฟล์สร้าง SEO จริงได้ แต่ยังไม่ยืนยันว่าพร้อมส่งขายวันนี้`,
    });
  }

  if (!profile.descriptionRules.required) {
    hints.push({ code: 'descriptionOptional', message: `${profile.label} ไม่มีช่อง Description บังคับ — ข้ามได้ถ้าไม่ต้องการเติม` });
  }

  if (!profile.contributorUrlVerified) {
    hints.push({ code: 'contributorUrlUnverified', message: `ลิงก์ Contributor Portal ของ ${profile.label} ยังไม่ได้ยืนยัน — ตรวจสอบก่อนใช้จริง` });
  }

  const categorySuggestion = resolveMarketplaceCategory(profile, spec.keywordBundle.patternType);
  if (categorySuggestion === profile.defaultCategory && profile.categoryMapping) {
    hints.push({
      code: 'defaultCategoryFallback',
      message: `หมวดหมู่ "${spec.keywordBundle.patternType}" ยังไม่มีการแม็พเฉพาะสำหรับ ${profile.label} — ใช้หมวดหมู่เริ่มต้น "${profile.defaultCategory}" แทน`,
    });
  }

  return hints;
}

/** Section 4's core: one marketplace's real, rule-based SEO hints for a
 * Design Specification — no `TileData` required, so this can run the
 * moment a spec exists, before anything is generated. */
export function buildSeoHints(spec: DesignSpecification, marketplaceId: MarketplaceId): MarketplaceSeoHints {
  const profile = MARKETPLACE_PROFILES[marketplaceId];
  const keywordCandidates = buildKeywordCandidates(spec, profile);
  const collectionNameSuggestion = truncateToLength(
    resolveNamingTemplate(profile.collectionNamingRules.template, { primaryKeyword: spec.seoHints.primaryKeyword }),
    profile.collectionNamingRules.maxLength,
  );

  return {
    marketplaceId,
    titleTarget: { minLength: profile.titleRules.minLength, maxLength: profile.titleRules.maxLength },
    descriptionTarget: profile.descriptionRules.required
      ? { required: true, minLength: profile.descriptionRules.minLength, maxLength: profile.descriptionRules.maxLength }
      : null,
    keywordCountTarget: { minCount: profile.keywordRules.minCount, maxCount: profile.keywordRules.maxCount, termLabel: profile.keywordRules.termLabel },
    keywordCandidates,
    categorySuggestion: resolveMarketplaceCategory(profile, spec.keywordBundle.patternType),
    collectionNameSuggestion,
    hints: buildHints(spec, profile, keywordCandidates),
  };
}

/** Every marketplace's hints in one call — mirrors
 * `metadata/marketplaceSeo.ts`'s `generateAllMarketplaceSeo` and
 * `trend/designSpecSeo.ts`'s `buildAllDesignSpecSeo`. */
export function buildAllSeoHints(spec: DesignSpecification): Record<MarketplaceId, MarketplaceSeoHints> {
  const result = {} as Record<MarketplaceId, MarketplaceSeoHints>;
  for (const marketplaceId of Object.keys(MARKETPLACE_PROFILES) as MarketplaceId[]) {
    result[marketplaceId] = buildSeoHints(spec, marketplaceId);
  }
  return result;
}
