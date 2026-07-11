import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { countNodes } from './svgGeometry';
import { h } from './svgAst';
import { applyHeroDetailOverlay, detailLevelForRole } from './heroComplexity';

const BASE_MOTIF = h('g', {}, [h('circle', { cx: 0, cy: 0, r: 30, fill: '#FF0000' })]);
const COLORS = ['#FFFFFF', '#FF3366', '#3366FF', '#33CC66'];

describe('detailLevelForRole', () => {
  it('hero gets the highest detail level', () => {
    expect(detailLevelForRole('hero')).toBe(100);
  });

  it('secondary gets a real but smaller boost than hero', () => {
    const secondary = detailLevelForRole('secondary');
    expect(secondary).toBeGreaterThan(0);
    expect(secondary).toBeLessThan(detailLevelForRole('hero'));
  });

  it('filler and accent get no boost', () => {
    expect(detailLevelForRole('filler')).toBe(0);
    expect(detailLevelForRole('accent')).toBe(0);
  });

  it('an undefined role gets no boost', () => {
    expect(detailLevelForRole(undefined)).toBe(0);
  });
});

describe('applyHeroDetailOverlay', () => {
  it('is a strict no-op for filler/accent/undefined roles (byte-identical node)', () => {
    for (const role of ['filler', 'accent', undefined] as const) {
      const rng = createRng(`overlay-noop-${role}`);
      const result = applyHeroDetailOverlay(BASE_MOTIF, { role, radius: 30, colors: COLORS }, rng);
      expect(result).toBe(BASE_MOTIF);
    }
  });

  it('adds real, measurable geometry for a hero role (across a sample of seeds — trigger probabilities are real, not guaranteed every single time)', () => {
    let addedAtLeastOnce = false;
    for (let i = 0; i < 20; i++) {
      const result = applyHeroDetailOverlay(BASE_MOTIF, { role: 'hero', radius: 30, colors: COLORS }, createRng(`overlay-hero-${i}`));
      if (countNodes(result) > countNodes(BASE_MOTIF)) addedAtLeastOnce = true;
    }
    expect(addedAtLeastOnce).toBe(true);
  });

  it('a hero motif ends up with more nodes than the same motif as secondary, on average', () => {
    let heroTotal = 0;
    let secondaryTotal = 0;
    const trials = 25;
    for (let i = 0; i < trials; i++) {
      heroTotal += countNodes(applyHeroDetailOverlay(BASE_MOTIF, { role: 'hero', radius: 30, colors: COLORS }, createRng(`hero-${i}`)));
      secondaryTotal += countNodes(applyHeroDetailOverlay(BASE_MOTIF, { role: 'secondary', radius: 30, colors: COLORS }, createRng(`secondary-${i}`)));
    }
    expect(heroTotal / trials).toBeGreaterThan(secondaryTotal / trials);
  });

  it('never returns an empty/degenerate node', () => {
    const rng = createRng('overlay-valid');
    const result = applyHeroDetailOverlay(BASE_MOTIF, { role: 'hero', radius: 30, colors: COLORS }, rng);
    expect(result.tag).toBeTruthy();
  });

  it('is deterministic for the same rng sequence', () => {
    const a = applyHeroDetailOverlay(BASE_MOTIF, { role: 'hero', radius: 30, colors: COLORS }, createRng('overlay-det'));
    const b = applyHeroDetailOverlay(BASE_MOTIF, { role: 'hero', radius: 30, colors: COLORS }, createRng('overlay-det'));
    expect(a).toEqual(b);
  });

  it('never uses the background color (colors[0]) for overlay strokes/fills', () => {
    const background = '#FFFFFF';
    for (let i = 0; i < 15; i++) {
      const rng = createRng(`overlay-no-bg-${i}`);
      const result = applyHeroDetailOverlay(BASE_MOTIF, { role: 'hero', radius: 30, colors: [background, '#FF3366', '#3366FF'] }, rng);
      // The overlay group's own color usages (not the original motif's own
      // red fill, which legitimately isn't background either) should never
      // introduce the exact background hex as a NEW stroke/fill.
      const overlayChildren = (result.children ?? []).slice(1);
      const overlayStr = JSON.stringify(overlayChildren);
      expect(overlayStr.toLowerCase()).not.toContain(background.toLowerCase());
    }
  });

  it('is a no-op when radius is zero or negative', () => {
    const rng = createRng('overlay-zero-radius');
    expect(applyHeroDetailOverlay(BASE_MOTIF, { role: 'hero', radius: 0, colors: COLORS }, rng)).toBe(BASE_MOTIF);
  });

  it('handles a single-color palette without throwing', () => {
    const rng = createRng('overlay-single-color');
    expect(() => applyHeroDetailOverlay(BASE_MOTIF, { role: 'hero', radius: 30, colors: ['#FFFFFF'] }, rng)).not.toThrow();
  });
});
