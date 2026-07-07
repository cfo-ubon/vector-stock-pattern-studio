import { pick, hashPick } from '../core/rng.js';
import { tr } from '../core/svg.js';
import { flatIcon } from '../core/icons.js';

export const FAMILY = {
  id: 'commercial',
  label: 'Cute Commercial Icons',
  heroVocab: ['cup', 'cake', 'paw'],
  secondaryVocab: ['heart', 'cloud', 'star'],
  fillerVocab: ['star', 'heart'],
  accentVocab: ['tiny dot'],
  paletteDefault: 'Soft Pastel',
  keywords: ['cute', 'icon', 'commercial', 'kawaii', 'sticker', 'planner', 'kitchen', 'pet', 'coffee'],
};

const ALL_ICONS = ['cup', 'cake', 'paw', 'heart', 'cloud', 'star'];

export function motif(tier, rng, palette, name, x, y, rot, scale, opacity) {
  if (tier === 'accent') {
    return `<g transform="${tr(x, y, rot, scale)}" opacity="${opacity.toFixed(2)}"><circle r="4" fill="${palette[4]}"/></g>`;
  }
  const kind = name ? hashPick(name, ALL_ICONS) : pick(rng, ALL_ICONS);
  return `<g transform="${tr(x, y, rot, scale)}" opacity="${opacity.toFixed(2)}">${flatIcon(kind, palette)}</g>`;
}
