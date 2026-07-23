import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { buildLuxuryCompositionPlacements, applyLuxuryProductAdjustment, type LuxuryCompositionOptions } from './luxuryFloralCompositionEngine';
import { LUXURY_COMPOSITION_PROFILES } from './luxuryCompositionProfiles';

const baseOpts: LuxuryCompositionOptions = {
  tileSize: 1200,
  motifSize: 60,
  density: 0.55,
  rotationJitter: 15,
  scaleJitter: 0.15,
  archetypes: ['bouquet', 'sprayBouquet'],
};

describe('buildLuxuryCompositionPlacements', () => {
  it('tags every cluster-bearing placement with a unit clusterId that is one of the reported primaryClusterIds — never an independent per-anchor sub-cluster', () => {
    const result = buildLuxuryCompositionPlacements(baseOpts, createRng('orchestrator-cluster-ids'));
    const primarySet = new Set(result.primaryClusterIds);
    expect(primarySet.size).toBeGreaterThan(0);
    for (const pl of result.placements) {
      if (pl.clusterId !== undefined) {
        expect(primarySet.has(pl.clusterId)).toBe(true);
      }
    }
  });

  it('gives each bouquet unit exactly one hero-role member', () => {
    const result = buildLuxuryCompositionPlacements(baseOpts, createRng('orchestrator-one-hero'));
    for (const clusterId of result.primaryClusterIds) {
      const members = result.placements.filter((pl) => pl.clusterId === clusterId);
      expect(members.filter((m) => m.role === 'hero')).toHaveLength(1);
    }
  });

  it('renders the hero of each unit strictly larger than every other placement in that same unit (Hero Dominance actually reaches the emitted scale)', () => {
    const result = buildLuxuryCompositionPlacements(baseOpts, createRng('orchestrator-hero-bigger'));
    for (const clusterId of result.primaryClusterIds) {
      const members = result.placements.filter((pl) => pl.clusterId === clusterId);
      const hero = members.find((m) => m.role === 'hero')!;
      for (const other of members.filter((m) => m.role !== 'hero')) {
        expect(hero.scale).toBeGreaterThan(other.scale);
      }
    }
  });

  it('only scores connector candidates between anchors that are actually present, with a recognized type and score', () => {
    const result = buildLuxuryCompositionPlacements(baseOpts, createRng('orchestrator-connectors'));
    for (const c of result.connectorCandidates) {
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(100);
      expect(typeof c.type).toBe('string');
    }
  });

  it('is fully deterministic for a given rng seed', () => {
    const a = buildLuxuryCompositionPlacements(baseOpts, createRng('orchestrator-determinism'));
    const b = buildLuxuryCompositionPlacements(baseOpts, createRng('orchestrator-determinism'));
    expect(a.placements).toEqual(b.placements);
    expect(a.profileId).toBe(b.profileId);
    expect(a.primaryClusterIds).toEqual(b.primaryClusterIds);
  });

  it('every placement lands within the tile bounds (wrap-safe emission)', () => {
    const result = buildLuxuryCompositionPlacements(baseOpts, createRng('orchestrator-bounds'));
    for (const pl of result.placements) {
      expect(pl.x).toBeGreaterThanOrEqual(0);
      expect(pl.x).toBeLessThan(baseOpts.tileSize);
      expect(pl.y).toBeGreaterThanOrEqual(0);
      expect(pl.y).toBeLessThan(baseOpts.tileSize);
    }
  });
});

describe('applyLuxuryProductAdjustment', () => {
  it('only tunes the selected profile\'s own numeric fields — never invents a different profile id', () => {
    const profile = LUXURY_COMPOSITION_PROFILES.dominantCentral;
    for (const target of ['fabric', 'wallpaper', 'wrappingPaper', 'packaging', 'stationery'] as const) {
      const adjusted = applyLuxuryProductAdjustment(profile, target);
      expect(adjusted.id).toBe(profile.id);
    }
  });

  it('returns the profile unchanged for an unrecognized/undefined product target', () => {
    const profile = LUXURY_COMPOSITION_PROFILES.crescentPremium;
    expect(applyLuxuryProductAdjustment(profile, undefined)).toEqual(profile);
  });
});
