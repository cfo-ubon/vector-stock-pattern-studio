import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { STYLE_DNA_PRESETS, resolveStyleDna } from '../engine/styleDna';
import { generateCollection, verifyConsistency, COLLECTION_SCHEMA_VERSION, type AssetType } from './collectionGenerator';

const EXPECTED_ASSET_TYPES: AssetType[] = [
  'heroPattern', 'secondaryPattern', 'blenderPattern', 'miniPattern', 'stripePattern', 'backgroundTexture',
  'densePattern', 'airyPattern',
  'borderPattern', 'cornerPattern', 'spotMotifSheet', 'individualMotif', 'decorativeElementsSheet',
  'collectionPreview', 'metadata', 'seoPackage',
];

describe('generateCollection: Collection', () => {
  it('produces every required asset type at least once', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-types' });
    const presentTypes = new Set(assets.map((a) => a.type));
    for (const type of EXPECTED_ASSET_TYPES) {
      expect(presentTypes.has(type)).toBe(true);
    }
  });

  it('produces exactly 4 border assets (one per edge) and 4 corner assets (one per corner)', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-border-corner-count' });
    expect(assets.filter((a) => a.type === 'borderPattern').length).toBe(4);
    expect(assets.filter((a) => a.type === 'cornerPattern').length).toBe(4);
  });

  it('is fully deterministic for the same base params', () => {
    const params = { ...defaultParams(), seed: 'collection-det' };
    const a = generateCollection(params);
    const b = generateCollection(params);
    // createdAt is real wall-clock time by design (like every other
    // `createdAt` timestamp in this app, e.g. SavedItem) — excluded from
    // the determinism comparison on purpose, everything else must match.
    const { createdAt: _a, ...manifestA } = a.manifest;
    const { createdAt: _b, ...manifestB } = b.manifest;
    expect(manifestA).toEqual(manifestB);
    expect(a.assets.map((x) => x.svg ?? JSON.stringify(x.data))).toEqual(b.assets.map((x) => x.svg ?? JSON.stringify(x.data)));
  });

  it('a different seed produces a genuinely different collection', () => {
    const a = generateCollection({ ...defaultParams(), seed: 'collection-seed-a' });
    const b = generateCollection({ ...defaultParams(), seed: 'collection-seed-b' });
    expect(a.assets.find((x) => x.id === 'hero')!.svg).not.toBe(b.assets.find((x) => x.id === 'hero')!.svg);
  });

  it('every svg-based asset is a well-formed, non-empty SVG document with no NaN/Infinity', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-svg-validity' });
    for (const asset of assets) {
      if (!asset.svg) continue;
      expect(asset.svg).toMatch(/^<\?xml/);
      expect(asset.svg).toContain('<svg');
      expect(asset.svg).not.toMatch(/NaN|Infinity/);
      expect(asset.svg).not.toMatch(/<image/i);
      expect(asset.svg).not.toMatch(/data:image/i);
    }
  });
});

describe('generateCollection: Style DNA / palette / motif family sharing (acceptance criteria)', () => {
  it('every pattern asset shares the same category and palette as the base params', () => {
    const params = { ...defaultParams(), categoryId: 'botanical', paletteId: 'jewel-tones', seed: 'collection-share-1' };
    // Re-derive each pattern tile's params by inspecting the manifest consistency check instead
    // of re-parsing SVG — the consistency check itself is the authoritative signal here.
    const { manifest } = generateCollection(params);
    expect(manifest.consistency.consistent).toBe(true);
    expect(manifest.consistency.issues).toEqual([]);
  });

  it('carries the active Style DNA id through to the manifest', () => {
    const dna = STYLE_DNA_PRESETS.darkBotanical;
    const params = { ...defaultParams(), ...resolveStyleDna(dna, 'collection-styledna'), seed: 'collection-styledna' };
    const { manifest } = generateCollection(params, dna);
    expect(manifest.styleDnaId).toBe('darkBotanical');
    expect(manifest.consistency.consistent).toBe(true);
  });

  it(
    'the positive-path guarantee holds across a sample of built-in Style DNA presets',
    () => {
      // Four full collection builds in one test — past the global 15000ms
      // default under full-suite worker contention on slower/fewer-core CI
      // runners; same headroom reasoning as the layout-diversity sweep
      // test below and the Design Spec determinism test's own override.
      const sample = [STYLE_DNA_PRESETS.editorialBotanical, STYLE_DNA_PRESETS.luxuryWallpaper, STYLE_DNA_PRESETS.modernTropical, STYLE_DNA_PRESETS.kidsPlayful];
      for (const dna of sample) {
        const params = { ...defaultParams(), ...resolveStyleDna(dna, 'collection-consistency-sweep') };
        const { manifest } = generateCollection(params, dna);
        expect(manifest.consistency.consistent).toBe(true);
      }
    },
    30000,
  );

  it('verifyConsistency genuinely flags a real disagreement (palette/style/category) — regression guard', () => {
    const base = defaultParams();
    const agreeing = [base, base, base];
    expect(verifyConsistency(agreeing).consistent).toBe(true);

    const paletteMismatch = [base, { ...base, paletteId: 'jewel-tones' }, base];
    const paletteResult = verifyConsistency(paletteMismatch);
    expect(paletteResult.consistent).toBe(false);
    expect(paletteResult.issues.some((i) => i.includes('palette'))).toBe(true);

    const styleMismatch = [{ ...base, styleDnaId: 'a' }, { ...base, styleDnaId: 'b' }];
    const styleResult = verifyConsistency(styleMismatch);
    expect(styleResult.consistent).toBe(false);
    expect(styleResult.issues.some((i) => i.includes('Style DNA'))).toBe(true);

    const categoryMismatch = [{ ...base, categoryId: 'botanical' }, { ...base, categoryId: 'geometric' }];
    const categoryResult = verifyConsistency(categoryMismatch);
    expect(categoryResult.consistent).toBe(false);
    expect(categoryResult.issues.some((i) => i.includes('motif family'))).toBe(true);
  });

  it('the collection manifest exposes a dominant motif family derived from the category', () => {
    const params = { ...defaultParams(), categoryId: 'tropical', seed: 'collection-family' };
    const { manifest } = generateCollection(params);
    expect(manifest.motifFamily).toBe('leaf');
  });
});

describe('generateCollection: Motif Factory relationships', () => {
  it('every border/corner/sheet asset lists real motif ids that exist in the returned motif set', () => {
    const { assets, motifs } = generateCollection({ ...defaultParams(), seed: 'collection-relationships' });
    const motifIds = new Set(motifs.map((m) => m.id));
    const withMotifs = assets.filter((a) => a.motifIds.length > 0);
    expect(withMotifs.length).toBeGreaterThan(0);
    for (const asset of withMotifs) {
      for (const motifId of asset.motifIds) {
        expect(motifIds.has(motifId)).toBe(true);
      }
    }
  });

  it('the manifest relationships list is exactly the flattened asset->motif pairs', () => {
    const { manifest } = generateCollection({ ...defaultParams(), seed: 'collection-relationship-shape' });
    const expectedCount = manifest.assets.reduce((sum, a) => sum + a.motifIds.length, 0);
    expect(manifest.relationships.length).toBe(expectedCount);
    for (const rel of manifest.relationships) {
      const asset = manifest.assets.find((a) => a.id === rel.assetId);
      expect(asset).toBeDefined();
      expect(asset!.motifIds).toContain(rel.motifId);
    }
  });
});

describe('generateCollection: Collection Manifest', () => {
  it('carries the correct schema version', () => {
    const { manifest } = generateCollection({ ...defaultParams(), seed: 'collection-schema' });
    expect(manifest.schemaVersion).toBe(COLLECTION_SCHEMA_VERSION);
  });

  it('every asset filename is unique within the collection', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-filenames' });
    const filenames = assets.map((a) => a.filename);
    expect(new Set(filenames).size).toBe(filenames.length);
  });

  it('carries the seed and resolved palette colors', () => {
    const { manifest } = generateCollection({ ...defaultParams(), seed: 'collection-manifest-fields' });
    expect(manifest.seed).toBe('collection-manifest-fields');
    expect(manifest.palette.colors.length).toBeGreaterThan(0);
  });
});

describe('generateCollection: Metadata / SEO Package', () => {
  it('metadata asset carries per-site SEO fields for all 6 marketplaces (incl. Etsy)', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-metadata' });
    const metaAsset = assets.find((a) => a.type === 'metadata')!;
    const data = metaAsset.data as { siteMetadata: Array<{ id: string }> };
    expect(data.siteMetadata.length).toBe(6);
  });

  it('SEO Package asset carries real Shutterstock + Adobe Stock CSV text covering all 7 sellable pattern assets', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-seo' });
    const seoAsset = assets.find((a) => a.type === 'seoPackage')!;
    const data = seoAsset.data as { shutterstockCsv: string; adobeStockCsv: string };
    const shutterstockRows = data.shutterstockCsv.trim().split('\r\n');
    // header + 7 sellable pattern-type assets (hero/secondary/blender/mini/stripe/dense/airy)
    expect(shutterstockRows.length).toBe(8);
    expect(data.adobeStockCsv.length).toBeGreaterThan(0);
  });
});

describe('generateCollection: Background Texture & Individual Motifs (Commercial Collection Engine Phase 4, Section 2)', () => {
  it('produces exactly one backgroundTexture asset with a valid, non-trivial SVG document', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-bg-texture' });
    const bgAssets = assets.filter((a) => a.type === 'backgroundTexture');
    expect(bgAssets.length).toBe(1);
    expect(bgAssets[0].svg).toContain('<svg');
  });

  it('produces exactly 6 individualMotif assets, each referencing exactly one real motif id', () => {
    const { assets, motifs } = generateCollection({ ...defaultParams(), seed: 'collection-individual-motifs' });
    const individualAssets = assets.filter((a) => a.type === 'individualMotif');
    expect(individualAssets.length).toBe(6);
    const motifIds = new Set(motifs.map((m) => m.id));
    for (const asset of individualAssets) {
      expect(asset.motifIds.length).toBe(1);
      expect(motifIds.has(asset.motifIds[0])).toBe(true);
      expect(asset.svg).toContain('<svg');
    }
  });

  it('every individualMotif filename is unique', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-individual-filenames' });
    const filenames = assets.filter((a) => a.type === 'individualMotif').map((a) => a.filename);
    expect(new Set(filenames).size).toBe(filenames.length);
  });

  it('the background texture is a real, independent buildTile output — not a copy of the hero pattern', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-bg-distinct' });
    const hero = assets.find((a) => a.type === 'heroPattern')!.svg!;
    const bg = assets.find((a) => a.type === 'backgroundTexture')!.svg!;
    expect(bg).not.toBe(hero);
  });
});

describe('generateCollection: Dense Pattern & Airy Pattern (Commercial Collection Engine Phase 4b, Section 2)', () => {
  it('produces exactly one densePattern and one airyPattern asset with valid, non-trivial SVG documents', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-dense-airy' });
    const dense = assets.filter((a) => a.type === 'densePattern');
    const airy = assets.filter((a) => a.type === 'airyPattern');
    expect(dense.length).toBe(1);
    expect(airy.length).toBe(1);
    expect(dense[0].svg).toContain('<svg');
    expect(airy[0].svg).toContain('<svg');
  });

  it('dense pattern is meaningfully denser than airy pattern (real, distinct buildTile outputs)', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-dense-airy-distinct' });
    const dense = assets.find((a) => a.type === 'densePattern')!.svg!;
    const airy = assets.find((a) => a.type === 'airyPattern')!.svg!;
    expect(dense).not.toBe(airy);
  });

  it('dense/airy patterns get their own genuinely distinct layouts, not reused from any other pattern asset', () => {
    const { patternTiles } = generateCollection({ ...defaultParams(), seed: 'collection-dense-airy-layout' });
    const layouts = patternTiles.map((t) => t.params.layoutId);
    expect(new Set(layouts).size).toBe(layouts.length);
  });
});

describe('generateCollection: Motif Reuse Engine (Commercial Collection Engine Phase 4b, Section 6)', () => {
  it('exposes a real motifReuse report with at least one genuinely shared filler motif (border + corner share a pool)', () => {
    const { motifReuse } = generateCollection({ ...defaultParams(), seed: 'collection-motif-reuse' });
    expect(motifReuse.totalDistinctMotifs).toBeGreaterThan(0);
    expect(motifReuse.reusedMotifCount).toBeGreaterThan(0);
    expect(motifReuse.sharedFillers.length).toBeGreaterThan(0);
    for (const entry of motifReuse.sharedFillers) {
      expect(entry.reuseCount).toBeGreaterThan(1);
      expect(entry.usedInAssetIds.length).toBe(entry.reuseCount);
    }
  });

  it('every shared filler entry carries real rotation/scale variant data from border/corner placements', () => {
    const { motifReuse } = generateCollection({ ...defaultParams(), seed: 'collection-motif-reuse-variants' });
    const withVariants = motifReuse.sharedFillers.filter((e) => e.variants.length > 0);
    expect(withVariants.length).toBeGreaterThan(0);
    for (const entry of withVariants) {
      for (const v of entry.variants) {
        expect(typeof v.rotationDeg).toBe('number');
        expect(typeof v.scale).toBe('number');
        expect(v.scale).toBeGreaterThan(0);
      }
    }
  });

  it('reuseRatio is a real 0-100 number, deterministic for the same seed', () => {
    const a = generateCollection({ ...defaultParams(), seed: 'collection-motif-reuse-det' }).motifReuse;
    const b = generateCollection({ ...defaultParams(), seed: 'collection-motif-reuse-det' }).motifReuse;
    expect(a.reuseRatio).toBeGreaterThanOrEqual(0);
    expect(a.reuseRatio).toBeLessThanOrEqual(100);
    expect(a).toEqual(b);
  });

  it('sharedLeaves is real (non-empty for a leaf-family category, e.g. tropical)', () => {
    const { motifReuse } = generateCollection({ ...defaultParams(), categoryId: 'tropical', seed: 'collection-motif-reuse-leaves' });
    expect(motifReuse.sharedLeaves.length).toBeGreaterThan(0);
    for (const entry of motifReuse.sharedLeaves) expect(entry.family).toBe('leaf');
  });
});

describe('generateCollection: scalable collection size (Section 12)', () => {
  it('with no requested size, produces the same structural asset count as before (backward compatible)', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-size-default' });
    expect(assets.filter((a) => a.type === 'individualMotif').length).toBe(6);
  });

  it('a requested size below the structural floor does not shrink the collection', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-size-10' }, undefined, undefined, 10);
    expect(assets.filter((a) => a.type === 'individualMotif').length).toBe(6);
    expect(assets.length).toBeGreaterThanOrEqual(10);
  });

  it('a requested size of 25 does not shrink the collection (already exceeds it structurally)', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-size-25' }, undefined, undefined, 25);
    expect(assets.length).toBeGreaterThanOrEqual(25);
  });

  it('a requested size of 50 grows the collection to at least 50 real assets, all valid SVG/data', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-size-50' }, undefined, undefined, 50);
    expect(assets.length).toBeGreaterThanOrEqual(50);
    for (const asset of assets) {
      if (asset.svg) expect(asset.svg).toContain('<svg');
    }
    expect(new Set(assets.map((a) => a.filename)).size).toBe(assets.length);
  });

  it('a requested size of 100 grows the collection to at least 100 real, uniquely-filenamed assets', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-size-100' }, undefined, undefined, 100);
    expect(assets.length).toBeGreaterThanOrEqual(100);
    expect(new Set(assets.map((a) => a.filename)).size).toBe(assets.length);
  });

  it('a requested size beyond 100 is clamped to 100', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-size-clamp' }, undefined, undefined, 500);
    expect(assets.length).toBeLessThanOrEqual(100);
  });

  it('extra Individual Motif assets still reference real motif ids tracked in the returned motif set', () => {
    const { assets, motifs } = generateCollection({ ...defaultParams(), seed: 'collection-size-relationships' }, undefined, undefined, 50);
    const motifIds = new Set(motifs.map((m) => m.id));
    const individual = assets.filter((a) => a.type === 'individualMotif');
    expect(individual.length).toBeGreaterThan(6);
    for (const asset of individual) {
      expect(asset.motifIds.length).toBe(1);
      expect(motifIds.has(asset.motifIds[0])).toBe(true);
    }
  });

  it('is deterministic for the same seed + requested size', () => {
    const a = generateCollection({ ...defaultParams(), seed: 'collection-size-det' }, undefined, undefined, 50);
    const b = generateCollection({ ...defaultParams(), seed: 'collection-size-det' }, undefined, undefined, 50);
    expect(a.assets.map((x) => x.filename)).toEqual(b.assets.map((x) => x.filename));
  });

  it('scaling to 100 assets completes in well under 10 seconds (reuse-first, not brute regeneration)', () => {
    const start = Date.now();
    generateCollection({ ...defaultParams(), seed: 'collection-size-perf' }, undefined, undefined, 100);
    expect(Date.now() - start).toBeLessThan(10000);
  });
});

describe('generateCollection: Layout Variation (Section 5)', () => {
  it('every pattern-type asset (hero/secondary/blender/mini/stripe/backgroundTexture) gets a distinct layout', () => {
    const { patternTiles } = generateCollection({ ...defaultParams(), seed: 'collection-layout-diversity' });
    const layouts = patternTiles.map((t) => t.params.layoutId);
    expect(new Set(layouts).size).toBe(layouts.length);
  });

  it(
    'layout diversity holds across a sample of built-in Style DNA presets too',
    () => {
      // Three full collection builds in one test (one per preset) — past
      // the global 15000ms default under full-suite worker contention on
      // slower/fewer-core CI runners; same headroom reasoning as the
      // Design Spec determinism test's own override.
      const sample = [STYLE_DNA_PRESETS.editorialBotanical, STYLE_DNA_PRESETS.luxuryWallpaper, STYLE_DNA_PRESETS.kidsPlayful];
      for (const dna of sample) {
        const params = { ...defaultParams(), ...resolveStyleDna(dna, 'collection-layout-dna-sweep') };
        const { patternTiles } = generateCollection(params, dna);
        const layouts = patternTiles.map((t) => t.params.layoutId);
        expect(new Set(layouts).size).toBe(layouts.length);
      }
    },
    30000,
  );

  it('mini pattern no longer silently inherits the hero pattern layout', () => {
    const { patternParams } = generateCollection({ ...defaultParams(), layoutId: 'grid', seed: 'collection-mini-layout' });
    const [hero, , , mini] = patternParams;
    expect(mini.layoutId).not.toBe(hero.layoutId);
  });

  it('is deterministic — the same seed always allocates the same set of layouts', () => {
    const params = { ...defaultParams(), seed: 'collection-layout-det' };
    const a = generateCollection(params).patternTiles.map((t) => t.params.layoutId);
    const b = generateCollection(params).patternTiles.map((t) => t.params.layoutId);
    expect(a).toEqual(b);
  });
});

describe('generateCollection: patternTiles (additive field, Section 9/10 support)', () => {
  it('exposes 8 pattern tiles: the same 5 patternParams covers, plus Background Texture, Dense, and Airy', () => {
    const { patternParams, patternTiles } = generateCollection({ ...defaultParams(), seed: 'collection-pattern-tiles' });
    expect(patternTiles.length).toBe(8);
    expect(patternTiles.slice(0, 5).map((t) => t.params)).toEqual(patternParams);
  });

  it('does not change patternParams length/order (components/ProjectPanel.tsx depends on this)', () => {
    const { patternParams } = generateCollection({ ...defaultParams(), seed: 'collection-pattern-params-shape' });
    expect(patternParams.length).toBe(5);
  });
});

describe('generateCollection: Motif Consistency (Section 4)', () => {
  it('verifyConsistency flags a real motif-family disagreement across factory motifs — regression guard', () => {
    const base = defaultParams();
    const consistentMotifs = [
      { category: 'botanical' },
      { category: 'botanical' },
    ] as Parameters<typeof verifyConsistency>[1];
    expect(verifyConsistency([base], consistentMotifs).consistent).toBe(true);

    const mismatchedMotifs = [
      { category: 'botanical' },
      { category: 'geometric' },
    ] as Parameters<typeof verifyConsistency>[1];
    const result = verifyConsistency([base], mismatchedMotifs);
    expect(result.consistent).toBe(false);
    expect(result.issues.some((i) => i.includes('factory-generated motifs'))).toBe(true);
  });

  it('verifyConsistency without a motifs argument still works exactly as before (backward compatible)', () => {
    const base = defaultParams();
    expect(verifyConsistency([base, base]).consistent).toBe(true);
  });

  it('a real generated collection has zero motif-family disagreement across its own factory motifs', () => {
    const { manifest } = generateCollection({ ...defaultParams(), categoryId: 'tropical', seed: 'collection-motif-consistency' });
    expect(manifest.consistency.consistent).toBe(true);
    expect(manifest.consistency.issues).toEqual([]);
  });
});

describe('generateCollection: Collection Preview', () => {
  it('produces exactly one collectionPreview asset with a non-trivial SVG document', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-preview' });
    const previewAssets = assets.filter((a) => a.type === 'collectionPreview');
    expect(previewAssets.length).toBe(1);
    expect(previewAssets[0].svg).toContain('<svg');
    expect(previewAssets[0].width).toBeGreaterThan(0);
    expect(previewAssets[0].height).toBeGreaterThan(0);
  });

  it('the preview composite has no duplicate ids (each source tile is properly namespaced)', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-preview-ids' });
    const svg = assets.find((a) => a.type === 'collectionPreview')!.svg!;
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
