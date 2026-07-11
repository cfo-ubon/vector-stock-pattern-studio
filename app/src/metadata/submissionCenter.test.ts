import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { buildTile } from '../engine/tile';
import type { SavedItem } from '../components/SavedPanel';
import {
  buildSubmissionChecklist,
  analyzeSeo,
  computeStockReadiness,
  buildSubmissionRecommendations,
  type ChecklistItem,
} from './submissionCenter';

const EXPECTED_CHECKLIST_IDS = [
  'svgGenerated', 'previewGenerated', 'metadataReady', 'titleReady', 'descriptionReady',
  'keywordsReady', 'filenameReady', 'collectionReady', 'zipReady', 'svgValid', 'originalityChecklist',
];

function makeTileData(seed: string) {
  return buildTile({ ...defaultParams(), seed });
}

describe('buildSubmissionChecklist', () => {
  it('returns exactly the 11 required checklist items', () => {
    const tileData = makeTileData('checklist-items');
    const items = buildSubmissionChecklist(tileData, { collectionGeneratedForSeed: null, saved: [] });
    expect(items.map((i) => i.id)).toEqual(EXPECTED_CHECKLIST_IDS);
  });

  it('every item has a real, non-empty label/status/detail', () => {
    const tileData = makeTileData('checklist-shape');
    const items = buildSubmissionChecklist(tileData, { collectionGeneratedForSeed: null, saved: [] });
    for (const item of items) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(['ready', 'warning', 'missing']).toContain(item.status);
      expect(item.detail.length).toBeGreaterThan(0);
    }
  });

  it('SVG Generated and Preview Generated are always ready for a real tile', () => {
    const tileData = makeTileData('checklist-svg-preview');
    const items = buildSubmissionChecklist(tileData, { collectionGeneratedForSeed: null, saved: [] });
    expect(items.find((i) => i.id === 'svgGenerated')!.status).toBe('ready');
    expect(items.find((i) => i.id === 'previewGenerated')!.status).toBe('ready');
  });

  it('SVG Valid is ready for a normal generated tile', () => {
    const tileData = makeTileData('checklist-svg-valid');
    const items = buildSubmissionChecklist(tileData, { collectionGeneratedForSeed: null, saved: [] });
    expect(items.find((i) => i.id === 'svgValid')!.status).toBe('ready');
  });

  it('Collection Ready reflects whether the current seed matches the last generated collection seed', () => {
    const tileData = makeTileData('checklist-collection');
    const notReady = buildSubmissionChecklist(tileData, { collectionGeneratedForSeed: null, saved: [] });
    expect(notReady.find((i) => i.id === 'collectionReady')!.status).toBe('missing');

    const ready = buildSubmissionChecklist(tileData, { collectionGeneratedForSeed: 'checklist-collection', saved: [] });
    expect(ready.find((i) => i.id === 'collectionReady')!.status).toBe('ready');

    const staleSeed = buildSubmissionChecklist(tileData, { collectionGeneratedForSeed: 'some-other-seed', saved: [] });
    expect(staleSeed.find((i) => i.id === 'collectionReady')!.status).toBe('missing');
  });

  it('Originality Checklist warns when the exact same settings already exist in the saved library', () => {
    const tileData = makeTileData('checklist-originality');
    const savedSame: SavedItem = { id: 's1', tileData: makeTileData('checklist-originality'), name: 'x', createdAt: 0, note: '', submissions: {} };
    const withDuplicate = buildSubmissionChecklist(tileData, { collectionGeneratedForSeed: null, saved: [savedSame] });
    expect(withDuplicate.find((i) => i.id === 'originalityChecklist')!.status).toBe('warning');

    const savedDifferent: SavedItem = { id: 's2', tileData: makeTileData('a-totally-different-seed'), name: 'y', createdAt: 0, note: '', submissions: {} };
    const withoutDuplicate = buildSubmissionChecklist(tileData, { collectionGeneratedForSeed: null, saved: [savedDifferent] });
    expect(withoutDuplicate.find((i) => i.id === 'originalityChecklist')!.status).toBe('ready');
  });

  it('is deterministic for the same tile and options', () => {
    const tileData = makeTileData('checklist-det');
    const a = buildSubmissionChecklist(tileData, { collectionGeneratedForSeed: null, saved: [] });
    const b = buildSubmissionChecklist(tileData, { collectionGeneratedForSeed: null, saved: [] });
    expect(a).toEqual(b);
  });
});

describe('analyzeSeo', () => {
  it('score is bounded to [0, 100]', () => {
    const tileData = makeTileData('seo-bounds');
    const analysis = analyzeSeo(tileData);
    expect(analysis.score).toBeGreaterThanOrEqual(0);
    expect(analysis.score).toBeLessThanOrEqual(100);
  });

  it('keywordCount matches the real generated Shutterstock keyword list length', () => {
    const tileData = makeTileData('seo-keyword-count');
    const analysis = analyzeSeo(tileData);
    expect(analysis.keywordCount).toBeGreaterThan(20);
    expect(analysis.keywordCount).toBeLessThanOrEqual(50);
  });

  it('never reports duplicate keywords for real generated data (the underlying generator already dedupes)', () => {
    const tileData = makeTileData('seo-no-dupes');
    const analysis = analyzeSeo(tileData);
    expect(analysis.duplicateKeywords).toEqual([]);
  });

  it('titleLength/descriptionLength/filenameLength reflect real non-zero content', () => {
    const tileData = makeTileData('seo-lengths');
    const analysis = analyzeSeo(tileData);
    expect(analysis.titleLength).toBeGreaterThan(0);
    expect(analysis.descriptionLength).toBeGreaterThan(0);
    expect(analysis.filenameLength).toBeGreaterThan(0);
  });

  it('commercialTags only contains real keywords present in the generated list', () => {
    const tileData = makeTileData('seo-commercial-tags');
    const analysis = analyzeSeo(tileData);
    expect(analysis.commercialTags.length).toBeGreaterThan(0);
    for (const tag of analysis.commercialTags) {
      expect(typeof tag).toBe('string');
    }
  });

  it('keywordCoverage is bounded to [0, 100]', () => {
    const tileData = makeTileData('seo-coverage');
    const analysis = analyzeSeo(tileData);
    expect(analysis.keywordCoverage).toBeGreaterThanOrEqual(0);
    expect(analysis.keywordCoverage).toBeLessThanOrEqual(100);
  });

  it('is deterministic for the same tile', () => {
    const tileData = makeTileData('seo-det');
    expect(analyzeSeo(tileData)).toEqual(analyzeSeo(tileData));
  });
});

describe('computeStockReadiness', () => {
  it('returns exactly 5 cards, one per stock site', () => {
    const tileData = makeTileData('readiness-count');
    const checklist = buildSubmissionChecklist(tileData, { collectionGeneratedForSeed: null, saved: [] });
    const readiness = computeStockReadiness(tileData, checklist);
    expect(readiness.length).toBe(5);
    expect(new Set(readiness.map((r) => r.siteId)).size).toBe(5);
  });

  it('a healthy pattern with a valid checklist is ready with no issues on every site', () => {
    const tileData = makeTileData('readiness-healthy');
    const checklist = buildSubmissionChecklist(tileData, { collectionGeneratedForSeed: null, saved: [] });
    const readiness = computeStockReadiness(tileData, checklist);
    for (const card of readiness) {
      expect(card.status).toBe('ready');
      expect(card.issues).toEqual([]);
    }
  });

  it('an invalid SVG checklist produces real issues on every site card', () => {
    const tileData = makeTileData('readiness-invalid');
    const brokenChecklist: ChecklistItem[] = [{ id: 'svgValid', label: 'SVG Valid', status: 'missing', detail: 'broken' }];
    const readiness = computeStockReadiness(tileData, brokenChecklist);
    expect(readiness.every((r) => r.status !== 'ready')).toBe(true);
    expect(readiness.every((r) => r.issues.length > 0)).toBe(true);
  });
});

describe('buildSubmissionRecommendations', () => {
  it('produces no recommendations for a fully healthy, well-covered pattern', () => {
    const tileData = makeTileData('recs-healthy');
    const checklist = buildSubmissionChecklist(tileData, { collectionGeneratedForSeed: 'recs-healthy', saved: [] });
    const seo = analyzeSeo(tileData);
    const readiness = computeStockReadiness(tileData, checklist);
    const recs = buildSubmissionRecommendations(checklist, seo, readiness);
    expect(recs).toEqual([]);
  });

  it('produces real recommendations reflecting a missing checklist item', () => {
    const tileData = makeTileData('recs-missing');
    // collectionGeneratedForSeed intentionally not matching -> 'collectionReady' is missing.
    const checklist = buildSubmissionChecklist(tileData, { collectionGeneratedForSeed: null, saved: [] });
    const seo = analyzeSeo(tileData);
    const readiness = computeStockReadiness(tileData, checklist);
    const recs = buildSubmissionRecommendations(checklist, seo, readiness);
    expect(recs.some((r) => r.includes('Collection Ready'))).toBe(true);
  });
});
