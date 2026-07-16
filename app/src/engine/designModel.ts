import type { GenerateParams } from './types';

// Shared Design Model utilities — the parts of "a central design model"
// that GenerateParams itself (the actual settings shape, unchanged) didn't
// yet provide: a safe deep clone, a deterministic settings hash (for
// candidate/cache deduplication), and a defensive numeric-range normalizer
// (protects against garbage values from a hand-edited JSON import — not a
// re-statement of every UI slider's exact min/max, which the native
// <input type="range"> elements already enforce for normal interaction).

/** Safe deep clone: GenerateParams is a flat object with a couple of nested
 * records (`hierarchy`, `compositionIntelligence`) and a couple of string
 * arrays — a targeted per-field
 * clone (rather than JSON round-tripping, which silently drops `undefined`
 * fields and would make "not set" indistinguishable from "explicitly
 * absent" for optional fields like `customColors`). */
export function cloneParams(params: GenerateParams): GenerateParams {
  return {
    ...params,
    mixCategoryIds: params.mixCategoryIds ? [...params.mixCategoryIds] : undefined,
    customColors: params.customColors ? [...params.customColors] : undefined,
    hierarchy: params.hierarchy ? { ...params.hierarchy } : undefined,
    compositionIntelligence: params.compositionIntelligence ? { ...params.compositionIntelligence } : undefined,
  };
}

/** cyrb53-style string hash (same family as engine/rng.ts's seed hash, but
 * kept self-contained here rather than importing a private implementation
 * detail of the RNG module). */
function hashString(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  // Two 32-bit halves concatenated as base36 strings — avoids the
  // precision loss a numeric (h1 * 2^32 + h2) combination would suffer
  // once past Number.MAX_SAFE_INTEGER.
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

/** Deterministic settings hash: same params (in any key order, since
 * JSON.stringify's key order here always matches object construction
 * order — see canonicalize below) always produces the same hash, and any
 * actual value change produces a different one. Useful for candidate/
 * scoring caches and for detecting "these two saved patterns are actually
 * identical settings". Not cryptographic — collision-resistance for a
 * pattern-generation cache key, nothing more. */
export function hashParams(params: GenerateParams): string {
  return hashString(canonicalize(params));
}

/** Stable JSON serialization with sorted object keys, so key insertion
 * order never changes the hash (unlike plain JSON.stringify). Keys whose
 * value is `undefined` are skipped entirely (matching JSON.stringify's own
 * behavior) — otherwise `cloneParams`'s explicit `field: undefined`
 * assignments (needed so "not set" clones correctly) would make an
 * object's own hash differ from its clone's, since `Object.keys` treats an
 * explicit `undefined` property differently from a key that was never
 * assigned at all. */
function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function clampNum(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.max(min, Math.min(max, v));
}

/** Defensive numeric-range normalization. Every field here already gets
 * clamped implicitly by the UI's native range-input min/max during normal
 * interaction — this exists for paths that bypass the UI entirely (JSON
 * import, saved-library migration, hand-built GenerateParams in a script)
 * where a value could be NaN, negative, or absurdly large. Returns a new
 * object; never mutates the input. */
export function normalizeParams(params: GenerateParams): GenerateParams {
  const next = cloneParams(params);
  next.colorCount = Math.round(clampNum(next.colorCount, 1, 12, 4));
  next.tileSize = clampNum(next.tileSize, 100, 5000, 1200);
  next.density = clampNum(next.density, 0, 1, 0.5);
  next.motifSize = clampNum(next.motifSize, 5, 500, 70);
  next.rotationJitter = clampNum(next.rotationJitter, 0, 180, 15);
  next.scaleJitter = clampNum(next.scaleJitter, 0, 1, 0.15);
  next.radialSymmetry = Math.round(clampNum(next.radialSymmetry, 1, 24, 1));
  if (next.patternScale !== undefined) next.patternScale = clampNum(next.patternScale, 0.2, 4, 1);
  if (next.negativeSpace !== undefined) next.negativeSpace = clampNum(next.negativeSpace, 0, 1, 0);
  if (next.overlapAmount !== undefined) next.overlapAmount = clampNum(next.overlapAmount, 0, 1, 0);
  if (next.compositionIntelligence) {
    const ci = next.compositionIntelligence;
    const flowProfile = ci.flowProfile === 'calm' || ci.flowProfile === 'directional' || ci.flowProfile === 'dynamic' ? ci.flowProfile : undefined;
    next.compositionIntelligence = {
      balanceStrength: clampNum(ci.balanceStrength, 0, 1, 0.5),
      rhythmStrength: clampNum(ci.rhythmStrength, 0, 1, 0.35),
      ...(ci.attractionStrength !== undefined ? { attractionStrength: clampNum(ci.attractionStrength, 0, 1, 0) } : {}),
      ...(ci.negativeSpaceStrength !== undefined ? { negativeSpaceStrength: clampNum(ci.negativeSpaceStrength, 0, 1, 0) } : {}),
      ...(flowProfile !== undefined ? { flowProfile } : {}),
      ...(ci.flowBiasStrength !== undefined ? { flowBiasStrength: clampNum(ci.flowBiasStrength, 0, 1, 0) } : {}),
    };
  }
  return next;
}
