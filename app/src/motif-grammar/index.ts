import geometric from './geometric.json';
import botanical from './botanical.json';
import organic from './organic.json';
import tropical from './tropical.json';
import boho from './boho.json';
import lineart from './lineart.json';
import mandala from './mandala.json';
import damask from './damask.json';
import cute from './cute.json';
import seasonal from './seasonal.json';
import retro from './retro.json';
import plaid from './plaid.json';
import animalprint from './animalprint.json';
import paisley from './paisley.json';
import terrazzo from './terrazzo.json';

// Motif Grammar Library — new in Design Intelligence Core Phase 1.
// Composition rules *within* one motif family/category (which roles/
// complexity levels/orientation freedoms are valid, and which Pattern
// Grammars this category composes well with) — formalizes rules that
// were previously implicit per-generator (generators/*.ts) as externally-
// editable data. `family`/`defaultMotifSize`/`recommendedDensity`/
// `disableGridRhythm` are ported 1:1 from the real, unmodified
// generators/index.ts + engine/motifFactory.ts source of truth.

export interface MotifGrammarRule {
  id: string;
  description: string;
  severity: 'error' | 'warning';
}

export interface MotifGrammarData {
  id: string;
  label: string;
  family: 'flower' | 'leaf' | 'branch' | 'berry' | 'icon' | 'decorative' | 'background' | 'geometric';
  defaultMotifSize: number;
  recommendedDensity?: number;
  complexityLevels: Array<'simple' | 'moderate' | 'intricate'>;
  roles: Array<'hero' | 'secondary' | 'filler' | 'accent'>;
  rotationAllowed: boolean;
  mirrorAllowed: boolean;
  disableGridRhythm: boolean;
  compatiblePatternGrammars: string[];
  rules: MotifGrammarRule[];
}

export const MOTIF_GRAMMAR_DATA: MotifGrammarData[] = [
  geometric, botanical, organic, tropical, boho, lineart, mandala, damask,
  cute, seasonal, retro, plaid, animalprint, paisley, terrazzo,
] as MotifGrammarData[];

export const MOTIF_GRAMMAR_DATA_BY_ID: Record<string, MotifGrammarData> = Object.fromEntries(
  MOTIF_GRAMMAR_DATA.map((g) => [g.id, g]),
);
