import { describe, it, expect, beforeEach } from 'vitest';
import { createCreativeBrief } from '../domain/creativeBrief';
import { loadCreativeBriefs, getCreativeBrief, putCreativeBrief, deleteCreativeBrief, clearCreativeBriefs } from './creativeBriefStore';

beforeEach(async () => {
  await clearCreativeBriefs();
});

function makeBrief() {
  return createCreativeBrief({ collectionName: 'Spring Cottage Garden', theme: 'Botanical', now: 1000 });
}

describe('creativeBriefStore', () => {
  it('persists and retrieves a brief', async () => {
    const brief = makeBrief();
    await putCreativeBrief(brief);
    expect(await getCreativeBrief(brief.id)).toEqual(brief);
  });

  it('deletes a brief', async () => {
    const brief = makeBrief();
    await putCreativeBrief(brief);
    await deleteCreativeBrief(brief.id);
    expect(await getCreativeBrief(brief.id)).toBeUndefined();
  });

  it('loads all briefs', async () => {
    await putCreativeBrief(makeBrief());
    expect(await loadCreativeBriefs()).toHaveLength(1);
  });
});
