import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { countNodes } from './svgGeometry';
import { h, serialize } from './svgAst';
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

  it('Build 011, Section 6: filler stays 0 when detailDistribution is left unset (backward compatible)', () => {
    expect(detailLevelForRole('filler')).toBe(0);
    expect(detailLevelForRole('filler', false)).toBe(0);
  });

  it('Build 011, Section 6: filler gets a small nonzero level when detailDistribution is true, still far below secondary', () => {
    const filler = detailLevelForRole('filler', true);
    expect(filler).toBeGreaterThan(0);
    expect(filler).toBeLessThan(detailLevelForRole('secondary', true));
  });

  it('Build 011, Section 6: detailDistribution never changes hero/secondary/accent levels', () => {
    expect(detailLevelForRole('hero', true)).toBe(detailLevelForRole('hero', false));
    expect(detailLevelForRole('secondary', true)).toBe(detailLevelForRole('secondary', false));
    expect(detailLevelForRole('accent', true)).toBe(detailLevelForRole('accent', false));
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

  it('Build 005, Section 7 (Premium Detail System): a large relativeScale produces more detail on average than a small one, for the same role', () => {
    let largeTotal = 0;
    let smallTotal = 0;
    const trials = 40;
    for (let i = 0; i < trials; i++) {
      largeTotal += countNodes(
        applyHeroDetailOverlay(BASE_MOTIF, { role: 'hero', radius: 30, colors: COLORS, relativeScale: 2.4 }, createRng(`relscale-large-${i}`)),
      );
      smallTotal += countNodes(
        applyHeroDetailOverlay(BASE_MOTIF, { role: 'hero', radius: 30, colors: COLORS, relativeScale: 0.3 }, createRng(`relscale-small-${i}`)),
      );
    }
    expect(largeTotal / trials).toBeGreaterThan(smallTotal / trials);
  });

  it('omitting relativeScale reproduces the exact original role-only behavior', () => {
    const a = applyHeroDetailOverlay(BASE_MOTIF, { role: 'hero', radius: 30, colors: COLORS }, createRng('relscale-omit'));
    const b = applyHeroDetailOverlay(BASE_MOTIF, { role: 'hero', radius: 30, colors: COLORS, relativeScale: undefined }, createRng('relscale-omit'));
    expect(a).toEqual(b);
  });

  it('filler/accent stay a strict no-op regardless of relativeScale (role gate still short-circuits first)', () => {
    for (const role of ['filler', 'accent'] as const) {
      const result = applyHeroDetailOverlay(BASE_MOTIF, { role, radius: 30, colors: COLORS, relativeScale: 3 }, createRng(`relscale-noop-${role}`));
      expect(result).toBe(BASE_MOTIF);
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

  it('Build 011, Section 6: filler stays a strict no-op when detailDistribution is left unset, even across many seeds', () => {
    for (let i = 0; i < 30; i++) {
      const rng = createRng(`filler-distribution-unset-${i}`);
      const result = applyHeroDetailOverlay(BASE_MOTIF, { role: 'filler', radius: 30, colors: COLORS }, rng);
      expect(result).toBe(BASE_MOTIF);
    }
  });

  it('Build 011, Section 6: filler gets real, measurable overlay geometry for at least one seed when detailDistribution is true', () => {
    let foundOverlay = false;
    for (let i = 0; i < 60 && !foundOverlay; i++) {
      const rng = createRng(`filler-distribution-on-${i}`);
      const result = applyHeroDetailOverlay(BASE_MOTIF, { role: 'filler', radius: 30, colors: COLORS, detailDistribution: true }, rng);
      if (result !== BASE_MOTIF) foundOverlay = true;
    }
    expect(foundOverlay).toBe(true);
  });

  it('Build 011, Section 6: a filler overlay (when it fires) never includes the hero-only primitives (decorative dots, nested contour, accent arc)', () => {
    for (let i = 0; i < 60; i++) {
      const rng = createRng(`filler-distribution-shape-${i}`);
      const result = applyHeroDetailOverlay(BASE_MOTIF, { role: 'filler', radius: 30, colors: COLORS, detailDistribution: true }, rng);
      if (result === BASE_MOTIF) continue;
      const svg = serialize(result);
      expect(svg).not.toContain('<polygon'); // buildNestedContour
      expect(svg).not.toContain('<path'); // buildAccentArc
    }
  });
});
