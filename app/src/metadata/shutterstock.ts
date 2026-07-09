import type { TileData } from '../engine/types';
import { GENERATORS } from '../generators';
import { getPalette } from '../palettes/palettes';

// Per-site SEO metadata generator. Builds copy-paste-ready upload-form
// fields tailored to each stock site's own limits and conventions
// (character caps, keyword counts, category pick counts) from the current
// pattern's category, palette and layout. Keyword pools are ordered
// most-important-first because stock search engines weight earlier
// keywords more heavily.

export type StockSiteId = 'shutterstock' | 'adobestock' | 'freepik' | 'creativefabrica' | 'creativemarket';

export interface SiteField {
  /** Form-field label as shown in that site's upload UI. */
  label: string;
  value: string;
  /** Character/word budget note rendered next to the label. */
  meta?: string;
}

export interface SiteMetadata {
  id: StockSiteId;
  label: string;
  /** One-line Thai note about this site's quirks (file format etc.). */
  note?: string;
  fields: SiteField[];
}

/** Site list in display order — also the canonical set used by the saved
 * library's per-site submission tracking. */
export const STOCK_SITES: Array<{ id: StockSiteId; label: string }> = [
  { id: 'shutterstock', label: 'Shutterstock' },
  { id: 'adobestock', label: 'Adobe Stock' },
  { id: 'freepik', label: 'Freepik' },
  { id: 'creativefabrica', label: 'Creative Fabrica' },
  { id: 'creativemarket', label: 'Creative Market' },
];

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

/** Everything the per-site builders need, computed once. */
function computeCore(tileData: TileData) {
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
  // would blow past title/description budgets, so mix uses short category
  // labels instead of the verbose single-category phrase.
  const phrase = isMix
    ? `${mixCategoryIds.map((id) => (GENERATORS[id]?.label ?? id).toLowerCase()).join(', ')} mixed motifs`
    : category.phrase;

  const titleLong = truncateWords(
    `${paletteLabel} ${generatorLabel} Seamless Vector Pattern — Flat ${capitalize(phrase)} Repeat for Fabric and Wallpaper`,
    200,
  );
  const titleShort = truncateWords(`${paletteLabel} ${generatorLabel} Seamless Vector Pattern`, 70);

  const description = truncateWords(
    `Seamless vector pattern with flat ${phrase} in ${moods[0]} colors. Hand-crafted repeating tile for fabric, textile, wallpaper, wrapping paper, stationery and web backgrounds. Fully editable vector.`,
    200,
  );

  // Longer, marketing-style copy for marketplace sites (Creative Fabrica /
  // Creative Market) that reward richer product descriptions with no tight
  // character cap.
  const marketingDescription =
    `${titleShort}. This seamless repeating pattern features flat ${phrase} in ${moods[0]} colors and tiles perfectly in every direction with no visible seams. ` +
    `Perfect for fabric printing, wallpaper, wrapping paper, digital paper, stationery, packaging, apparel, scrapbooking and web backgrounds. ` +
    `Fully editable vector — every motif is a separate group, so colors and layout are easy to customize in Illustrator, Affinity Designer or Inkscape.`;

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
  const raw = [...interleaved, ...moods, ...(LAYOUT_WORDS[layoutId] ?? []), ...UNIVERSAL];
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const word of raw) {
    const w = word.trim().toLowerCase();
    if (!w || seen.has(w)) continue;
    seen.add(w);
    keywords.push(w);
    if (keywords.length === 50) break;
  }

  const secondary = SHUTTERSTOCK_SECONDARY[isMix ? mixCategoryIds[0] : categoryId] ?? 'Abstract';

  return { titleLong, titleShort, description, marketingDescription, keywords, ssSecondary: secondary };
}

/** Build upload-form-ready metadata for every supported stock site, each
 * shaped to that site's own limits and field names. */
export function buildSiteMetadata(tileData: TileData): SiteMetadata[] {
  const core = computeCore(tileData);
  const kw = (n: number) => core.keywords.slice(0, n).join(', ');

  return [
    {
      id: 'shutterstock',
      label: 'Shutterstock',
      note: 'อัปโหลดเป็น EPS (แนบ JPEG preview ชื่อไฟล์เดียวกันได้) — เลือก 2 categories',
      fields: [
        { label: 'Title', value: core.titleLong, meta: `${core.titleLong.length}/200 ตัวอักษร` },
        { label: 'Description', value: core.description, meta: `${core.description.length}/200 ตัวอักษร` },
        { label: 'Keywords', value: kw(50), meta: `${Math.min(core.keywords.length, 50)}/50 คำ` },
        { label: 'Categories', value: `Backgrounds/Textures, ${core.ssSecondary}`, meta: 'เลือก 2 หมวด' },
      ],
    },
    {
      id: 'adobestock',
      label: 'Adobe Stock',
      note: 'อัปโหลดเป็น AI หรือ EPS — ไม่มีช่อง description แยก, keyword 10 คำแรกมีน้ำหนักสูงสุด',
      fields: [
        { label: 'Title', value: core.titleShort, meta: `${core.titleShort.length}/70 ตัวอักษร (สั้นกระชับดีกว่า)` },
        { label: 'Keywords', value: kw(49), meta: `${Math.min(core.keywords.length, 49)}/49 คำ` },
        { label: 'Category', value: 'Graphic Resources', meta: 'เลือก 1 หมวด' },
      ],
    },
    {
      id: 'freepik',
      label: 'Freepik',
      note: 'อัปโหลดเป็น EPS + ต้องแนบ JPG preview คู่เสมอ',
      fields: [
        { label: 'Title', value: truncateWords(core.titleLong, 100), meta: `${truncateWords(core.titleLong, 100).length}/100 ตัวอักษร` },
        { label: 'Keywords / Tags', value: kw(50), meta: `${Math.min(core.keywords.length, 50)}/50 คำ` },
      ],
    },
    {
      id: 'creativefabrica',
      label: 'Creative Fabrica',
      note: 'รับ SVG ตรงจากแอปได้เลย (แนบ EPS/PNG เพิ่มยิ่งดี) — description ยาวได้ ยิ่งละเอียดยิ่งขายดี',
      fields: [
        { label: 'Product Name', value: `${core.titleShort} — Digital Paper & Fabric Design`, meta: 'ชื่อสินค้า' },
        { label: 'Description', value: core.marketingDescription, meta: `${core.marketingDescription.length} ตัวอักษร (ไม่จำกัด)` },
        { label: 'Tags', value: kw(20), meta: '20 คำแรก (คำสำคัญสุด)' },
      ],
    },
    {
      id: 'creativemarket',
      label: 'Creative Market',
      note: 'จัดเป็นชุดสินค้า (zip รวม SVG + EPS + JPG) — ตั้งราคาเองได้',
      fields: [
        { label: 'Product Name', value: `${core.titleShort} — Seamless Digital Pattern`, meta: 'ชื่อสินค้า' },
        { label: 'Description', value: core.marketingDescription, meta: `${core.marketingDescription.length} ตัวอักษร (ไม่จำกัด)` },
        { label: 'Tags', value: kw(20), meta: '20 คำแรก (คำสำคัญสุด)' },
      ],
    },
  ];
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
