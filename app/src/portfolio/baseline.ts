import schemaVersionData from '../knowledge/schema_version.json';
import { STYLE_SCHEMA_VERSION } from '../knowledge/registry/styleSchema';
import { SPECIES_SCHEMA_VERSION } from '../knowledge/registry/speciesSchema';
import { PENALTY_SYSTEM_VERSION } from '../engine/penaltyRulesV2';

// Build 013, Section 2 (Frozen Evaluation Baseline). "Freeze Build 012 as
// the comparison baseline" — this module builds one real, machine-readable
// manifest recording exactly which evaluator/knowledge/generator state
// produced a given Portfolio Intelligence run, reusing every already-real
// version source in the codebase (BUILD_013_AUDIT.md's own findings) rather
// than inventing a parallel versioning scheme:
//
//  - `knowledgeVersion`/`styleSchemaVersion`/`speciesSchemaVersion`: read
//    straight from `knowledge/schema_version.json` and the two real schema
//    version constants (`STYLE_SCHEMA_VERSION`/`SPECIES_SCHEMA_VERSION`,
//    Build 008A) — these already exist and are already tested
//    (`styleSchema.test.ts`/`speciesSchema.test.ts` assert they match the
//    JSON file).
//  - `penaltySystemVersion`: the one genuinely new version constant this
//    build adds (`PENALTY_SYSTEM_VERSION`, `engine/penaltyRulesV2.ts`) —
//    Build 012's own Penalty System V2 had never been given an explicit
//    version number before.
//  - `evaluatorCommit`/`generatorCommit`: the real git commit hash HEAD was
//    at when the baseline was captured — the single unambiguous, already-
//    real "what code produced this" pin for the parts of the evaluation
//    (scoring.ts/scoringV2.ts/layoutEvaluation.ts/styleEvaluation.ts/
//    commercialJudgeV2.ts) and generation (tile.ts/layouts/generators)
//    pipelines that have no standalone version constant of their own. This
//    module deliberately does NOT read git itself — `src/portfolio/` is
//    compiled under `tsconfig.app.json` (the browser app bundle, no Node
//    APIs available), so the commit hash is read by the calling Node
//    script (`scripts/portfolioGenerate.ts`, via `execSync('git rev-parse
//    HEAD')`) and passed in — this file stays pure and reusable from either
//    context.
//  - `seedPolicy`: documents the exact deterministic seed convention used,
//    matching the same `<prefix>-<n>` convention every prior large-portfolio
//    script (`commercialRealityCheck.ts`, `build012Regression.ts`) already
//    established — never a new, undocumented seeding scheme.

export interface PortfolioBaselineManifest {
  /** ISO timestamp this manifest was generated. */
  capturedAt: string;
  /** Human-readable label for the frozen build this baseline pins. */
  label: string;
  knowledgeVersion: string;
  styleSchemaVersion: string;
  speciesSchemaVersion: string;
  penaltySystemVersion: number;
  evaluatorCommit: string;
  generatorCommit: string;
  seedPolicy: {
    prefix: string;
    description: string;
  };
  /** Version of the Portfolio Intelligence pattern-record schema itself
   * (`PORTFOLIO_SCHEMA_VERSION`, `src/portfolio/types.ts`) — recorded here
   * too so a manifest is fully self-describing without needing a second
   * file to interpret it. */
  portfolioSchemaVersion: number;
}

export interface PortfolioBaselineOptions {
  /** Real git commit hash, supplied by the calling Node script — 'unknown'
   * when the caller has no git context (e.g. a unit test), never guessed. */
  commit?: string;
  label?: string;
}

/** Builds the frozen baseline manifest for a Portfolio Intelligence run.
 * `seedPrefix`/`seedDescription` let each caller (5,000-pattern generation,
 * a smaller test fixture, etc.) document its own real seed convention
 * without this function guessing one. `portfolioSchemaVersion` is passed in
 * (not imported from `types.ts`) to avoid a circular import between the two
 * sibling modules — both are re-exported together from `src/portfolio/index.ts`. */
export function buildPortfolioBaseline(
  seedPrefix: string,
  seedDescription: string,
  portfolioSchemaVersion: number,
  options: PortfolioBaselineOptions = {},
): PortfolioBaselineManifest {
  const commit = options.commit ?? 'unknown';
  return {
    capturedAt: new Date().toISOString(),
    label: options.label ?? 'Build 012 — Evaluation Intelligence Engine V3',
    knowledgeVersion: schemaVersionData.knowledgeVersion,
    styleSchemaVersion: STYLE_SCHEMA_VERSION,
    speciesSchemaVersion: SPECIES_SCHEMA_VERSION,
    penaltySystemVersion: PENALTY_SYSTEM_VERSION,
    evaluatorCommit: commit,
    generatorCommit: commit,
    seedPolicy: { prefix: seedPrefix, description: seedDescription },
    portfolioSchemaVersion,
  };
}
