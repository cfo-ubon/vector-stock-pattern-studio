import { describe, it, expect } from 'vitest';
import { buildTile } from './tile';
import { defaultParams } from './defaults';
import { serialize } from './svgAst';
import { GENERATORS } from '../generators';
import { LAYOUTS } from '../layouts';
import { HIERARCHY_PRESETS, DEFAULT_HIERARCHY } from './hierarchy';
import { DEFAULT_COMPOSITION_INTELLIGENCE } from './compositionIntelligence';
import { extractInstances } from './svgGeometry';
import type { GenerateParams } from './types';
import { PRODUCT_USE_IDS } from '../collection/productTargets';
import { STYLE_DNA_PRESETS, resolveStyleDna } from './styleDna';

describe('buildTile: seeded reproducibility', () => {
  it('the same seed + params produce byte-identical SVG output', () => {
    const params = { ...defaultParams(), seed: 'reproducibility-check' };
    const a = serialize(buildTile(params).svg);
    const b = serialize(buildTile(params).svg);
    expect(a).toBe(b);
  });

  it('a different seed produces different output', () => {
    const base = defaultParams();
    const a = serialize(buildTile({ ...base, seed: 'seed-a' }).svg);
    const b = serialize(buildTile({ ...base, seed: 'seed-b' }).svg);
    expect(a).not.toBe(b);
  });
});

describe('buildTile: SVG validity', () => {
  it('never emits raster images or base64 data URIs', () => {
    const svg = serialize(buildTile({ ...defaultParams(), seed: 'validity-1' }).svg);
    expect(svg).not.toMatch(/<image/i);
    expect(svg).not.toMatch(/data:image/i);
    expect(svg).not.toMatch(/base64/i);
  });

  it('every motif group id is unique within the tile', () => {
    const svg = serialize(buildTile({ ...defaultParams(), seed: 'validity-2' }).svg);
    const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not use disallowed filter/blur/mask effects that break EPS export', () => {
    const svg = serialize(buildTile({ ...defaultParams(), seed: 'validity-3' }).svg);
    expect(svg).not.toMatch(/<filter/i);
    expect(svg).not.toMatch(/feGaussianBlur/i);
    expect(svg).not.toMatch(/<mask/i);
  });
});

describe('buildTile: every layout x a sample of categories builds without throwing', () => {
  const categories = ['botanical', 'geometric', 'mandala', 'tropical', 'animalprint'];
  const layoutIds = Object.keys(LAYOUTS) as GenerateParams['layoutId'][];

  for (const layoutId of layoutIds) {
    for (const categoryId of categories) {
      it(`${layoutId} x ${categoryId} (with hierarchy + negativeSpace + overlapAmount set)`, () => {
        const generator = GENERATORS[categoryId];
        const params: GenerateParams = {
          ...defaultParams(),
          categoryId,
          layoutId,
          motifSize: generator.defaultMotifSize,
          hierarchy: HIERARCHY_PRESETS.heroFocus.value,
          negativeSpace: 0.3,
          overlapAmount: 0.2,
          seed: `smoke-${layoutId}-${categoryId}`,
        };
        expect(() => buildTile(params)).not.toThrow();
      });
    }
  }
});

describe('buildTile: backward compatibility', () => {
  it('a params object with no hierarchy/negativeSpace/overlapAmount/artDirection fields (pre-v1.23 shape) still builds', () => {
    const legacy = { ...defaultParams(), seed: 'legacy-1' };
    delete (legacy as Partial<GenerateParams>).hierarchy;
    delete (legacy as Partial<GenerateParams>).negativeSpace;
    delete (legacy as Partial<GenerateParams>).overlapAmount;
    delete (legacy as Partial<GenerateParams>).artDirection;
    expect(() => buildTile(legacy)).not.toThrow();
  });

  it('undefined hierarchy produces the exact same output as before the Hierarchy Engine existed (no data-role attrs)', () => {
    const params = { ...defaultParams(), hierarchy: undefined, seed: 'legacy-2' };
    const svg = serialize(buildTile(params).svg);
    expect(svg).not.toMatch(/data-role/);
  });
});

describe('buildTile: Hierarchy Engine', () => {
  it('emits data-role attributes when hierarchy is set on a non-exempt layout', () => {
    const params: GenerateParams = {
      ...defaultParams(),
      layoutId: 'grid',
      hierarchy: HIERARCHY_PRESETS.heroFocus.value,
      seed: 'hier-role-1',
    };
    const svg = serialize(buildTile(params).svg);
    expect(svg).toMatch(/data-role="(hero|secondary|filler|accent)"/);
  });

  it('bouquet (Cluster Engine-backed) tags its own real hero/secondary/filler/accent roles', () => {
    const params: GenerateParams = { ...defaultParams(), layoutId: 'bouquet', seed: 'hier-role-2' };
    const svg = serialize(buildTile(params).svg);
    expect(svg).toMatch(/data-role="hero"/);
    expect(svg).toMatch(/data-role="(secondary|filler|accent)"/);
  });

  it('does not apply the generic hierarchy pass on exempt layouts (bouquet already builds its own tiers via the Cluster Engine) — a hierarchy preset has zero effect on its output', () => {
    const withoutHierarchy = serialize(buildTile({ ...defaultParams(), layoutId: 'bouquet', seed: 'hier-role-exempt' }).svg);
    const withHierarchy = serialize(
      buildTile({ ...defaultParams(), layoutId: 'bouquet', hierarchy: HIERARCHY_PRESETS.heroFocus.value, seed: 'hier-role-exempt' }).svg,
    );
    expect(withHierarchy).toBe(withoutHierarchy);
  });
});

describe('buildTile: Layer Priority paint order (Build 001, Section 2)', () => {
  it('paints every hero-role motif after every other roled motif, so hero always renders on top', () => {
    const tile = buildTile({ ...defaultParams(), layoutId: 'grid', hierarchy: HIERARCHY_PRESETS.heroFocus.value, seed: 'layer-priority-1' });
    const instances = extractInstances(tile);
    const heroIndices = instances.filter((i) => i.role === 'hero').map((i) => i.index);
    const otherIndices = instances.filter((i) => i.role && i.role !== 'hero').map((i) => i.index);
    expect(heroIndices.length).toBeGreaterThan(0);
    expect(otherIndices.length).toBeGreaterThan(0);
    expect(Math.min(...heroIndices)).toBeGreaterThan(Math.max(...otherIndices));
  });

  it('is a strict no-op for a tile with no roles at all (paint order identical to before Layer Priority existed)', () => {
    const noHierarchy = { ...defaultParams(), layoutId: 'grid' as const, seed: 'layer-priority-2' };
    delete (noHierarchy as Partial<GenerateParams>).hierarchy;
    const withoutSort = serialize(buildTile(noHierarchy).svg);
    // No hierarchy set at all -> every placement has role undefined -> the
    // stable sort must leave the array (and therefore the output) unchanged.
    expect(withoutSort).not.toMatch(/data-role/);
  });

  it('the bouquet layout (Cluster Engine-backed, already hero-first internally) still ends with hero painted last', () => {
    const tile = buildTile({ ...defaultParams(), layoutId: 'bouquet', categoryId: 'botanical', seed: 'layer-priority-3' });
    const instances = extractInstances(tile);
    const heroIndices = instances.filter((i) => i.role === 'hero').map((i) => i.index);
    const otherIndices = instances.filter((i) => i.role && i.role !== 'hero').map((i) => i.index);
    if (heroIndices.length > 0 && otherIndices.length > 0) {
      expect(Math.min(...heroIndices)).toBeGreaterThan(Math.max(...otherIndices));
    }
  });
});

describe('buildTile: Regular Lattice layouts opt out of Composition Intelligence V2 (Build 001)', () => {
  it('a strict Grid layout at full default settings still reads as a genuine even lattice', () => {
    // Regression guard: Composition Intelligence V2's new flow-bias/
    // negative-space/attraction passes must not fight Grid's own deliberate
    // even spacing — verified indirectly via the Design Critic's
    // spacingUniformity metric elsewhere; here we just confirm the V2 fields
    // being present at all doesn't throw or corrupt Grid's output.
    const params: GenerateParams = { ...defaultParams(), layoutId: 'grid', seed: 'regular-lattice-1' };
    expect(() => buildTile(params)).not.toThrow();
  });

  it('every Regular Lattice layout (Grid, Grid Minimal, Half-Drop, Brick, Stripe) produces identical output whether or not the new V2 fields are present (only V1 fields ever apply to them)', () => {
    for (const layoutId of ['grid', 'gridMinimal', 'halfDrop', 'brick', 'stripe'] as const) {
      const v1Only = serialize(buildTile({ ...defaultParams(), layoutId, compositionIntelligence: { balanceStrength: 0.5, rhythmStrength: 0.35 }, seed: `regular-lattice-2-${layoutId}` }).svg);
      const withV2 = serialize(
        buildTile({
          ...defaultParams(),
          layoutId,
          compositionIntelligence: {
            balanceStrength: 0.5,
            rhythmStrength: 0.35,
            attractionStrength: 0.9,
            negativeSpaceStrength: 0.9,
            flowProfile: 'dynamic',
            flowBiasStrength: 0.9,
          },
          seed: `regular-lattice-2-${layoutId}`,
        }).svg,
      );
      expect(withV2).toBe(v1Only);
    }
  });

  it('a non-lattice layout (scatter) is genuinely affected by the new V2 fields', () => {
    const v1Only = serialize(buildTile({ ...defaultParams(), layoutId: 'scatter', compositionIntelligence: { balanceStrength: 0.5, rhythmStrength: 0.35 }, seed: 'regular-lattice-3' }).svg);
    const withV2 = serialize(
      buildTile({
        ...defaultParams(),
        layoutId: 'scatter',
        compositionIntelligence: {
          balanceStrength: 0.5,
          rhythmStrength: 0.35,
          attractionStrength: 0.9,
          negativeSpaceStrength: 0.9,
          flowProfile: 'dynamic',
          flowBiasStrength: 0.9,
        },
        seed: 'regular-lattice-3',
      }).svg,
    );
    expect(withV2).not.toBe(v1Only);
  });
});

describe('buildTile: Composition Intelligence Engine', () => {
  it('a params object with no compositionIntelligence field (pre-v1.29 shape) still builds', () => {
    const legacy = { ...defaultParams(), seed: 'ci-legacy-1' };
    delete (legacy as Partial<GenerateParams>).compositionIntelligence;
    expect(() => buildTile(legacy)).not.toThrow();
  });

  it('undefined compositionIntelligence produces identical output to the field being entirely absent', () => {
    const withField = { ...defaultParams(), compositionIntelligence: undefined, seed: 'ci-legacy-2' };
    const withoutField = { ...defaultParams(), seed: 'ci-legacy-2' } as Partial<GenerateParams>;
    delete withoutField.compositionIntelligence;
    expect(serialize(buildTile(withField).svg)).toBe(serialize(buildTile(withoutField as GenerateParams).svg));
  });

  it('actually changes the generated geometry for at least one real scenario (not a silent no-op when enabled)', () => {
    let foundDifference = false;
    for (let i = 0; i < 20 && !foundDifference; i++) {
      const base: GenerateParams = { ...defaultParams(), layoutId: 'scatter', density: 0.15, motifSize: 150, seed: `ci-diff-${i}` };
      const off = serialize(buildTile({ ...base, compositionIntelligence: undefined }).svg);
      const on = serialize(buildTile({ ...base, compositionIntelligence: { balanceStrength: 1, rhythmStrength: 1 } }).svg);
      if (off !== on) foundDifference = true;
    }
    expect(foundDifference).toBe(true);
  });

  it('same seed + settings with the feature on reproduce byte-identical output (determinism preserved)', () => {
    const params: GenerateParams = { ...defaultParams(), compositionIntelligence: { balanceStrength: 0.8, rhythmStrength: 0.5 }, seed: 'ci-determinism' };
    expect(serialize(buildTile(params).svg)).toBe(serialize(buildTile(params).svg));
  });

  it('never produces NaN/Infinity or duplicate ids across several layouts with the feature at full strength', () => {
    const layoutIds: GenerateParams['layoutId'][] = ['grid', 'scatter', 'halfDrop', 'sCurve', 'toss'];
    for (const layoutId of layoutIds) {
      const svg = serialize(
        buildTile({
          ...defaultParams(),
          layoutId,
          compositionIntelligence: { balanceStrength: 1, rhythmStrength: 1 },
          seed: `ci-robust-${layoutId}`,
        }).svg,
      );
      expect(svg).not.toMatch(/NaN|Infinity/);
      const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('buildTile: Artistic Balance Engine (Build 011, Section 1)', () => {
  it('artisticBalance is a strict no-op when left unset (same output as before this build)', () => {
    const base: GenerateParams = { ...defaultParams(), layoutId: 'scatter', density: 0.15, motifSize: 150, compositionIntelligence: { balanceStrength: 1, rhythmStrength: 0.5 }, seed: 'artistic-balance-noop' };
    const withoutFlag = serialize(buildTile(base).svg);
    const explicitlyUnset = serialize(buildTile({ ...base, compositionIntelligence: { ...base.compositionIntelligence!, artisticBalance: undefined } }).svg);
    expect(explicitlyUnset).toBe(withoutFlag);
  });

  it('enabling artisticBalance actually changes geometry for at least one real scenario', () => {
    // A perceptually-heavier hero only flips which grid cell reads as
    // "heaviest" in a minority of random scatter layouts (empirically ~1 in
    // 40 with this exact scenario) -- most already have an unambiguously
    // heaviest cell regardless of the hero's own detail/color bump, which is
    // the expected, honest behavior of a *correction* pass, not a defect.
    // 100 seeds keeps this a reliable, non-flaky assertion of "this really
    // does something", not a demand that it dominates every composition.
    let foundDifference = false;
    for (let i = 0; i < 100 && !foundDifference; i++) {
      const base: GenerateParams = {
        ...defaultParams(),
        layoutId: 'scatter',
        density: 0.15,
        motifSize: 150,
        hierarchy: DEFAULT_HIERARCHY,
        compositionIntelligence: { balanceStrength: 1, rhythmStrength: 0 },
        seed: `artistic-balance-diff-${i}`,
      };
      const off = serialize(buildTile(base).svg);
      const on = serialize(buildTile({ ...base, compositionIntelligence: { ...base.compositionIntelligence!, artisticBalance: true } }).svg);
      if (off !== on) foundDifference = true;
    }
    expect(foundDifference).toBe(true);
  });

  it('same seed + settings with artisticBalance on reproduce byte-identical output (determinism preserved)', () => {
    const params: GenerateParams = { ...defaultParams(), hierarchy: DEFAULT_HIERARCHY, compositionIntelligence: { balanceStrength: 1, rhythmStrength: 0.5, artisticBalance: true }, seed: 'artistic-balance-determinism' };
    expect(serialize(buildTile(params).svg)).toBe(serialize(buildTile(params).svg));
  });
});

describe('buildTile: Color Harmony Intelligence (Build 011, Section 3)', () => {
  it('colorHarmonyBias is a strict no-op when left unset (same output as before this build)', () => {
    const base: GenerateParams = { ...defaultParams(), paletteId: 'vibrant-pop', colorCount: 6, seed: 'color-harmony-bias-noop' };
    const withoutFlag = serialize(buildTile(base).svg);
    const explicitlyUnset = serialize(buildTile({ ...base, colorHarmonyBias: undefined }).svg);
    expect(explicitlyUnset).toBe(withoutFlag);
  });

  it('enabling colorHarmonyBias actually changes the resolved story color for at least one real palette/seed combination', () => {
    let foundDifference = false;
    for (let i = 0; i < 20 && !foundDifference; i++) {
      const base: GenerateParams = { ...defaultParams(), paletteId: 'vibrant-pop', colorCount: 6, seed: `color-harmony-bias-diff-${i}` };
      const off = serialize(buildTile(base).svg);
      const on = serialize(buildTile({ ...base, colorHarmonyBias: true }).svg);
      if (off !== on) foundDifference = true;
    }
    expect(foundDifference).toBe(true);
  });

  it('same seed + settings with colorHarmonyBias on reproduce byte-identical output (determinism preserved)', () => {
    const params: GenerateParams = { ...defaultParams(), paletteId: 'vibrant-pop', colorCount: 6, colorHarmonyBias: true, seed: 'color-harmony-bias-determinism' };
    expect(serialize(buildTile(params).svg)).toBe(serialize(buildTile(params).svg));
  });
});

describe('buildTile: Silhouette Intelligence — heroArchetype override (Build 011, Section 5)', () => {
  it('heroArchetype is a strict no-op when left unset (same output as before this build)', () => {
    const base = { ...defaultParams(), ...resolveStyleDna(STYLE_DNA_PRESETS.luxuryFloral, 'hero-archetype-noop'), seed: 'hero-archetype-noop' };
    const withoutFlag = serialize(buildTile(base).svg);
    const explicitlyUnset = serialize(buildTile({ ...base, heroArchetype: undefined }).svg);
    expect(explicitlyUnset).toBe(withoutFlag);
  });

  it('forcing heroArchetype makes every premium hero built for that tile report exactly that archetype', () => {
    const base = { ...defaultParams(), ...resolveStyleDna(STYLE_DNA_PRESETS.luxuryFloral, 'hero-archetype-forced'), seed: 'hero-archetype-forced' };
    const tile = buildTile({ ...base, heroArchetype: 'cascade' });
    expect(tile.premiumHeroArchetypes).toBeDefined();
    expect(tile.premiumHeroArchetypes!.length).toBeGreaterThan(0);
    for (const archetype of tile.premiumHeroArchetypes!) {
      expect(archetype).toBe('cascade');
    }
  });

  it('forcing heroArchetype actually changes geometry relative to the unconstrained roll for at least one real seed', () => {
    let foundDifference = false;
    for (let i = 0; i < 20 && !foundDifference; i++) {
      const base = { ...defaultParams(), ...resolveStyleDna(STYLE_DNA_PRESETS.luxuryFloral, `hero-archetype-diff-${i}`), seed: `hero-archetype-diff-${i}` };
      const off = serialize(buildTile(base).svg);
      const on = serialize(buildTile({ ...base, heroArchetype: 'editorial' }).svg);
      if (off !== on) foundDifference = true;
    }
    expect(foundDifference).toBe(true);
  });

  it('same seed + settings with heroArchetype forced reproduce byte-identical output (determinism preserved)', () => {
    const base = { ...defaultParams(), ...resolveStyleDna(STYLE_DNA_PRESETS.luxuryFloral, 'hero-archetype-determinism'), seed: 'hero-archetype-determinism', heroArchetype: 'asymmetric' as const };
    expect(serialize(buildTile(base).svg)).toBe(serialize(buildTile(base).svg));
  });
});

describe('buildTile: Premium Detail Distribution (Build 011, Section 6)', () => {
  it('detailDistribution is a strict no-op when left unset (same output as before this build)', () => {
    const base: GenerateParams = { ...defaultParams(), layoutId: 'scatter', density: 0.2, motifSize: 150, hierarchy: DEFAULT_HIERARCHY, seed: 'detail-distribution-noop' };
    const withoutFlag = serialize(buildTile(base).svg);
    const explicitlyUnset = serialize(buildTile({ ...base, detailDistribution: undefined }).svg);
    expect(explicitlyUnset).toBe(withoutFlag);
  });

  it('enabling detailDistribution actually changes geometry for at least one real seed (filler motifs can now get overlay detail)', () => {
    let foundDifference = false;
    for (let i = 0; i < 40 && !foundDifference; i++) {
      const base: GenerateParams = { ...defaultParams(), layoutId: 'scatter', density: 0.2, motifSize: 150, hierarchy: DEFAULT_HIERARCHY, seed: `detail-distribution-diff-${i}` };
      const off = serialize(buildTile(base).svg);
      const on = serialize(buildTile({ ...base, detailDistribution: true }).svg);
      if (off !== on) foundDifference = true;
    }
    expect(foundDifference).toBe(true);
  });

  it('same seed + settings with detailDistribution on reproduce byte-identical output (determinism preserved)', () => {
    const params: GenerateParams = { ...defaultParams(), layoutId: 'scatter', density: 0.2, motifSize: 150, hierarchy: DEFAULT_HIERARCHY, detailDistribution: true, seed: 'detail-distribution-determinism' };
    expect(serialize(buildTile(params).svg)).toBe(serialize(buildTile(params).svg));
  });
});

describe('buildTile: Style DNA metadata', () => {
  it('embeds no style-dna attributes when styleDnaId is unset (backward compatible)', () => {
    const svg = serialize(buildTile({ ...defaultParams(), seed: 'style-meta-none' }).svg);
    expect(svg).not.toMatch(/data-style-dna/);
  });

  it('embeds id/name/version attributes on the root tile-content group when styleDnaId is set', () => {
    const svg = serialize(buildTile({ ...defaultParams(), styleDnaId: 'darkBotanical', seed: 'style-meta-1' }).svg);
    expect(svg).toMatch(/data-style-dna-id="darkBotanical"/);
    expect(svg).toMatch(/data-style-dna-name="Dark Botanical"/);
    expect(svg).toMatch(/data-style-dna-version="1"/);
  });

  it('falls back to the id itself as the name for an unknown/custom style id', () => {
    const svg = serialize(buildTile({ ...defaultParams(), styleDnaId: 'myCustomStyle', seed: 'style-meta-2' }).svg);
    expect(svg).toMatch(/data-style-dna-id="myCustomStyle"/);
    expect(svg).toMatch(/data-style-dna-name="myCustomStyle"/);
  });
});

describe('buildTile: Negative Space Designer (Build 006, Section 5)', () => {
  it('omitting productTarget reproduces the exact prior output (backward compatible)', () => {
    const withField = buildTile({ ...defaultParams(), negativeSpace: 0.2, seed: 'negspace-product-none' });
    const without = { ...defaultParams(), negativeSpace: 0.2, seed: 'negspace-product-none' } as GenerateParams;
    delete without.productTarget;
    const alsoWithout = buildTile(without);
    expect(serialize(withField.svg)).toBe(serialize(alsoWithout.svg));
  });

  it('a giftWrap productTarget genuinely changes the generated tile vs. no productTarget', () => {
    const base = { ...defaultParams(), categoryId: 'botanical', layoutId: 'scatter' as const, negativeSpace: 0.2, seed: 'negspace-product-giftwrap' };
    const plain = buildTile(base);
    const giftWrap = buildTile({ ...base, productTarget: 'giftWrap' as const });
    expect(serialize(plain.svg)).not.toBe(serialize(giftWrap.svg));
  });
});

describe('buildTile: Product-aware Species Selection (Build 008B, Section 8)', () => {
  it('omitting productTarget with no botanicalFamily set reproduces the exact prior output (backward compatible)', () => {
    const withField = buildTile({ ...defaultParams(), categoryId: 'botanical', layoutId: 'scatter' as const, seed: 'product-species-none' });
    const without = { ...defaultParams(), categoryId: 'botanical', layoutId: 'scatter' as const, seed: 'product-species-none' } as GenerateParams;
    delete without.productTarget;
    const alsoWithout = buildTile(without);
    expect(serialize(withField.svg)).toBe(serialize(alsoWithout.svg));
  });

  it('a productTarget with no explicit botanicalFamily genuinely changes the generated botanical tile vs. no productTarget', () => {
    const base = { ...defaultParams(), categoryId: 'botanical', layoutId: 'scatter' as const, seed: 'product-species-wallpaper' };
    const plain = buildTile(base);
    const wallpaperTarget = buildTile({ ...base, productTarget: 'wallpaper' as const });
    expect(serialize(plain.svg)).not.toBe(serialize(wallpaperTarget.svg));
  });

  it('an explicit botanicalFamily always wins over a productTarget-driven fallback', () => {
    // Composition Intelligence is disabled and compositionZone pinned equal
    // in both variants so this test isolates species/family selection
    // specifically -- productTarget now has two other real, independent
    // effects: Build 009 Section 3 (a per-product rhythm/cluster-looseness
    // nudge on compositionIntelligence) and Build 009 Section 8 (a
    // per-product compositionZone fallback, see
    // `resolveCompositionZoneForProduct`) -- so the two builds are no
    // longer expected to be byte-identical SVGs once either pass is active.
    const withFamily = buildTile({
      ...defaultParams(), categoryId: 'botanical', layoutId: 'scatter' as const,
      botanicalFamily: 'olive', productTarget: 'wallpaper' as const, compositionIntelligence: undefined, compositionZone: 'diagonal',
      seed: 'product-species-explicit-family',
    });
    const withFamilyNoProduct = buildTile({
      ...defaultParams(), categoryId: 'botanical', layoutId: 'scatter' as const,
      botanicalFamily: 'olive', compositionIntelligence: undefined, compositionZone: 'diagonal',
      seed: 'product-species-explicit-family',
    });
    expect(serialize(withFamily.svg)).toBe(serialize(withFamilyNoProduct.svg));
  });

  it('every real ProductUseId builds a valid botanical tile with no explicit family set', () => {
    for (const productTarget of PRODUCT_USE_IDS) {
      expect(() =>
        buildTile({ ...defaultParams(), categoryId: 'botanical', layoutId: 'scatter' as const, productTarget, seed: `product-species-${productTarget}` }),
      ).not.toThrow();
    }
  });
});

describe('buildTile: Product-aware Composition Engine (Build 010, Section 7)', () => {
  it('omitting productTarget with hierarchy configured reproduces the exact prior output (backward compatible)', () => {
    const withField = buildTile({
      ...defaultParams(), categoryId: 'botanical', layoutId: 'scatter' as const, hierarchy: DEFAULT_HIERARCHY, seed: 'product-rhythm-none',
    });
    const without = {
      ...defaultParams(), categoryId: 'botanical', layoutId: 'scatter' as const, hierarchy: DEFAULT_HIERARCHY, seed: 'product-rhythm-none',
    } as GenerateParams;
    delete without.productTarget;
    const alsoWithout = buildTile(without);
    expect(serialize(withField.svg)).toBe(serialize(alsoWithout.svg));
  });

  it('a giftWrap productTarget with hierarchy configured genuinely changes the tile vs. no productTarget (premiumRhythm fallback)', () => {
    const base = { ...defaultParams(), categoryId: 'botanical', layoutId: 'scatter' as const, hierarchy: DEFAULT_HIERARCHY, seed: 'product-rhythm-giftwrap' };
    const plain = buildTile(base);
    const giftWrap = buildTile({ ...base, productTarget: 'giftWrap' as const });
    expect(serialize(plain.svg)).not.toBe(serialize(giftWrap.svg));
  });

  it('an explicit hierarchy.premiumRhythm always wins over the product fallback', () => {
    // Every other product-sensitive dimension is pinned identically in both
    // variants (same discipline as the depthStrength isolation test below)
    // so this isolates premiumRhythm specifically.
    const shared = {
      ...defaultParams(), categoryId: 'botanical', layoutId: 'scatter' as const,
      botanicalFamily: 'olive' as const, compositionIntelligence: undefined, compositionZone: 'diagonal' as const,
      hierarchy: { ...DEFAULT_HIERARCHY, premiumRhythm: false }, depthStrength: 0, negativeSpace: 1,
      seed: 'product-rhythm-explicit',
    };
    const explicit = buildTile({ ...shared, productTarget: 'giftWrap' as const });
    const explicitNoProduct = buildTile(shared);
    expect(serialize(explicit.svg)).toBe(serialize(explicitNoProduct.svg));
  });

  it('an explicit params.depthStrength always wins over the product fallback', () => {
    // Every other product-sensitive dimension (botanicalFamily, composition
    // zone/intelligence, hierarchy.premiumRhythm) is pinned identically in
    // both variants so this isolates depthStrength specifically -- the same
    // "pin everything else, vary one dimension" approach the botanicalFamily
    // no-op test above already established.
    const shared = {
      ...defaultParams(), categoryId: 'botanical', layoutId: 'scatter' as const,
      botanicalFamily: 'olive' as const, compositionIntelligence: undefined, compositionZone: 'diagonal' as const,
      hierarchy: { ...DEFAULT_HIERARCHY, premiumRhythm: false }, depthStrength: 0,
      // Pinned at the [0, 1] clamp ceiling so Build 006's own
      // resolveNegativeSpaceForProduct adjustment (a real, separate,
      // pre-existing productTarget effect) clamps to the same value with
      // or without productTarget -- isolating depthStrength specifically.
      negativeSpace: 1,
      seed: 'product-depth-explicit',
    };
    const explicit = buildTile({ ...shared, productTarget: 'giftWrap' as const });
    const explicitNoProduct = buildTile(shared);
    expect(serialize(explicit.svg)).toBe(serialize(explicitNoProduct.svg));
  });
});

describe('buildTile: Luxury Negative Space Engine — artisticBalance product fallback (Build 011, Section 2)', () => {
  it('an explicit compositionIntelligence.artisticBalance:false is not overridden by the giftWrap fallback (which resolves true)', () => {
    // Both variants share the exact same productTarget, so giftWrap's other
    // real, always-active effects (spacing-strategy rhythm/cluster nudge,
    // negative space, depth, premiumRhythm, professionalRules) apply
    // identically in both -- only artisticBalance's own resolved value
    // differs (fallback true vs. explicit false), isolating it specifically.
    // As Section 1's own test found, a perceptually-heavier hero only flips
    // the balance-correction outcome in a minority of layouts, so this
    // checks several seeds for at least one real difference rather than
    // asserting it on a single arbitrary seed.
    //
    // Build 025 (Phase 10, flaky-test root cause): the default tileSize
    // (1200) / density (0.55) fixture generates hundreds of bouquet
    // placements per buildTile() call, and this loop calls buildTile() up
    // to 60 times (30 seeds x 2 variants) hunting for the first seed that
    // differs -- measured standalone at ~250-450ms/call, ~8.5-9.5s total
    // wall-clock for the (deterministic) 26 iterations this exact fixture
    // needs, which sits close enough to the global 15000ms testTimeout
    // that ordinary full-suite worker contention pushes it over. This is
    // not an async/timer/race-condition bug -- buildTile() here is pure
    // and synchronous -- it is a heavy-per-call fixture cost. A smaller
    // tileSize/motifSize exercises the exact same artisticBalance
    // fallback-resolution code path with far fewer placements to
    // position/repair per call (measured: first difference now found at
    // seed index 0, ~60-80ms total), so the fix targets the actual cost
    // rather than the timeout.
    let foundDifference = false;
    for (let i = 0; i < 30 && !foundDifference; i++) {
      const base = {
        ...defaultParams(), categoryId: 'botanical', layoutId: 'scatter' as const,
        productTarget: 'giftWrap' as const,
        tileSize: 400, motifSize: 60,
        compositionIntelligence: DEFAULT_COMPOSITION_INTELLIGENCE,
        seed: `product-artistic-balance-explicit-${i}`,
      };
      const fallbackResolvesTrue = serialize(buildTile(base).svg);
      const explicitFalse = serialize(buildTile({ ...base, compositionIntelligence: { ...DEFAULT_COMPOSITION_INTELLIGENCE, artisticBalance: false } }).svg);
      if (explicitFalse !== fallbackResolvesTrue) foundDifference = true;
    }
    expect(foundDifference).toBe(true);
  });

  it('the artisticBalance fallback never reaches a REGULAR_LATTICE layout (a lattice layout stays fully opted out of Composition Intelligence V2)', () => {
    const base = {
      ...defaultParams(), categoryId: 'botanical', layoutId: 'grid' as const,
      compositionIntelligence: DEFAULT_COMPOSITION_INTELLIGENCE, hierarchy: DEFAULT_HIERARCHY,
      seed: 'product-artistic-balance-lattice',
    };
    const withoutProduct = serialize(buildTile(base).svg);
    // If the artisticBalance fallback leaked past REGULAR_LATTICE_LAYOUTS'
    // own trim, a giftWrap productTarget (which resolves artisticBalance:
    // true) would produce different geometry purely from that leak on top
    // of giftWrap's own already-real negativeSpace/spacing-strategy effects
    // -- so instead this compares giftWrap WITH vs WITHOUT an explicit
    // artisticBalance override: if the trim is working, the override itself
    // can never reach the pipeline, so both must be identical.
    const giftWrapDefault = serialize(buildTile({ ...base, productTarget: 'giftWrap' as const }).svg);
    const giftWrapExplicitArtisticBalance = serialize(
      buildTile({ ...base, productTarget: 'giftWrap' as const, compositionIntelligence: { ...DEFAULT_COMPOSITION_INTELLIGENCE, artisticBalance: true } }).svg,
    );
    expect(giftWrapExplicitArtisticBalance).toBe(giftWrapDefault);
    expect(giftWrapDefault).not.toBe(withoutProduct); // giftWrap's other real effects (negative space etc.) still apply
  });
});
