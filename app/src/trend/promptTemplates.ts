import { STYLE_DNA_PRESETS } from '../engine/styleDna';
import { MARKETPLACE_PROFILES } from '../metadata/marketplaceProfiles';
import type { DesignSpecification } from './designSpecTypes';

// Prompt Factory (Section 7) — "Generate prompts from the Design
// Specification. Support ChatGPT, Claude, Gemini, Adobe Firefly,
// Midjourney, Stable Diffusion, FLUX. Prompt templates must be stored
// externally. Do not hardcode prompts." Every template lives in this one
// config module (never inlined in a UI component) — the same "one
// editable config, not scattered magic strings" convention
// marketplaceProfiles.ts/trendPacks.ts/keywordMap.ts already established
// for this app's "no server backend" architecture, with the same JSON
// export/import escape hatch trendPacks.ts uses for user customization.
//
// Two platform kinds, since they serve genuinely different purposes for a
// surface-pattern designer: `conversational` (ChatGPT/Claude/Gemini) asks
// the LLM for creative brainstorming help (motif ideas, marketing copy) —
// none of these three generate images. `imageGeneration` (Adobe Firefly/
// Midjourney/Stable Diffusion/FLUX) is an actual txt2img prompt for
// moodboard/reference art (none of these tools produce editable seamless
// vector patterns directly — that's still this app's own SVG Engine).

export type PromptPlatformId = 'chatgpt' | 'claude' | 'gemini' | 'adobeFirefly' | 'midjourney' | 'stableDiffusion' | 'flux';

export type PromptPlatformKind = 'conversational' | 'imageGeneration';

export interface PromptPlatformProfile {
  id: PromptPlatformId;
  label: string;
  kind: PromptPlatformKind;
  /** The prompt body — `{placeholder}` tokens resolved by
   * `resolvePromptTemplate` against a real `DesignSpecification`. */
  template: string;
  /** Appended after the resolved template — platform-specific generation
   * flags (e.g. Midjourney's `--tile --ar 1:1`). Empty for every
   * conversational platform. */
  suffix?: string;
}

const CONVERSATIONAL_TEMPLATE =
  "I'm designing a seamless vector surface pattern collection for {commercialCategory}, themed \"{primaryKeyword}\" ({theme}). " +
  'Mood: {mood}. Style direction: {styleDna}, a {composition} composition. Palette: {colorList}. ' +
  'Target audience: {audience}, for the {season} season, intended for {marketplace}. ' +
  'Suggest 5 additional motif ideas that would fit this direction, a refined product title (under 100 characters), ' +
  'and a short marketing description a stock-image buyer would find compelling.';

const IMAGE_GEN_TEMPLATE =
  'Seamless repeating surface pattern design, "{primaryKeyword}" {patternType} motifs, {mood} mood, ' +
  '{styleDna} style, {composition} composition, color palette: {colorList}, flat vector illustration style, ' +
  'tileable, high detail, {season} inspired';

export const PROMPT_TEMPLATES: Record<PromptPlatformId, PromptPlatformProfile> = {
  chatgpt: { id: 'chatgpt', label: 'ChatGPT', kind: 'conversational', template: CONVERSATIONAL_TEMPLATE },
  claude: { id: 'claude', label: 'Claude', kind: 'conversational', template: CONVERSATIONAL_TEMPLATE },
  gemini: { id: 'gemini', label: 'Gemini', kind: 'conversational', template: CONVERSATIONAL_TEMPLATE },
  adobeFirefly: { id: 'adobeFirefly', label: 'Adobe Firefly', kind: 'imageGeneration', template: IMAGE_GEN_TEMPLATE },
  midjourney: { id: 'midjourney', label: 'Midjourney', kind: 'imageGeneration', template: IMAGE_GEN_TEMPLATE, suffix: ' --tile --ar 1:1 --v 6' },
  stableDiffusion: { id: 'stableDiffusion', label: 'Stable Diffusion', kind: 'imageGeneration', template: `${IMAGE_GEN_TEMPLATE}, trending on artstation, 4k` },
  flux: { id: 'flux', label: 'FLUX', kind: 'imageGeneration', template: IMAGE_GEN_TEMPLATE },
};

export const PROMPT_PLATFORM_LIST: PromptPlatformProfile[] = Object.values(PROMPT_TEMPLATES);

function buildPromptPlaceholders(spec: DesignSpecification): Record<string, string> {
  return {
    primaryKeyword: spec.seoHints.primaryKeyword,
    secondaryKeywords: spec.seoHints.secondaryKeywords.join(', '),
    mood: spec.trend?.mood ?? 'balanced, versatile',
    theme: spec.trend?.theme ?? spec.seoHints.primaryKeyword,
    styleDna: STYLE_DNA_PRESETS[spec.styleDnaId]?.label ?? spec.styleDnaId,
    patternType: spec.keywordBundle.patternType,
    composition: spec.composition,
    colorList: spec.palette.colors.slice(1).join(', '),
    season: spec.seoHints.season,
    audience: spec.seoHints.audience,
    commercialCategory: spec.seoHints.commercialCategory,
    marketplace: MARKETPLACE_PROFILES[spec.marketplace.id]?.label ?? spec.marketplace.id,
  };
}

/** Resolves a prompt template's `{placeholder}` tokens against a real
 * `DesignSpecification`. Every placeholder is optional; an unrecognized
 * one is left as literal text (never throws) — same "typo in a hand-
 * edited template degrades gracefully" convention
 * metadata/filenameEngine.ts's `resolveFilenameTemplate` already uses. */
export function resolvePromptTemplate(template: string, spec: DesignSpecification): string {
  const placeholders = buildPromptPlaceholders(spec);
  return template.replace(/\{(\w+)\}/g, (match, key: string) => placeholders[key] ?? match);
}

/** Builds one platform's complete prompt (template resolved + its
 * platform-specific suffix appended, if any). */
export function buildPrompt(spec: DesignSpecification, platformId: PromptPlatformId): string {
  const profile = PROMPT_TEMPLATES[platformId];
  const resolved = resolvePromptTemplate(profile.template, spec);
  return profile.suffix ? `${resolved}${profile.suffix}` : resolved;
}

/** Every supported platform's prompt in one call — Section 7's "support
 * ChatGPT, Claude, Gemini, Adobe Firefly, Midjourney, Stable Diffusion,
 * FLUX" requirement. */
export function buildAllPrompts(spec: DesignSpecification): Record<PromptPlatformId, string> {
  const result = {} as Record<PromptPlatformId, string>;
  for (const id of Object.keys(PROMPT_TEMPLATES) as PromptPlatformId[]) {
    result[id] = buildPrompt(spec, id);
  }
  return result;
}

export const PROMPT_TEMPLATE_SCHEMA_VERSION = 1;

export interface PromptTemplateExport {
  schemaVersion: number;
  exportedAt: number;
  promptTemplate: PromptPlatformProfile;
}

/** JSON export/import for one platform's template — the same "editable,
 * import/export as JSON" escape hatch trendPacks.ts provides for Trend
 * Packs, so a user can hand-tune a platform's wording without touching
 * source code. */
export function exportPromptTemplateJson(profile: PromptPlatformProfile): string {
  const doc: PromptTemplateExport = { schemaVersion: PROMPT_TEMPLATE_SCHEMA_VERSION, exportedAt: Date.now(), promptTemplate: profile };
  return JSON.stringify(doc, null, 2);
}

export function importPromptTemplateJson(json: string): PromptPlatformProfile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('ไฟล์ Prompt Template ไม่ใช่ JSON ที่ถูกต้อง');
  }
  const doc = parsed as Partial<PromptTemplateExport> & Partial<PromptPlatformProfile>;
  const profile = (doc.promptTemplate ?? doc) as Partial<PromptPlatformProfile>;
  if (
    typeof profile.id !== 'string' ||
    typeof profile.label !== 'string' ||
    typeof profile.kind !== 'string' ||
    typeof profile.template !== 'string' ||
    profile.template.trim() === ''
  ) {
    throw new Error('โครงสร้างไฟล์ Prompt Template ไม่ครบถ้วน — ตรวจสอบว่ามีทุกฟิลด์ที่จำเป็น');
  }
  return profile as PromptPlatformProfile;
}
