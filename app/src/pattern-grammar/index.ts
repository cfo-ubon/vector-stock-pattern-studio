import airy from './airy.json';
import balanced from './balanced.json';
import dense from './dense.json';
import editorial from './editorial.json';
import maximalist from './maximalist.json';
import minimal from './minimal.json';

// Pattern Grammar Library — new in Design Intelligence Core Phase 1.
// Formalizes what previously lived only as an implicit lookup table
// inside trend/designIntelligence.ts (COMPOSITION_STYLE_TO_HIERARCHY,
// COMPOSITION_STYLE_NEGATIVE_SPACE) as externally-editable data: for each
// Composition Style, which layouts/hierarchy/density/negative-space/flow/
// rhythm combinations are valid together, plus named constraint rules a
// Design Specification using this style should satisfy.

export interface PatternGrammarRule {
  id: string;
  description: string;
  severity: 'error' | 'warning';
}

export interface PatternGrammarData {
  id: 'airy' | 'balanced' | 'dense' | 'editorial' | 'maximalist' | 'minimal';
  label: string;
  description: string;
  compatibleLayouts: string[];
  hierarchyPreset: string;
  densityRange: { min: number; max: number };
  negativeSpaceRange: { min: number; max: number };
  compatibleFlowProfiles: string[];
  compatibleRhythmProfiles: string[];
  rules: PatternGrammarRule[];
}

export const PATTERN_GRAMMAR_DATA: PatternGrammarData[] = [airy, balanced, dense, editorial, maximalist, minimal] as PatternGrammarData[];

export const PATTERN_GRAMMAR_DATA_BY_ID: Record<string, PatternGrammarData> = Object.fromEntries(
  PATTERN_GRAMMAR_DATA.map((g) => [g.id, g]),
);
