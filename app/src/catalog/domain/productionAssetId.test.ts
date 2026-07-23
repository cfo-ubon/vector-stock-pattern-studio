import { describe, it, expect } from 'vitest';
import { computeProductionAssetId, isValidProductionAssetId } from './productionAssetId';
import type { ProductionAssetIdentityInput } from './productionAssetId';

function baseInput(overrides: Partial<ProductionAssetIdentityInput> = {}): ProductionAssetIdentityInput {
  return {
    generatorVersion: '1.79',
    styleDna: 'luxuryFloral',
    presetId: 'luxuryFloral',
    compositionType: 'bouquet',
    productTargets: ['fabric', 'wallpaper'],
    generatorSeed: 'm25-1',
    canonicalSvg: '<svg>fixture</svg>',
    ...overrides,
  };
}

describe('computeProductionAssetId', () => {
  it('produces a validly-shaped id', async () => {
    const id = await computeProductionAssetId(baseInput());
    expect(isValidProductionAssetId(id)).toBe(true);
  });

  it('is stable across copy/rename/restart — same input always yields the same id', async () => {
    const a = await computeProductionAssetId(baseInput());
    const b = await computeProductionAssetId(baseInput());
    expect(a).toBe(b);
  });

  it('is order-independent for productTargets (same design, differently-ordered array)', async () => {
    const a = await computeProductionAssetId(baseInput({ productTargets: ['fabric', 'wallpaper'] }));
    const b = await computeProductionAssetId(baseInput({ productTargets: ['wallpaper', 'fabric'] }));
    expect(a).toBe(b);
  });

  it('does not use filename as identity — filename/path are not inputs at all', async () => {
    // Same generation inputs, no filename parameter exists to pass — this test
    // documents the invariant by construction: there is no way to make two
    // calls differ only by filename, because filename cannot be supplied.
    const a = await computeProductionAssetId(baseInput());
    const b = await computeProductionAssetId(baseInput());
    expect(a).toBe(b);
  });

  it('changes when the seed changes (different generated design)', async () => {
    const a = await computeProductionAssetId(baseInput({ generatorSeed: 'm25-1' }));
    const b = await computeProductionAssetId(baseInput({ generatorSeed: 'm25-2' }));
    expect(a).not.toBe(b);
  });

  it('changes when the style DNA changes', async () => {
    const a = await computeProductionAssetId(baseInput({ styleDna: 'luxuryFloral' }));
    const b = await computeProductionAssetId(baseInput({ styleDna: 'darkBotanical' }));
    expect(a).not.toBe(b);
  });

  it('changes when the composition type changes', async () => {
    const a = await computeProductionAssetId(baseInput({ compositionType: 'bouquet' }));
    const b = await computeProductionAssetId(baseInput({ compositionType: 'heroScatter' }));
    expect(a).not.toBe(b);
  });

  it('changes when the product targets differ (not just reordered)', async () => {
    const a = await computeProductionAssetId(baseInput({ productTargets: ['fabric', 'wallpaper'] }));
    const b = await computeProductionAssetId(baseInput({ productTargets: ['fabric'] }));
    expect(a).not.toBe(b);
  });

  it('changes when the generator version changes (reproducibility across builds)', async () => {
    const a = await computeProductionAssetId(baseInput({ generatorVersion: '1.79' }));
    const b = await computeProductionAssetId(baseInput({ generatorVersion: '1.80' }));
    expect(a).not.toBe(b);
  });

  it('changes when the SVG content changes', async () => {
    const a = await computeProductionAssetId(baseInput({ canonicalSvg: '<svg>a</svg>' }));
    const b = await computeProductionAssetId(baseInput({ canonicalSvg: '<svg>b</svg>' }));
    expect(a).not.toBe(b);
  });

  it('does not let field-boundary shifting create a false collision (empty compositionType vs empty presetId)', async () => {
    const a = await computeProductionAssetId(baseInput({ presetId: '', compositionType: 'x' }));
    const b = await computeProductionAssetId(baseInput({ presetId: 'x', compositionType: null }));
    expect(a).not.toBe(b);
  });

  it('treats null and empty-string compositionType as the same canonical value', async () => {
    const a = await computeProductionAssetId(baseInput({ compositionType: null }));
    const b = await computeProductionAssetId(baseInput({ compositionType: '' }));
    expect(a).toBe(b);
  });
});

describe('isValidProductionAssetId', () => {
  it('rejects non-matching strings', () => {
    expect(isValidProductionAssetId('not-a-valid-id')).toBe(false);
    expect(isValidProductionAssetId('')).toBe(false);
    expect(isValidProductionAssetId(null)).toBe(false);
    expect(isValidProductionAssetId(undefined)).toBe(false);
    expect(isValidProductionAssetId(12345)).toBe(false);
  });

  it('accepts a well-formed id', async () => {
    const id = await computeProductionAssetId(baseInput());
    expect(isValidProductionAssetId(id)).toBe(true);
  });
});
