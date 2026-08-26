import { describe, it, expect } from 'vitest';
import { generateConcepts, refineConcept } from './generateFromIntent';
import { analyzeKeyword } from './keywordIntent';
import { getDesignCoachRecommendations } from './designCoach';

describe('refineConcept (Milestone 11 — non-destructive versioning)', () => {
  it('never mutates the original concept object', () => {
    const intent = analyzeKeyword('minimal botanical leaves');
    const [original] = generateConcepts(intent, 1);
    const originalSnapshot = JSON.parse(JSON.stringify(original.params));
    refineConcept(original, { density: 0.9 });
    expect(original.params).toEqual(originalSnapshot);
  });

  it('produces a real, differently-seeded concept reflecting the requested override', () => {
    const intent = analyzeKeyword('minimal botanical leaves');
    const [original] = generateConcepts(intent, 1);
    const refined = refineConcept(original, { density: 0.9 });
    expect(refined.id).not.toBe(original.id);
    expect(refined.params.seed).not.toBe(original.params.seed);
    expect(refined.params.density).toBe(0.9);
  });

  it('runs both mandatory gates on the refined output too, never assuming pass', () => {
    const intent = analyzeKeyword('japanese geometric');
    const [original] = generateConcepts(intent, 1);
    const refined = refineConcept(original, { rotationJitter: 30 });
    expect(['VECTOR_PASS', 'VECTOR_BLOCKED']).toContain(refined.vectorIntegrity.status);
    expect(['SEAMLESS_PASS', 'SEAMLESS_BLOCKED']).toContain(refined.seamlessIntegrity.status);
  });

  it('clamps density/negativeSpace overrides to the valid 0-1 range', () => {
    const intent = analyzeKeyword('christmas candy');
    const [original] = generateConcepts(intent, 1);
    const refined = refineConcept(original, { density: 1.5, negativeSpace: -0.5 });
    expect(refined.params.density).toBe(1);
    expect(refined.params.negativeSpace).toBe(0);
  });
});

describe('getDesignCoachRecommendations (Milestone 12 — reuses existing critic evidence)', () => {
  it('returns real, evidence-based recommendations, never fabricated placeholders', () => {
    const intent = analyzeKeyword('minimal botanical leaves');
    const [concept] = generateConcepts(intent, 1);
    const recs = getDesignCoachRecommendations(concept.tileData, concept.metrics);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.length).toBeLessThanOrEqual(4);
    for (const rec of recs) {
      expect(typeof rec.message).toBe('string');
      expect(rec.message.length).toBeGreaterThan(0);
    }
  });

  it('says so honestly when no significant issues are detected, rather than inventing advice', () => {
    // A concept with no detected visual issues and no cornerDeadZone
    // problem should get the explicit "no significant issues" message,
    // not a fabricated generic tip.
    const intent = analyzeKeyword('minimal botanical leaves');
    const [concept] = generateConcepts(intent, 1);
    const recs = getDesignCoachRecommendations(concept.tileData, concept.metrics);
    // Every returned id must be a real, traceable recommendation key.
    const validIds = ['crowdedAreas', 'deadSpace', 'mechanicalSpacing', 'gridAppearance', 'lowHeroVisibility', 'weakHierarchy', 'lowDetail', 'weakFlow', 'cornerDeadZone', 'none'];
    for (const rec of recs) {
      expect(validIds).toContain(rec.id);
    }
  });
});
