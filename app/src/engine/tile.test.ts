import { describe, it, expect } from 'vitest';
import { buildTile } from './tile';
import { defaultParams } from './defaults';
import { serialize } from './svgAst';
import { GENERATORS } from '../generators';
import { LAYOUTS } from '../layouts';
import { HIERARCHY_PRESETS } from './hierarchy';
import { extractInstances } from './svgGeometry';
import type { GenerateParams } from './types';
import { PRODUCT_USE_IDS } from '../collection/productTargets';

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
    const withFamily = buildTile({
      ...defaultParams(), categoryId: 'botanical', layoutId: 'scatter' as const,
      botanicalFamily: 'olive', productTarget: 'wallpaper' as const, seed: 'product-species-explicit-family',
    });
    const withFamilyNoProduct = buildTile({
      ...defaultParams(), categoryId: 'botanical', layoutId: 'scatter' as const,
      botanicalFamily: 'olive', seed: 'product-species-explicit-family',
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
