import { TREND_PACK_DATA_BY_ID } from '../trend-packs';
import { MARKETPLACE_DATA_BY_ID } from '../marketplaces';
import { STYLE_DNA_DATA_BY_ID } from '../style-dna';
import { PATTERN_GRAMMAR_DATA_BY_ID } from '../pattern-grammar';
import { MOTIF_GRAMMAR_DATA_BY_ID } from '../motif-grammar';
import { COLOR_ROLE_SYSTEM_DATA } from '../color-roles';
import type { ValidationIssue } from './jsonSchemaValidator';

// Relationship + marketplace-compatibility validator (Design Intelligence
// Core Phase 1, deliverable 10's explicitly-required "Relationships" and
// "Marketplace compatibility" checks). `validateAgainstSchema` (see
// jsonSchemaValidator.ts) only checks one JSON document's own shape in
// isolation — it has no notion that a Design Specification's
// `styleDnaId` must actually name a real Style DNA entry, or that its
// `composition` must be a Pattern Grammar whose `compatibleLayouts`
// really includes its `repeatType`. This module cross-checks a Design
// Specification-shaped object against the other 5 data libraries
// (trend-packs, marketplaces, style-dna, pattern-grammar, motif-grammar,
// color-roles) for exactly those cross-reference and compatibility rules.
//
// Deliberately structural (not importing trend/designSpecTypes.ts's
// `DesignSpecification` type) so this validator stays usable standalone
// against any object with this shape — including a plain JSON document
// loaded at runtime — without creating a compile-time dependency on the
// already-shipped trend/* module (which this milestone must not modify).

export interface DesignSpecMotifRefLike {
  categoryId: string;
  role: 'hero' | 'secondary' | 'filler' | 'accent';
}

export interface DesignSpecificationRelationshipInput {
  marketplace: { id: string };
  trend: { trendPackId: string } | null;
  styleDnaId: string;
  palette: { colors: string[] };
  composition: string;
  repeatType: string;
  density: number;
  negativeSpace: number;
  flow: string;
  rhythm: string;
  heroMotifs: DesignSpecMotifRefLike[];
  secondaryMotifs: DesignSpecMotifRefLike[];
  fillers: DesignSpecMotifRefLike[];
  exportHints: { exportFormats: string[] };
}

function inRange(value: number, range: { min: number; max: number }): boolean {
  return value >= range.min && value <= range.max;
}

/** Checks every motif reference (hero + secondary + fillers) against the
 * Motif Grammar Library: the referenced category must exist, must allow
 * the role it's used in, and must list the spec's Pattern Grammar
 * (`composition`) as compatible. */
function validateMotifRefs(
  refs: DesignSpecMotifRefLike[],
  listName: string,
  composition: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  refs.forEach((ref, i) => {
    const path = `$.${listName}[${i}]`;
    const grammar = MOTIF_GRAMMAR_DATA_BY_ID[ref.categoryId];
    if (!grammar) {
      issues.push({ path: `${path}.categoryId`, message: `Unknown motif category "${ref.categoryId}" (no matching Motif Grammar entry)` });
      return;
    }
    if (!grammar.roles.includes(ref.role)) {
      issues.push({ path: `${path}.role`, message: `Motif Grammar "${ref.categoryId}" does not allow role "${ref.role}" (allowed: ${grammar.roles.join(', ')})` });
    }
    if (!grammar.compatiblePatternGrammars.includes(composition)) {
      issues.push({
        path: `${path}.categoryId`,
        message: `Motif Grammar "${ref.categoryId}" is not compatible with Pattern Grammar "${composition}" (compatible: ${grammar.compatiblePatternGrammars.join(', ')})`,
      });
    }
  });
  return issues;
}

/** Cross-schema relationship + marketplace-compatibility checks for one
 * Design Specification-shaped object. Complements (does not replace)
 * `validateDesignSpecificationData` from `validators/index.ts`, which
 * only checks the document's own shape. */
export function validateDesignSpecificationRelationships(
  spec: DesignSpecificationRelationshipInput,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const marketplace = MARKETPLACE_DATA_BY_ID[spec.marketplace.id];
  if (!marketplace) {
    issues.push({ path: '$.marketplace.id', message: `Unknown marketplace "${spec.marketplace.id}"` });
  } else {
    const compatibleFormats = spec.exportHints.exportFormats.filter((fmt) => fmt === marketplace.filenameRules.extension);
    if (compatibleFormats.length === 0) {
      issues.push({
        path: '$.exportHints.exportFormats',
        message: `None of [${spec.exportHints.exportFormats.join(', ')}] match marketplace "${spec.marketplace.id}"'s required export extension "${marketplace.filenameRules.extension}"`,
      });
    }
  }

  if (spec.trend && !TREND_PACK_DATA_BY_ID[spec.trend.trendPackId]) {
    issues.push({ path: '$.trend.trendPackId', message: `Unknown trend pack "${spec.trend.trendPackId}"` });
  }

  if (!STYLE_DNA_DATA_BY_ID[spec.styleDnaId]) {
    issues.push({ path: '$.styleDnaId', message: `Unknown Style DNA "${spec.styleDnaId}"` });
  }

  if (spec.palette.colors.length < COLOR_ROLE_SYSTEM_DATA.minPaletteColors) {
    issues.push({
      path: '$.palette.colors',
      message: `Palette has ${spec.palette.colors.length} colors, fewer than the Color Role System's minPaletteColors (${COLOR_ROLE_SYSTEM_DATA.minPaletteColors})`,
    });
  }

  const patternGrammar = PATTERN_GRAMMAR_DATA_BY_ID[spec.composition];
  if (!patternGrammar) {
    issues.push({ path: '$.composition', message: `Unknown composition style "${spec.composition}" (no matching Pattern Grammar entry)` });
  } else {
    if (!patternGrammar.compatibleLayouts.includes(spec.repeatType)) {
      issues.push({
        path: '$.repeatType',
        message: `Layout "${spec.repeatType}" is not compatible with Pattern Grammar "${spec.composition}" (compatible: ${patternGrammar.compatibleLayouts.join(', ')})`,
      });
    }
    if (!inRange(spec.density, patternGrammar.densityRange)) {
      issues.push({
        path: '$.density',
        message: `Density ${spec.density} is outside Pattern Grammar "${spec.composition}"'s densityRange [${patternGrammar.densityRange.min}, ${patternGrammar.densityRange.max}]`,
      });
    }
    if (!inRange(spec.negativeSpace, patternGrammar.negativeSpaceRange)) {
      issues.push({
        path: '$.negativeSpace',
        message: `negativeSpace ${spec.negativeSpace} is outside Pattern Grammar "${spec.composition}"'s negativeSpaceRange [${patternGrammar.negativeSpaceRange.min}, ${patternGrammar.negativeSpaceRange.max}]`,
      });
    }
    if (!patternGrammar.compatibleFlowProfiles.includes(spec.flow)) {
      issues.push({
        path: '$.flow',
        message: `Flow profile "${spec.flow}" is not compatible with Pattern Grammar "${spec.composition}" (compatible: ${patternGrammar.compatibleFlowProfiles.join(', ')})`,
      });
    }
    if (!patternGrammar.compatibleRhythmProfiles.includes(spec.rhythm)) {
      issues.push({
        path: '$.rhythm',
        message: `Rhythm profile "${spec.rhythm}" is not compatible with Pattern Grammar "${spec.composition}" (compatible: ${patternGrammar.compatibleRhythmProfiles.join(', ')})`,
      });
    }

    issues.push(...validateMotifRefs(spec.heroMotifs, 'heroMotifs', spec.composition));
    issues.push(...validateMotifRefs(spec.secondaryMotifs, 'secondaryMotifs', spec.composition));
    issues.push(...validateMotifRefs(spec.fillers, 'fillers', spec.composition));
  }

  return issues;
}
