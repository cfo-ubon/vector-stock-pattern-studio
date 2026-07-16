import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildDesignSpecification } from '../../trend/designIntelligence';
import type { KeywordBundle } from '../../trend/designSpecTypes';
import { ValidationPanel } from './ValidationPanel';

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

describe('ValidationPanel', () => {
  it('shows the "valid" indicator when there are no errors', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    // Use a schema/relationship/semantic-clean tuple (see workbenchValidation.test.ts for why the
    // raw engine output isn't guaranteed error-free against the separately-built Pattern Grammar library).
    const compatible = { ...spec, composition: 'balanced' as const, repeatType: 'heroFlow' as const, density: 0.5, negativeSpace: 0.2, flow: 'directional' as const, rhythm: 'regular' as const };
    render(<ValidationPanel spec={compatible} />);
    expect(screen.getByText('✅ Design Specification is valid')).toBeInTheDocument();
  });

  it('shows an error count and groups a relationship error under "Relationships"', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const broken = { ...spec, styleDnaId: 'not-real' };
    render(<ValidationPanel spec={broken} />);
    expect(screen.getByText(/error/)).toBeInTheDocument();
    expect(screen.getByText(/Relationships/)).toBeInTheDocument();
    expect(screen.getByText(/Unknown Style DNA "not-real"/)).toBeInTheDocument();
  });

  it('groups a missing-value issue under "Missing Values"', () => {
    const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });
    const broken = { ...spec, heroMotifs: [] };
    render(<ValidationPanel spec={broken} />);
    expect(screen.getByText(/Missing Values/)).toBeInTheDocument();
  });

  it('groups a duplicate-value issue under "Duplicate Values"', () => {
    const spec = buildDesignSpecification({
      keywordBundle: makeBundle({ primaryKeyword: 'Botanical', secondaryKeywords: ['botanical'] }),
      trendPackId: '2026-Q1',
      createdAt: 1000,
    });
    render(<ValidationPanel spec={spec} />);
    expect(screen.getByText(/Duplicate Values/)).toBeInTheDocument();
  });
});
