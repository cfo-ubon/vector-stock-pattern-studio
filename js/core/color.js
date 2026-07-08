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

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const [rl, gl, bl] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

// WCAG-style contrast ratio (1..21) between two hex colors.
export function contrastRatio(hexA, hexB) {
  const a = relativeLuminance(hexA), b = relativeLuminance(hexB);
  const lighter = Math.max(a, b), darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

// Average pairwise color distance across a palette, normalized to 0..1.
// Low values mean the palette is nearly monochrome.
export function paletteSpread(palette) {
  let total = 0, count = 0;
  for (let i = 0; i < palette.length; i++) {
    for (let j = i + 1; j < palette.length; j++) {
      const A = hexToRgb(palette[i]), B = hexToRgb(palette[j]);
      total += Math.sqrt((A.r - B.r) ** 2 + (A.g - B.g) ** 2 + (A.b - B.b) ** 2);
      count++;
    }
  }
  return count ? total / count / 441.67 : 0;
}
