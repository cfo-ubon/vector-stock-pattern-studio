// Each palette is [background, tint, mid, deep, accent, pale, ink].
export const PALETTES = {
  'Cream Coral Garden': ['#fbf5e9', '#d9dec9', '#9caf8a', '#426c48', '#d57957', '#f2d9bd', '#133b2d'],
  'Scandinavian Sage': ['#f7f1e8', '#cbd6c0', '#91a983', '#476b46', '#c98362', '#eee1cb', '#19382c'],
  'Vintage Cream': ['#f6ecd9', '#cbbb9e', '#8b9467', '#56633e', '#b96f57', '#ead4b8', '#2d3a2a'],
  'Luxury Dark': ['#17372c', '#d7d0b8', '#879a74', '#f5ead8', '#d98661', '#fff6e6', '#061f19'],
  'Pastel Garden': ['#fff4ec', '#d8dfc8', '#a8bd91', '#6f8f5e', '#e5a28c', '#f5dec9', '#2b5140'],
  'Neutral Textile': ['#f4eee4', '#d8cab6', '#a99d84', '#6b6a54', '#b88468', '#ead8c3', '#2f3328'],
  'Muted Terracotta': ['#f7efe7', '#ddbea9', '#cb997e', '#a5a58d', '#6b705c', '#ffe8d6', '#432818'],
  'Cool Minimal': ['#f7f7f2', '#cfdbd5', '#a6a2a2', '#5b6c5d', '#2f3e46', '#e8eddf', '#1c2521'],
  'Mid Century Bold': ['#f2e8cf', '#dda15e', '#bc6c25', '#606c38', '#283618', '#fefae0', '#1c1c1c'],
  'Soft Pastel': ['#fff7f0', '#d8e2dc', '#ffe5d9', '#ffcad4', '#e08a9b', '#9d8189', '#3a2e33'],
};

export function defaultPaletteName() {
  return Object.keys(PALETTES)[0];
}
