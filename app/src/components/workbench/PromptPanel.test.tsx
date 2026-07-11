import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { buildDesignSpecification } from '../../trend/designIntelligence';
import type { KeywordBundle } from '../../trend/designSpecTypes';
import { buildPrompt } from '../../trend/promptTemplates';
import { PromptPanel } from './PromptPanel';

function makeBundle(overrides: Partial<KeywordBundle> = {}): KeywordBundle {
  return {
    primaryKeyword: 'Luxury Botanical',
    secondaryKeywords: ['Wallpaper'],
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

function makeSpec() {
  return buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
}

describe('PromptPanel', () => {
  it('defaults to the Midjourney prompt built by the real Prompt Factory', () => {
    const spec = makeSpec();
    render(<PromptPanel spec={spec} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe(buildPrompt(spec, 'midjourney'));
  });

  it('switching platform swaps the prompt text to that platform\'s real template output', () => {
    const spec = makeSpec();
    render(<PromptPanel spec={spec} />);
    fireEvent.click(screen.getByRole('button', { name: /Claude/ }));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe(buildPrompt(spec, 'claude'));
    expect(textarea.value).not.toBe(buildPrompt(spec, 'midjourney'));
  });

  it('shows the conversational hint for Claude and the image-generation hint for Midjourney', () => {
    const spec = makeSpec();
    render(<PromptPanel spec={spec} />);
    expect(screen.getByText(/moodboard\/reference prompt/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Claude/ }));
    expect(screen.getByText(/Conversational/)).toBeInTheDocument();
  });
});
