// AI-SBOS Multi-Version Release — this file exists ONLY on the frozen v1
// release build branch (build/ai-sbos-v1-release), never merged back into
// the main development line. It is the one, single source of truth this
// v1 build reads for its own version identity — added here, on top of the
// immutable `release/ai-sbos-v1-stable` tag/branch (commit `6f4c048`),
// as a minimal, additive, UI-only patch. No business logic in this
// codebase was touched to add this file.
//
// Product version assigned retroactively per AI_SBOS_VERSION_AUDIT.md's
// semantic-versioning policy: this commit is the last one before the
// AI-SBOS product rebrand, sitting on top of the real "Hotfix v1.0.2"
// release plus Design Refinement Studio Pro's 5 capability milestones
// (each a MINOR bump on the v1.0.2 baseline: v1.1.0 .. v1.5.0).

export const PRODUCT_NAME = 'AI-SBOS';
export const PRODUCT_VERSION = '1.5.0';
export const VERSION_STATUS: 'Stable / Legacy' | 'Current' = 'Stable / Legacy';
export const BUILD_NAME = 'Design Refinement Studio Pro — Milestone 6 (final)';
export const RELEASE_DATE = '2026-08-07';
export const RELEASE_COMMIT = '6f4c048';
export const SHORT_DESCRIPTION =
  'The certified, regression-tested production baseline before the AI-SBOS rebrand: Production Mode, Commercial Pipeline, Decision OS, Factory Orchestrator, and Design Refinement Studio Pro (Design Edit Mode, AI Design Coach, Version Control + Compare Center, Batch Refinement, Pattern Safety).';

/** Where "Switch Version" returns to — the Version Selector one level up
 * from this build's own base path (`/vector-stock-pattern-studio/studio/v1/`). */
export const VERSION_SELECTOR_PATH = '../';
