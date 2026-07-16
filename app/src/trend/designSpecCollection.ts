import type { StyleDna } from '../engine/styleDna';
import { STYLE_DNA_PRESETS } from '../engine/styleDna';
import { generateCollection, type GeneratedCollection } from '../collection/collectionGenerator';
import { buildGenerateParamsFromDesignSpec } from './designSpecToParams';
import { buildDesignSpecCollectionName } from './designSpecSeo';
import type { DesignSpecification } from './designSpecTypes';

// Collection Generator (Section 11) — "Generate Hero Pattern, Secondary
// Pattern, Mini Pattern, Stripe, Border, Corner, Spot Motifs. All assets
// share Style DNA, Palette, Motif Family, Collection Identity." Reuses the
// *existing, unmodified* collection/collectionGenerator.ts's
// `generateCollection` for every asset (no duplicated asset-building
// logic) — Style DNA/Palette/Motif Family sharing across every asset is
// already guaranteed by that function's own existing consistency
// mechanism (`verifyConsistency`), unchanged here. The one thing this
// module adds on top: "Collection Identity" (the manifest's
// `collectionName`) is the Design Specification's own market-driven name
// (`buildDesignSpecCollectionName` — the primary keyword + matched Trend
// Pack theme) instead of the generic "{family} collection — {categoryId}"
// default `generateCollection` falls back to when no override is given.

/** Resolves a Design Specification's `styleDnaId` into a real `StyleDna`
 * object for `generateCollection`'s style-aware candidate patching —
 * checks the built-in `STYLE_DNA_PRESETS` first; a custom user-saved style
 * (stored in localStorage, invisible to this pure engine module — same
 * "custom styles aren't visible to pure engine code" precedent
 * `engine/candidateEngine.ts`'s own `styleAwareCandidatePatch` documents)
 * can be passed in via `customStyleDna` by a caller that has access to
 * `storage/styleDnaStore.ts` (the UI layer). */
export function resolveDesignSpecStyleDna(spec: DesignSpecification, customStyleDna?: StyleDna): StyleDna | undefined {
  return customStyleDna ?? STYLE_DNA_PRESETS[spec.styleDnaId];
}

/** Builds a full commercial Collection directly from a Design
 * Specification — the Section 11 requirement. `seed` is a separate
 * argument (not read from the spec), matching every other trend/*
 * adapter's convention (`buildTileFromDesignSpec`, `buildDesignSpecSeo`),
 * so the same spec can deterministically produce different collections
 * from different seeds. */
export function buildCollectionFromDesignSpec(spec: DesignSpecification, seed: string, customStyleDna?: StyleDna): GeneratedCollection {
  const baseParams = buildGenerateParamsFromDesignSpec(spec, seed);
  const styleDna = resolveDesignSpecStyleDna(spec, customStyleDna);
  const collectionName = buildDesignSpecCollectionName(spec);
  // Section 12 — the Design Spec's own requested `collection.size` now
  // actually scales the generated asset count (previously tracked as
  // metadata only, never wired into generation — see collectionGenerator.ts's
  // `generateCollection` for the reuse-first scaling strategy).
  return generateCollection(baseParams, styleDna, collectionName, spec.collection.size);
}
