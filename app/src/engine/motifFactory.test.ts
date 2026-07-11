import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { defaultParams } from './defaults';
import { GENERATORS } from '../generators';
import { createFactoryMotif, generateMotifSet, familyForCategory } from './motifFactory';

describe('familyForCategory', () => {
  it('returns a known family for every registered category', () => {
    for (const id of Object.keys(GENERATORS)) {
      expect(typeof familyForCategory(id)).toBe('string');
    }
  });

  it('is deterministic (pure lookup, no randomness)', () => {
    expect(familyForCategory('botanical')).toBe(familyForCategory('botanical'));
  });
});

describe('createFactoryMotif', () => {
  it('produces a motif with a real positive-area bounding box and finite radius', () => {
    const rng = createRng('factory-motif-1');
    const motif = createFactoryMotif({
      categoryId: 'botanical',
      rng,
      colors: ['#ffffff', '#336633', '#ff6699'],
      size: 70,
      role: 'hero',
      index: 0,
    });
    expect(Number.isFinite(motif.radius)).toBe(true);
    expect(motif.radius).toBeGreaterThan(0);
    expect(motif.bounds.width).toBeGreaterThan(0);
    expect(motif.bounds.height).toBeGreaterThan(0);
  });

  it('is deterministic for the same rng state and inputs', () => {
    const a = createFactoryMotif({
      categoryId: 'geometric',
      rng: createRng('factory-det'),
      colors: ['#ffffff', '#333333'],
      size: 50,
      role: 'icon',
      index: 2,
    });
    const b = createFactoryMotif({
      categoryId: 'geometric',
      rng: createRng('factory-det'),
      colors: ['#ffffff', '#333333'],
      size: 50,
      role: 'icon',
      index: 2,
    });
    expect(a.bounds).toEqual(b.bounds);
    expect(a.radius).toBe(b.radius);
    expect(a.complexity).toBe(b.complexity);
  });

  it('produces 3 anchors (base/tip/center) derived from the real bounding box', () => {
    const motif = createFactoryMotif({
      categoryId: 'tropical',
      rng: createRng('factory-anchors'),
      colors: ['#ffffff', '#227744'],
      size: 60,
      role: 'secondary',
      index: 0,
    });
    const labels = motif.anchors.map((a) => a.label).sort();
    expect(labels).toEqual(['base', 'center', 'tip']);
    const base = motif.anchors.find((a) => a.label === 'base')!;
    const tip = motif.anchors.find((a) => a.label === 'tip')!;
    expect(base.y).toBeGreaterThan(tip.y); // base sits below tip (larger y = lower on screen)
  });

  it('complexity is bounded to [0, 100]', () => {
    for (const categoryId of Object.keys(GENERATORS)) {
      const motif = createFactoryMotif({
        categoryId,
        rng: createRng(`complexity-${categoryId}`),
        colors: ['#ffffff', '#222222', '#ee7733'],
        size: 70,
        role: 'hero',
        index: 0,
      });
      expect(motif.complexity).toBeGreaterThanOrEqual(0);
      expect(motif.complexity).toBeLessThanOrEqual(100);
    }
  });

  it('colorRoles only contains colors actually referenced in this motif (subset of the input palette)', () => {
    const colors = ['#ffffff', '#112233', '#445566', '#778899'];
    const motif = createFactoryMotif({
      categoryId: 'botanical',
      rng: createRng('color-roles'),
      colors,
      size: 70,
      role: 'hero',
      index: 0,
    });
    for (const c of motif.colorRoles) {
      expect(colors.map((x) => x.toLowerCase())).toContain(c.toLowerCase());
    }
  });

  it('tags always include the category id, role, and family', () => {
    const motif = createFactoryMotif({
      categoryId: 'mandala',
      rng: createRng('tags-check'),
      colors: ['#ffffff', '#552277'],
      size: 60,
      role: 'accent',
      index: 0,
    });
    expect(motif.tags).toContain('mandala');
    expect(motif.tags).toContain('accent');
    expect(motif.tags).toContain(familyForCategory('mandala'));
  });

  it('id is derived from category/role/index, not a global counter (repeat calls do not collide or drift)', () => {
    const a = createFactoryMotif({ categoryId: 'geometric', rng: createRng('id-a'), colors: ['#fff', '#000'], size: 50, role: 'hero', index: 0 });
    const b = createFactoryMotif({ categoryId: 'geometric', rng: createRng('id-b'), colors: ['#fff', '#000'], size: 50, role: 'hero', index: 0 });
    expect(a.id).toBe(b.id);
  });
});

describe('generateMotifSet', () => {
  it('produces the requested count of motifs', () => {
    const motifs = generateMotifSet(defaultParams(), { count: 5, role: 'icon', baseSeed: 'set-count' });
    expect(motifs.length).toBe(5);
  });

  it('is fully deterministic for the same params + options', () => {
    const params = { ...defaultParams(), seed: 'set-det' };
    const a = generateMotifSet(params, { count: 4, role: 'background', baseSeed: 'set-det' });
    const b = generateMotifSet(params, { count: 4, role: 'background', baseSeed: 'set-det' });
    expect(a.map((m) => m.bounds)).toEqual(b.map((m) => m.bounds));
    expect(a.map((m) => m.radius)).toEqual(b.map((m) => m.radius));
  });

  it('a different baseSeed produces a different set', () => {
    const params = defaultParams();
    const a = generateMotifSet(params, { count: 4, role: 'hero', baseSeed: 'seed-x' });
    const b = generateMotifSet(params, { count: 4, role: 'hero', baseSeed: 'seed-y' });
    expect(a.map((m) => m.bounds)).not.toEqual(b.map((m) => m.bounds));
  });

  it('sizeMul scales the resulting bounding box up/down', () => {
    const params = { ...defaultParams(), categoryId: 'geometric' };
    const small = generateMotifSet(params, { count: 1, role: 'icon', baseSeed: 'size-check', sizeMul: 0.4 })[0];
    const large = generateMotifSet(params, { count: 1, role: 'hero', baseSeed: 'size-check', sizeMul: 1.6 })[0];
    expect(large.bounds.width).toBeGreaterThan(small.bounds.width);
  });

  it('every motif carries the role and styleDnaId passed in', () => {
    const params = { ...defaultParams(), styleDnaId: 'darkBotanical' };
    const motifs = generateMotifSet(params, { count: 3, role: 'accent', baseSeed: 'role-check' });
    expect(motifs.every((m) => m.role === 'accent')).toBe(true);
    expect(motifs.every((m) => m.styleDnaId === 'darkBotanical')).toBe(true);
  });
});
