import { GENERATORS } from '../generators';
import { LAYOUTS } from '../layouts';
import { PALETTES } from '../palettes/palettes';
import { STYLE_DNA_PRESETS } from '../engine/styleDna';
import { MARKETPLACE_PROFILES } from '../metadata/marketplaceProfiles';
import type { DesignSpecification } from './designSpecTypes';

// Design Specification "Schema Check" (Section 6's JSON Editor requires
// Tree View / Code View / Validation / Schema Check / Undo / Redo — this
// module is the Validation + Schema Check half; the editor UI itself is a
// later phase). Two levels on purpose: `parseDesignSpecificationJson`
// rejects a document that isn't even shaped like a DesignSpecification
// (used on import — same "throw with a Thai message" convention as
// trendPacks.ts/projectJson.ts); `validateDesignSpecification` accepts a
// structurally-valid spec and reports *semantic* problems (a category id
// that doesn't exist, a density outside 0..1) as warnings/errors a JSON
// Editor can highlight without blocking editing.

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  path: string;
  message: string;
  severity: ValidationSeverity;
}

const REQUIRED_TOP_LEVEL_KEYS: Array<keyof DesignSpecification> = [
  'schemaVersion',
  'project',
  'collection',
  'marketplace',
  'trend',
  'keywordBundle',
  'styleDnaId',
  'palette',
  'colorRoles',
  'composition',
  'repeatType',
  'density',
  'hierarchy',
  'flow',
  'rhythm',
  'negativeSpace',
  'heroMotifs',
  'secondaryMotifs',
  'fillers',
  'background',
  'svgHints',
  'seoHints',
  'exportHints',
  'qualityTargets',
];

/** Parses a JSON string into a `DesignSpecification`, throwing (Thai
 * message, matching every other import validator in this app) if it isn't
 * even shape-valid — every required top-level key present, with the right
 * primitive/array/object kind. Does not check semantic validity (real
 * category/layout/palette ids etc.) — call `validateDesignSpecification`
 * on the result for that. */
export function parseDesignSpecificationJson(json: string): DesignSpecification {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('ไฟล์ Design Specification ไม่ใช่ JSON ที่ถูกต้อง');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('ไฟล์ Design Specification ต้องเป็น object');
  }
  const doc = parsed as Record<string, unknown>;
  const missing = REQUIRED_TOP_LEVEL_KEYS.filter((key) => !(key in doc));
  if (missing.length > 0) {
    throw new Error(`Design Specification ขาดฟิลด์ที่จำเป็น: ${missing.join(', ')}`);
  }
  return doc as unknown as DesignSpecification;
}

function issue(path: string, message: string, severity: ValidationSeverity = 'error'): ValidationIssue {
  return { path, message, severity };
}

/** Semantic validation over an already shape-valid `DesignSpecification` —
 * every id referenced actually exists in the relevant real registry
 * (generators/layouts/palettes/Style DNA/Marketplace Profiles), and every
 * 0..1-ranged number is actually in range. Returns an empty array for a
 * fully healthy spec. `error` issues mean generation would likely produce
 * broken/undefined output; `warning` issues are stylistically odd but
 * would still generate something. */
export function validateDesignSpecification(spec: DesignSpecification): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!GENERATORS[spec.keywordBundle.patternType]) {
    issues.push(issue('keywordBundle.patternType', `ไม่รู้จักหมวดลาย "${spec.keywordBundle.patternType}"`));
  }
  for (const ref of [...spec.heroMotifs, ...spec.secondaryMotifs, ...spec.fillers]) {
    if (!GENERATORS[ref.categoryId]) {
      issues.push(issue(`motifs.${ref.role}.${ref.categoryId}`, `ไม่รู้จักหมวดลาย "${ref.categoryId}"`));
    }
  }
  if (!LAYOUTS[spec.repeatType]) {
    issues.push(issue('repeatType', `ไม่รู้จัก layout "${spec.repeatType}"`));
  }
  if (!PALETTES.some((p) => p.id === spec.palette.id)) {
    issues.push(issue('palette.id', `ไม่รู้จัก palette "${spec.palette.id}"`));
  }
  if (!STYLE_DNA_PRESETS[spec.styleDnaId]) {
    issues.push(issue('styleDnaId', `ไม่รู้จัก Style DNA "${spec.styleDnaId}"`, 'warning'));
  }
  if (!MARKETPLACE_PROFILES[spec.marketplace.id]) {
    issues.push(issue('marketplace.id', `ไม่รู้จัก marketplace "${spec.marketplace.id}"`));
  }
  if (spec.trend && spec.trend.trendPackId.trim() === '') {
    issues.push(issue('trend.trendPackId', 'trendPackId ว่างเปล่า', 'warning'));
  }

  const inUnitRange = (path: string, value: number) => {
    if (value < 0 || value > 1) issues.push(issue(path, `ค่าควรอยู่ระหว่าง 0-1 แต่ได้ ${value}`));
  };
  inUnitRange('density', spec.density);
  inUnitRange('negativeSpace', spec.negativeSpace);
  inUnitRange('svgHints.scaleJitter', spec.svgHints.scaleJitter);

  if (spec.collection.size <= 0) issues.push(issue('collection.size', 'collection.size ต้องมากกว่า 0'));
  if (spec.collection.assetTypes.length === 0) issues.push(issue('collection.assetTypes', 'ยังไม่ได้เลือกชนิดชิ้นงานสักชิ้น', 'warning'));
  if (spec.exportHints.exportFormats.length === 0) issues.push(issue('exportHints.exportFormats', 'ยังไม่ได้กำหนดฟอร์แมต export', 'warning'));

  const colorSet = new Set(spec.palette.colors);
  for (const [role, hex] of Object.entries(spec.colorRoles)) {
    if (!colorSet.has(hex)) issues.push(issue(`colorRoles.${role}`, `สี ${hex} ไม่อยู่ใน palette ที่เลือก`, 'warning'));
  }

  return issues;
}

export function isDesignSpecificationValid(issues: ValidationIssue[]): boolean {
  return issues.every((i) => i.severity !== 'error');
}
