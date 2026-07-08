import type { Rng } from './types';

/** cyrb53 string hash -> 32-bit seed. Used so users can type any seed text
 * (words, dates, etc.) and still get a well-distributed numeric seed. */
function hashSeed(str: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return (h1 >>> 0) ^ (h2 >>> 0);
}

/** mulberry32 PRNG: fast, small, deterministic. Given the same seed string
 * it always produces the same sequence, which is what lets the app show a
 * seed value and reproduce an identical pattern from it later. */
export function createRng(seed: string): Rng {
  let state = hashSeed(seed) || 1;
  return function rng() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function rngRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function rngInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rngRange(rng, min, max + 1));
}

export function rngPick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function rngBool(rng: Rng, probability = 0.5): boolean {
  return rng() < probability;
}

/** +/- jitter around a base value, e.g. jitter(90, 15) => 75..105 */
export function jitter(rng: Rng, base: number, amount: number): number {
  return base + rngRange(rng, -amount, amount);
}
