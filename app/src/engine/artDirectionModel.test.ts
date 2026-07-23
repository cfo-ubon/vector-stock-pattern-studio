import { describe, it, expect } from 'vitest';
import { resolveArtDirectionModel } from './artDirectionModel';
import { STYLE_DNA_PRESETS } from './styleDna';

describe('resolveArtDirectionModel (Build 024, Phase 2)', () => {
  const luxuryFloral = STYLE_DNA_PRESETS.luxuryFloral;
  const scandinavianOrganic = STYLE_DNA_PRESETS.scandinavianOrganic;

  it('resolves a pronounced depth plan and heroMustDominate intent for a premiumHero style', () => {
    const model = resolveArtDirectionModel(luxuryFloral, 'seed-1', {});
    expect(model.depthPlan).toBe('pronounced');
    expect(model.thumbnailIntent).toBe('heroMustDominate');
    expect(model.focalStrategy).toBe('singleDominantHero');
    expect(model.heroCountRange).toEqual([1, 1]);
  });

  it('resolves a flat depth plan for a non-premiumHero, non-heroFocus style', () => {
    const model = resolveArtDirectionModel(scandinavianOrganic, 'seed-1', {});
    expect(model.depthPlan).toBe('flat');
  });

  it('is deterministic for the same style + seed', () => {
    const a = resolveArtDirectionModel(luxuryFloral, 'seed-42', {});
    const b = resolveArtDirectionModel(luxuryFloral, 'seed-42', {});
    expect(a).toEqual(b);
  });

  it('produces every field the model interface declares', () => {
    const model = resolveArtDirectionModel(luxuryFloral, 'seed-1', {});
    expect(model.story.length).toBeGreaterThan(0);
    expect(model.heroScaleRange[1]).toBeGreaterThan(model.heroScaleRange[0]);
    expect(model.secondaryScaleRange[1]).toBeGreaterThan(model.secondaryScaleRange[0]);
    expect(model.fillerScaleRange[1]).toBeGreaterThan(model.fillerScaleRange[0]);
    expect(Array.isArray(model.botanicalFamilies)).toBe(true);
  });

  it('carries the resolved botanical family through when provided', () => {
    const model = resolveArtDirectionModel(luxuryFloral, 'seed-1', { botanicalFamily: 'rose' });
    expect(model.botanicalFamilies).toEqual(['rose']);
  });
});
