import { describe, it, expect } from 'vitest';
import type { Placement } from './types';
import {
  computeWeight,
  computePerceivedWeight,
  applyBalanceCorrection,
  applyGridBalanceCorrection,
  applyNegativeSpaceCorrection,
  applyFlowBias,
  applyRhythmSmoothing,
  applyCompositionIntelligence,
  applyControlledAsymmetry,
  ASYMMETRY_DIRECTIONS,
  DEFAULT_COMPOSITION_INTELLIGENCE,
} from './compositionIntelligence';

function makePlacement(x: number, y: number, overrides: Partial<Placement> = {}): Placement {
  return { x, y, rotationDeg: 0, scale: 1, colorSeed: 0, ...overrides };
}

const TILE = 1000;

describe('computeWeight', () => {
  it('scales with the square of placement scale', () => {
    const small = computeWeight(makePlacement(0, 0, { scale: 1 }));
    const big = computeWeight(makePlacement(0, 0, { scale: 2 }));
    expect(big).toBeCloseTo(small * 4, 5);
  });

  it('weights hero > secondary > filler > accent at equal scale', () => {
    const hero = computeWeight(makePlacement(0, 0, { scale: 1, role: 'hero' }));
    const secondary = computeWeight(makePlacement(0, 0, { scale: 1, role: 'secondary' }));
    const filler = computeWeight(makePlacement(0, 0, { scale: 1, role: 'filler' }));
    const accent = computeWeight(makePlacement(0, 0, { scale: 1, role: 'accent' }));
    expect(hero).toBeGreaterThan(secondary);
    expect(secondary).toBeGreaterThan(filler);
    expect(filler).toBeGreaterThan(accent);
  });

  it('treats an unset role as neutral (same as scale^2 alone)', () => {
    const noRole = computeWeight(makePlacement(0, 0, { scale: 1.5 }));
    expect(noRole).toBeCloseTo(1.5 * 1.5, 5);
  });
});

describe('computePerceivedWeight (Build 011, Section 1: Artistic Balance Engine)', () => {
  it('matches computeWeight exactly when paletteEnergy is undefined and role has no detail level', () => {
    const filler = makePlacement(0, 0, { scale: 1, role: 'filler' });
    expect(computePerceivedWeight(filler)).toBeCloseTo(computeWeight(filler), 10);
  });

  it('a hero reads heavier than plain computeWeight due to detail density, even with no paletteEnergy', () => {
    const hero = makePlacement(0, 0, { scale: 1, role: 'hero' });
    expect(computePerceivedWeight(hero)).toBeGreaterThan(computeWeight(hero));
  });

  it('a higher paletteEnergy makes a hero/secondary placement read heavier', () => {
    const hero = makePlacement(0, 0, { scale: 1, role: 'hero' });
    const low = computePerceivedWeight(hero, 0);
    const high = computePerceivedWeight(hero, 1);
    expect(high).toBeGreaterThan(low);
  });

  it('paletteEnergy does not affect filler/accent (neutral background roles)', () => {
    const filler = makePlacement(0, 0, { scale: 1, role: 'filler' });
    const accent = makePlacement(0, 0, { scale: 1, role: 'accent' });
    expect(computePerceivedWeight(filler, 0)).toBeCloseTo(computePerceivedWeight(filler, 1), 10);
    expect(computePerceivedWeight(accent, 0)).toBeCloseTo(computePerceivedWeight(accent, 1), 10);
  });

  it('still orders hero > secondary > filler > accent at equal scale/paletteEnergy', () => {
    const hero = computePerceivedWeight(makePlacement(0, 0, { scale: 1, role: 'hero' }), 0.5);
    const secondary = computePerceivedWeight(makePlacement(0, 0, { scale: 1, role: 'secondary' }), 0.5);
    const filler = computePerceivedWeight(makePlacement(0, 0, { scale: 1, role: 'filler' }), 0.5);
    const accent = computePerceivedWeight(makePlacement(0, 0, { scale: 1, role: 'accent' }), 0.5);
    expect(hero).toBeGreaterThan(secondary);
    expect(secondary).toBeGreaterThan(filler);
    expect(filler).toBeGreaterThan(accent);
  });
});

describe('applyBalanceCorrection', () => {
  it('is a no-op when strength is 0', () => {
    const placements = [makePlacement(100, 100), makePlacement(120, 110), makePlacement(900, 900), makePlacement(50, 50)];
    const result = applyBalanceCorrection(placements, TILE, 0);
    expect(result).toBe(placements);
  });

  it('is a no-op for fewer than 4 placements', () => {
    const placements = [makePlacement(100, 100), makePlacement(120, 110)];
    const result = applyBalanceCorrection(placements, TILE, 1);
    expect(result).toBe(placements);
  });

  it('is a no-op when the 4 quadrants are already evenly weighted', () => {
    const placements = [
      makePlacement(100, 100), // quadrant 0 (top-left)
      makePlacement(600, 100), // quadrant 1 (top-right)
      makePlacement(100, 600), // quadrant 2 (bottom-left)
      makePlacement(600, 600), // quadrant 3 (bottom-right)
    ];
    const result = applyBalanceCorrection(placements, TILE, 1);
    expect(result).toEqual(placements);
  });

  it('reduces quadrant-weight imbalance for a severely lopsided layout', () => {
    // 10 placements crammed into the top-left quadrant, none anywhere else.
    const placements: Placement[] = [];
    for (let i = 0; i < 10; i++) {
      placements.push(makePlacement(50 + i * 20, 50 + i * 15));
    }
    const before = quadrantWeights(placements, TILE);
    const corrected = applyBalanceCorrection(placements, TILE, 1);
    const after = quadrantWeights(corrected, TILE);
    const imbalance = (arr: number[]) => Math.max(...arr) - Math.min(...arr);
    expect(imbalance(after)).toBeLessThan(imbalance(before));
  });

  it('never moves more than ~15% of placements in a single pass', () => {
    const placements: Placement[] = [];
    for (let i = 0; i < 40; i++) placements.push(makePlacement(10 + i * 5, 10 + i * 3));
    const corrected = applyBalanceCorrection(placements, TILE, 1);
    const movedCount = corrected.filter((p, i) => p.x !== placements[i].x || p.y !== placements[i].y).length;
    expect(movedCount).toBeLessThanOrEqual(Math.ceil(placements.length * 0.15) + 1);
  });

  it('is deterministic (pure function, no rng)', () => {
    const placements: Placement[] = [];
    for (let i = 0; i < 12; i++) placements.push(makePlacement(20 + i * 10, 30 + i * 8));
    const a = applyBalanceCorrection(placements, TILE, 0.7);
    const b = applyBalanceCorrection(placements, TILE, 0.7);
    expect(a).toEqual(b);
  });
});

function quadrantWeights(placements: Placement[], tileSize: number): number[] {
  const q = [0, 0, 0, 0];
  for (const p of placements) {
    const px = ((p.x % tileSize) + tileSize) % tileSize;
    const py = ((p.y % tileSize) + tileSize) % tileSize;
    const qx = px < tileSize / 2 ? 0 : 1;
    const qy = py < tileSize / 2 ? 0 : 1;
    q[qy * 2 + qx] += computeWeight(p);
  }
  return q;
}

describe('applyRhythmSmoothing', () => {
  it('is a no-op when strength is 0', () => {
    const placements = [makePlacement(100, 100), makePlacement(110, 100), makePlacement(900, 900)];
    const result = applyRhythmSmoothing(placements, TILE, 0);
    expect(result).toBe(placements);
  });

  it('is a no-op for fewer than 3 placements', () => {
    const placements = [makePlacement(100, 100), makePlacement(110, 100)];
    const result = applyRhythmSmoothing(placements, TILE, 1);
    expect(result).toBe(placements);
  });

  it('is a no-op for a perfectly even grid (no spacing outliers)', () => {
    const placements: Placement[] = [];
    for (let gx = 0; gx < 4; gx++) {
      for (let gy = 0; gy < 4; gy++) {
        placements.push(makePlacement(gx * 250 + 50, gy * 250 + 50));
      }
    }
    const result = applyRhythmSmoothing(placements, TILE, 1);
    expect(result).toEqual(placements);
  });

  it('pulls an isolated outlier closer to its nearest neighbor', () => {
    // A tight cluster plus one placement sitting far away from everything.
    const placements: Placement[] = [
      makePlacement(500, 500),
      makePlacement(520, 500),
      makePlacement(500, 520),
      makePlacement(510, 510),
      makePlacement(50, 950), // isolated outlier
    ];
    const before = nearestDistance(placements, 4, TILE);
    const corrected = applyRhythmSmoothing(placements, TILE, 1);
    const after = nearestDistance(corrected, 4, TILE);
    expect(after).toBeLessThan(before);
  });

  it('is deterministic (pure function, no rng)', () => {
    const placements = [
      makePlacement(500, 500),
      makePlacement(520, 500),
      makePlacement(500, 520),
      makePlacement(510, 510),
      makePlacement(50, 950),
    ];
    const a = applyRhythmSmoothing(placements, TILE, 0.6);
    const b = applyRhythmSmoothing(placements, TILE, 0.6);
    expect(a).toEqual(b);
  });
});

function nearestDistance(placements: Placement[], index: number, tileSize: number): number {
  const p = placements[index];
  let best = Infinity;
  placements.forEach((o, j) => {
    if (j === index) return;
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const d = Math.hypot(p.x - (o.x + ox * tileSize), p.y - (o.y + oy * tileSize));
        if (d < best) best = d;
      }
    }
  });
  return best;
}

describe('applyCompositionIntelligence', () => {
  it('is a strict no-op (same array reference) when params is undefined', () => {
    const placements = [makePlacement(100, 100), makePlacement(900, 900), makePlacement(50, 50)];
    const result = applyCompositionIntelligence(placements, TILE, undefined);
    expect(result).toBe(placements);
  });

  it('runs balance correction before rhythm smoothing and returns a real result', () => {
    const placements: Placement[] = [];
    for (let i = 0; i < 10; i++) placements.push(makePlacement(50 + i * 20, 50 + i * 15));
    const result = applyCompositionIntelligence(placements, TILE, DEFAULT_COMPOSITION_INTELLIGENCE);
    expect(result.length).toBe(placements.length);
    for (const p of result) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it('is deterministic end to end', () => {
    const placements: Placement[] = [];
    for (let i = 0; i < 16; i++) placements.push(makePlacement(20 + i * 15, 30 + i * 11));
    const a = applyCompositionIntelligence(placements, TILE, DEFAULT_COMPOSITION_INTELLIGENCE);
    const b = applyCompositionIntelligence(placements, TILE, DEFAULT_COMPOSITION_INTELLIGENCE);
    expect(a).toEqual(b);
  });

  it('is a strict V1 pipeline (balance -> rhythm only) when only the original two fields are set', () => {
    const placements: Placement[] = [];
    for (let i = 0; i < 12; i++) placements.push(makePlacement(50 + i * 20, 50 + i * 15));
    const v1Params = { balanceStrength: 0.7, rhythmStrength: 0.4 };
    const viaOrchestrator = applyCompositionIntelligence(placements, TILE, v1Params);
    const manual = applyRhythmSmoothing(applyBalanceCorrection(placements, TILE, 0.7), TILE, 0.4);
    expect(viaOrchestrator).toEqual(manual);
  });

  it('Build 009 Section 2: eyeFlowPath/eyeFlowStrength are a strict no-op when left unset', () => {
    const placements: Placement[] = [];
    for (let i = 0; i < 12; i++) placements.push(makePlacement(50 + i * 20, 50 + i * 15));
    const withoutEyeFlow = applyCompositionIntelligence(placements, TILE, DEFAULT_COMPOSITION_INTELLIGENCE);
    const explicitlyUnset = applyCompositionIntelligence(placements, TILE, { ...DEFAULT_COMPOSITION_INTELLIGENCE, eyeFlowPath: undefined, eyeFlowStrength: undefined });
    expect(explicitlyUnset).toEqual(withoutEyeFlow);
  });

  it('Build 009 Section 2: setting eyeFlowPath/eyeFlowStrength visibly changes the result', () => {
    const placements: Placement[] = [];
    for (let i = 0; i < 12; i++) placements.push(makePlacement(50 + i * 20, 50 + i * 15));
    const without = applyCompositionIntelligence(placements, TILE, DEFAULT_COMPOSITION_INTELLIGENCE);
    const withEyeFlow = applyCompositionIntelligence(placements, TILE, { ...DEFAULT_COMPOSITION_INTELLIGENCE, eyeFlowPath: 'sCurve', eyeFlowStrength: 0.5 });
    expect(withEyeFlow).not.toEqual(without);
  });

  it('Build 011 Section 1: artisticBalance/paletteEnergy are a strict no-op when left unset', () => {
    const placements: Placement[] = [];
    for (let i = 0; i < 12; i++) placements.push(makePlacement(50 + i * 20, 50 + i * 15, { role: i % 3 === 0 ? 'hero' : 'filler' }));
    const withoutFlag = applyCompositionIntelligence(placements, TILE, DEFAULT_COMPOSITION_INTELLIGENCE);
    const explicitlyUnset = applyCompositionIntelligence(placements, TILE, { ...DEFAULT_COMPOSITION_INTELLIGENCE, artisticBalance: undefined, paletteEnergy: undefined });
    expect(explicitlyUnset).toEqual(withoutFlag);
  });

  it('Build 011 Section 1: enabling artisticBalance with a high paletteEnergy can flip which cell reads as heaviest, visibly changing the result', () => {
    // 3 fillers alone outweigh 1 hero under plain computeWeight (2.55 vs
    // 2.535), so the default pass evicts a filler from the filler-heavy
    // cell. Once the hero's real perceived weight (detail density + this
    // tile's own color energy) is factored in, the hero cell becomes the
    // heavier one instead, and the hero itself is what gets moved — a real,
    // observable behavior change, not just a magnitude tweak that happens
    // to net out the same.
    const placements: Placement[] = [
      makePlacement(60, 60, { role: 'filler' }),
      makePlacement(70, 70, { role: 'filler' }),
      makePlacement(80, 80, { role: 'filler' }),
      makePlacement(900, 60, { role: 'hero', scale: 1.3 }),
    ];
    const minimalParams = { balanceStrength: 1, rhythmStrength: 0 };
    const without = applyCompositionIntelligence(placements, TILE, minimalParams);
    const withArtisticBalance = applyCompositionIntelligence(placements, TILE, { ...minimalParams, artisticBalance: true, paletteEnergy: 1 });
    expect(withArtisticBalance).not.toEqual(without);
    const hero = placements[3];
    const heroMovedOnlyWithArtisticBalance = withArtisticBalance[3].x !== hero.x || withArtisticBalance[3].y !== hero.y;
    const heroMovedByDefault = without[3].x !== hero.x || without[3].y !== hero.y;
    expect(heroMovedOnlyWithArtisticBalance).toBe(true);
    expect(heroMovedByDefault).toBe(false);
  });
});

describe('applyGridBalanceCorrection', () => {
  it('gridN=2 behaves identically to applyBalanceCorrection', () => {
    const placements: Placement[] = [];
    for (let i = 0; i < 10; i++) placements.push(makePlacement(50 + i * 20, 50 + i * 15));
    expect(applyGridBalanceCorrection(placements, TILE, 2, 0.7)).toEqual(applyBalanceCorrection(placements, TILE, 0.7));
  });

  it('is a no-op when strength is 0', () => {
    const placements = [makePlacement(100, 100), makePlacement(120, 110), makePlacement(900, 900), makePlacement(50, 50)];
    expect(applyGridBalanceCorrection(placements, TILE, 4, 0)).toBe(placements);
  });

  it('a finer grid (4x4) catches a localized imbalance a coarse 2x2 split would average away', () => {
    // Two placements crammed into one quadrant's corner cell, two more
    // spread across the rest of that same quadrant — quadrant-level (2x2)
    // weight looks roughly balanced against the empty opposite quadrant,
    // but a 4x4 split exposes the one genuinely overloaded cell.
    const placements: Placement[] = [
      makePlacement(60, 60), makePlacement(70, 70), makePlacement(65, 65), makePlacement(75, 75), makePlacement(68, 62),
    ];
    const corrected = applyGridBalanceCorrection(placements, TILE, 4, 1);
    const movedCount = corrected.filter((p, i) => p.x !== placements[i].x || p.y !== placements[i].y).length;
    expect(movedCount).toBeGreaterThan(0);
  });

  it('is deterministic (pure function, no rng)', () => {
    const placements: Placement[] = [];
    for (let i = 0; i < 12; i++) placements.push(makePlacement(20 + i * 10, 30 + i * 8));
    const a = applyGridBalanceCorrection(placements, TILE, 4, 0.6);
    const b = applyGridBalanceCorrection(placements, TILE, 4, 0.6);
    expect(a).toEqual(b);
  });

  it('Build 011, Section 1: an explicit weightFn changes which placement is judged heaviest', () => {
    const placements: Placement[] = [
      makePlacement(60, 60, { role: 'hero' }),
      makePlacement(70, 70, { role: 'filler' }),
      makePlacement(900, 60, { role: 'accent' }),
      makePlacement(900, 900, { role: 'accent' }),
    ];
    // Default computeWeight: hero (1.5) > filler (0.85), so the redistribution
    // pass moves the *lighter* filler out of the overloaded cell first.
    const defaultResult = applyGridBalanceCorrection(placements, TILE, 2, 1);
    const filler = placements[1];
    const fillerMoved = defaultResult[1].x !== filler.x || defaultResult[1].y !== filler.y;
    expect(fillerMoved).toBe(true);
    const hero = placements[0];
    const heroUnmovedByDefault = defaultResult[0].x === hero.x && defaultResult[0].y === hero.y;
    expect(heroUnmovedByDefault).toBe(true);

    // An inverted weightFn (hero reads as lightest) moves the hero instead —
    // proof `weightFn` genuinely replaces `computeWeight`, not just an inert
    // parameter.
    const invertedWeightFn = (p: Placement) => (p.role === 'hero' ? 0.1 : 2);
    const invertedResult = applyGridBalanceCorrection(placements, TILE, 2, 1, invertedWeightFn);
    const heroMovedWhenInverted = invertedResult[0].x !== hero.x || invertedResult[0].y !== hero.y;
    expect(heroMovedWhenInverted).toBe(true);
  });
});

describe('applyNegativeSpaceCorrection', () => {
  it('is a thin 4x4 wrapper over applyGridBalanceCorrection', () => {
    const placements: Placement[] = [];
    for (let i = 0; i < 12; i++) placements.push(makePlacement(30 + i * 18, 40 + i * 14));
    expect(applyNegativeSpaceCorrection(placements, TILE, 0.5)).toEqual(applyGridBalanceCorrection(placements, TILE, 4, 0.5));
  });

  it('is a no-op when strength is 0', () => {
    const placements = [makePlacement(100, 100), makePlacement(120, 110), makePlacement(900, 900), makePlacement(50, 50)];
    expect(applyNegativeSpaceCorrection(placements, TILE, 0)).toBe(placements);
  });
});

describe('applyFlowBias', () => {
  it('is a no-op when strength is 0', () => {
    const placements = [makePlacement(100, 100), makePlacement(500, 500)];
    expect(applyFlowBias(placements, TILE, 'directional', 0)).toBe(placements);
  });

  it("is a no-op for 'calm' regardless of strength (an even, non-directional field is the point)", () => {
    const placements = [makePlacement(100, 100), makePlacement(500, 500)];
    expect(applyFlowBias(placements, TILE, 'calm', 1)).toBe(placements);
  });

  it('directional bias pulls placements toward the tile diagonal (x and y move closer together)', () => {
    const placements = [makePlacement(100, 900)]; // far from the y=x diagonal
    const [result] = applyFlowBias(placements, TILE, 'directional', 1);
    const before = Math.abs(100 - 900);
    const after = Math.abs(result.x - result.y);
    expect(after).toBeLessThan(before);
  });

  it('dynamic bias applies a nonzero two-axis offset', () => {
    const placements = [makePlacement(300, 300)];
    const [result] = applyFlowBias(placements, TILE, 'dynamic', 1);
    expect(result.x !== 300 || result.y !== 300).toBe(true);
  });

  it('scales the bias magnitude with strength', () => {
    const placements = [makePlacement(100, 900)];
    const [weak] = applyFlowBias(placements, TILE, 'directional', 0.2);
    const [strong] = applyFlowBias(placements, TILE, 'directional', 1);
    const weakGap = Math.abs(weak.x - weak.y);
    const strongGap = Math.abs(strong.x - strong.y);
    expect(strongGap).toBeLessThan(weakGap);
  });

  it('is deterministic (pure function, no rng)', () => {
    const placements = [makePlacement(100, 900), makePlacement(400, 200)];
    const a = applyFlowBias(placements, TILE, 'dynamic', 0.6);
    const b = applyFlowBias(placements, TILE, 'dynamic', 0.6);
    expect(a).toEqual(b);
  });
});

describe('applyControlledAsymmetry (Build 009, Section 5: Natural Asymmetry Engine)', () => {
  it('is a no-op when strength is 0', () => {
    const placements = [makePlacement(100, 100, { role: 'filler' })];
    expect(applyControlledAsymmetry(placements, TILE, 'right', 0)).toBe(placements);
  });

  it('is a no-op for an empty placement list', () => {
    expect(applyControlledAsymmetry([], TILE, 'right', 1)).toEqual([]);
  });

  it('never nudges hero or secondary placements', () => {
    const hero = makePlacement(500, 500, { role: 'hero' });
    const secondary = makePlacement(500, 500, { role: 'secondary' });
    const [resultHero] = applyControlledAsymmetry([hero], TILE, 'right', 1);
    const [resultSecondary] = applyControlledAsymmetry([secondary], TILE, 'right', 1);
    expect(resultHero).toEqual(hero);
    expect(resultSecondary).toEqual(secondary);
  });

  it('nudges filler/accent/unroled placements in the chosen direction', () => {
    const filler = makePlacement(500, 500, { role: 'filler' });
    const accent = makePlacement(500, 500, { role: 'accent' });
    const unroled = makePlacement(500, 500);
    const [rFiller] = applyControlledAsymmetry([filler], TILE, 'right', 1);
    const [rAccent] = applyControlledAsymmetry([accent], TILE, 'right', 1);
    const [rUnroled] = applyControlledAsymmetry([unroled], TILE, 'right', 1);
    expect(rFiller.x).toBeGreaterThan(filler.x);
    expect(rAccent.x).toBeGreaterThan(accent.x);
    expect(rUnroled.x).toBeGreaterThan(unroled.x);
  });

  it("moves placements in the direction implied by each named direction's vector", () => {
    const p = makePlacement(500, 500, { role: 'accent' });
    const [right] = applyControlledAsymmetry([p], TILE, 'right', 1);
    const [left] = applyControlledAsymmetry([p], TILE, 'left', 1);
    const [top] = applyControlledAsymmetry([p], TILE, 'top', 1);
    const [bottom] = applyControlledAsymmetry([p], TILE, 'bottom', 1);
    expect(right.x).toBeGreaterThan(p.x);
    expect(left.x).toBeLessThan(p.x);
    expect(top.y).toBeLessThan(p.y);
    expect(bottom.y).toBeGreaterThan(p.y);
  });

  it('every real direction produces a nonzero, bounded (subtle) nudge', () => {
    const p = makePlacement(500, 500, { role: 'accent' });
    for (const direction of ASYMMETRY_DIRECTIONS) {
      const [result] = applyControlledAsymmetry([p], TILE, direction, 1);
      const dist = Math.hypot(result.x - p.x, result.y - p.y);
      expect(dist).toBeGreaterThan(0);
      expect(dist).toBeLessThan(TILE * 0.1);
    }
  });

  it('scales the nudge magnitude with strength', () => {
    const p = makePlacement(500, 500, { role: 'accent' });
    const [weak] = applyControlledAsymmetry([p], TILE, 'right', 0.2);
    const [strong] = applyControlledAsymmetry([p], TILE, 'right', 1);
    expect(strong.x - p.x).toBeGreaterThan(weak.x - p.x);
  });

  it('filler moves less than accent for the same strength (a lighter touch on the more prominent role)', () => {
    const filler = makePlacement(500, 500, { role: 'filler' });
    const accent = makePlacement(500, 500, { role: 'accent' });
    const [rFiller] = applyControlledAsymmetry([filler], TILE, 'right', 1);
    const [rAccent] = applyControlledAsymmetry([accent], TILE, 'right', 1);
    expect(rFiller.x - filler.x).toBeLessThan(rAccent.x - accent.x);
  });

  it('is deterministic (pure function, no rng)', () => {
    const placements = [makePlacement(100, 900, { role: 'accent' }), makePlacement(400, 200, { role: 'filler' })];
    const a = applyControlledAsymmetry(placements, TILE, 'bottomLeft', 0.6);
    const b = applyControlledAsymmetry(placements, TILE, 'bottomLeft', 0.6);
    expect(a).toEqual(b);
  });
});
