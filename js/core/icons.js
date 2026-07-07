// Shared flat-icon renderer used by both the "seasonal" and "commercial"
// style families, so the two families reuse one repertoire of simple,
// scalable icon shapes instead of duplicating shape code.

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
  switch (kind) {
    case 'heart':
      return `<path d="M0 42 C-56 2 -50 -54 -10 -54 C0 -54 0 -44 0 -40 C0 -44 0 -54 10 -54 C50 -54 56 2 0 42Z" fill="${a}"/>`;
    case 'star':
      return `<path d="${starPath(46, 20, 5)}" fill="${a}"/>`;
    case 'leaf':
      return `<path d="M0 -60 C42 -40 42 40 0 60 C-42 40 -42 -40 0 -60Z" fill="${b}"/><path d="M0 -48 L0 48" stroke="${line}" stroke-width="3" opacity=".5"/>`;
    case 'snowflake': {
      let s = '';
      for (let i = 0; i < 6; i++) {
        s += `<line x1="0" y1="0" x2="0" y2="-55" stroke="${line}" stroke-width="5" stroke-linecap="round" transform="rotate(${i * 60})"/>`;
      }
      return s;
    }
    case 'pumpkin':
      return `<ellipse rx="55" ry="46" fill="${a}"/><path d="M-40 0 L40 0M-24 -40 L-24 40M24 -40 L24 40" stroke="${line}" stroke-width="3" opacity=".3"/><rect x="-6" y="-64" width="12" height="20" rx="5" fill="${b}"/>`;
    case 'gift':
      return `<rect x="-40" y="-40" width="80" height="80" rx="8" fill="${a}"/><rect x="-40" y="-8" width="80" height="16" fill="${b}"/><rect x="-8" y="-40" width="16" height="80" fill="${b}"/>`;
    case 'bunny':
      return `<ellipse cx="-14" cy="-46" rx="10" ry="26" fill="${a}"/><ellipse cx="14" cy="-46" rx="10" ry="26" fill="${a}"/><circle r="30" fill="${a}"/>`;
    case 'cup':
      return `<path d="M-30 -30 h60 v40 a30 30 0 0 1 -30 30 a30 30 0 0 1 -30 -30 z" fill="${a}"/><path d="M30 -15 h14 a16 16 0 0 1 0 32 h-14" fill="none" stroke="${a}" stroke-width="8"/>`;
    case 'paw':
      return `<ellipse cy="20" rx="30" ry="24" fill="${a}"/><circle cx="-26" cy="-24" r="12" fill="${a}"/><circle cx="26" cy="-24" r="12" fill="${a}"/><circle cx="-12" cy="-40" r="10" fill="${a}"/><circle cx="12" cy="-40" r="10" fill="${a}"/>`;
    case 'cloud':
      return `<ellipse cy="10" rx="55" ry="26" fill="${a}"/><circle cx="-20" cy="-10" r="26" fill="${a}"/><circle cx="18" cy="-14" r="30" fill="${a}"/>`;
    case 'cake':
      return `<rect x="-40" y="-6" width="80" height="46" rx="8" fill="${a}"/><rect x="-40" y="-6" width="80" height="14" fill="${b}"/><rect x="-4" y="-40" width="8" height="34" fill="${line}"/><path d="M-4 -40 q6 -10 8 0" fill="${line}"/>`;
    case 'ornament':
      return `<circle cy="6" r="38" fill="${a}"/><rect x="-8" y="-46" width="16" height="14" rx="3" fill="${b}"/><path d="M-24 -6 A38 38 0 0 1 24 -6" stroke="${line}" stroke-width="3" fill="none" opacity=".4"/>`;
    default:
      return `<circle r="30" fill="${a}"/>`;
  }
}
