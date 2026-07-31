import { describe, it, expect, beforeEach } from 'vitest';
import { createMarketKeyword } from '../domain/marketKeyword';
import { loadMarketKeywords, getMarketKeyword, putMarketKeyword, deleteMarketKeyword, clearMarketKeywords } from './marketKeywordStore';

beforeEach(async () => {
  await clearMarketKeywords();
});

describe('marketKeywordStore', () => {
  it('is empty before anything is written', async () => {
    expect(await loadMarketKeywords()).toEqual([]);
  });

  it('persists and retrieves a keyword', async () => {
    const keyword = createMarketKeyword({ keyword: 'botanical wallpaper', cluster: 'subject', evidenceSource: 'USER_OBSERVATION', now: 1000 });
    await putMarketKeyword(keyword);
    expect(await getMarketKeyword(keyword.id)).toEqual(keyword);
  });

  it('deletes a keyword', async () => {
    const keyword = createMarketKeyword({ keyword: 'geometric', cluster: 'style', evidenceSource: 'SAMPLE_DATA', now: 1000 });
    await putMarketKeyword(keyword);
    await deleteMarketKeyword(keyword.id);
    expect(await getMarketKeyword(keyword.id)).toBeUndefined();
  });
});
