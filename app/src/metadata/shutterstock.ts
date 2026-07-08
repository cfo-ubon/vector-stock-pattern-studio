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
}

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
};

export function buildStockMetadata(tileData: TileData): StockMetadata {
  const { categoryId, paletteId, layoutId, customColors } = tileData.params;
  const category = CATEGORY_KEYWORDS[categoryId] ?? CATEGORY_KEYWORDS.geometric;
  const generatorLabel = GENERATORS[categoryId]?.label ?? 'Pattern';
  const usingCustom = !!customColors?.length;
  const paletteLabel = usingCustom ? 'Colorful' : getPalette(paletteId).label;
  const moods = usingCustom ? ['colorful', 'multicolor', 'bright'] : (PALETTE_MOODS[paletteId] ?? ['colorful']);

  const title = `${paletteLabel} ${generatorLabel} Seamless Vector Pattern — Flat ${capitalize(category.phrase)} Repeat for Fabric and Wallpaper`;

  const description = `Seamless vector pattern with flat ${category.phrase} in ${moods[0]} colors. Hand-crafted repeating tile for fabric, textile, wallpaper, wrapping paper, stationery and web backgrounds. Fully editable vector.`;

  // Assemble keywords most-important-first, dedupe, cap at exactly 50.
  const raw = [
    ...category.words,
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
  return { title, description, keywords };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
