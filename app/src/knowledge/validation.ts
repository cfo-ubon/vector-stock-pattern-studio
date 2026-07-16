import {
  validateStyleDnaData,
  validateMotifGrammarData,
  validatePatternGrammarData,
  validateColorRoleSystemData,
  validatePaletteData,
  validateMarketplaceProfileData,
  validateRejectRulesData,
  validateLearningHistoryData,
  type ValidationIssue,
} from '../validators';
import { STYLE_DNA_DATA } from '../style-dna';
import { MOTIF_GRAMMAR_DATA } from '../motif-grammar';
import { PATTERN_GRAMMAR_DATA } from '../pattern-grammar';
import { COLOR_ROLE_SYSTEM_DATA, PALETTE_DATA } from '../color-roles';
import { MARKETPLACE_DATA } from '../marketplaces';
import { LAYOUTS } from '../layouts';
import { HIERARCHY_PRESETS } from '../engine/hierarchy';
import { REJECT_RULES } from './rules';
import { DEFAULT_LEARNING_HISTORY } from './history';

// Design Knowledge Engine (Phase 6.5) — Section 12 "Validation". Two real
// checks, both reusing the *same* schema/validator machinery every other
// domain in this app already uses (`validators/index.ts`'s
// `SCHEMA_REGISTRY` + `makeValidator` pattern) — no second validation
// engine:
//
// 1. `validateAllKnowledge()` — every real knowledge data file against its
//    own JSON Schema (the same validators `validators/index.test.ts`
//    already exercises per-domain; this is a single entry point covering
//    all of them at once, which didn't exist before this phase).
// 2. `validateKnowledgeRelationships()` — genuinely new: cross-domain id
//    references (Style DNA -> Palette/Motif Category/Layout/Hierarchy
//    Preset, Motif Grammar -> Pattern Grammar, Pattern Grammar -> Layout/
//    Hierarchy Preset) actually resolve to a real record in the other
//    domain. Schema validation alone can't catch this (a schema only
//    knows its own file's shape); this walks the real, already-loaded
//    data structures to check that every foreign-key-like reference in
//    the knowledge base isn't silently dangling.

export interface KnowledgeValidationResult {
  domain: string;
  id: string;
  issues: ValidationIssue[];
}

/** Runs the real schema validator for every knowledge domain's real data
 * files. Always one entry per checked record (issues: [] when clean), so
 * a caller can report full coverage, not just failures. */
export function validateAllKnowledge(): KnowledgeValidationResult[] {
  const results: KnowledgeValidationResult[] = [];
  for (const dna of STYLE_DNA_DATA) results.push({ domain: 'style', id: dna.id, issues: validateStyleDnaData(dna) });
  for (const g of MOTIF_GRAMMAR_DATA) results.push({ domain: 'motif', id: g.id, issues: validateMotifGrammarData(g) });
  for (const g of PATTERN_GRAMMAR_DATA) results.push({ domain: 'pattern', id: g.id, issues: validatePatternGrammarData(g) });
  results.push({ domain: 'palette', id: 'colorRoleSystem', issues: validateColorRoleSystemData(COLOR_ROLE_SYSTEM_DATA) });
  for (const p of PALETTE_DATA) results.push({ domain: 'palette', id: p.id, issues: validatePaletteData(p) });
  for (const m of MARKETPLACE_DATA) results.push({ domain: 'marketplace', id: m.id, issues: validateMarketplaceProfileData(m) });
  results.push({ domain: 'rules', id: 'rejectRules', issues: validateRejectRulesData(REJECT_RULES) });
  results.push({ domain: 'history', id: 'defaultLearningHistory', issues: validateLearningHistoryData(DEFAULT_LEARNING_HISTORY) });
  return results;
}

export function isAllKnowledgeValid(): boolean {
  return validateAllKnowledge().every((r) => r.issues.length === 0);
}

/** Cross-domain referential-integrity check — see module header. Always
 * one entry per checked record (issues: [] when every reference resolves). */
export function validateKnowledgeRelationships(): KnowledgeValidationResult[] {
  const results: KnowledgeValidationResult[] = [];
  const realPaletteIds = new Set<string>(PALETTE_DATA.map((p) => p.id));
  const realCategoryIds = new Set<string>(MOTIF_GRAMMAR_DATA.map((g) => g.id));
  const realLayoutIds = new Set<string>(Object.keys(LAYOUTS));
  const realHierarchyPresets = new Set<string>(Object.keys(HIERARCHY_PRESETS));
  const realPatternGrammarIds = new Set<string>(PATTERN_GRAMMAR_DATA.map((g) => g.id));

  for (const dna of STYLE_DNA_DATA) {
    const issues: ValidationIssue[] = [];
    for (const paletteId of dna.paletteIds) {
      if (!realPaletteIds.has(paletteId)) issues.push({ path: 'paletteIds', message: `references unknown palette "${paletteId}"` });
    }
    for (const categoryId of dna.categories) {
      if (!realCategoryIds.has(categoryId)) issues.push({ path: 'categories', message: `references unknown motif category "${categoryId}"` });
    }
    for (const layoutId of dna.layouts) {
      if (!realLayoutIds.has(layoutId)) issues.push({ path: 'layouts', message: `references unknown layout "${layoutId}"` });
    }
    if (!realHierarchyPresets.has(dna.hierarchyPreset)) {
      issues.push({ path: 'hierarchyPreset', message: `references unknown hierarchy preset "${dna.hierarchyPreset}"` });
    }
    results.push({ domain: 'style', id: dna.id, issues });
  }

  for (const g of MOTIF_GRAMMAR_DATA) {
    const issues: ValidationIssue[] = [];
    for (const pgId of g.compatiblePatternGrammars) {
      if (!realPatternGrammarIds.has(pgId)) issues.push({ path: 'compatiblePatternGrammars', message: `references unknown pattern grammar "${pgId}"` });
    }
    results.push({ domain: 'motif', id: g.id, issues });
  }

  for (const g of PATTERN_GRAMMAR_DATA) {
    const issues: ValidationIssue[] = [];
    for (const layoutId of g.compatibleLayouts) {
      if (!realLayoutIds.has(layoutId)) issues.push({ path: 'compatibleLayouts', message: `references unknown layout "${layoutId}"` });
    }
    if (!realHierarchyPresets.has(g.hierarchyPreset)) {
      issues.push({ path: 'hierarchyPreset', message: `references unknown hierarchy preset "${g.hierarchyPreset}"` });
    }
    results.push({ domain: 'pattern', id: g.id, issues });
  }

  return results;
}

export function isKnowledgeRelationshipsValid(): boolean {
  return validateKnowledgeRelationships().every((r) => r.issues.length === 0);
}
