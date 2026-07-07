export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  };
}

export function mulberry32(seed) {
  let a = seed;
  return function () {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  return mulberry32(xmur3(String(seed))());
}

export function range(rng, a, b) {
  return a + (b - a) * rng();
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Deterministically maps an arbitrary string (e.g. an AI-suggested motif
// name) onto one of the renderer's known variants, so unrecognized names
// still spread across the full visual repertoire instead of collapsing
// onto a single fallback.
export function hashPick(name, arr) {
  let h = 0;
  const s = String(name || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}
