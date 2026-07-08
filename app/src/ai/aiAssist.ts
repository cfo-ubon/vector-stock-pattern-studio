import type { GenerateParams, LayoutId } from '../engine/types';
import { GENERATORS } from '../generators';
import { PALETTES } from '../palettes/palettes';
import { randomSeed } from '../engine/rng';

// "AI assist" without any API calls (keeps the app free and static-host
// safe): the user copies a prompt describing this app's parameter schema,
// pastes it into ChatGPT/Claude/etc themselves, and pastes the AI's JSON
// answer back here. parseAiJson() validates the reply and turns it into
// GenerateParams patches the engine can render directly.

export function buildAiPrompt(): string {
  const categoryIds = Object.keys(GENERATORS).join(', ');
  const paletteIds = PALETTES.map((p) => p.id).join(', ');
  return `You are a surface-pattern design expert helping me create seamless vector patterns to sell on stock sites (Shutterstock, Adobe Stock, Creative Fabrica).

Suggest 3-6 pattern configurations for my generator app. Think about what sells well: coherent color stories, clear contrast between background and motifs, and commercially popular themes.

Reply with ONLY a JSON array (no prose, no markdown code fences). Each element must be an object with these fields:

- "concept": short name of your idea (for my reference)
- "category": one of: ${categoryIds}
- "layout": one of: grid, brick, halfDrop, radial, scatter
- "palette": one of: ${paletteIds}
  OR instead provide "colors": an array of 3-6 hex colors where the FIRST color is the background and the rest are motif colors (make sure motif colors contrast well against the background)
- "colorCount": integer 2-6 (ignored when "colors" is given)
- "density": number 0.15-0.9 (how tightly packed the motifs are)
- "motifSize": integer 30-120
- "rotationJitter": integer 0-180 (degrees of random rotation; 0 = strict)
- "scaleJitter": number 0-0.5 (random size variation; 0 = uniform)
- "mirror": boolean
- "radialSymmetry": integer 3-12 (only matters for radial layout)
- "seed": short random-looking string (letters/numbers)

Design brief: (describe here what kind of patterns you want, e.g. "autumn patterns for gift wrap", or leave blank for your best commercial picks)`;
}

export interface ParsedAiResult {
  patches: Partial<GenerateParams>[];
  concepts: string[];
  error?: string;
}

const LAYOUT_IDS: LayoutId[] = ['grid', 'brick', 'radial', 'scatter', 'halfDrop'];

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Parse the JSON pasted back from the AI. Tolerant of markdown fences and
 * a single object instead of an array; invalid fields fall back to safe
 * defaults instead of failing the whole import. */
export function parseAiJson(text: string): ParsedAiResult {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch {
    return { patches: [], concepts: [], error: 'ไม่สามารถอ่าน JSON ได้ — ตรวจว่าคัดลอกมาครบและเป็น JSON ล้วน (ไม่มีข้อความอื่นปน)' };
  }
  const items = Array.isArray(data) ? data : [data];
  const patches: Partial<GenerateParams>[] = [];
  const concepts: string[] = [];

  for (const item of items.slice(0, 9)) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    const patch: Partial<GenerateParams> = {};

    if (typeof o.category === 'string' && GENERATORS[o.category]) {
      patch.categoryId = o.category;
      patch.motifSize = GENERATORS[o.category].defaultMotifSize;
    }
    if (typeof o.layout === 'string' && LAYOUT_IDS.includes(o.layout as LayoutId)) patch.layoutId = o.layout as LayoutId;
    if (typeof o.palette === 'string' && PALETTES.some((p) => p.id === o.palette)) patch.paletteId = o.palette as string;
    if (Array.isArray(o.colors)) {
      const hexes = o.colors.filter((c): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c));
      if (hexes.length >= 2) {
        patch.customColors = hexes.slice(0, 6);
        patch.colorCount = patch.customColors.length;
      }
    }
    if (typeof o.colorCount === 'number' && !patch.customColors) patch.colorCount = clamp(Math.round(o.colorCount), 2, 6);
    if (typeof o.density === 'number') patch.density = clamp(o.density, 0.05, 1);
    if (typeof o.motifSize === 'number') patch.motifSize = clamp(Math.round(o.motifSize), 20, 140);
    if (typeof o.rotationJitter === 'number') patch.rotationJitter = clamp(Math.round(o.rotationJitter), 0, 180);
    if (typeof o.scaleJitter === 'number') patch.scaleJitter = clamp(o.scaleJitter, 0, 0.6);
    if (typeof o.mirror === 'boolean') patch.mirror = o.mirror;
    if (typeof o.radialSymmetry === 'number') patch.radialSymmetry = clamp(Math.round(o.radialSymmetry), 3, 12);
    patch.seed = typeof o.seed === 'string' && o.seed.trim() ? o.seed.trim().slice(0, 32) : randomSeed();

    if (Object.keys(patch).length > 1) {
      patches.push(patch);
      concepts.push(typeof o.concept === 'string' ? o.concept : `แบบที่ ${patches.length}`);
    }
  }

  if (patches.length === 0) {
    return { patches: [], concepts: [], error: 'JSON อ่านได้แต่ไม่มีรายการที่ใช้ได้ — ตรวจว่า field ชื่อตรงตาม schema ใน prompt' };
  }
  return { patches, concepts };
}
