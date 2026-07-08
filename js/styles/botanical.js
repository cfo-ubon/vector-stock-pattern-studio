import { pick, hashPick, range } from '../core/rng.js';
import { tr } from '../core/svg.js';
import { shade } from '../core/color.js';

export const FAMILY = {
  id: 'botanical',
  label: 'Botanical & Floral',
  heroVocab: ['peony', 'rose', 'daisy', 'cosmos', 'tulip'],
  secondaryVocab: ['eucalyptus branch', 'olive branch', 'fern frond', 'willow branch'],
  fillerVocab: ['berry stem', 'bud sprig', 'single leaf'],
  accentVocab: ['sparkle', 'dot'],
  paletteDefault: 'Cream Coral Garden',
  keywords: ['botanical', 'floral', 'flower', 'leaf', 'foliage', 'garden', 'petal', 'bloom', 'nature', 'organic'],
};

const HERO_KINDS = FAMILY.heroVocab;
const SECONDARY_KINDS = FAMILY.secondaryVocab;
const FILLER_KINDS = FAMILY.fillerVocab;
const ACCENT_KINDS = FAMILY.accentVocab;

function flowerShape(kind, palette, rng) {
  // A small per-instance tint jitter keeps repeated flowers from reading
  // as an identical rubber-stamp copy — closer to how a hand-painted
  // botanical pattern varies bloom to bloom.
  const base = { rose: '#c8626a', cosmos: '#e3a38d' }[kind] || palette[4];
  const petalColor = shade(base, range(rng, -0.07, 0.07));
  const petalCount = { peony: 8, rose: 6, daisy: 10, cosmos: 8, tulip: 6 }[kind] || 8;
  const layers = kind === 'daisy' ? 1 : kind === 'tulip' ? 2 : 3;
  const edge = shade(petalColor, -0.25);
  const highlight = shade(petalColor, 0.4);
  let s = '';
  for (let layer = 0; layer < layers; layer++) {
    const r = 68 - layer * 20;
    const rx = kind === 'tulip' ? 20 - layer * 4 : 40 - layer * 9;
    const ry = kind === 'tulip' ? 58 - layer * 10 : 98 - layer * 22;
    const alpha = (1 - layer * 0.18).toFixed(2);
    for (let i = 0; i < petalCount; i++) {
      const a = (360 * i) / petalCount + layer * 14;
      const px = Math.sin((a * Math.PI) / 180) * r;
      const py = -Math.cos((a * Math.PI) / 180) * r;
      s += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${rx}" ry="${ry}" fill="${petalColor}" stroke="${edge}" stroke-width="1.5" opacity="${alpha}" transform="rotate(${a.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)})"/>`;
      if (layer === 0) {
        s += `<ellipse cx="${px.toFixed(1)}" cy="${(py - ry * 0.32).toFixed(1)}" rx="${(rx * 0.45).toFixed(1)}" ry="${(ry * 0.28).toFixed(1)}" fill="${highlight}" opacity=".45" transform="rotate(${a.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)})"/>`;
      }
    }
  }
  return s + `<circle r="19" fill="${edge}"/><circle r="16" fill="${palette[6]}" opacity=".88"/><circle cx="-4" cy="-4" r="6" fill="${highlight}" opacity=".5"/>`;
}

function branchShape(kind, palette, rng) {
  const stroke = palette[6];
  const base = kind === 'eucalyptus branch' ? palette[1] : kind === 'fern frond' ? palette[2] : palette[3];
  const leafFill = shade(base, range(rng, -0.06, 0.06));
  const leafEdge = shade(leafFill, -0.22);
  const leafHi = shade(leafFill, 0.35);
  const length = kind === 'fern frond' ? 340 : 420;
  const leafCount = kind === 'fern frond' ? 8 : 6;
  let s = `<path d="M0 ${length / 2} C-40 ${length * 0.1} 30 ${-length * 0.15} 0 ${-length / 2}" fill="none" stroke="${stroke}" stroke-width="6" stroke-linecap="round"/>`;
  for (let i = 0; i < leafCount; i++) {
    const t = (i + 0.5) / leafCount;
    const y = length / 2 - t * length;
    const side = i % 2 ? -1 : 1;
    const lx = side * (30 + 10 * Math.sin(i));
    const ly = y - 8;
    s += `<path d="M0 ${y.toFixed(1)} L${lx.toFixed(1)} ${ly.toFixed(1)}" stroke="${stroke}" stroke-width="3" opacity=".6"/>`;
    s += `<ellipse cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" rx="16" ry="30" fill="${leafFill}" stroke="${leafEdge}" stroke-width="1.2" opacity=".9" transform="rotate(${side * 30} ${lx.toFixed(1)} ${ly.toFixed(1)})"/>`;
    s += `<ellipse cx="${(lx - side * 4).toFixed(1)}" cy="${(ly - 8).toFixed(1)}" rx="5" ry="12" fill="${leafHi}" opacity=".4" transform="rotate(${side * 30} ${lx.toFixed(1)} ${ly.toFixed(1)})"/>`;
  }
  return s;
}

function fillerShape(kind, palette) {
  if (kind === 'berry stem') {
    let s = `<path d="M0 60 C10 20 -8 -20 0 -60" stroke="${palette[6]}" stroke-width="3" fill="none"/>`;
    for (let i = 0; i < 4; i++) {
      s += `<circle cx="${i % 2 ? 8 : -8}" cy="${45 - i * 30}" r="7" fill="${palette[4]}"/>`;
    }
    return s;
  }
  if (kind === 'bud sprig') {
    return `<path d="M0 30 L0 -30" stroke="${palette[6]}" stroke-width="3"/><ellipse cy="-32" rx="8" ry="14" fill="${palette[4]}"/>`;
  }
  return `<ellipse rx="14" ry="26" fill="${palette[2]}" opacity=".8"/>`;
}

function accentShape(kind, palette) {
  if (kind === 'sparkle') {
    let s = '';
    for (let i = 0; i < 6; i++) {
      const a = i * 60;
      const x = Math.sin((a * Math.PI) / 180) * 14;
      const y = -Math.cos((a * Math.PI) / 180) * 14;
      s += `<line x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${palette[6]}" stroke-width="2" stroke-linecap="round"/>`;
    }
    return s + `<circle r="3" fill="${palette[6]}"/>`;
  }
  return `<circle r="5" fill="${palette[4]}" opacity=".7"/>`;
}

export function motif(tier, rng, palette, name, x, y, rot, scale, opacity) {
  const group = (inner) => `<g transform="${tr(x, y, rot, scale)}" opacity="${opacity.toFixed(2)}">${inner}</g>`;
  if (tier === 'hero') return group(flowerShape(name ? hashPick(name, HERO_KINDS) : pick(rng, HERO_KINDS), palette, rng));
  if (tier === 'secondary') return group(branchShape(name ? hashPick(name, SECONDARY_KINDS) : pick(rng, SECONDARY_KINDS), palette, rng));
  if (tier === 'filler') return group(fillerShape(name ? hashPick(name, FILLER_KINDS) : pick(rng, FILLER_KINDS), palette));
  return group(accentShape(name ? hashPick(name, ACCENT_KINDS) : pick(rng, ACCENT_KINDS), palette));
}
