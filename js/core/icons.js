import { shade } from './color.js';

// Shared flat-icon renderer used by both the "seasonal" and "commercial"
// style families, so the two families reuse one repertoire of simple,
// scalable icon shapes instead of duplicating shape code. Every shape
// gets an outline stroke plus a small highlight/shading detail so it
// reads as a finished "die-cut sticker" rather than a flat placeholder —
// all pure vector (no filters/blur), so it stays fully editable when
// opened in Affinity Designer.

function starPath(outer, inner, points) {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI * i) / points - Math.PI / 2;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d + 'Z';
}

export const ICON_KINDS = [
  'heart', 'star', 'leaf', 'snowflake', 'pumpkin', 'gift',
  'bunny', 'cup', 'paw', 'cloud', 'cake', 'ornament',
];

export function flatIcon(kind, palette) {
  const a = palette[4] || '#c98a6a';
  const b = palette[2] || '#7b8453';
  const line = palette[6] || palette[3] || '#2a2a2a';
  const hi = shade(a, 0.35);
  const lo = shade(a, -0.25);
  const strokeMain = `stroke="${line}" stroke-width="4" stroke-linejoin="round"`;
  switch (kind) {
    case 'heart':
      return `<path d="M0 42 C-56 2 -50 -54 -10 -54 C0 -54 0 -44 0 -40 C0 -44 0 -54 10 -54 C50 -54 56 2 0 42Z" fill="${a}" ${strokeMain}/>` +
        `<ellipse cx="-14" cy="-30" rx="10" ry="14" fill="${hi}" opacity=".55"/>`;
    case 'star':
      return `<path d="${starPath(46, 20, 5)}" fill="${a}" ${strokeMain}/><circle cx="-8" cy="-14" r="7" fill="${hi}" opacity=".6"/>`;
    case 'leaf':
      return `<path d="M0 -60 C42 -40 42 40 0 60 C-42 40 -42 -40 0 -60Z" fill="${b}" stroke="${line}" stroke-width="3"/>` +
        `<path d="M0 -48 L0 48" stroke="${line}" stroke-width="3" opacity=".5"/>` +
        `<path d="M-16 -18 C-8 -22 0 -18 0 -8" fill="none" stroke="${shade(b, 0.4)}" stroke-width="4" stroke-linecap="round" opacity=".7"/>`;
    case 'snowflake': {
      let s = '';
      for (let i = 0; i < 6; i++) {
        s += `<line x1="0" y1="0" x2="0" y2="-55" stroke="${line}" stroke-width="5" stroke-linecap="round" transform="rotate(${i * 60})"/>`;
        s += `<line x1="0" y1="-40" x2="12" y2="-48" stroke="${line}" stroke-width="4" stroke-linecap="round" transform="rotate(${i * 60})"/>`;
      }
      return s + `<circle r="6" fill="${line}"/>`;
    }
    case 'pumpkin':
      return `<ellipse rx="55" ry="46" fill="${a}" ${strokeMain}/>` +
        `<path d="M-40 0 L40 0M-24 -40 L-24 40M24 -40 L24 40" stroke="${lo}" stroke-width="3" opacity=".4"/>` +
        `<ellipse cx="-22" cy="-10" rx="10" ry="16" fill="${hi}" opacity=".5"/>` +
        `<rect x="-6" y="-64" width="12" height="20" rx="5" fill="${b}"/><path d="M6 -60 q16 -6 10 10" fill="none" stroke="${b}" stroke-width="5" stroke-linecap="round"/>`;
    case 'gift':
      return `<rect x="-40" y="-40" width="80" height="80" rx="8" fill="${a}" ${strokeMain}/>` +
        `<rect x="-40" y="-8" width="80" height="16" fill="${b}"/><rect x="-8" y="-40" width="16" height="80" fill="${b}"/>` +
        `<path d="M-16 -40 Q-30 -60 -6 -58 Q-16 -50 -16 -40Z" fill="${hi}"/><path d="M16 -40 Q30 -60 6 -58 Q16 -50 16 -40Z" fill="${hi}"/>`;
    case 'bunny':
      return `<ellipse cx="-14" cy="-46" rx="10" ry="26" fill="${a}" ${strokeMain}/><ellipse cx="14" cy="-46" rx="10" ry="26" fill="${a}" ${strokeMain}/>` +
        `<circle r="30" fill="${a}" ${strokeMain}/><circle cx="-10" cy="4" r="3" fill="${line}"/><circle cx="10" cy="4" r="3" fill="${line}"/>` +
        `<circle cx="-16" cy="14" r="6" fill="${hi}" opacity=".6"/><circle cx="16" cy="14" r="6" fill="${hi}" opacity=".6"/>`;
    case 'cup':
      return `<path d="M-30 -30 h60 v40 a30 30 0 0 1 -30 30 a30 30 0 0 1 -30 -30 z" fill="${a}" ${strokeMain}/>` +
        `<path d="M30 -15 h14 a16 16 0 0 1 0 32 h-14" fill="none" stroke="${line}" stroke-width="6"/>` +
        `<rect x="-22" y="-24" width="10" height="30" rx="5" fill="${hi}" opacity=".5"/>` +
        `<path d="M-8 -50 q6 -10 0 -18M6 -50 q6 -10 0 -18" fill="none" stroke="${a}" stroke-width="4" stroke-linecap="round" opacity=".6"/>`;
    case 'paw':
      return `<ellipse cy="20" rx="30" ry="24" fill="${a}" ${strokeMain}/>` +
        `<circle cx="-26" cy="-24" r="12" fill="${a}" ${strokeMain}/><circle cx="26" cy="-24" r="12" fill="${a}" ${strokeMain}/>` +
        `<circle cx="-12" cy="-40" r="10" fill="${a}" ${strokeMain}/><circle cx="12" cy="-40" r="10" fill="${a}" ${strokeMain}/>` +
        `<ellipse cx="-6" cy="12" rx="8" ry="6" fill="${hi}" opacity=".5"/>`;
    case 'cloud':
      return `<ellipse cy="10" rx="55" ry="26" fill="${a}" ${strokeMain}/><circle cx="-20" cy="-10" r="26" fill="${a}" ${strokeMain}/><circle cx="18" cy="-14" r="30" fill="${a}" ${strokeMain}/>` +
        `<ellipse cx="10" cy="-20" rx="14" ry="8" fill="${hi}" opacity=".55"/>`;
    case 'cake':
      return `<rect x="-40" y="-6" width="80" height="46" rx="8" fill="${a}" ${strokeMain}/><rect x="-40" y="-6" width="80" height="14" fill="${b}" stroke="${line}" stroke-width="2"/>` +
        `<rect x="-4" y="-40" width="8" height="34" fill="${line}"/><path d="M-4 -40 q6 -10 8 0" fill="${line}"/>` +
        `<circle cx="-20" cy="16" r="10" fill="${b}" ${strokeMain}/><circle cx="18" cy="4" r="6" fill="${shade(b, -0.3)}"/>`;
    case 'ornament':
      return `<circle cy="6" r="38" fill="${a}" ${strokeMain}/><rect x="-8" y="-46" width="16" height="14" rx="3" fill="${b}"/>` +
        `<path d="M-24 -6 A38 38 0 0 1 24 -6" stroke="${lo}" stroke-width="3" fill="none" opacity=".4"/>` +
        `<ellipse cx="-12" cy="-8" rx="10" ry="14" fill="${hi}" opacity=".5"/>`;
    default:
      return `<circle r="30" fill="${a}" ${strokeMain}/>`;
  }
}
