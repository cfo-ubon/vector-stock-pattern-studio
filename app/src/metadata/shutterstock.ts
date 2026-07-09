import type { TileData } from '../engine/types';
import { GENERATORS } from '../generators';
import { getPalette } from '../palettes/palettes';

// Shutterstock SEO metadata generator. Builds a copy-paste-ready title,
// description (kept under Shutterstock's 200-character limit) and exactly
// 50 keywords (Shutterstock's maximum) from the current pattern's
// category, palette and layout. Keyword pools are ordered
// most-important-first because stock search engines weight earlier
// keywords more heavily.

export interface StockMetadata {
  title: string;
  description: string;
  keywords: string[]; // exactly 50
  /** Upload-form category suggestions. Shutterstock allows picking up to 2
   * from its fixed list; Adobe Stock exactly 1 from its 21. */
  categories: {
    shutterstock: [string, string];
    adobeStock: string;
  };
}

// Shutterstock's fixed category list only — these strings must match the
// upload form's options verbatim. Every seamless pattern's primary category
// is Backgrounds/Textures; the secondary varies by subject matter.
const SHUTTERSTOCK_SECONDARY: Record<string, string> = {
  geometric: 'Abstract',
  botanical: 'Nature',
  organic: 'Abstract',
  tropical: 'Nature',
  boho: 'Abstract',
  lineart: 'Abstract',
  mandala: 'Arts',
  damask: 'Vintage',
  cute: 'Animals/Wildlife',
  seasonal: 'Holidays',
  retro: 'Vintage',
  plaid: 'Abstract',
  animalprint: 'Animals/Wildlife',
  paisley: 'Arts',
  terrazzo: 'Abstract',
};

// Universal keywords that apply to every seamless vector pattern. Long
// enough to always pad the list to 50 after category/palette words.
const UNIVERSAL = [
  'seamless', 'pattern', 'vector', 'seamless pattern', 'background', 'wallpaper', 'textile',
  'fabric', 'print', 'repeat', 'texture', 'design', 'illustration', 'flat', 'wrapping paper',
  'surface pattern', 'backdrop', 'decorative', 'ornament', 'stationery', 'packaging', 'fashion',
  'home decor', 'scrapbook', 'modern', 'trendy', 'abstract', 'graphic', 'art', 'style', 'decor',
  'element', 'creative', 'motif', 'simple', 'minimal', 'swatch', 'tile', 'endless', 'repeating',
  'apparel', 'bedding', 'curtain', 'gift wrap', 'web background', 'branding', 'cover', 'poster',
  'card', 'invitation', 'editable', 'eps',
];

const CATEGORY_KEYWORDS: Record<string, { phrase: string; words: string[] }> = {
  geometric: {
    phrase: 'geometric shapes',
    words: ['geometric', 'geometry', 'circle', 'triangle', 'hexagon', 'shapes', 'bauhaus', 'scandinavian', 'mid century', 'retro', 'polygon', 'grid', 'mosaic', 'nordic', 'contemporary', 'stripe', 'dot', 'memphis'],
  },
  botanical: {
    phrase: 'botanical leaves and flowers',
    words: ['floral', 'flower', 'leaf', 'leaves', 'botanical', 'botany', 'garden', 'spring', 'bloom', 'blossom', 'nature', 'plant', 'foliage', 'branch', 'meadow', 'ditsy', 'summer', 'herb'],
  },
  organic: {
    phrase: 'abstract organic shapes',
    words: ['organic', 'blob', 'memphis', 'matisse', 'cutout', 'hand drawn', 'contemporary', 'squiggle', 'doodle', 'shape', 'freeform', 'artistic', 'collage', 'mid century', 'funky', 'playful', 'terrazzo', 'confetti'],
  },
  tropical: {
    phrase: 'tropical leaves and fruit',
    words: ['tropical', 'palm', 'palm leaf', 'monstera', 'jungle', 'exotic', 'summer', 'hawaiian', 'beach', 'paradise', 'hibiscus', 'citrus', 'fruit', 'botanical', 'aloha', 'vacation', 'rainforest', 'leaf'],
  },
  boho: {
    phrase: 'boho tribal motifs',
    words: ['boho', 'bohemian', 'tribal', 'ethnic', 'aztec', 'moon', 'sun', 'mystic', 'celestial', 'folk', 'hippie', 'arch', 'rainbow', 'zigzag', 'chevron', 'native', 'earthy', 'terracotta'],
  },
  lineart: {
    phrase: 'minimal line art',
    words: ['line art', 'line', 'one line', 'outline', 'doodle', 'sketch', 'minimalist', 'contour', 'monoline', 'hand drawn', 'linear', 'drawing', 'spiral', 'wave', 'stroke', 'elegant', 'delicate', 'fine line'],
  },
  mandala: {
    phrase: 'mandala medallions',
    words: ['mandala', 'kaleidoscope', 'medallion', 'rosette', 'symmetry', 'oriental', 'henna', 'yoga', 'meditation', 'spiritual', 'indian', 'ethnic', 'circular', 'lotus', 'zen', 'sacred', 'ornamental', 'boho'],
  },
  damask: {
    phrase: 'classic damask ornaments',
    words: ['damask', 'victorian', 'baroque', 'classic', 'elegant', 'royal', 'luxury', 'vintage', 'ornate', 'acanthus', 'ogee', 'wallpaper', 'antique', 'heritage', 'flourish', 'scroll', 'renaissance', 'regal'],
  },
  cute: {
    phrase: 'cute animal faces',
    words: ['cute', 'kawaii', 'animal', 'kids', 'baby', 'nursery', 'children', 'bear', 'cat', 'bunny', 'rabbit', 'paw', 'heart', 'star', 'cartoon', 'childish', 'sweet', 'adorable'],
  },
  seasonal: {
    phrase: 'holiday motifs',
    words: ['holiday', 'christmas', 'halloween', 'festive', 'winter', 'xmas', 'seasonal', 'celebration', 'snowflake', 'tree', 'pumpkin', 'ghost', 'noel', 'greeting', 'december', 'october', 'party', 'gift'],
  },
  retro: {
    phrase: 'groovy seventies shapes',
    words: ['retro', 'groovy', 'seventies', '70s', 'vintage', 'hippie', 'rainbow', 'daisy', 'sun', 'mushroom', 'psychedelic', 'flower power', 'sixties', 'wavy', 'funky', 'nostalgia', 'mod', 'boho'],
  },
  plaid: {
    phrase: 'plaid and tartan check',
    words: ['plaid', 'tartan', 'check', 'checkered', 'gingham', 'houndstooth', 'buffalo check', 'flannel', 'woven', 'scottish', 'preppy', 'cozy', 'autumn', 'lumberjack', 'fabric print', 'textile', 'grid check', 'wool'],
  },
  animalprint: {
    phrase: 'animal print texture',
    words: ['animal print', 'leopard', 'zebra', 'tiger', 'cheetah', 'snake skin', 'giraffe', 'safari', 'wild', 'fur', 'spots', 'stripes', 'fashion', 'exotic', 'jungle', 'wildlife', 'chic', 'trendy'],
  },
  paisley: {
    phrase: 'paisley and ikat motifs',
    words: ['paisley', 'ikat', 'indian', 'persian', 'boteh', 'teardrop', 'ethnic', 'bohemian', 'ornamental', 'batik', 'oriental', 'intricate', 'traditional', 'textile', 'scarf', 'henna', 'exotic', 'folk'],
  },
  terrazzo: {
    phrase: 'terrazzo chip texture',
    words: ['terrazzo', 'chip', 'speckled', 'stone', 'confetti', 'marble', 'granite', 'flooring', 'italian', 'aggregate', 'modern', 'contemporary', 'minimalist', 'interior', 'mosaic', 'playful', 'pastel', 'organic shapes'],
  },
};

// Short mood words per palette id (first entry doubles as the description's
// color phrase).
const PALETTE_MOODS: Record<string, string[]> = {
  'pastel-dream': ['pastel', 'soft', 'pale', 'gentle', 'baby colors'],
  'earth-tone': ['earth tone', 'natural', 'warm', 'brown', 'organic colors'],
  'vibrant-pop': ['vibrant', 'bright', 'bold', 'colorful', 'pop'],
  'monochrome-blue': ['blue', 'monochrome', 'navy', 'indigo', 'cool'],
  'jewel-tones': ['jewel tone', 'rich', 'deep', 'elegant', 'moody'],
  'candy-shop': ['candy', 'colorful', 'cheerful', 'rainbow', 'fun'],
  'autumn-harvest': ['autumn', 'fall', 'warm', 'seasonal', 'cozy'],
  'ocean-breeze': ['ocean', 'teal', 'aqua', 'marine', 'fresh'],
  terracotta: ['terracotta', 'clay', 'warm', 'rustic', 'desert'],
  'mono-charcoal': ['monochrome', 'gray', 'black and white', 'neutral', 'grayscale'],
  'sage-terracotta': ['sage', 'terracotta', 'muted', 'earthy', 'calm'],
  'blush-gold': ['blush', 'gold', 'feminine', 'romantic', 'chic'],
  'retro-sunset': ['sunset', 'retro', 'warm', 'seventies', 'groovy'],
  'coastal-neutral': ['coastal', 'neutral', 'beige', 'serene', 'natural'],
  'berry-punch': ['berry', 'pink', 'magenta', 'sweet', 'juicy'],
  'midnight-botanical': ['dark', 'midnight', 'forest', 'moody', 'deep green'],
  'citrus-pop': ['citrus', 'bright', 'fresh', 'zesty', 'summer colors'],
  'lavender-fields': ['lavender', 'purple', 'violet', 'dreamy', 'lilac'],
};

const LAYOUT_WORDS: Record<string, string[]> = {
  grid: ['grid layout', 'geometric grid'],
  brick: ['offset', 'staggered'],
  halfDrop: ['half drop', 'wallpaper repeat'],
  radial: ['medallion', 'circular layout'],
  scatter: ['ditsy', 'scattered', 'tossed'],
  heroFlow: ['editorial', 'flowing layout', 'statement print'],
  heroScatter: ['hero print', 'focal point', 'scattered accent'],
  sCurve: ['s-curve', 'organic flow', 'botanical stripe'],
  bouquet: ['bouquet', 'clustered', 'floral arrangement'],
  airy: ['airy', 'light spacing', 'breathable'],
  toss: ['toss print', 'all-over toss', 'random layout'],
  densePremium: ['dense', 'packed', 'premium all-over'],
  gridMinimal: ['minimal grid', 'icon grid', 'evenly spaced'],
  stripe: ['striped', 'linear repeat', 'banded'],
};

export function buildStockMetadata(tileData: TileData): StockMetadata {
  const { categoryId, paletteId, layoutId, customColors, mixCategoryIds } = tileData.params;
  const isMix = !!mixCategoryIds && mixCategoryIds.length >= 2;
  const mixCategories = isMix ? mixCategoryIds.map((id) => CATEGORY_KEYWORDS[id] ?? CATEGORY_KEYWORDS.geometric) : [];
  const category = CATEGORY_KEYWORDS[categoryId] ?? CATEGORY_KEYWORDS.geometric;
  const generatorLabel = isMix
    ? `${mixCategoryIds.map((id) => GENERATORS[id]?.label ?? id).join(' + ')} Mix`
    : (GENERATORS[categoryId]?.label ?? 'Pattern');
  const usingCustom = !!customColors?.length;
  const paletteLabel = usingCustom ? 'Colorful' : getPalette(paletteId).label;
  const moods = usingCustom ? ['colorful', 'multicolor', 'bright'] : (PALETTE_MOODS[paletteId] ?? ['colorful']);
  // Mix mode can combine up to 5 categories — joining their full phrases
  // ("geometric shapes and botanical leaves and flowers and ... mixed")
  // would blow past Shutterstock's title/description budgets, so mix uses
  // short category labels instead of the verbose single-category phrase.
  const phrase = isMix
    ? `${mixCategoryIds.map((id) => (GENERATORS[id]?.label ?? id).toLowerCase()).join(', ')} mixed motifs`
    : category.phrase;

  const title = truncateWords(
    `${paletteLabel} ${generatorLabel} Seamless Vector Pattern — Flat ${capitalize(phrase)} Repeat for Fabric and Wallpaper`,
    200,
  );

  const description = truncateWords(
    `Seamless vector pattern with flat ${phrase} in ${moods[0]} colors. Hand-crafted repeating tile for fabric, textile, wallpaper, wrapping paper, stationery and web backgrounds. Fully editable vector.`,
    200,
  );

  // Assemble keywords most-important-first, dedupe, cap at exactly 50. In
  // mix mode, interleave each category's word list (round-robin) instead
  // of concatenating, so every mixed category gets early, high-weight
  // keyword slots rather than the first category hogging them all.
  const categoryWordSource = isMix ? mixCategories : [category];
  const interleaved: string[] = [];
  const maxLen = Math.max(...categoryWordSource.map((c) => c.words.length));
  for (let i = 0; i < maxLen; i++) {
    for (const c of categoryWordSource) {
      if (c.words[i]) interleaved.push(c.words[i]);
    }
  }
  const raw = [
    ...interleaved,
    ...moods,
    ...(LAYOUT_WORDS[layoutId] ?? []),
    ...UNIVERSAL,
  ];
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const word of raw) {
    const w = word.trim().toLowerCase();
    if (!w || seen.has(w)) continue;
    seen.add(w);
    keywords.push(w);
    if (keywords.length === 50) break;
  }

  // Category suggestions for the upload forms. Patterns always lead with
  // Backgrounds/Textures on Shutterstock; the secondary comes from the
  // (first, in mix mode) subject category. Vector patterns on Adobe Stock
  // belong under Graphic Resources regardless of subject.
  const secondary = SHUTTERSTOCK_SECONDARY[isMix ? mixCategoryIds[0] : categoryId] ?? 'Abstract';
  const categories: StockMetadata['categories'] = {
    shutterstock: ['Backgrounds/Textures', secondary],
    adobeStock: 'Graphic Resources',
  };

  return { title, description, keywords, categories };
}

/** Hard safety net: trims to the last whole word at or under `max` chars.
 * Keeps title/description within Shutterstock's limits even if a future
 * category phrase or a 5-way asset mix makes the raw string run long. */
function truncateWords(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
