import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { STYLE_DNA_PRESETS, resolveStyleDna } from '../engine/styleDna';
import { generateCollection, verifyConsistency, COLLECTION_SCHEMA_VERSION, type AssetType } from './collectionGenerator';

const EXPECTED_ASSET_TYPES: AssetType[] = [
  'heroPattern', 'secondaryPattern', 'blenderPattern', 'miniPattern', 'stripePattern',
  'borderPattern', 'cornerPattern', 'spotMotifSheet', 'decorativeElementsSheet',
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

  it('the positive-path guarantee holds across a sample of built-in Style DNA presets', () => {
    const sample = [STYLE_DNA_PRESETS.editorialBotanical, STYLE_DNA_PRESETS.luxuryWallpaper, STYLE_DNA_PRESETS.modernTropical, STYLE_DNA_PRESETS.kidsPlayful];
    for (const dna of sample) {
      const params = { ...defaultParams(), ...resolveStyleDna(dna, 'collection-consistency-sweep') };
      const { manifest } = generateCollection(params, dna);
      expect(manifest.consistency.consistent).toBe(true);
    }
  });

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
  it('metadata asset carries per-site SEO fields for all 5 stock sites', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-metadata' });
    const metaAsset = assets.find((a) => a.type === 'metadata')!;
    const data = metaAsset.data as { siteMetadata: Array<{ id: string }> };
    expect(data.siteMetadata.length).toBe(5);
  });

  it('SEO Package asset carries real Shutterstock + Adobe Stock CSV text covering all 5 pattern assets', () => {
    const { assets } = generateCollection({ ...defaultParams(), seed: 'collection-seo' });
    const seoAsset = assets.find((a) => a.type === 'seoPackage')!;
    const data = seoAsset.data as { shutterstockCsv: string; adobeStockCsv: string };
    const shutterstockRows = data.shutterstockCsv.trim().split('\r\n');
    // header + 5 pattern-type assets (hero/secondary/blender/mini/stripe)
    expect(shutterstockRows.length).toBe(6);
    expect(data.adobeStockCsv.length).toBeGreaterThan(0);
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
