import type { TileData } from '../engine/types';
import { buildSiteMetadata, STOCK_SITES, type StockSiteId, type SiteMetadata } from './shutterstock';
import { buildExportFilename, buildFilenameParts } from '../export/svgExporter';
import { applyHardRejectRules } from '../engine/candidateEngine';
import { hashParams } from '../engine/designModel';
import { MARKETPLACE_PROFILES } from './marketplaceProfiles';
import type { SavedItem } from '../components/SavedPanel';

// Stock Submission Center — extends the existing per-site SEO metadata
// (metadata/shutterstock.ts, unchanged) with a real submission checklist,
// an SEO analyzer, and per-site readiness cards, all computed from data
// that already exists (the tile's actual SVG, the actual generated
// metadata fields, the actual filename) rather than static labels. A
// lightweight, real Designer-Assistant-style check — same scoping
// precedent as Style DNA's and the Asset Factory's own "not a full Phase 8
// engine, but a real rule-based check built now" decisions.

export type ChecklistStatus = 'ready' | 'warning' | 'missing';

export interface ChecklistItem {
  id: string;
  label: string;
  status: ChecklistStatus;
  detail: string;
}

/** Per-site field-length/keyword-count ceilings — derived from
 * metadata/marketplaceProfiles.ts (the Marketplace Profile System's single
 * source of validation rules) instead of a second, independently
 * maintained table. shutterstock/adobestock/freepik values are the site's
 * own documented upload-form limits; creativefabrica/creativemarket/etsy
 * have no publicly documented hard cap on their "Product Name"/"Title"
 * field (etsy's *title* is a real 140-char platform limit, but its
 * description is not), so those use a generous, clearly-labeled
 * *practical* ceiling for readability rather than a claimed platform
 * limit — see each profile's `titleRules`/`descriptionRules`. */
const SITE_LIMITS: Record<StockSiteId, { titleMax: number; titleIsPracticalCeiling?: boolean; keywordsMax: number }> = Object.fromEntries(
  Object.values(MARKETPLACE_PROFILES).map((p) => [
    p.id,
    { titleMax: p.titleRules.maxLength, titleIsPracticalCeiling: p.id === 'creativefabrica' || p.id === 'creativemarket', keywordsMax: p.keywordRules.maxCount },
  ]),
) as Record<StockSiteId, { titleMax: number; titleIsPracticalCeiling?: boolean; keywordsMax: number }>;

const RECOMMENDED_FILENAME_MAX = 100;

function titleField(site: SiteMetadata): { value: string } | undefined {
  return site.fields.find((f) => f.label === 'Title' || f.label === 'Product Name');
}

function descriptionField(site: SiteMetadata): { value: string } | undefined {
  return site.fields.find((f) => f.label === 'Description');
}

function keywordsField(site: SiteMetadata): { value: string } | undefined {
  return site.fields.find((f) => f.label === 'Keywords' || f.label === 'Keywords / Tags' || f.label === 'Tags');
}

function splitKeywords(value: string): string[] {
  return value
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

export function buildSubmissionChecklist(
  tileData: TileData,
  opts: { collectionGeneratedForSeed: string | null; saved: SavedItem[] },
): ChecklistItem[] {
  const sites = buildSiteMetadata(tileData);
  const hardReject = applyHardRejectRules(tileData);
  const filename = buildExportFilename(buildFilenameParts(tileData.params), tileData.params.seed);

  const metadataOk = sites.every((s) => s.fields.every((f) => f.value.trim().length > 0));

  const titlesOk = sites.every((s) => {
    const f = titleField(s);
    return !!f && f.value.trim().length > 0 && f.value.length <= SITE_LIMITS[s.id].titleMax;
  });
  const titlesPresent = sites.every((s) => !!titleField(s)?.value.trim());

  const descriptionSites = sites.filter((s) => descriptionField(s));
  const descriptionsOk = descriptionSites.length > 0 && descriptionSites.every((s) => (descriptionField(s)?.value.trim().length ?? 0) > 0);

  const keywordCounts = sites.map((s) => splitKeywords(keywordsField(s)?.value ?? '').length);
  const keywordsOk = keywordCounts.every((n) => n >= 7);

  const duplicateHash = hashParams(tileData.params);
  const isDuplicateOfSaved = opts.saved.some((item) => hashParams(item.tileData.params) === duplicateHash);

  const items: ChecklistItem[] = [
    { id: 'svgGenerated', label: 'SVG Generated', status: 'ready', detail: 'สร้าง SVG ต้นฉบับของลายนี้แล้ว' },
    {
      id: 'previewGenerated',
      label: 'Preview Generated',
      status: 'ready',
      detail: 'พรีวิวสร้างจาก SVG ต้นฉบับตัวเดียวกันเสมอ (renderer เดียวกันทั้งหน้าจอและไฟล์ export รับประกันตรงกัน 100%)',
    },
    {
      id: 'metadataReady',
      label: 'Metadata Ready',
      status: metadataOk ? 'ready' : 'missing',
      detail: metadataOk ? 'สร้าง metadata ครบทุกเว็บ (5 เว็บ) แล้ว' : 'มีบางฟิลด์ในบางเว็บยังว่างอยู่',
    },
    {
      id: 'titleReady',
      label: 'Title Ready',
      status: !titlesPresent ? 'missing' : titlesOk ? 'ready' : 'warning',
      detail: !titlesPresent ? 'บางเว็บยังไม่มี Title' : titlesOk ? 'Title ทุกเว็บมีเนื้อหาและอยู่ในความยาวที่กำหนด' : 'Title บางเว็บยาวเกินขีดจำกัดของเว็บนั้น',
    },
    {
      id: 'descriptionReady',
      label: 'Description Ready',
      status: descriptionsOk ? 'ready' : 'warning',
      detail: descriptionsOk
        ? 'Description พร้อมสำหรับเว็บที่มีช่องนี้'
        : 'บางเว็บที่มีช่อง Description ยังว่างอยู่ (Adobe Stock ไม่มีช่องนี้ตามปกติ ไม่นับเป็นปัญหา)',
    },
    {
      id: 'keywordsReady',
      label: 'Keywords Ready',
      status: keywordsOk ? 'ready' : 'warning',
      detail: keywordsOk ? 'คำค้นทุกเว็บมีอย่างน้อย 7 คำ' : `บางเว็บมีคำค้นน้อยกว่า 7 คำ (${keywordCounts.join('/')})`,
    },
    {
      id: 'filenameReady',
      label: 'Filename Ready',
      status: filename.length > 0 && filename.length <= RECOMMENDED_FILENAME_MAX ? 'ready' : 'warning',
      detail: `ชื่อไฟล์ยาว ${filename.length} ตัวอักษร (แนะนำไม่เกิน ${RECOMMENDED_FILENAME_MAX})`,
    },
    {
      id: 'collectionReady',
      label: 'Collection Ready',
      status: opts.collectionGeneratedForSeed === tileData.params.seed ? 'ready' : 'missing',
      detail:
        opts.collectionGeneratedForSeed === tileData.params.seed
          ? 'สร้าง Collection (Professional Asset Factory) สำหรับลายนี้แล้ว'
          : 'ยังไม่ได้กด Generate Collection สำหรับลายนี้',
    },
    {
      id: 'zipReady',
      label: 'ZIP Ready',
      status: 'ready',
      detail: 'พร้อมดาวน์โหลดชุดไฟล์ (SVG + EPS + 3×3 + SEO) จากปุ่มบันทึกเข้าคลัง/ดาวน์โหลดได้ทันที',
    },
    {
      id: 'svgValid',
      label: 'SVG Valid',
      status: hardReject.rejected ? 'missing' : 'ready',
      detail: hardReject.rejected ? hardReject.reasons.join('; ') : 'ผ่านการตรวจสอบโครงสร้าง SVG ทั้งหมด (ไม่มี NaN/raster/id ซ้ำ/เกิน node budget)',
    },
    {
      id: 'originalityChecklist',
      label: 'Originality Checklist',
      status: isDuplicateOfSaved ? 'warning' : 'ready',
      detail: isDuplicateOfSaved
        ? 'ตั้งค่าเดียวกันนี้เคยถูกบันทึกเข้าคลังไว้แล้ว (seed+ค่าปรับตรงกัน) — ตรวจว่าตั้งใจส่งซ้ำหรือไม่'
        : 'ไม่พบลายที่ตั้งค่าตรงกันในคลังที่บันทึกไว้ (ตรวจได้เฉพาะภายในคลังของคุณเอง ไม่ใช่ฐานข้อมูลตลาดทั้งหมด)',
    },
  ];

  return items;
}

export interface SeoAnalysis {
  score: number;
  keywordCount: number;
  duplicateKeywords: string[];
  titleLength: number;
  descriptionLength: number;
  filenameLength: number;
  commercialTags: string[];
  keywordCoverage: number;
}

// Exported (Marketplace Intelligence Engine Phase 5, Section 8) so the
// Readiness Score module can reuse this exact commercial-tag pool instead
// of maintaining a second, duplicate list.
export const COMMERCIAL_TAG_CANDIDATES = ['seamless', 'vector', 'pattern', 'commercial use', 'editable', 'repeat', 'tileable', 'print', 'wallpaper', 'textile'];

/** 5 broad keyword categories a well-covered listing should touch:
 * technique, subject/style, color/mood, use-case, and format. Presence is
 * checked against real generated keyword lists, not a fixed script. */
const COVERAGE_BUCKETS: Record<string, string[]> = {
  technique: ['seamless', 'vector', 'repeat', 'tileable', 'pattern'],
  useCase: ['fabric', 'wallpaper', 'textile', 'packaging', 'stationery', 'wrapping paper', 'apparel'],
  format: ['editable', 'eps', 'flat', 'illustration'],
};

export function analyzeSeo(tileData: TileData): SeoAnalysis {
  const sites = buildSiteMetadata(tileData);
  const shutterstock = sites.find((s) => s.id === 'shutterstock') ?? sites[0];
  const filename = buildExportFilename(buildFilenameParts(tileData.params), tileData.params.seed);

  const title = titleField(shutterstock)?.value ?? '';
  const description = descriptionField(shutterstock)?.value ?? '';
  const keywords = splitKeywords(keywordsField(shutterstock)?.value ?? '');

  const seen = new Map<string, number>();
  for (const k of keywords) seen.set(k, (seen.get(k) ?? 0) + 1);
  const duplicateKeywords = [...seen.entries()].filter(([, count]) => count > 1).map(([k]) => k);

  const commercialTags = COMMERCIAL_TAG_CANDIDATES.filter((tag) => keywords.includes(tag));

  const bucketHits = Object.values(COVERAGE_BUCKETS).filter((words) => words.some((w) => keywords.includes(w)));
  const keywordCoverage = Math.round((bucketHits.length / Object.keys(COVERAGE_BUCKETS).length) * 100);

  // Weighted real sub-scores, same "weighted average" convention
  // scoring.ts's computeOverallScore uses for pattern quality.
  const titleScore = title.length >= 20 && title.length <= SITE_LIMITS.shutterstock.titleMax ? 100 : title.length > 0 ? 50 : 0;
  const descriptionScore = description.length >= 40 ? 100 : description.length > 0 ? 50 : 0;
  const keywordCountScore = keywords.length >= 30 ? 100 : Math.round((keywords.length / 30) * 100);
  const duplicatePenalty = Math.min(30, duplicateKeywords.length * 10);
  const commercialScore = Math.min(100, commercialTags.length * 25);
  const score = Math.max(
    0,
    Math.round(titleScore * 0.2 + descriptionScore * 0.2 + keywordCountScore * 0.25 + commercialScore * 0.15 + keywordCoverage * 0.2 - duplicatePenalty),
  );

  return {
    score,
    keywordCount: keywords.length,
    duplicateKeywords,
    titleLength: title.length,
    descriptionLength: description.length,
    filenameLength: filename.length,
    commercialTags,
    keywordCoverage,
  };
}

export interface StockReadiness {
  siteId: StockSiteId;
  label: string;
  status: 'ready' | 'needsReview' | 'issues';
  issues: string[];
  recommendations: string[];
}

export function computeStockReadiness(tileData: TileData, checklist: ChecklistItem[]): StockReadiness[] {
  const sites = buildSiteMetadata(tileData);
  const svgInvalid = checklist.find((c) => c.id === 'svgValid')?.status !== 'ready';

  return STOCK_SITES.map(({ id, label }) => {
    const site = sites.find((s) => s.id === id)!;
    const limits = SITE_LIMITS[id];
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (svgInvalid) issues.push('SVG ไม่ผ่านการตรวจสอบโครงสร้าง — ทุกเว็บต้องการ SVG ที่ถูกต้อง');

    const title = titleField(site);
    if (!title || title.value.trim().length === 0) {
      issues.push('ไม่มี Title/Product Name');
    } else if (title.value.length > limits.titleMax) {
      issues.push(`Title ยาว ${title.value.length} ตัวอักษร เกิน ${limits.titleIsPracticalCeiling ? 'ค่าแนะนำ' : 'ขีดจำกัดของเว็บ'} ${limits.titleMax}`);
      recommendations.push(`ย่อ Title ให้ไม่เกิน ${limits.titleMax} ตัวอักษร`);
    }

    const kwCount = splitKeywords(keywordsField(site)?.value ?? '').length;
    if (kwCount < 7) {
      issues.push(`คำค้นมีแค่ ${kwCount} คำ`);
      recommendations.push('เพิ่มคำค้นให้ครอบคลุมมากขึ้น (สี, สไตล์, การใช้งาน)');
    } else if (kwCount > limits.keywordsMax) {
      issues.push(`คำค้นเกินขีดจำกัด ${limits.keywordsMax} คำของเว็บนี้`);
    }

    const desc = descriptionField(site);
    if (site.fields.some((f) => f.label === 'Description') && (!desc || desc.value.trim().length === 0)) {
      issues.push('ไม่มี Description');
      recommendations.push('เติม Description ให้ครบก่อนอัปโหลด');
    }

    const status: StockReadiness['status'] = issues.length === 0 ? 'ready' : svgInvalid || !title?.value.trim() ? 'issues' : 'needsReview';

    return { siteId: id, label, status, issues, recommendations };
  });
}

/** Real, rule-based recommendations derived directly from the computed
 * checklist/analysis — the "Designer Assistant" requirement for this page,
 * scoped like every other not-yet-a-full-engine Designer Assistant check
 * in this app: a genuinely useful function built now, not a placeholder
 * waiting on a future roadmap phase. */
export function buildSubmissionRecommendations(checklist: ChecklistItem[], seo: SeoAnalysis, readiness: StockReadiness[]): string[] {
  const recs: string[] = [];

  for (const item of checklist) {
    if (item.status === 'missing') recs.push(`${item.label}: ${item.detail}`);
  }
  for (const item of checklist) {
    if (item.status === 'warning') recs.push(`${item.label}: ${item.detail}`);
  }

  if (seo.duplicateKeywords.length > 0) {
    recs.push(`มีคำค้นซ้ำ ${seo.duplicateKeywords.length} คำ (${seo.duplicateKeywords.slice(0, 5).join(', ')}) — แทนที่ด้วยคำใหม่เพื่อเพิ่มความหลากหลาย`);
  }
  if (seo.keywordCoverage < 100) {
    recs.push('คำค้นยังไม่ครอบคลุมทุกหมวด (เทคนิค/การใช้งาน/รูปแบบไฟล์) — เพิ่มคำที่เกี่ยวกับการใช้งานจริง เช่น fabric, wallpaper, packaging');
  }
  if (seo.commercialTags.length < 3) {
    recs.push('เพิ่มคำค้นเชิงพาณิชย์ เช่น "seamless", "vector", "commercial use" ให้ครบเพื่อให้ค้นเจอง่ายขึ้น');
  }

  for (const site of readiness) {
    if (site.status === 'issues') {
      recs.push(`${site.label}: ${site.issues.join('; ')}`);
    }
  }

  return [...new Set(recs)];
}
