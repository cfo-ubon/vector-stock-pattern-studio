import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from './designIntelligence';
import { buildCollectionFromDesignSpec, resolveDesignSpecStyleDna } from './designSpecCollection';
import { verifyConsistency, type AssetType } from '../collection/collectionGenerator';
import { STYLE_DNA_PRESETS } from '../engine/styleDna';
import type { KeywordBundle } from './designSpecTypes';

function makeBundle(overrides: Partial<KeywordBundle> = {}): KeywordBundle {
  return {
    primaryKeyword: 'Luxury Botanical',
    secondaryKeywords: ['Wallpaper', 'Spring', 'Muted Green', 'Editorial'],
    marketplace: 'adobestock',
    season: 'spring',
    audience: 'editorial',
    commercialCategory: 'wallpaper',
    patternType: 'botanical',
    paletteDirection: 'muted green',
    difficulty: 'moderate',
    collectionSize: 8,
    ...overrides,
  };
}

const EXPECTED_ASSET_TYPES: AssetType[] = [
  'heroPattern', 'secondaryPattern', 'blenderPattern', 'miniPattern', 'stripePattern',
  'borderPattern', 'cornerPattern', 'spotMotifSheet', 'decorativeElementsSheet',
  'collectionPreview', 'metadata', 'seoPackage',
];

describe('resolveDesignSpecStyleDna', () => {
  it('resolves a built-in Style DNA preset from the spec', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const styleDna = resolveDesignSpecStyleDna(spec);
    expect(styleDna).toEqual(STYLE_DNA_PRESETS[spec.styleDnaId]);
  });

  it('a caller-supplied custom Style DNA wins over the built-in lookup', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const custom = { ...STYLE_DNA_PRESETS.kidsPlayful, id: 'my-custom-style', custom: true as const };
    expect(resolveDesignSpecStyleDna(spec, custom)).toBe(custom);
  });
});

describe('buildCollectionFromDesignSpec', () => {
  it('produces every required asset type at least once, same as the plain generateCollection path', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const collection = buildCollectionFromDesignSpec(spec, 'seed-collection-1');
    const presentTypes = new Set(collection.assets.map((a) => a.type));
    for (const type of EXPECTED_ASSET_TYPES) {
      expect(presentTypes.has(type), type).toBe(true);
    }
  });

  it('every pattern asset shares Style DNA, palette, and motif family (real consistency check, not a label)', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const collection = buildCollectionFromDesignSpec(spec, 'seed-collection-consistency');
    const consistency = verifyConsistency(collection.patternParams);
    expect(consistency.consistent, consistency.issues.join('; ')).toBe(true);
  });

  it('the manifest\'s Collection Identity (collectionName) is the Design Spec\'s market-driven name, not the generic default', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const collection = buildCollectionFromDesignSpec(spec, 'seed-collection-name');
    expect(collection.manifest.collectionName).toContain('Luxury Botanical');
    expect(collection.manifest.collectionName).toContain(spec.trend!.theme);
    expect(collection.manifest.collectionName).not.toMatch(/^.+ collection — /);
  });

  it('every asset\'s categoryId/paletteId traces back to the Design Spec (hero pattern matches heroMotifs[0])', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const collection = buildCollectionFromDesignSpec(spec, 'seed-collection-trace');
    expect(collection.patternParams[0].categoryId).toBe(spec.heroMotifs[0].categoryId);
    expect(collection.patternParams[0].paletteId).toBe(spec.palette.id);
  });

  it(
    'is fully deterministic for the same spec + seed',
    () => {
      // manifest.createdAt is a real wall-clock timestamp (generateCollection's
      // own existing behavior, unrelated to this Design-Spec-driven wiring)
      // allowed to differ by a millisecond between two independent calls —
      // same reasoning exportPackage.test.ts's determinism test already uses.
      // Two full collection builds in one test, each now building 8
      // pattern-type tiles instead of 6 (Commercial Collection Engine
      // Phase 4b adds Dense Pattern + Airy Pattern) — bumped past the
      // previous 15000ms override for the same reason it existed at all.
      // Bumped again to 60000ms: under full-suite worker contention on
      // slower/fewer-core CI runners (e.g. GitHub's windows-latest), the
      // 30000ms budget was observed timing out even though the same test
      // completes in a few seconds in isolation.
      const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q2', createdAt: 1000 });
      const a = buildCollectionFromDesignSpec(spec, 'seed-collection-det');
      const b = buildCollectionFromDesignSpec(spec, 'seed-collection-det');
      expect({ ...a.manifest, createdAt: null }).toEqual({ ...b.manifest, createdAt: null });
      expect(a.assets).toEqual(b.assets);
    },
    60000,
  );

  it(
    'a different seed produces a genuinely different collection id',
    () => {
      // Two full collection builds in one test — same "some category/layout
      // combos take several seconds for a full collection" headroom the
      // determinism test above already documents (Cluster Composition
      // Engine layouts place more motifs per tile than the old independent
      // scatter did, by design — see engine/clusterEngine.ts).
      const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
      const a = buildCollectionFromDesignSpec(spec, 'seed-collection-a');
      const b = buildCollectionFromDesignSpec(spec, 'seed-collection-b');
      expect(a.manifest.collectionId).not.toBe(b.manifest.collectionId);
    },
    30000,
  );
});
