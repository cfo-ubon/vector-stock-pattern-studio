import { pick, hashPick, range } from '../core/rng.js';
import { tr } from '../core/svg.js';
import { shade } from '../core/color.js';

export const FAMILY = {
  id: 'geometric',
  label: 'Geometric & Abstract',
  heroVocab: ['sunburst', 'arch', 'terrazzo'],
  secondaryVocab: ['half moon', 'ribbon wave', 'soft triangle'],
  fillerVocab: ['dot cluster', 'small square', 'pebble'],
  accentVocab: ['tiny dot', 'confetti dash'],
  paletteDefault: 'Cool Minimal',
  keywords: ['geometric', 'abstract', 'modern', 'mid century', 'shapes', 'minimal', 'bauhaus', 'retro'],
};

function heroShape(kind, palette, rng) {
  const a = palette[4], b = palette[2], c = palette[1];
  const aEdge = shade(a, -0.25), aHi = shade(a, 0.35);
  if (kind === 'sunburst') {
    let s = `<circle r="26" fill="${a}" stroke="${aEdge}" stroke-width="3"/>`;
    for (let i = 0; i < 10; i++) {
      s += `<line x1="0" y1="-30" x2="0" y2="-64" stroke="${a}" stroke-width="7" stroke-linecap="round" transform="rotate(${i * 36})"/>`;
    }
    return s + `<circle cx="-8" cy="-8" r="9" fill="${aHi}" opacity=".6"/>`;
  }
  if (kind === 'arch') {
    return `<path d="M-48 46 A48 48 0 0 1 48 46 L48 60 L-48 60 Z" fill="${a}" stroke="${aEdge}" stroke-width="2"/>` +
      `<path d="M-28 46 A28 28 0 0 1 28 46 L28 60 L-28 60 Z" fill="${b}" stroke="${shade(b, -0.2)}" stroke-width="2"/>` +
      `<path d="M-40 42 A40 40 0 0 1 -10 8" fill="none" stroke="${aHi}" stroke-width="4" opacity=".55" stroke-linecap="round"/>`;
  }
  if (kind === 'terrazzo') {
    let s = `<circle r="42" fill="${c}" stroke="${shade(c, -0.2)}" stroke-width="2"/>`;
    for (let i = 0; i < 6; i++) {
      const r = range(rng, 6, 14);
      const cx = range(rng, -30, 30), cy = range(rng, -30, 30);
      const fill = i % 2 ? a : b;
      s += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" stroke="${shade(fill, -0.25)}" stroke-width="1"/>`;
    }
    return s;
  }
  return `<path d="M-50 30 C-50 -30 50 -30 50 30 C20 55 -20 55 -50 30Z" fill="${a}" stroke="${aEdge}" stroke-width="2"/><ellipse cx="-14" cy="-6" rx="16" ry="9" fill="${aHi}" opacity=".5"/>`;
}

function secondaryShape(kind, palette) {
  const a = palette[3], b = palette[5];
  if (kind === 'half moon') return `<path d="M-40 0 A40 40 0 0 1 40 0" fill="none" stroke="${a}" stroke-width="12" stroke-linecap="round"/>`;
  if (kind === 'ribbon wave') return `<path d="M-60 0 C-30 -30 30 30 60 0" fill="none" stroke="${a}" stroke-width="10" stroke-linecap="round"/>`;
  return `<path d="M0 -40 L35 30 L-35 30 Z" fill="${b}" opacity=".85"/>`;
}

function fillerShape(kind, palette) {
  const a = palette[4];
  if (kind === 'dot cluster') {
    let s = '';
    for (let i = 0; i < 3; i++) s += `<circle cx="${(i - 1) * 16}" cy="0" r="6" fill="${a}"/>`;
    return s;
  }
  if (kind === 'small square') return `<rect x="-10" y="-10" width="20" height="20" rx="4" fill="${a}"/>`;
  return `<circle r="9" fill="${a}" opacity=".8"/>`;
}

function accentShape(kind, palette) {
  if (kind === 'confetti dash') return `<rect x="-2" y="-10" width="4" height="20" fill="${palette[6]}" opacity=".7"/>`;
  return `<circle r="3.5" fill="${palette[6]}" opacity=".8"/>`;
}

export function motif(tier, rng, palette, name, x, y, rot, scale, opacity) {
  const group = (inner) => `<g transform="${tr(x, y, rot, scale)}" opacity="${opacity.toFixed(2)}">${inner}</g>`;
  if (tier === 'hero') return group(heroShape(name ? hashPick(name, FAMILY.heroVocab) : pick(rng, FAMILY.heroVocab), palette, rng));
  if (tier === 'secondary') return group(secondaryShape(name ? hashPick(name, FAMILY.secondaryVocab) : pick(rng, FAMILY.secondaryVocab), palette));
  if (tier === 'filler') return group(fillerShape(name ? hashPick(name, FAMILY.fillerVocab) : pick(rng, FAMILY.fillerVocab), palette));
  return group(accentShape(name ? hashPick(name, FAMILY.accentVocab) : pick(rng, FAMILY.accentVocab), palette));
}
