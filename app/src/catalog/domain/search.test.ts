import { describe, it, expect } from 'vitest';
import { searchPortfolioAssets, sortPortfolioAssets, describeActiveFilters } from './search';
import { createPortfolioAsset } from './asset';
import type { PortfolioAsset, SourceFileReference } from './types';

function ref(role: SourceFileReference['role'], size = 100): SourceFileReference {
  return { fileId: `f-${role}-${Math.random()}`, role, filename: `x.${role}`, mimeType: 'text/plain', fileSize: size, sha256: `h-${role}` };
}

function makeAsset(overrides: Partial<PortfolioAsset> = {}): PortfolioAsset {
  const displayName = overrides.displayName ?? 'Spring Garden';
  const base = createPortfolioAsset({
    displayName,
    originalFilename: `${displayName.toLowerCase().replace(/\s+/g, '-')}.svg`,
    sourceFileReferences: [ref('svg')],
    previewReference: null,
    metadataReference: null,
    styleDna: 'darkBotanical',
  });
  return { ...base, ...overrides };
}

describe('searchPortfolioAssets', () => {
  it('matches keyword across display name, tags, styleDna, notes', () => {
    const a = makeAsset({ displayName: 'Spring Garden' });
    const b = makeAsset({ displayName: 'Winter Frost', tags: ['snowflake'] });
    expect(searchPortfolioAssets([a, b], { keyword: 'spring' })).toEqual([a]);
    expect(searchPortfolioAssets([a, b], { keyword: 'snowflake' })).toEqual([b]);
    expect(searchPortfolioAssets([a, b], { keyword: 'darkBotanical' })).toEqual([a, b]);
  });

  it('filters by workflow status', () => {
    const a = makeAsset({ workflowStatus: 'DRAFT' });
    const b = makeAsset({ workflowStatus: 'APPROVED' });
    expect(searchPortfolioAssets([a, b], { workflowStatus: ['APPROVED'] })).toEqual([b]);
  });

  it('excludes archived assets by default and includes them when requested', () => {
    const active = makeAsset({ isArchived: false });
    const archived = makeAsset({ isArchived: true });
    expect(searchPortfolioAssets([active, archived], {})).toEqual([active]);
    expect(searchPortfolioAssets([active, archived], { archived: 'archived' })).toEqual([archived]);
    expect(searchPortfolioAssets([active, archived], { archived: 'all' })).toHaveLength(2);
  });

  it('filters by rating minimum', () => {
    const low = makeAsset({ rating: 1 });
    const high = makeAsset({ rating: 5 });
    expect(searchPortfolioAssets([low, high], { ratingMin: 4 })).toEqual([high]);
  });

  it('filters missing-preview / missing-SVG / missing-JSON', () => {
    const withSvg = makeAsset({ sourceFileReferences: [ref('svg')], previewReference: 'p1' });
    const jsonOnly = makeAsset({ sourceFileReferences: [ref('json')], previewReference: null });
    expect(searchPortfolioAssets([withSvg, jsonOnly], { missingSvg: true })).toEqual([jsonOnly]);
    expect(searchPortfolioAssets([withSvg, jsonOnly], { missingPreview: true })).toEqual([jsonOnly]);
    expect(searchPortfolioAssets([withSvg, jsonOnly], { missingJson: true })).toEqual([withSvg]);
  });

  it('combines multiple filters together (AND semantics)', () => {
    const match = makeAsset({ workflowStatus: 'APPROVED', rating: 5 });
    const wrongStatus = makeAsset({ workflowStatus: 'DRAFT', rating: 5 });
    const wrongRating = makeAsset({ workflowStatus: 'APPROVED', rating: 1 });
    const result = searchPortfolioAssets([match, wrongStatus, wrongRating], { workflowStatus: ['APPROVED'], ratingMin: 4 });
    expect(result).toEqual([match]);
  });

  it('filters onlyDuplicates using an externally-computed duplicate set', () => {
    const a = makeAsset();
    const b = makeAsset();
    const result = searchPortfolioAssets([a, b], { onlyDuplicates: true, duplicateAssetIds: new Set([a.assetId]) });
    expect(result).toEqual([a]);
  });

  it('filters by a specific collectionId (Portfolio Manager P2 Stage 2, Section 14)', () => {
    const inCollection = makeAsset({ collectionIds: ['COL-1'] });
    const notInCollection = makeAsset({ collectionIds: ['COL-2'] });
    expect(searchPortfolioAssets([inCollection, notInCollection], { collectionId: 'COL-1' })).toEqual([inCollection]);
  });

  it('filters by collectionMembership "any" and "none"', () => {
    const member = makeAsset({ collectionIds: ['COL-1'] });
    const unassigned = makeAsset({ collectionIds: [] });
    expect(searchPortfolioAssets([member, unassigned], { collectionMembership: 'any' })).toEqual([member]);
    expect(searchPortfolioAssets([member, unassigned], { collectionMembership: 'none' })).toEqual([unassigned]);
  });
});

describe('sortPortfolioAssets', () => {
  it('sorts by name', () => {
    const b = makeAsset({ displayName: 'Banana' });
    const a = makeAsset({ displayName: 'Apple' });
    expect(sortPortfolioAssets([b, a], 'name').map((x) => x.displayName)).toEqual(['Apple', 'Banana']);
  });

  it('sorts by rating descending', () => {
    const low = makeAsset({ rating: 1 });
    const high = makeAsset({ rating: 5 });
    expect(sortPortfolioAssets([low, high], 'rating')).toEqual([high, low]);
  });

  it('sorts by importedAt descending by default key', () => {
    const older = makeAsset({ importedAt: 100 });
    const newer = makeAsset({ importedAt: 200 });
    expect(sortPortfolioAssets([older, newer], 'importedDesc')).toEqual([newer, older]);
  });

  it('does not mutate the input array', () => {
    const list = [makeAsset({ displayName: 'B' }), makeAsset({ displayName: 'A' })];
    const original = [...list];
    sortPortfolioAssets(list, 'name');
    expect(list).toEqual(original);
  });
});

describe('describeActiveFilters', () => {
  it('describes no filters as an empty list', () => {
    expect(describeActiveFilters({})).toEqual([]);
  });

  it('describes several active filters', () => {
    const desc = describeActiveFilters({ keyword: 'garden', workflowStatus: ['APPROVED'], ratingMin: 3 });
    expect(desc.length).toBe(3);
  });
});
