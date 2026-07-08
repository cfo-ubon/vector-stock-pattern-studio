import { pick, hashPick } from '../core/rng.js';
import { tr } from '../core/svg.js';
import { shade } from '../core/color.js';

export const FAMILY = {
  id: 'textile',
  label: 'Textile & Ikat',
  heroVocab: ['ikat diamond', 'medallion', 'block stamp', 'paisley', 'scallop rosette'],
  secondaryVocab: ['chevron row', 'stripe band', 'zigzag stitch'],
  fillerVocab: ['woven dash', 'tiny cross', 'seed dot'],
  accentVocab: ['thread dot', 'fleck'],
  paletteDefault: 'Muted Terracotta',
  keywords: ['textile', 'ikat', 'fabric', 'woven', 'ethnic', 'boho', 'block print', 'loom'],
};

function heroShape(kind, palette) {
  const a = palette[4], b = palette[3], c = palette[1];
  const aEdge = shade(a, -0.28), cHi = shade(c, 0.3);
  if (kind === 'ikat diamond') {
    return `<path d="M0 -60 L45 0 L0 60 L-45 0Z" fill="${a}" stroke="${aEdge}" stroke-width="2"/>` +
      `<path d="M0 -34 L26 0 L0 34 L-26 0Z" fill="${c}" stroke="${shade(c, -0.2)}" stroke-width="1.5"/>` +
      `<path d="M0 -16 L10 0 L0 16 L-10 0Z" fill="${cHi}" opacity=".7"/>`;
  }
  if (kind === 'medallion') {
    return `<circle r="48" fill="none" stroke="${a}" stroke-width="8"/><circle r="26" fill="${b}" stroke="${shade(b, -0.22)}" stroke-width="2"/>` +
      `<circle r="8" fill="${a}"/><circle cx="-9" cy="-9" r="5" fill="${shade(a, 0.4)}" opacity=".6"/>`;
  }
  if (kind === 'paisley') {
    return `<path d="M0 -46 C34 -46 40 -6 14 10 C34 14 30 40 4 42 C-30 46 -50 16 -34 -12 C-24 -30 -14 -46 0 -46Z" fill="${a}" stroke="${aEdge}" stroke-width="2"/>` +
      `<circle cx="-6" cy="-10" r="10" fill="${c}" opacity=".85"/><circle cx="-6" cy="-10" r="4" fill="${cHi}"/>`;
  }
  if (kind === 'scallop rosette') {
    let s = `<circle r="20" fill="${a}" stroke="${aEdge}" stroke-width="2"/>`;
    for (let i = 0; i < 8; i++) {
      s += `<circle r="14" fill="${c}" stroke="${shade(c, -0.2)}" stroke-width="1.5" transform="rotate(${i * 45}) translate(0 -34)"/>`;
    }
    return s + `<circle r="7" fill="${cHi}" opacity=".8"/>`;
  }
  return `<rect x="-40" y="-40" width="80" height="80" fill="${a}" stroke="${aEdge}" stroke-width="2"/><rect x="-24" y="-24" width="48" height="48" fill="${c}" stroke="${shade(c, -0.2)}" stroke-width="1.5"/>`;
}

function secondaryShape(kind, palette) {
  const a = palette[5];
  if (kind === 'chevron row') return `<path d="M-40 20 L0 -20 L40 20" fill="none" stroke="${a}" stroke-width="9" stroke-linecap="round"/>`;
  if (kind === 'zigzag stitch') return `<path d="M-40 -10 L-20 10 L0 -10 L20 10 L40 -10" fill="none" stroke="${a}" stroke-width="4" stroke-linecap="round"/>`;
  return `<rect x="-45" y="-6" width="90" height="12" fill="${a}"/>`;
}

function fillerShape(kind, palette) {
  const a = palette[6];
  if (kind === 'woven dash') return `<line x1="-14" y1="0" x2="14" y2="0" stroke="${a}" stroke-width="4" stroke-linecap="round"/>`;
  if (kind === 'seed dot') return `<circle r="4" fill="${a}"/><circle cx="10" cy="4" r="2.5" fill="${a}" opacity=".7"/>`;
  return `<path d="M-8 -8 L8 8M-8 8 L8 -8" stroke="${a}" stroke-width="3" stroke-linecap="round"/>`;
}

function accentShape(palette) {
  return `<circle r="4" fill="${palette[4]}" opacity=".75"/>`;
}

export function motif(tier, rng, palette, name, x, y, rot, scale, opacity) {
  const group = (inner) => `<g transform="${tr(x, y, rot, scale)}" opacity="${opacity.toFixed(2)}">${inner}</g>`;
  if (tier === 'hero') return group(heroShape(name ? hashPick(name, FAMILY.heroVocab) : pick(rng, FAMILY.heroVocab), palette));
  if (tier === 'secondary') return group(secondaryShape(name ? hashPick(name, FAMILY.secondaryVocab) : pick(rng, FAMILY.secondaryVocab), palette));
  if (tier === 'filler') return group(fillerShape(name ? hashPick(name, FAMILY.fillerVocab) : pick(rng, FAMILY.fillerVocab), palette));
  return group(accentShape(palette));
}
