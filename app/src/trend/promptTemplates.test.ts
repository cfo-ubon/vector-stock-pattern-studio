import { describe, it, expect } from 'vitest';
import { buildDesignSpecification } from './designIntelligence';
import {
  PROMPT_TEMPLATES,
  PROMPT_PLATFORM_LIST,
  resolvePromptTemplate,
  buildPrompt,
  buildAllPrompts,
  exportPromptTemplateJson,
  importPromptTemplateJson,
} from './promptTemplates';
import type { KeywordBundle } from './designSpecTypes';

function makeBundle(overrides: Partial<KeywordBundle> = {}): KeywordBundle {
  return {
    primaryKeyword: 'Luxury Botanical',
    secondaryKeywords: ['Wallpaper', 'Spring', 'Muted Green', 'Editorial'],
    marketplace: 'adobestock',
    season: 'spring',
    audience: 'editorial',
    commercialCategory: 'wallpaper',
    patternType: 'botanical',
    paletteDirection: 'muted green',
    difficulty: 'moderate',
    collectionSize: 8,
    ...overrides,
  };
}

describe('promptTemplates: config integrity', () => {
  it('defines all 7 required platforms', () => {
    const ids = PROMPT_PLATFORM_LIST.map((p) => p.id).sort();
    expect(ids).toEqual(['adobeFirefly', 'chatgpt', 'claude', 'flux', 'gemini', 'midjourney', 'stableDiffusion'].sort());
  });

  it('every template is non-empty', () => {
    for (const profile of PROMPT_PLATFORM_LIST) {
      expect(profile.template.trim().length, profile.id).toBeGreaterThan(0);
    }
  });

  it('classifies the 3 conversational LLMs and 4 image-generation platforms correctly', () => {
    const conversational = PROMPT_PLATFORM_LIST.filter((p) => p.kind === 'conversational').map((p) => p.id).sort();
    const imageGen = PROMPT_PLATFORM_LIST.filter((p) => p.kind === 'imageGeneration').map((p) => p.id).sort();
    expect(conversational).toEqual(['chatgpt', 'claude', 'gemini']);
    expect(imageGen).toEqual(['adobeFirefly', 'flux', 'midjourney', 'stableDiffusion'].sort());
  });

  it('only Midjourney carries a generation-flag suffix', () => {
    for (const profile of PROMPT_PLATFORM_LIST) {
      if (profile.id === 'midjourney') {
        expect(profile.suffix).toBeDefined();
      } else {
        expect(profile.suffix, profile.id).toBeUndefined();
      }
    }
  });
});

describe('resolvePromptTemplate / buildPrompt', () => {
  it('resolves every placeholder against a real Design Specification', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const resolved = resolvePromptTemplate(PROMPT_TEMPLATES.chatgpt.template, spec);
    expect(resolved).toContain('Luxury Botanical');
    expect(resolved).toContain(spec.trend!.theme);
    expect(resolved).not.toMatch(/\{[a-zA-Z]+\}/);
  });

  it('leaves an unrecognized placeholder as literal text instead of throwing', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const resolved = resolvePromptTemplate('Pattern about {primaryKeyword} and {notARealPlaceholder}', spec);
    expect(resolved).toContain('Luxury Botanical');
    expect(resolved).toContain('{notARealPlaceholder}');
  });

  it('appends the platform suffix for platforms that have one (Midjourney)', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const prompt = buildPrompt(spec, 'midjourney');
    expect(prompt.endsWith('--tile --ar 1:1 --v 6')).toBe(true);
  });

  it('does not append any suffix for platforms without one', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const prompt = buildPrompt(spec, 'chatgpt');
    expect(prompt.endsWith('--tile --ar 1:1 --v 6')).toBe(false);
  });

  it('a conversational prompt asks for creative help; an image-generation prompt describes a visual', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const chatgpt = buildPrompt(spec, 'chatgpt');
    const midjourney = buildPrompt(spec, 'midjourney');
    expect(chatgpt.toLowerCase()).toContain('suggest');
    expect(midjourney.toLowerCase()).toContain('seamless repeating surface pattern');
  });

  it('is fully deterministic for the same spec', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q2', createdAt: 1000 });
    const a = buildAllPrompts(spec);
    const b = buildAllPrompts(spec);
    expect(a).toEqual(b);
  });

  it('buildAllPrompts covers every one of the 7 platforms', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), createdAt: 1000 });
    const all = buildAllPrompts(spec);
    expect(Object.keys(all).sort()).toEqual(PROMPT_PLATFORM_LIST.map((p) => p.id).sort());
  });

  it('reflects a genuinely different Trend Pack in the resolved prompt (mood/theme actually change)', () => {
    const specQ1 = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const specQ4 = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q4', createdAt: 1000 });
    const promptQ1 = buildPrompt(specQ1, 'chatgpt');
    const promptQ4 = buildPrompt(specQ4, 'chatgpt');
    expect(promptQ1).not.toBe(promptQ4);
  });
});

describe('prompt template JSON import/export', () => {
  it('round-trips a template through export -> import to an equivalent object', () => {
    const original = PROMPT_TEMPLATES.claude;
    const json = exportPromptTemplateJson(original);
    const imported = importPromptTemplateJson(json);
    expect(imported).toEqual(original);
  });

  it('rejects invalid JSON', () => {
    expect(() => importPromptTemplateJson('not json')).toThrow();
  });

  it('rejects a JSON object missing required fields', () => {
    expect(() => importPromptTemplateJson(JSON.stringify({ id: 'x' }))).toThrow();
  });

  it('rejects an empty template string', () => {
    expect(() => importPromptTemplateJson(JSON.stringify({ id: 'x', label: 'X', kind: 'conversational', template: '   ' }))).toThrow();
  });

  it('accepts a bare PromptPlatformProfile object (not wrapped in the export envelope)', () => {
    const bare = PROMPT_TEMPLATES.gemini;
    const imported = importPromptTemplateJson(JSON.stringify(bare));
    expect(imported).toEqual(bare);
  });
});
