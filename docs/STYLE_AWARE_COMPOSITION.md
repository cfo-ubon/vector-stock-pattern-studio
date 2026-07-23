# Style-Aware Composition Envelopes

Build 022, Phase 3 (see `BUILD_022_AUDIT.md` Section 6, Section 7).

## The problem

Every Style DNA preset resolves its hero/secondary/filler/accent role
split through a shared `HIERARCHY_PRESETS` table
(`src/engine/hierarchy.ts`). Two presets' resolved hierarchy genuinely
mismatched their own declared identity:

- `minimalBotanical` used the shared `minimalRepeat` preset
  (`heroRatio: 0.02`) — almost no motif ever received "hero" treatment,
  contradicting its own description ("a single restrained botanical
  silhouette repeated"). Since this codebase's Hero Detail Ratio work
  (Build 019/020) concentrates extra illustration detail on hero-role
  motifs, having no real hero meant Minimal Botanical never got that
  investment — a measured contributor to its illustrationQualityV2 being
  the weakest of all 15 presets (33.53).
- `luxuryFloral` used the shared `heroFocus` preset (`heroRatio: 0.3`) —
  nearly a third of every placement became an equally-large hero bouquet,
  the opposite of "one clear primary floral focal point."

`minimalRepeat` and `heroFocus` are both shared by other presets
(`organicAbstract` also uses `minimalRepeat`; `darkBotanical`/
`modernTropical` also use `heroFocus`) with no evidence of the same
problem — editing the shared table directly would risk changing those
presets too, which the audit found no justification for.

## The fix

`src/engine/compositionEnvelopes.ts` declares a small, additive
per-style override table:

```ts
export type HierarchyOverride = Partial<Pick<HierarchyParams,
  'heroRatio' | 'secondaryRatio' | 'fillerRatio' | 'accentRatio' | 'heroScale'>>;

export const WEAK_PRESET_HIERARCHY_OVERRIDES: Partial<Record<string, HierarchyOverride>> = {
  minimalBotanical: { heroRatio: 0.1, secondaryRatio: 0.55, heroScale: 1.5 },
  luxuryFloral:      { heroRatio: 0.18, secondaryRatio: 0.47, heroScale: 2.6 },
};

export function applyCompositionEnvelope(styleId: string, hierarchy: HierarchyParams): HierarchyParams
```

`applyCompositionEnvelope` merges the override (if any) over an
already-resolved `HierarchyParams`, and returns the **identical object
reference** for any style with no registered override — so
`compositionEnvelopes.test.ts` can assert strict no-op via `toBe` (not
just `toEqual`) for every other preset, including the ones sharing
`minimalRepeat`/`heroFocus`.

Wired into `src/engine/styleDna.ts`, wrapping the existing
`hierarchy:` field resolution.

## Deliberately out of scope

Only ratio/scale fields are adjustable — never density, negative space,
layout, or palette, which stay under each style's own declared values.
This keeps the envelope narrowly about hero/secondary/filler/accent
balance, not a general-purpose style override mechanism.

## Known remaining issue

The `luxuryFloral` envelope did not resolve the `fragmentedSilhouette`
visual issue (still 100% fire rate after this fix) — see
`BUILD_022_WEAK_STYLE_UPGRADE.md`'s "Known issue" section. That is a
spatial-placement problem, not a hero/secondary ratio problem, and needs a
separate fix in the cluster-placement code.
