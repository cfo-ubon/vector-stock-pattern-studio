import { makeRng, range, pick } from './rng.js';
import { heroAnchors, wrapCopies, occupancyGuard, densityProfile } from './layout.js';
import { escapeXml } from './svg.js';
import { STYLE_MODULES } from './families.js';

export const VIEW = 2000;

export function compose(schema) {
  const mod = STYLE_MODULES[schema.family];
  const rng = makeRng(schema.seed);
  const palette = schema.palette;
  const density = densityProfile(schema.patternType);
  const guard = occupancyGuard();
  let motifCount = 0;

  const heroLayer = [], secondaryLayer = [], fillerLayer = [], accentLayer = [];

  if (density.hero > 0) {
    const anchors = heroAnchors(schema.composition, VIEW, rng, schema.patternType);
    const minDist = schema.patternType === 'Hero Motif' ? VIEW * 0.12 : VIEW * 0.09;
    anchors.forEach((p) => {
      if (!guard(p.x, p.y, minDist)) return;
      const name = pick(rng, schema.assets.hero);
      const scale = density.heroScale * range(rng, 0.85, 1.15);
      wrapCopies(p.x, p.y, VIEW, VIEW * 0.12).forEach(([wx, wy]) => {
        heroLayer.push(mod.motif('hero', rng, palette, name, wx, wy, p.rot, scale, 0.96));
        motifCount++;
      });
    });
  }

  const secondaryCount = Math.round(30 * density.secondary);
  for (let i = 0; i < secondaryCount; i++) {
    const x = range(rng, VIEW * 0.05, VIEW * 0.95), y = range(rng, VIEW * 0.05, VIEW * 0.95);
    if (!guard(x, y, VIEW * 0.05)) continue;
    const name = pick(rng, schema.assets.secondary);
    secondaryLayer.push(mod.motif('secondary', rng, palette, name, x, y, range(rng, 0, 360), density.heroScale * range(rng, 0.5, 0.8), range(rng, 0.6, 0.85)));
    motifCount++;
  }

  const fillerCount = Math.round(55 * density.filler);
  for (let i = 0; i < fillerCount; i++) {
    const x = range(rng, 0, VIEW), y = range(rng, 0, VIEW);
    const name = pick(rng, schema.assets.filler);
    fillerLayer.push(mod.motif('filler', rng, palette, name, x, y, range(rng, 0, 360), density.heroScale * range(rng, 0.3, 0.55), range(rng, 0.4, 0.7)));
    motifCount++;
  }

  const accentCount = Math.round(80 * density.accent);
  for (let i = 0; i < accentCount; i++) {
    const x = range(rng, 0, VIEW), y = range(rng, 0, VIEW);
    const name = pick(rng, schema.assets.accent);
    accentLayer.push(mod.motif('accent', rng, palette, name, x, y, range(rng, 0, 360), density.heroScale * range(rng, 0.3, 0.7), range(rng, 0.15, 0.35)));
    motifCount++;
  }

  const size = schema.exportSize || VIEW;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${VIEW} ${VIEW}">` +
    `<title>${escapeXml(schema.title)}</title><desc>${escapeXml(schema.metadata.description)}</desc>` +
    `<rect width="${VIEW}" height="${VIEW}" fill="${palette[0]}"/>` +
    `<g id="filler-layer">${fillerLayer.join('')}</g>` +
    `<g id="secondary-layer">${secondaryLayer.join('')}</g>` +
    `<g id="hero-layer">${heroLayer.join('')}</g>` +
    `<g id="accent-layer">${accentLayer.join('')}</g>` +
    `</svg>`;

  return { svg, motifCount };
}
