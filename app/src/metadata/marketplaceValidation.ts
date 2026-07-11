import type { MarketplaceSeo } from './marketplaceSeo';
import type { MarketplaceProfile } from './marketplaceProfiles';

// Marketplace Validation — checks a generated (or user-edited) SEO package
// against its own marketplace profile's rules, instead of a fixed set of
// checks with numbers hardcoded inline (the old approach in
// metadata/submissionCenter.ts's SITE_LIMITS table, which this module now
// supersedes as the single source of validation rules — submissionCenter.ts
// reads the same MARKETPLACE_PROFILES this validates against).
//
// Marketplace Intelligence Engine Phase 5, Section 3 extends coverage from
// 4 checked fields (Title/Description/Keywords/Filename) to all 9 the
// brief names: Collection Name, Asset Name, Preview, Export Package, and
// Display are added below as their own small, focused functions rather
// than one growing `validateMarketplaceSeo` — each takes exactly the real
// data it needs and nothing more, so a caller that only has a filename (no
// preview image yet, say) can still validate what it does have. Also adds
// a third `'suggestion'` severity: a real, non-blocking tier for "this
// would look better" advice (Section 3's own explicit 3-tier ask), never
// mixed into `isMarketplaceReady`'s pass/fail gate — only errors/warnings
// bear on whether a listing is actually submittable, same as before.

export type ValidationSeverity = 'error' | 'warning' | 'suggestion';

export interface ValidationIssue {
  code:
    | 'titleTooShort'
    | 'titleTooLong'
    | 'descriptionMissing'
    | 'keywordsMissing'
    | 'keywordsTooMany'
    | 'duplicateKeywords'
    | 'keywordTooLong'
    | 'filenameInvalid'
    | 'filenameTooLong'
    | 'collectionNameMissing'
    | 'collectionNameTooLong'
    | 'assetNameMissing'
    | 'assetNameTooLong'
    | 'previewTooSmall'
    | 'previewFormatMismatch'
    | 'exportPackageMissingFiles'
    | 'titleNearLimit'
    | 'descriptionNearLimit';
  severity: ValidationSeverity;
  message: string;
}

const FILENAME_SAFE = /^[a-z0-9-]+\.(svg|eps)$/;

/** Fraction of a field's max length past which it's flagged as "close
 * enough to the limit to risk truncation on the marketplace's own listing
 * page" — a `'suggestion'`, not a blocker (Section 3, "Display"). */
const NEAR_LIMIT_FRACTION = 0.9;

export function validateMarketplaceSeo(seo: MarketplaceSeo, profile: MarketplaceProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { titleRules, descriptionRules, keywordRules, filenameRules } = profile;

  if (seo.title.length < titleRules.minLength) {
    issues.push({
      code: 'titleTooShort',
      severity: 'error',
      message: `Title สั้นเกินไป (${seo.title.length} ตัวอักษร ต้องอย่างน้อย ${titleRules.minLength})`,
    });
  } else if (seo.title.length > titleRules.maxLength) {
    issues.push({
      code: 'titleTooLong',
      severity: 'error',
      message: `Title ยาวเกินไป (${seo.title.length} ตัวอักษร เกินขีดจำกัด ${titleRules.maxLength})`,
    });
  }

  if (descriptionRules.required && seo.description.trim().length === 0) {
    issues.push({ code: 'descriptionMissing', severity: 'error', message: 'ยังไม่มี Description ทั้งที่เว็บนี้ต้องการ' });
  } else if (descriptionRules.required && seo.description.length < descriptionRules.minLength) {
    issues.push({
      code: 'descriptionMissing',
      severity: 'warning',
      message: `Description สั้นเกินไป (${seo.description.length} ตัวอักษร แนะนำอย่างน้อย ${descriptionRules.minLength})`,
    });
  }

  if (seo.keywords.length < keywordRules.minCount) {
    issues.push({
      code: 'keywordsMissing',
      severity: 'warning',
      message: `${keywordRules.termLabel === 'tags' ? 'Tags' : 'Keywords'} มีแค่ ${seo.keywords.length} คำ (แนะนำอย่างน้อย ${keywordRules.minCount})`,
    });
  }
  if (seo.keywords.length > keywordRules.maxCount) {
    issues.push({
      code: 'keywordsTooMany',
      severity: 'error',
      message: `${keywordRules.termLabel === 'tags' ? 'Tags' : 'Keywords'} เกินขีดจำกัด (${seo.keywords.length}/${keywordRules.maxCount})`,
    });
  }
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const k of seo.keywords) {
    const lower = k.toLowerCase();
    if (seen.has(lower)) duplicates.add(lower);
    seen.add(lower);
  }
  if (duplicates.size > 0) {
    issues.push({ code: 'duplicateKeywords', severity: 'warning', message: `มีคำซ้ำ ${duplicates.size} คำ: ${[...duplicates].slice(0, 5).join(', ')}` });
  }
  if (keywordRules.maxKeywordLength) {
    const tooLong = seo.keywords.filter((k) => k.length > keywordRules.maxKeywordLength!);
    if (tooLong.length > 0) {
      issues.push({
        code: 'keywordTooLong',
        severity: 'error',
        message: `มี ${tooLong.length} คำยาวเกิน ${keywordRules.maxKeywordLength} ตัวอักษรต่อคำ: ${tooLong.slice(0, 3).join(', ')}`,
      });
    }
  }

  if (!FILENAME_SAFE.test(seo.filename)) {
    issues.push({ code: 'filenameInvalid', severity: 'error', message: `ชื่อไฟล์มีอักขระที่ไม่ปลอดภัยสำหรับอัปโหลด: ${seo.filename}` });
  }
  if (seo.filename.length > filenameRules.maxLength + filenameRules.extension.length + 1) {
    issues.push({
      code: 'filenameTooLong',
      severity: 'warning',
      message: `ชื่อไฟล์ยาว ${seo.filename.length} ตัวอักษร (แนะนำไม่เกิน ${filenameRules.maxLength})`,
    });
  }

  return issues;
}

/** Section 3, "Collection Name" — checked against the profile's
 * `collectionNamingRules.maxLength`. Missing is a `'suggestion'`, not an
 * error: no marketplace's own upload form has a literal "Collection Name"
 * field (it's this app's own organizational concept), so an empty name
 * never blocks a real submission the way a missing Title would. */
export function validateCollectionName(collectionName: string, profile: MarketplaceProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const trimmed = collectionName.trim();
  if (trimmed.length === 0) {
    issues.push({ code: 'collectionNameMissing', severity: 'suggestion', message: 'ยังไม่ได้ตั้งชื่อ Collection — ช่วยให้จัดกลุ่ม/ค้นหาชิ้นงานที่เกี่ยวข้องกันง่ายขึ้น' });
  } else if (trimmed.length > profile.collectionNamingRules.maxLength) {
    issues.push({
      code: 'collectionNameTooLong',
      severity: 'warning',
      message: `ชื่อ Collection ยาว ${trimmed.length} ตัวอักษร (แนะนำไม่เกิน ${profile.collectionNamingRules.maxLength})`,
    });
  }
  return issues;
}

/** Section 3, "Asset Name" — the human-readable label for one asset within
 * a collection (distinct from its filename, which `validateMarketplaceSeo`
 * already checks). Reuses `titleRules.maxLength` as a defensible ceiling
 * (an asset name typically appears in the same kind of UI context a title
 * does) rather than inventing a separate, unverified limit. */
export function validateAssetName(assetName: string, profile: MarketplaceProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const trimmed = assetName.trim();
  if (trimmed.length === 0) {
    issues.push({ code: 'assetNameMissing', severity: 'warning', message: 'ชิ้นงานนี้ยังไม่มีชื่อ' });
  } else if (trimmed.length > profile.titleRules.maxLength) {
    issues.push({
      code: 'assetNameTooLong',
      severity: 'warning',
      message: `ชื่อชิ้นงานยาว ${trimmed.length} ตัวอักษร (แนะนำไม่เกิน ${profile.titleRules.maxLength})`,
    });
  }
  return issues;
}

export interface PreviewInput {
  width: number;
  height: number;
  format: string;
}

/** Section 3, "Preview" — checks a real preview image's dimensions/format
 * against `profile.previewRequirements`. A too-small preview is an
 * `'error'` (most marketplaces reject an upload below their published
 * minimum outright); a format that doesn't match the profile's preferred
 * one is only a `'warning'` — most of these sites accept more than one
 * raster format in practice, this app just has one documented default per
 * marketplace. */
export function validatePreview(preview: PreviewInput, profile: MarketplaceProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { minWidth, minHeight, format } = profile.previewRequirements;
  if (preview.width < minWidth || preview.height < minHeight) {
    issues.push({
      code: 'previewTooSmall',
      severity: 'error',
      message: `พรีวิวขนาด ${preview.width}x${preview.height} เล็กกว่าขั้นต่ำที่แนะนำ ${minWidth}x${minHeight}`,
    });
  }
  if (preview.format.toLowerCase() !== format.toLowerCase()) {
    issues.push({
      code: 'previewFormatMismatch',
      severity: 'warning',
      message: `พรีวิวเป็นไฟล์ .${preview.format} แต่เว็บนี้แนะนำ .${format}`,
    });
  }
  return issues;
}

/** Section 3, "Export Package" — checks that every file
 * `profile.exportPackageFiles` names is actually present in the package
 * being assembled. Real set-difference against the profile's own required
 * list, not a guess. */
export function validateExportPackage(packageFiles: string[], profile: MarketplaceProfile): ValidationIssue[] {
  const present = new Set(packageFiles);
  const missing = profile.exportPackageFiles.filter((f) => !present.has(f));
  if (missing.length === 0) return [];
  return [{ code: 'exportPackageMissingFiles', severity: 'error', message: `แพ็กเกจขาดไฟล์ที่จำเป็น: ${missing.join(', ')}` }];
}

/** Section 3, "Display" — flags title/description that are close enough
 * to their marketplace's own max length to risk looking cut off wherever
 * that marketplace truncates long listings (search results, thumbnails).
 * Always `'suggestion'` severity: nothing here is actually invalid, it's
 * a readability heads-up computed from the field's own real length versus
 * the profile's own real limit. */
export function validateDisplay(seo: MarketplaceSeo, profile: MarketplaceProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const titleThreshold = profile.titleRules.maxLength * NEAR_LIMIT_FRACTION;
  if (seo.title.length <= profile.titleRules.maxLength && seo.title.length >= titleThreshold) {
    issues.push({
      code: 'titleNearLimit',
      severity: 'suggestion',
      message: `Title ใกล้ขีดจำกัดแล้ว (${seo.title.length}/${profile.titleRules.maxLength}) — อาจถูกตัดในหน้าแสดงผลของบางเว็บ`,
    });
  }
  if (profile.descriptionRules.required) {
    const descThreshold = profile.descriptionRules.maxLength * NEAR_LIMIT_FRACTION;
    if (seo.description.length <= profile.descriptionRules.maxLength && seo.description.length >= descThreshold && descThreshold > 0) {
      issues.push({
        code: 'descriptionNearLimit',
        severity: 'suggestion',
        message: `Description ใกล้ขีดจำกัดแล้ว (${seo.description.length}/${profile.descriptionRules.maxLength}) — อาจถูกตัดในหน้าแสดงผลของบางเว็บ`,
      });
    }
  }
  return issues;
}

export interface MarketplaceSubmissionInput {
  seo: MarketplaceSeo;
  /** Any of these are omitted when the caller doesn't have that data yet
   * (e.g. no preview rendered) — the corresponding check is simply skipped,
   * never a false failure. */
  collectionName?: string;
  assetName?: string;
  preview?: PreviewInput;
  packageFiles?: string[];
}

/** Section 3's full validation surface in one call — Title/Description/
 * Keywords/Filename (via `validateMarketplaceSeo`) plus every field in
 * `input` that's actually present (Collection Name/Asset Name/Preview/
 * Export Package), plus Display's near-limit suggestions. Never runs a
 * check it doesn't have real data for. */
export function validateMarketplaceSubmission(input: MarketplaceSubmissionInput, profile: MarketplaceProfile): ValidationIssue[] {
  const issues: ValidationIssue[] = [
    ...validateMarketplaceSeo(input.seo, profile),
    ...validateDisplay(input.seo, profile),
  ];
  if (input.collectionName !== undefined) issues.push(...validateCollectionName(input.collectionName, profile));
  if (input.assetName !== undefined) issues.push(...validateAssetName(input.assetName, profile));
  if (input.preview !== undefined) issues.push(...validatePreview(input.preview, profile));
  if (input.packageFiles !== undefined) issues.push(...validateExportPackage(input.packageFiles, profile));
  return issues;
}

export function isMarketplaceReady(issues: ValidationIssue[]): boolean {
  return !issues.some((i) => i.severity === 'error');
}
