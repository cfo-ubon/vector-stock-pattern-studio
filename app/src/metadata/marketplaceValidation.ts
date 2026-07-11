import type { MarketplaceSeo } from './marketplaceSeo';
import type { MarketplaceProfile } from './marketplaceProfiles';

// Marketplace Validation — checks a generated (or user-edited) SEO package
// against its own marketplace profile's rules, instead of a fixed set of
// checks with numbers hardcoded inline (the old approach in
// metadata/submissionCenter.ts's SITE_LIMITS table, which this module now
// supersedes as the single source of validation rules — submissionCenter.ts
// reads the same MARKETPLACE_PROFILES this validates against).

export type ValidationSeverity = 'error' | 'warning';

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
    | 'filenameTooLong';
  severity: ValidationSeverity;
  message: string;
}

const FILENAME_SAFE = /^[a-z0-9-]+\.(svg|eps)$/;

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

export function isMarketplaceReady(issues: ValidationIssue[]): boolean {
  return !issues.some((i) => i.severity === 'error');
}
