# Build 010 Audit — Signature Composition & Commercial Story Engine

Read in full before writing any code: `generators/premiumHero.ts`,
`engine/luxuryComposition.ts`, `generators/botanicalFamilies.ts`,
`knowledge/registry/speciesSchema.ts`, `knowledge/registry/speciesLoader.ts`,
`generators/illustrationFamily.ts`, `engine/eyeFlowEngine.ts`,
`engine/compositionZones.ts`, `engine/flowArchitecture.ts`,
`engine/compositionIntelligence.ts`, `engine/hierarchy.ts`,
`engine/patternPhysics.ts`, `engine/tile.ts` (full placement/paint
pipeline), `engine/types.ts` (`Motif`/`Placement`/`TileData`),
`engine/negativeSpaceDesigner.ts`, `engine/rhythmBands.ts`,
`engine/clusterEngine.ts` (`SIZE_RHYTHM`, `ClusterArchetype`),
`engine/clusterAvoidance.ts`, `engine/scoring.ts` (field list),
`engine/styleDna.ts`, `engine/portfolioQuality.ts`,
`critic/designCritique.ts`, `critic/problems.ts`,
`critic/visualAnalysis.ts`, `scripts/qualityReport.ts`.

## Key finding: "Signature Bouquet Composer" is Build 006's own "Luxury
Bouquet Composer" wearing a new name, and it is already real, shipped, and
tested — Build 010 must extend it, not redesign it.

Build 010's Section 1 name ("Signature Bouquet Composer") is suspiciously
close to Build 006, Section 2's own shipped mechanism, and the match is not
coincidental: `generators/premiumHero.ts` still carries that exact
attribution in its own doc comments —

```
// Build 006, Section 2 (Luxury Bouquet Composer): "current heroes still
// feel procedural" -- one real, measurable driver is that every non-hero
// member draws at whatever scale the cluster archetype's own jitter
// happened to roll...
```

`balanceVisualWeight` (the real, computed "visual weight" cap that shrinks
outweighing support members) and the companion-foliage "branch rhythm"
sprig (a second, shorter foliage stem bound alongside the primary one) are
both that mechanism, still active on every premium hero today, further
sharpened by Build 008B's `supportWeightRatio` (species-`premiumScore`-aware
cap tightening) and measured by `engine/illustrationQualityV2.ts`'s own
"Bouquet Quality" sub-score (real presence-rate of the `companion-foliage`
group). Build 009, Section 4 (Hero Framing Engine) then added a *second*
layer directly on top of the same cluster members: `applyHeroFraming`'s
push-away (no member crowds inside the hero's own footprint) and, for the
`bouquet` archetype specifically, bounded angular-slot framing. So a
"Signature Bouquet Composer" build in 2026 would be the **third** build
touching this exact code path (006 → 009 → 010) — per this codebase's own
stated convention (every prior `BUILD_*_REPORT.md`, and CLAUDE.md's own
"do not break working systems" spirit), Build 010 Section 1 must extend
`buildPremiumHero`/`applyHeroFraming`, never rewrite them or introduce a
parallel "Signature Composer" module that duplicates what already works.

## Two other pre-existing systems this build must not accidentally triplicate

1. **Eye-path systems.** Build 009's own audit already found `FlowProfile`
   (styleDna.ts, 3 values) and `CompositionZone` (compositionZones.ts, 10
   values) never unified, and Build 009 itself added a *third*,
   `engine/eyeFlowEngine.ts` (6 named paths, placement-level pull toward a
   real skeleton, reused across `compositionZones.ts`'s own wave/diagonal/
   row/spiral formulas). All three remain live and un-merged. Build 010's
   Section 2 ("Visual Story Flow Engine") must not become a *fourth*
   independent eye-path mechanism — see §Section 2 below for exactly which
   of the three existing systems it should extend instead.
2. **Cluster-size rhythm.** `engine/clusterEngine.ts`'s `SIZE_RHYTHM =
   [1.35, 0.82, 1.05, 0.62]` (Build 003) is already a real, deliberately
   non-monotonic large/medium/small/smaller alternating cycle applied to
   cluster anchors — i.e. "scale variety with intent, not pure randomness"
   already exists as shipped code for cluster-anchor sizing. Build 010,
   Section 5 ("Premium Rhythm Engine") must extend this cycle's *reach*
   (see below), not invent a second, differently-named scale-rhythm
   mechanism that duplicates it under new terminology.

## Real taxonomy reuse (per every prior build's own convention)

- `ProductUseId` (10 values: wallpaper, fabric, wrappingPaper, giftWrap,
  packaging, notebookCovers, stationery, homeDecor, textile, digitalPaper)
  is still the only real product taxonomy; any "Phone Case"/"Poster"/
  "Canvas" language in the Build 010 brief maps the same way Build 009
  already established (Greeting Card → `stationery`, Phone Case →
  `packaging`, Poster/Canvas → `homeDecor`).
- `CompanionRole` (`'foliage' | 'filler' | 'accentBerry'`,
  `knowledge/registry/speciesSchema.ts`) is the only real per-species
  relationship vocabulary that exists today — a pairwise, single-role,
  strength-weighted matrix (`SpeciesCompanion.strength`, consumed by
  `pickCompanionFamily`'s roulette-wheel pick). There is no spatial
  relationship vocabulary (climbing/trailing/nesting/wrapping) anywhere in
  the schema, loader, or consumers — Section 4 below scopes this as the one
  genuinely new taxonomy this build needs to add, not something to fake by
  overloading `CompanionRole`.
- `ClusterArchetype` (13 values, `engine/clusterEngine.ts`) vs.
  `HERO_ARCHETYPE_POOL` (5 values, the reachable subset for hero assembly,
  `generators/premiumHero.ts`) — Build 009 already drew this distinction
  explicitly for its Silhouette Optimization section; Build 010 should keep
  reusing `HERO_ARCHETYPE_POOL` as the honest denominator anywhere it
  measures hero-silhouette-related diversity, never the full 13-value union.
- `MotifRole` stays the closed 4-value union (`hero`/`secondary`/`filler`/
  `accent`) — every build since 001 has declined to add a 5th value because
  of its blast radius (`ClusterMember` roles, Pattern Physics importance,
  paint order, `ROLE_SCALE_RANGE`, botanical part selection). Build 010
  should not be the build that finally adds one; every section below has a
  real path that doesn't require it (Section 3's depth-plane work reuses
  `ROLE_LAYER_PRIORITY`, not a new role).

## Section-by-section scope decisions

### 1. Signature Bouquet Composer

**Already real and must not be redesigned:** `buildPremiumHero`
(Build 004), `balanceVisualWeight`/companion-foliage sprig (Build 006,
"Luxury Bouquet Composer" — see the Key Finding above), `supportWeightRatio`
(Build 008B), `resolveFillerPart`'s companion-role-aware part selection
(Build 008B), the botanical Gesture Engine's whole-bouquet `gestureLean`
(Build 007), and Build 009's `applyHeroFraming` (push-away + bouquet-only
angular framing). Together these already give a premium hero: a real
visual-weight cap, a second bound foliage stem, species-aware filler-part
selection, a deliberate lean, crowding prevention, and even angular-slot
coverage.

**Real, specific gap:** every one of those mechanisms operates on where
each cluster member sits relative to the hero's *center point* — none of
them ties the bouquet's members to one shared **gather point** the way a
real cut-flower bouquet is bound. `buildPremiumHero` draws exactly one
stem (the hero's own, from `generateStem(rng, size * 0.4 * ..., ...)`,
starting at local origin) plus one optional companion-foliage sprig
(translated to its own independent random offset); every secondary/filler/
accent cluster member is a wholly separate `botanicalGenerator.createMotif`
call positioned only by the cluster archetype's own `dx`/`dy` offset — none
of them visually "grows from" or converges toward the hero's own stem base.
A commercial illustrator's bouquet reads as designed specifically because
every stem visually gathers at one point before spreading into blooms; this
codebase's premium hero currently reads as "several independently-drawn
objects clustered near a point," which is precisely the "procedurally
scattered" complaint the brief names. A real Signature Bouquet Composer
addition is a bounded, additive pass that nudges each non-hero member's
rendered anchor a small fraction toward the hero's own stem-base point
(not its center) before the existing `applyHeroFraming` push-away runs —
same "pull toward the nearest thing" idiom `applyRhythmSmoothing`/
`applyEyeFlow` already use, applied one level down at the hero-internal
scale instead of tile scale.

**Second real, smaller gap:** `generateCluster`'s `memberCount` is a plain
`rngInt(rng, lo, hi)` — no bias toward the classic "rule of odds" real
florists/illustrators use (odd-numbered groupings read as more natural/
intentional than even ones). See Section 6 for why this belongs there
structurally, but Section 1's own `memberCountRange` resolution
(`designRules?.heroMemberCountRange ?? [4, 6]`) is the natural place to
apply an odd-favoring roll once Section 6 builds it, rather than
duplicating the logic here.

### 2. Visual Story Flow Engine

**Already real, and already whole-tile, not "just one cluster":**
`engine/eyeFlowEngine.ts`'s `applyEyeFlow` already pulls *every* placement
in the tile (fillers/accents included, not just cluster members) toward one
shared skeleton; `engine/compositionZones.ts`'s zones already bias *every*
cluster anchor across the tile toward one skeleton; `flowArchitecture.ts`
supplies the shared sine-path math both use. So the brief's literal ask —
"an intentional narrative/eye-path across the WHOLE TILE" — is already,
concretely, what these three systems do. Framing Section 2 as if nothing
exists yet would misdescribe the codebase.

**Real, specific gap:** every one of these existing passes applies **one
uniform pull strength to every placement regardless of role or position**.
`applyEyeFlow(placements, tileSize, path, strength)` computes one
`pullFrac = 0.22 * strength` and applies it identically to hero, secondary,
filler, and accent placements alike. A genuine "story" — as opposed to a
generic field bias — needs the pull to read as a sequence: the eye should
land on the primary hero first, then be guided along the skeleton to a
secondary point of interest, with filler/accent motifs trailing off in
importance rather than all snapping toward the path with equal force. This
is a real, bounded, additive extension: a per-role pull multiplier (e.g.
hero pulled hardest toward the skeleton's own start, filler/accent pulled
least, so the *hierarchy* Section 1 (Build 009) already assigns doubles as
the "story's" foreground/background emphasis) layered onto
`applyEyeFlow`'s existing per-placement loop — not a new skeleton system,
not a fourth eye-path taxonomy alongside `FlowProfile`/`CompositionZone`/
`EyeFlowPath`.

**Second real gap:** no metric measures whether the "story" reads as
coherent across the *whole* tile versus one cluster — `scoring.ts`'s
`flowCoherence` is the closest existing measurement (nearest-neighbor
directional consistency), reusable as the base for a new "story clarity"
composite the way `luxuryComposition.ts` already reuses `hierarchyClarity`.

### 3. Multi-layer Depth Engine

**Already real (partial depth cues):** `HierarchyParams`'s per-role scale
bands (`heroScale`/`secondaryScale`/`fillerScale`/`accentScale`,
`engine/hierarchy.ts`), `ROLE_LAYER_PRIORITY` (`{hero:3, secondary:2,
filler:1, accent:0}`, real paint-order z-layering via
`sortByLayerPriority` — confirmed wired in `tile.ts`: `paintOrderedPlacements
= sortByLayerPriority(refinedPlacements)`), and `engine/heroComplexity.ts`'s
detail overlay (hero/secondary get a real detail pass, filler/accent don't
— a genuine detail-level gradient by role). So scale, paint order, and
detail-level *already* form a real, if implicit, 4-tier depth ordering.

**Real, specific gap, and a real constraint on how it can be closed:**
there is no distinct visual *treatment* per depth plane beyond scale/paint
order/detail — no opacity, blur, or desaturation differentiates a
background-reading filler/accent motif from a foreground hero. Critically,
this is not an oversight to simply "add blur to": this codebase has an
explicit, tested, deliberate "EPS-safe" convention that forbids real SVG
opacity/blur entirely (`engine/types.ts`'s own doc comments on
`flatShadow`/`flatHighlight`: "no blur, no transparency — EPS-safe by
construction"; `tile.test.ts` asserts `expect(svg).not.toMatch
(/feGaussianBlur/i)`). Every existing "soft" visual effect (shadow,
highlight, filler-layer tint) is implemented as a **solid, pre-blended
color** via `blendHex`, never real alpha. A genuine Multi-layer Depth
Engine therefore cannot add real opacity-based atmospheric perspective or
`feGaussianBlur` — it must express "background" the same way this codebase
already expresses every other soft effect: a solid, pre-blended color shift
(desaturating/lightening a filler/accent motif's own fill toward the
background color using `blendHex`, the same function `buildFillerLayer`
already uses) plus the existing scale/paint-order/detail gradient, not a
transparency- or filter-based mechanism. This is the single most important
constraint for whoever scopes Section 3's implementation.

### 4. Botanical Relationship Engine V2

**Already real:** `SpeciesCompanion` (`family`, `role: 'foliage' | 'filler'
| 'accentBerry'`, `strength: 0-1`), `pickCompanionFamily`'s roulette-wheel
pick (Build 008B), `resolveFillerPart`'s companion-role-aware part
selection (Build 008B), and the companion-foliage sprig (Build 006). This
is a real, working, weighted **pairwise** relationship matrix — one
companion picked once per hero, reused consistently across that hero's
filler/accent roles.

**Real, specific gap:** every relationship in `SpeciesCompanion` is a flat
"this family pairs with that family, with this strength, for this role" —
there is no *spatial* relationship vocabulary at all. The brief's own
examples (climbing, trailing, nesting) describe how a companion should be
positioned relative to its primary, not just which part it draws — nothing
in `speciesSchema.ts`, `pickCompanionFamily`, or `generators/premiumHero.ts`
encodes "olive foliage trails downward past the hero's base" vs. "berries
nest tucked behind the hero flower" vs. "a climbing vine wraps the stem."
Currently every filler/accent member's position comes purely from the
cluster archetype's own generic offset math (`ClusterMember.dx/dy`),
completely independent of which companion species was picked. A real V2
extension adds a new, small, optional field to `SpeciesCompanion` (e.g. a
`spatialRelationship: 'trailing' | 'nesting' | 'climbing' | 'none'`) that
`buildPremiumHero`'s per-member loop reads to bias that specific member's
rendered offset (trailing = pulled downward/outward past the hero's own
footprint; nesting = pulled inward/behind; climbing = aligned along the
hero's own stem axis) — additive on top of `applyHeroFraming`'s existing
push-away, never replacing it. This is the one section where a genuinely
new taxonomy is warranted (per the "real taxonomy reuse" note above),
because nothing existing captures this dimension at all.

### 5. Premium Rhythm Engine

**Already real:** `engine/clusterEngine.ts`'s `SIZE_RHYTHM = [1.35, 0.82,
1.05, 0.62]` (Build 003) — a real, deliberately non-monotonic scale
sequence applied to cluster anchors with a randomized start offset;
`engine/rhythmBands.ts`'s dense/loose spacing wave (Build 003, applied to
ambient/filler tiers and `airy`'s scatter); `engine/negativeSpaceDesigner.ts`'s
`ProductSpacingStrategy.rhythmMultiplier`; `scoring.ts`'s `rhythmRegularity`
measured metric. So "real scale-variety-with-intent, not pure randomness"
is **already shipped** for cluster anchors specifically (see the Two
Pre-Existing Systems section above) — this is not a gap to invent from
scratch.

**Real, specific gap:** `SIZE_RHYTHM`'s reach is narrow — it only sizes
*cluster anchors* (`placeClusterAnchors`, feeding `bouquet`/`heroScatter`-
style layouts). Individual non-clustered layouts (`grid`, `scatter`,
`toss`, `halfDrop`) get scale variety purely from `HierarchyParams`'s
`+/-22% wobble` (Build 002) — a real spread, but genuinely random within a
band, not a deliberate alternating sequence the way `SIZE_RHYTHM` is. The
real, additive extension is applying the same "fixed non-monotonic cycle +
randomized start offset" idiom to `applyHierarchy`'s own per-instance scale
assignment for non-exempt layouts, rather than inventing a differently-named
second mechanism.

### 6. Professional Illustrator Rules

**Already real:** `critic/visualAnalysis.ts`'s `gridAppearance` detector
(flags when neighbor directions concentrate on the axes — real, if
implicit, "avoid grid-like alignment"), `engine/rotationFamilies.ts`
(Build 003's Rotation Angle Families — real directional/rotation variety,
not raw jitter), `engine/clusterAvoidance.ts`'s pairwise repulsion (avoids
two large anchors visually colliding), Build 009's `applyHeroFraming`
push-away (avoids a support member crowding inside the hero's own
footprint), and `luxuryComposition.ts`'s "Elegant Overlap" dimension
(`overlapQuality` — deliberately encourages *some* real overlap for
cohesion, the opposite direction from avoidance). Grepped explicitly and
confirmed absent anywhere in `engine/` or `critic/`: **"tangent"** (as a
touching-avoidance concept — the only `tangent` hits in this codebase are
curve-tangent math in `curveEngine.ts`/`rotationFamilies.ts`, unrelated),
**"odd"**/"rule of odds" (`generateCluster`'s `memberCount` is a plain
`rngInt(lo, hi)`, no odd-number bias anywhere).

**Real, specific gaps:**
1. **Rule of odds** — genuinely absent. A small, real, additive fix:
   `generateCluster`'s member-count roll (and `buildPremiumHero`'s
   `memberCountRange` resolution, see Section 1) can bias toward odd totals
   (e.g. re-roll once if even, or roll from an odd-only range) — a named,
   well-known illustrator convention with no existing analog to conflict
   with.
2. **Touching-tangent avoidance specifically** — `clusterAvoidance.ts`'s
   repulsion only fires when two anchors' *required* separation (based on
   real post-rhythm size) exceeds their actual distance; it does not
   specifically detect the "just barely touching at one point" case that
   reads as an accidental collision rather than deliberate overlap. A real
   gap, but a narrow one: extending `resolveClusterCollisions`'s existing
   distance check with a second band (nudge fully apart *or* into
   comfortable overlap, never leave a pair sitting exactly on the boundary)
   is additive, not a new detector.
3. Directional/rotation variety and grid-alignment avoidance are, per the
   above, **already real** — this section's remaining honest scope is
   narrower than the brief implies.

### 7. Product-aware Composition Engine

**Already real:** Build 009 Section 8's exact convention —
`ProductSpacingStrategy` (`engine/negativeSpaceDesigner.ts`,
`rhythmMultiplier`/`clusterLooseness`/`preferredZones`, keyed by
`ProductUseId`), `resolveCompositionZoneForProduct`, and `tile.ts`'s
`params.X ?? productFallback(params.productTarget)` fallback pattern
(`effectiveBotanicalFamily`, `effectiveCompositionZone`). This is a mature,
proven, three-times-reused convention (species selection in 008B,
composition zone + spacing strategy in 009).

**Real, specific scope:** Section 7's honest job is mechanical, not
inventive — extend `ProductSpacingStrategy` (or add sibling per-product
tables following the identical shape) with new fields for whichever of
Sections 2/3/5 above ship real new tunable parameters (e.g. a per-product
eye-flow-pull-by-role multiplier for Section 2, a per-product depth-plane
strength for Section 3, a per-product rhythm-sequence bias for Section 5),
each defaulting to the identity/no-op the same way `IDENTITY_SPACING_STRATEGY`
does today. No new fallback mechanism needs inventing — only wiring
Sections 2/3/5's new fields through the exact pattern already proven three
times over.

### 8. Signature Style Engine

**Already real:** `resolveStyleDna`'s deterministic `pickPreferred`
mechanism already gives every Style DNA preset a real, seed-stable
compositional identity across several dimensions (`compositionZone`,
`eyeFlowPath`/`eyeFlowStrength` via `mapCompositionZoneToEyeFlow`,
`asymmetryDirection`, cluster style/density, flow profile) — this is
already a real "compositional fingerprint" mechanism, just not yet
extended to cover Sections 1-7's new fields (which don't exist yet). The
JSON-schema-loader convention (`knowledge/registry/data/styles/*.json` +
`styleSchema.ts` + `KnowledgeRegistry`, Build 008A) is the proven, reusable
place to add new optional per-style fields without touching 15 hand-authored
JSON files' existing values.

**Real, specific scope:** genuinely downstream of Sections 1-7 — there is
no fingerprint to build from fields that don't exist yet. The real, bounded
work once those fields exist is: (a) add new optional `StyleDna` schema
fields (e.g. a preferred gather-point tightness for Section 1, a preferred
story-flow role-emphasis for Section 2, a preferred spatial-relationship
bias for Section 4), each resolved via the exact same `pickPreferred`
hash-based idiom every existing field already uses; (b) verify each new
field, once threaded through `resolveStyleDna`, produces a *measurably*
distinct fingerprint per preset (reusing `computeStyleDnaConsistency`'s own
"declared vs. measured" honesty convention) rather than 15 presets that all
resolve to visually indistinguishable output.

### 9. Commercial Validation Suite

**Already real:** `engine/scoring.ts`'s 28+ measured `CompositionMetrics`
fields, `engine/portfolioQuality.ts`'s diversity metrics (Species/
Composition/Cluster/Hero/Hero-Archetype Diversity, each a real "fraction of
an actual, fixed taxonomy exercised" measurement), `engine/luxuryComposition.ts`'s
7-dimension aggregate (6 reused fields + 1 genuinely new golden-balance
check). This module's own established discipline — "reuse an already-real
measurement wherever one genuinely captures the same thing, build a new
computation only where nothing existing does" — is the exact discipline
Section 9 should keep following.

**Real, specific scope:** each of Sections 1-8 needs at most one or two
genuinely new measured fields, following that same discipline: a gather-
point cohesion measurement for Section 1 (e.g. variance of non-hero
members' distance-to-stem-base vs. distance-to-hero-center); a story-flow
coherence composite for Section 2 (reusing `flowCoherence` + a new
role-emphasis-gradient check); a depth-plane distinctness measurement for
Section 3 (variance of role-grouped fill lightness/saturation, since real
depth here is color-based per the EPS-safe constraint, not opacity); a
companion spatial-relationship presence-rate for Section 4 (the same
"real presence rate of a named group" idiom `illustrationQualityV2.ts`'s
Bouquet Quality already uses for `companion-foliage`); a rhythm-sequence
regularity extension to `rhythmRegularity` for Section 5; a rule-of-odds
compliance rate and a tangent-avoidance rate for Section 6; nothing new for
Section 7 beyond confirming Sections 2/3/5's product-aware variants
actually differ per product (the same supplementary spot-check convention
Build 009 §9 already established, since the frozen portfolio harness never
sets `productTarget`); a fingerprint-distinctness measurement for Section 8
(pairwise difference of the new per-style resolved fields across all 15
presets). None of this can be scoped further until Sections 1-8's actual
new fields exist.

### 10. Portfolio Evaluation

Not scoped in depth per this audit's brief — noting only the real,
existing state: `app/scripts/qualityReport.ts` is the existing 30/100/300
harness (`large` CLI mode, added by Build 009, runs 15 `STYLE_DNA_PRESETS`
x 20 fixed seeds = exactly 300 patterns); `docs/build_reports/baselines/BUILD_009_final.json`
is the frozen baseline to diff a Build 010 run against. One real practical
wrinkle worth flagging for whoever implements this section: 500 does not
divide evenly by the current preset count (15 x 33.33), unlike 300's clean
15 x 20 — the harness's per-preset seed count will need to become
non-uniform (e.g. 15 presets x 33 seeds = 495, plus 5 extra) or the preset
loop restructured, not a simple constant swap.

## Recommendation carried forward (not this build's scope)

Unifying `FlowProfile`, `CompositionZone`, and now `EyeFlowPath` into one
real eye-path taxonomy remains the single highest-leverage architectural
cleanup this and the prior audit found — deferred again because
`FlowProfile` is a closed union with lookup tables in `styleDna.ts` touched
by dozens of call sites, and unifying it safely needs its own dedicated
build. Build 010's Section 2 should be careful not to add a *fourth*
independent mechanism to this pile (see "Two other pre-existing systems"
above) — extending `applyEyeFlow` with per-role pull weighting keeps this
at three, not four.
