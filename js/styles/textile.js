import { pick, hashPick } from '../core/rng.js';
import { tr } from '../core/svg.js';

export const FAMILY = {
  id: 'textile',
  label: 'Textile & Ikat',
  heroVocab: ['ikat diamond', 'medallion', 'block stamp'],
  secondaryVocab: ['chevron row', 'stripe band'],
  fillerVocab: ['woven dash', 'tiny cross'],
  accentVocab: ['thread dot', 'fleck'],
  paletteDefault: 'Muted Terracotta',
  keywords: ['textile', 'ikat', 'fabric', 'woven', 'ethnic', 'boho', 'block print', 'loom'],
};

function heroShape(kind, palette) {
  const a = palette[4], b = palette[3], c = palette[1];
  if (kind === 'ikat diamond') return `<path d="M0 -60 L45 0 L0 60 L-45 0Z" fill="${a}"/><path d="M0 -34 L26 0 L0 34 L-26 0Z" fill="${c}"/>`;
  if (kind === 'medallion') return `<circle r="48" fill="none" stroke="${a}" stroke-width="8"/><circle r="26" fill="${b}"/><circle r="8" fill="${a}"/>`;
  return `<rect x="-40" y="-40" width="80" height="80" fill="${a}"/><rect x="-24" y="-24" width="48" height="48" fill="${c}"/>`;
}

function secondaryShape(kind, palette) {
  const a = palette[5];
  if (kind === 'chevron row') return `<path d="M-40 20 L0 -20 L40 20" fill="none" stroke="${a}" stroke-width="9" stroke-linecap="round"/>`;
  return `<rect x="-45" y="-6" width="90" height="12" fill="${a}"/>`;
}

function fillerShape(kind, palette) {
  const a = palette[6];
  if (kind === 'woven dash') return `<line x1="-14" y1="0" x2="14" y2="0" stroke="${a}" stroke-width="4" stroke-linecap="round"/>`;
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
