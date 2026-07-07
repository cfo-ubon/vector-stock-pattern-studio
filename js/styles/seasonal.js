import { pick, hashPick } from '../core/rng.js';
import { tr } from '../core/svg.js';
import { flatIcon } from '../core/icons.js';

export const FAMILY = {
  id: 'seasonal',
  label: 'Seasonal & Holiday',
  heroVocab: ['gift', 'pumpkin', 'snowflake', 'ornament'],
  secondaryVocab: ['bunny', 'cloud', 'leaf'],
  fillerVocab: ['star', 'heart', 'leaf'],
  accentVocab: ['star', 'snowflake'],
  paletteDefault: 'Vintage Cream',
  keywords: ['holiday', 'seasonal', 'christmas', 'halloween', 'spring', 'celebration', 'festive', 'gift', 'winter', 'autumn'],
};

const ALL_ICONS = ['gift', 'pumpkin', 'snowflake', 'ornament', 'bunny', 'cloud', 'leaf', 'star', 'heart'];

export function motif(tier, rng, palette, name, x, y, rot, scale, opacity) {
  const kind = name ? hashPick(name, ALL_ICONS) : pick(rng, ALL_ICONS);
  return `<g transform="${tr(x, y, rot, scale)}" opacity="${opacity.toFixed(2)}">${flatIcon(kind, palette)}</g>`;
}
