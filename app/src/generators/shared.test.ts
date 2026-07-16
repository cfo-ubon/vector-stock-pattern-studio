import { describe, it, expect } from 'vitest';
import { createRng } from '../engine/rng';
import { serialize } from '../engine/svgAst';
import { calyxBase, pinnateVeins, flowerCenterDetail } from './shared';

describe('calyxBase (Build 005, Section 3: Calyx Generator)', () => {
  it('is deterministic for the same seed', () => {
    const a = calyxBase(createRng('calyx-det'), { color: '#5a7a4a', flowerRadius: 30 });
    const b = calyxBase(createRng('calyx-det'), { color: '#5a7a4a', flowerRadius: 30 });
    expect(serialize(a)).toBe(serialize(b));
  });

  it('emits a data-part="calyx" group with sepalCount children', () => {
    const node = calyxBase(createRng('calyx-count'), { color: '#5a7a4a', flowerRadius: 30, sepalCount: 6 });
    expect(node.attrs?.['data-part']).toBe('calyx');
    expect(node.children?.length).toBe(6);
  });

  it('never produces NaN/Infinity coordinates across many seeds/radii', () => {
    for (let i = 0; i < 20; i++) {
      const node = calyxBase(createRng(`calyx-safety-${i}`), { color: '#5a7a4a', flowerRadius: 10 + i * 5 });
      expect(serialize(node)).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe('pinnateVeins (existing Vein Generator, unchanged)', () => {
  it('is deterministic and produces valid output', () => {
    const a = pinnateVeins(40, 20, '#3a5a2a', '#e8e4d8', 3);
    const b = pinnateVeins(40, 20, '#3a5a2a', '#e8e4d8', 3);
    expect(a.map(serialize)).toEqual(b.map(serialize));
  });
});

describe('flowerCenterDetail (Build 006, Section 7: Premium SVG Detail)', () => {
  it('is deterministic for the same seed', () => {
    const opts = { filamentColor: '#c9a05c', discColor: '#7a2e3a', flowerRadius: 30 };
    const a = flowerCenterDetail(createRng('center-det'), opts);
    const b = flowerCenterDetail(createRng('center-det'), opts);
    expect(serialize(a)).toBe(serialize(b));
  });

  it('emits a data-part="flower-center" group with filamentCount stamen groups plus one center disc', () => {
    const node = flowerCenterDetail(createRng('center-count'), {
      filamentColor: '#c9a05c', discColor: '#7a2e3a', flowerRadius: 30, filamentCount: 5,
    });
    expect(node.attrs?.['data-part']).toBe('flower-center');
    expect(node.children?.length).toBe(6); // 5 filament groups + 1 disc circle
  });

  it('never produces NaN/Infinity coordinates across many seeds/radii', () => {
    for (let i = 0; i < 20; i++) {
      const node = flowerCenterDetail(createRng(`center-safety-${i}`), {
        filamentColor: '#c9a05c', discColor: '#7a2e3a', flowerRadius: 10 + i * 5,
      });
      expect(serialize(node)).not.toMatch(/NaN|Infinity/);
    }
  });
});
