import { describe, it, expect } from 'vitest';
import { recommendColorwayPlans } from './colorwayStrategist';
import { createCreativeBrief } from '../domain/creativeBrief';

describe('recommendColorwayPlans', () => {
  it('returns no plans and a note when the brief has no real hex colors', () => {
    const brief = createCreativeBrief({ collectionName: 'X', theme: 'Botanical', colorDirection: ['sage green', 'dusty rose'], now: 1000 });
    const result = recommendColorwayPlans(brief);
    expect(result.plans).toEqual([]);
    expect(result.note).toContain('hex');
  });

  it('produces 6 named colorway plans from real hex colors, including a seasonal match', () => {
    const brief = createCreativeBrief({ collectionName: 'Christmas Botanical', theme: 'Christmas Botanical', colorDirection: ['#8B0000', '#0B6623'], now: 1000 });
    const result = recommendColorwayPlans(brief);
    expect(result.plans.map((p) => p.id).sort()).toEqual(['marketplace', 'neutral', 'premium', 'primary', 'seasonal', 'secondary']);
    const seasonal = result.plans.find((p) => p.id === 'seasonal')!;
    expect(seasonal.variantId).toBe('winter');
  });

  it('maps a known marketplace to its documented palette rule', () => {
    const brief = createCreativeBrief({ collectionName: 'X', theme: 'Y', targetMarketplace: 'etsy', colorDirection: ['#8B0000'], now: 1000 });
    const result = recommendColorwayPlans(brief);
    const marketplace = result.plans.find((p) => p.id === 'marketplace')!;
    expect(marketplace.variantId).toBe('earthTone');
  });
});
