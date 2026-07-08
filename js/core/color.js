function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

// amt > 0 lightens toward white, amt < 0 darkens toward black.
export function shade(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const target = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  return `rgb(${clamp(r + (target - r) * p)},${clamp(g + (target - g) * p)},${clamp(b + (target - b) * p)})`;
}
