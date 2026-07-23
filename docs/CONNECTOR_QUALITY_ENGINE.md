# Connector Quality Engine (Build 025, Phase 5)

**Status: implemented, tested, measured — reachable only via the disabled
`luxuryComposition` flag.** See `BUILD_025_AUDIT.md`.

## What existed before this build

`clusterEngine.ts`'s `connectClusters` accepts a bridge between any
sufficiently close anchor pair with a bare `rng() > 0.35` coin flip — no
botanical or visual reasoning, no distinction between a bridge that reads as
a genuine stem/branch and one that's just a short decorative line.

## What this build adds

`engine/connectorQuality.ts` replaces the coin flip with a real, inspectable
score.

### `scoreConnectorCandidate(a, b, aIndex, bIndex, dist, baseRadius, tileSize)`

Starts at score 100 and applies checkable, named deductions:

- **too-short / near-overlap** (`dist < baseRadius * 0.55`): -25, plus a
  further -20 if `dist < baseRadius * 0.35` ("creates a tangent rather than
  a genuine connection").
- **too-long for plausible botanical reach** (`dist > baseRadius * 3.4`):
  -35. This is the only penalty a very long connector receives — a bridge
  can never be rejected on reach alone from this check by design (only
  filterConnectorCandidates' own set-level checks, below, can still reject
  it); a unit test documents this exact scoring behavior.
- **too short to read at 128px thumbnail scale** (`dist < tileSize * 0.015`):
  -15.
- **hero-to-hero spine bonus**: +10 (a bridge between the tile's two named
  masses is its own visual spine and always earns credit for existing).

`classifyConnectorType` picks one of 7 named `ConnectorType`s
(`curvedFoliageBranch`, `eucalyptusStem`, `oliveBranch`, `berryStem`,
`smallFlowerBranch`, `foregroundBridge`, `rearBridge`) from the pair's own
mass roles and distance band — `foregroundBridge` covers every hero-to-hero
connection (this module operates on flat, pre-depth-reorder placements, so
it never emits the depth-aware `rearBridge` itself, an honest limitation
rather than a fabricated foreground/rear distinction).

A candidate is `accepted` when its score is `>= 55` (`ACCEPT_THRESHOLD`).

### `filterConnectorCandidates(candidates, anchors, baseRadius, tileSize)`

Applies 3 further checks the per-pair score can't see on its own, over the
already-accepted candidates (sorted by score, highest first):

1. **Clutter risk**: caps accepted connectors at 2 per anchor.
2. **Bare-stem risk**: rejects a connector with no OTHER anchor near its own
   midpoint (unless one endpoint is a hero) — a connector floating across
   empty space with nothing supporting it reads as a drawn line, not a
   branch.
3. **Focal obstruction risk**: rejects a non-hero-to-hero connector whose
   midpoint falls inside the primary hero's own footprint
   (`baseRadius * primary.sizeMul * 0.9`) — a bridge should never visually
   cut through the tile's main focal point.

## Where this is used

`engine/luxuryFloralCompositionEngine.ts`'s orchestrator scores every
unit-primary pair within `baseRadius * 3.4` and emits accepted bridges as
accent placements — see `docs/LUXURY_FLORAL_COMPOSITION_ENGINE.md`. Only
reachable via `params.luxuryComposition`, currently disabled by default.
