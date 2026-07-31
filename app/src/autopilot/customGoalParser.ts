import { MARKETPLACE_LIST } from '../metadata/marketplaceProfiles';

// Build 029, Module CUSTOM_GOAL — translates a one-sentence user goal (Thai
// or English) into the same theme/marketplace/count/productTargets shape
// the Decision Engine consumes from every other mode. Deliberately simple,
// regex-and-keyword based (no LLM call, no network) — every field it
// returns is either a real number/keyword match found in the sentence, or
// an honest `undefined`/default, never an invented interpretation.
//
// Example: "สร้าง Luxury Botanical สำหรับ Adobe Stock จำนวน 20 ลาย"
//   -> { theme: 'Luxury Botanical', marketplace: 'Adobe Stock', count: 20 }

export interface ParsedCustomGoal {
  theme: string;
  marketplace: string | null;
  count: number | null;
  productTargets: string[];
}

const COUNT_PATTERN = /(\d+)\s*(ลาย|patterns?|designs?)?/i;

const PRODUCT_KEYWORDS: Array<{ keyword: string; id: string }> = [
  { keyword: 'gift wrap', id: 'giftWrap' },
  { keyword: 'giftwrap', id: 'giftWrap' },
  { keyword: 'wallpaper', id: 'wallpaper' },
  { keyword: 'fabric', id: 'fabric' },
  { keyword: 'stationery', id: 'stationery' },
  { keyword: 'home decor', id: 'homeDecor' },
  { keyword: 'textile', id: 'textile' },
];

function findMarketplace(text: string): string | null {
  const lower = text.toLowerCase();
  const match = MARKETPLACE_LIST.find((p) => lower.includes(p.label.toLowerCase()) || lower.includes(p.id.toLowerCase()));
  return match?.label ?? null;
}

function findCount(text: string): number | null {
  const match = text.match(COUNT_PATTERN);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function findProductTargets(text: string): string[] {
  const lower = text.toLowerCase();
  return PRODUCT_KEYWORDS.filter((p) => lower.includes(p.keyword)).map((p) => p.id);
}

/** Strips recognized "boilerplate" words (create/design/for/sell/จำนวน/
 * สำหรับ/ขาย/สร้างลาย, the matched marketplace name, the matched count +
 * its unit) from the sentence, leaving the real theme text — never
 * fabricates a theme when nothing recognizable remains; falls back to the
 * original trimmed sentence so a caller-supplied even keeps something real
 * to show, honestly labeled by the caller as "as typed" rather than
 * "extracted". */
function extractTheme(text: string, marketplace: string | null, count: number | null): string {
  let cleaned = text;
  if (marketplace) cleaned = cleaned.replace(new RegExp(marketplace, 'ig'), '');
  if (count !== null) cleaned = cleaned.replace(COUNT_PATTERN, '');
  const boilerplate = /\b(create|design|for|sell|make)\b|สร้าง|สำหรับ|ขาย|จำนวน|ลาย/gi;
  cleaned = cleaned.replace(boilerplate, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : text.trim();
}

export function parseCustomGoal(instruction: string): ParsedCustomGoal {
  const trimmed = instruction.trim();
  const marketplace = findMarketplace(trimmed);
  const count = findCount(trimmed);
  const productTargets = findProductTargets(trimmed);
  const theme = extractTheme(trimmed, marketplace, count);
  return { theme, marketplace, count, productTargets };
}
