import { describe, it, expect } from 'vitest';
import { validateSeoContent } from './seoValidator';

const GOOD_CONTENT = {
  title: 'Seamless Pastel Floral Spring Pattern With Botanical Motifs',
  description: 'This seamless floral pattern brings a soft, pastel spring feel to any project. It works beautifully on fabric and wallpaper.',
  keywords: ['seamless', 'floral', 'pastel', 'fabric', 'wallpaper', 'spring', 'botanical'],
};

describe('validateSeoContent — never throws', () => {
  it('returns a structured report for an unregistered marketplace instead of throwing', () => {
    expect(() => validateSeoContent(GOOD_CONTENT, 'not-a-real-marketplace')).not.toThrow();
    const report = validateSeoContent(GOOD_CONTENT, 'not-a-real-marketplace');
    expect(report.valid).toBe(false);
    expect(report.errors).toEqual([{ severity: 'error', code: 'unknown-marketplace', message: expect.any(String) }]);
  });

  it('returns a structured report for completely empty content instead of throwing', () => {
    expect(() => validateSeoContent({ title: '', description: '', keywords: [] }, 'shutterstock')).not.toThrow();
  });
});

describe('validateSeoContent — valid content', () => {
  it('is valid with zero errors for well-formed content', () => {
    const report = validateSeoContent(GOOD_CONTENT, 'shutterstock');
    expect(report.valid).toBe(true);
    expect(report.errors).toEqual([]);
  });
});

describe('validateSeoContent — errors (marketplace rule violations)', () => {
  it('reports a title-non-compliant error for an empty title', () => {
    const report = validateSeoContent({ ...GOOD_CONTENT, title: '' }, 'shutterstock');
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.code === 'title-non-compliant')).toBe(true);
  });

  it('reports a description-non-compliant error when required and missing', () => {
    const report = validateSeoContent({ ...GOOD_CONTENT, description: '' }, 'etsy');
    expect(report.errors.some((e) => e.code === 'description-non-compliant')).toBe(true);
  });

  it('reports a keyword-non-compliant error for too few keywords', () => {
    const report = validateSeoContent({ ...GOOD_CONTENT, keywords: ['one', 'two'] }, 'shutterstock');
    expect(report.errors.some((e) => e.code === 'keyword-non-compliant')).toBe(true);
  });
});

describe('validateSeoContent — warnings', () => {
  it('reports duplicate-keywords', () => {
    const report = validateSeoContent({ ...GOOD_CONTENT, keywords: [...GOOD_CONTENT.keywords, 'Floral'] }, 'shutterstock');
    expect(report.warnings.some((w) => w.code === 'duplicate-keywords')).toBe(true);
  });

  it('reports plural-singular-conflict', () => {
    const report = validateSeoContent({ ...GOOD_CONTENT, keywords: [...GOOD_CONTENT.keywords, 'florals'] }, 'shutterstock');
    expect(report.warnings.some((w) => w.code === 'plural-singular-conflict')).toBe(true);
  });

  it('reports noise-keywords', () => {
    const report = validateSeoContent({ ...GOOD_CONTENT, keywords: [...GOOD_CONTENT.keywords, 'the'] }, 'shutterstock');
    expect(report.warnings.some((w) => w.code === 'noise-keywords')).toBe(true);
  });

  it('reports duplicate-title-words', () => {
    const report = validateSeoContent({ ...GOOD_CONTENT, title: 'Floral Floral Seamless Spring Pattern Design' }, 'shutterstock');
    expect(report.warnings.some((w) => w.code === 'duplicate-title-words')).toBe(true);
  });

  it('warnings never affect validity', () => {
    const report = validateSeoContent({ ...GOOD_CONTENT, keywords: [...GOOD_CONTENT.keywords, 'Floral'] }, 'shutterstock');
    expect(report.warnings.length).toBeGreaterThan(0);
    expect(report.valid).toBe(true);
  });
});

describe('validateSeoContent — suggestions', () => {
  it('reports missing-concepts when keyword coverage has gaps', () => {
    const report = validateSeoContent({ ...GOOD_CONTENT, keywords: ['seamless', 'vector', 'repeat', 'tileable', 'pattern', 'illustration', 'digital'] }, 'shutterstock'); // technique only
    expect(report.suggestions.some((s) => s.code === 'missing-concepts')).toBe(true);
  });

  it('reports keyword-ordering when ordering quality is poor', () => {
    const report = validateSeoContent({ ...GOOD_CONTENT, keywords: ['pastel floral seamless repeat pattern for fabric', 'floral seamless pattern', 'floral'] }, 'shutterstock');
    expect(report.suggestions.some((s) => s.code === 'keyword-ordering')).toBe(true);
  });

  it('reports description-not-natural-language for a comma-joined dump', () => {
    const report = validateSeoContent({ ...GOOD_CONTENT, description: 'seamless, floral, pastel, spring' }, 'shutterstock');
    expect(report.suggestions.some((s) => s.code === 'description-not-natural-language')).toBe(true);
  });

  it('suggestions never affect validity', () => {
    // 7 keywords (meets shutterstock's minimum of 7) but every one is a
    // "technique" term — no keyword-compliance error, just a coverage
    // suggestion.
    const report = validateSeoContent({ ...GOOD_CONTENT, keywords: ['seamless', 'vector', 'repeat', 'tileable', 'pattern', 'illustration', 'digital'] }, 'shutterstock');
    expect(report.suggestions.length).toBeGreaterThan(0);
    expect(report.errors).toEqual([]);
    expect(report.valid).toBe(true);
  });
});
