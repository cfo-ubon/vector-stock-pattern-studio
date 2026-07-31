import { describe, it, expect, beforeEach } from 'vitest';
import { createResearchSource } from '../domain/researchSource';
import { loadResearchSources, getResearchSource, putResearchSource, deleteResearchSource, clearResearchSources } from './researchSourceStore';

beforeEach(async () => {
  await clearResearchSources();
});

describe('researchSourceStore', () => {
  it('is empty before anything is written', async () => {
    expect(await loadResearchSources()).toEqual([]);
  });

  it('persists and retrieves a source', async () => {
    const source = createResearchSource({ sourceType: 'google-trends', sourceTitle: 'Spring floral rising trend', now: 1000 });
    await putResearchSource(source);
    expect(await getResearchSource(source.id)).toEqual(source);
  });

  it('deletes a source', async () => {
    const source = createResearchSource({ sourceType: 'pinterest', sourceTitle: 'Board scan', now: 1000 });
    await putResearchSource(source);
    await deleteResearchSource(source.id);
    expect(await getResearchSource(source.id)).toBeUndefined();
  });
});
