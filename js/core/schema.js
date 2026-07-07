import { STYLE_MODULES } from './families.js';
import { PALETTES } from './palettes.js';

const COMMON_KEYWORDS = [
  'seamless', 'pattern', 'vector', 'surface design', 'textile', 'fabric', 'wallpaper',
  'digital paper', 'wrapping paper', 'repeat', 'tile', 'background', 'decorative',
  'editable', 'svg', 'commercial use', 'stock', 'adobe stock', 'shutterstock', 'etsy',
  'printable', 'premium', 'modern', 'elegant', 'timeless', 'classic', 'illustration',
  'design element', 'print', 'packaging', 'gift wrap', 'scrapbook', 'home decor',
  'textile design', 'apparel print', 'stationery', 'greeting card', 'backdrop',
  'texture', 'clipart', 'motif', 'print on demand', 'flat design',
];

function buildKeywords(fam) {
  const seen = new Set();
  const kws = [];
  [...fam.keywords, ...COMMON_KEYWORDS].forEach((k) => {
    if (!seen.has(k)) { seen.add(k); kws.push(k); }
  });
  return kws.slice(0, 50);
}

export function defaultSchema(family, overrides = {}) {
  const mod = STYLE_MODULES[family];
  const fam = mod.FAMILY;
  const palette = overrides.palette || PALETTES[fam.paletteDefault] || Object.values(PALETTES)[0];
  const title = overrides.title || `Premium ${fam.label} Seamless Vector Pattern`;
  return {
    version: 'VSP-1',
    family,
    title,
    concept: overrides.concept || `commercial seamless vector pattern in the ${fam.label} style`,
    composition: overrides.composition || 'S-Curve Flow',
    patternType: overrides.patternType || 'Hero Motif',
    seed: overrides.seed || `KOKO-${Math.floor(range100000())}`,
    exportSize: overrides.exportSize || 3000,
    palette,
    assets: {
      hero: overrides.assets?.hero?.length ? overrides.assets.hero : fam.heroVocab,
      secondary: overrides.assets?.secondary?.length ? overrides.assets.secondary : fam.secondaryVocab,
      filler: overrides.assets?.filler?.length ? overrides.assets.filler : fam.fillerVocab,
      accent: overrides.assets?.accent?.length ? overrides.assets.accent : fam.accentVocab,
    },
    metadata: {
      title,
      description: overrides.description || `Editable seamless ${fam.label.toLowerCase()} vector pattern for surface design, fabric, wallpaper and stock marketplaces.`,
      keywords: overrides.keywords?.length ? overrides.keywords.slice(0, 50) : buildKeywords(fam),
    },
  };
}

function range100000() {
  return 100000 + Math.random() * 900000;
}

export function cleanJsonText(raw) {
  let t = String(raw || '').trim()
    .replace(/```json/gi, '').replace(/```/g, '')
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  return t.replace(/,\s*([}\]])/g, '$1');
}

// Merges AI-supplied JSON onto the caller's live schema (not a fresh
// default), so fields the AI didn't mention — composition, patternType,
// seed, exportSize — keep whatever the user already has selected in
// Studio instead of being silently reset.
export function repairJson(raw, currentSchema) {
  let obj;
  try {
    obj = typeof raw === 'string' ? JSON.parse(cleanJsonText(raw)) : raw;
  } catch (e) {
    throw new Error(`JSON ยังไม่ถูกต้อง: ${e.message}`);
  }
  const family = STYLE_MODULES[obj.family] ? obj.family : currentSchema.family;
  const base = family !== currentSchema.family ? defaultSchema(family) : currentSchema;
  const out = { ...base, ...obj, family };
  out.assets = { ...base.assets };
  out.metadata = { ...base.metadata, ...(obj.metadata || {}) };

  if (Array.isArray(obj.palette) && obj.palette.length >= 5) out.palette = obj.palette.slice(0, 7);
  if (Array.isArray(obj.metadata?.keywords) && obj.metadata.keywords.length) out.metadata.keywords = obj.metadata.keywords.slice(0, 50);
  if (obj.title) { out.title = obj.title; out.metadata.title = obj.title; }
  if (obj.description) out.metadata.description = obj.description;
  if (obj.concept) out.concept = obj.concept;

  ['hero', 'secondary', 'filler', 'accent'].forEach((tier) => {
    const list = obj.assets?.[tier];
    if (Array.isArray(list) && list.length) out.assets[tier] = list;
  });

  return out;
}
