import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { generateCollection } from '../collection/collectionGenerator';
import { createProject, addCollectionToProject, updateConcept, addMoodboardItem } from './projectManager';
import { reviewProject } from './designerAssistant';

describe('reviewProject', () => {
  it('flags an empty project (no collections) and recommends generating one', () => {
    const review = reviewProject(createProject('Empty'));
    expect(review.collectionsReviewed).toBe(0);
    expect(review.averageCollectionScore).toBeNull();
    expect(review.issues.some((i) => i.includes('ยังไม่มี Collection'))).toBe(true);
    expect(review.recommendations.some((r) => r.includes('Generate Collection'))).toBe(true);
  });

  it('a healthy single-collection project has no collection-consistency issues and a high average score', () => {
    const p = addCollectionToProject(createProject('Healthy'), generateCollection({ ...defaultParams(), seed: 'review-healthy' }));
    const review = reviewProject(p);
    expect(review.collectionsReviewed).toBe(1);
    // Not a flat 100: collection/collectionScore.ts's Motif Shape Diversity
    // dimension (Commercial Collection Engine Phase 4) is a real, rich
    // measurement rather than a binary consistency flag, so even a clean
    // positive-path collection can land just under 100 there.
    expect(review.averageCollectionScore).not.toBeNull();
    expect(review.averageCollectionScore!).toBeGreaterThanOrEqual(95);
    expect(review.issues).toEqual([]);
  });

  it('still recommends filling in concept/moodboard even for a healthy project', () => {
    const p = addCollectionToProject(createProject('Healthy'), generateCollection({ ...defaultParams(), seed: 'review-concept' }));
    const review = reviewProject(p);
    expect(review.recommendations.some((r) => r.includes('Concept'))).toBe(true);
    expect(review.recommendations.some((r) => r.includes('Moodboard'))).toBe(true);
  });

  it('does not recommend concept/moodboard once they are filled in', () => {
    let p = addCollectionToProject(createProject('Healthy'), generateCollection({ ...defaultParams(), seed: 'review-filled' }));
    p = updateConcept(p, 'A botanical wallpaper collection for spring.');
    p = addMoodboardItem(p, { color: '#f5e6d3', note: 'warm neutral base' });
    const review = reviewProject(p);
    expect(review.recommendations.some((r) => r.includes('Concept'))).toBe(false);
    expect(review.recommendations.some((r) => r.includes('Moodboard'))).toBe(false);
  });

  it('genuinely flags a Style DNA mismatch across multiple collections — regression guard', () => {
    const collectionA = generateCollection({ ...defaultParams(), seed: 'review-mismatch-a' });
    const collectionB = generateCollection({ ...defaultParams(), seed: 'review-mismatch-b' });
    let p = createProject('Mismatch');
    p = addCollectionToProject(p, { ...collectionA, manifest: { ...collectionA.manifest, styleDnaId: 'styleA' } });
    p = addCollectionToProject(p, { ...collectionB, manifest: { ...collectionB.manifest, styleDnaId: 'styleB' } });
    const review = reviewProject(p);
    expect(review.issues.some((i) => i.includes('Style DNA ไม่ตรงกัน'))).toBe(true);
  });

  it('is fully deterministic for the same project data', () => {
    const p = addCollectionToProject(createProject('Det'), generateCollection({ ...defaultParams(), seed: 'review-det' }));
    expect(reviewProject(p)).toEqual(reviewProject(p));
  });
});
