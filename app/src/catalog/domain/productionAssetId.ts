import { sha256Hex } from './hash';

// Build 026, Phase 2 — Production Asset Identity. `domain/id.ts`'s
// `generateAssetId` is a random, date-stamped string: correct for what it
// was built for (a stable *storage key* for an imported catalog row), but
// it carries no relationship to the generated design itself — two
// independent imports of the exact same pattern (copied file, re-exported
// ZIP, moved folder) get two different, unrelated `assetId`s, and nothing
// about the ID survives a rename. The brief explicitly requires an
// identity that stays stable "when copied / restarted / archived /
// metadata edited / folders moved / previews regenerated" and forbids
// filename as identity — a random import-time ID satisfies none of that.
//
// `productionAssetId` is a SEPARATE, additional identifier computed from
// the fields that actually define "this is the same generated design":
// generator version/build, style DNA id, preset id, composition type,
// product targets (sorted — order must not matter), the generator seed,
// and a canonical content hash of the produced SVG. It is deliberately
// NOT a replacement for `assetId` (still the IndexedDB primary key,
// unchanged) — `productionAssetId` is an additive field two DIFFERENT
// `PortfolioAsset` rows (e.g. the same design imported twice into
// different collections, or re-imported after a folder move) can share,
// which is exactly the point: it is what lets duplicate detection and
// submission-history lookups recognize "this is the same production
// asset" across storage rows, filenames, and machines.

export interface ProductionAssetIdentityInput {
  generatorVersion: string;
  styleDna: string;
  presetId: string;
  compositionType: string | null;
  productTargets: string[];
  generatorSeed: string;
  /** The canonical, already-generated SVG markup — hashed as-is (no
   * re-serialization/whitespace normalization) so the fingerprint reflects
   * literally what will be submitted, not a lossy paraphrase of it. Two
   * SVGs differing only in cosmetic formatting are intentionally treated
   * as different production assets by this hash (they are caught instead
   * by the separate `normalizedJsonHash`-style content-duplicate check in
   * `duplicateClassification.ts`, which is allowed to be lossier because
   * it is explicitly a *duplicate signal*, not an identity). */
  canonicalSvg: string;
}

/** Deterministic, order-independent canonical string built from the
 * identity inputs — sorting `productTargets` so `['fabric','wallpaper']`
 * and `['wallpaper','fabric']` (same design, differently-ordered array
 * from two import paths) produce the identical fingerprint. Uses
 * `JSON.stringify` on an ordered tuple (not naive string concatenation)
 * so every field is unambiguously length/quote-delimited by the JSON
 * encoding itself — e.g. `presetId=""` + `compositionType="x"` can never
 * collide with `presetId="x"` + `compositionType=""`, and a field value
 * that happens to contain a delimiter-like character is handled exactly
 * as JSON already handles it (escaped), never a bespoke escaping scheme. */
function canonicalize(input: ProductionAssetIdentityInput): string {
  const sortedTargets = [...input.productTargets].sort();
  return JSON.stringify([
    input.generatorVersion,
    input.styleDna,
    input.presetId,
    input.compositionType ?? '',
    sortedTargets,
    input.generatorSeed,
    input.canonicalSvg,
  ]);
}

const PRODUCTION_ASSET_ID_PREFIX = 'PAID-';

/** Computes the stable `productionAssetId` for a generated design. Async
 * because it hashes via `crypto.subtle` (same primitive `domain/hash.ts`
 * already uses for source-file hashing) — there is no synchronous
 * browser-native SHA-256, and this codebase deliberately avoids adding a
 * hashing dependency (see `hash.ts`'s own header comment). */
export async function computeProductionAssetId(input: ProductionAssetIdentityInput): Promise<string> {
  const canonical = canonicalize(input);
  const encoder = new TextEncoder();
  const digest = await sha256Hex(encoder.encode(canonical).buffer as ArrayBuffer);
  return `${PRODUCTION_ASSET_ID_PREFIX}${digest}`;
}

const PRODUCTION_ASSET_ID_PATTERN = /^PAID-[0-9a-f]{64}$/;

export function isValidProductionAssetId(value: unknown): value is string {
  return typeof value === 'string' && PRODUCTION_ASSET_ID_PATTERN.test(value);
}
