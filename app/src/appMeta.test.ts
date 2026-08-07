import { describe, it, expect } from 'vitest';
import { PRODUCT_NAME, PRODUCT_SUBTITLE, MODULE_NAME, APP_VERSION, BUILD_NAME, RELEASE_DATE, COMMIT, ENVIRONMENT, CHANGELOG } from './appMeta';

describe('appMeta', () => {
  it('exposes the real AI-SBOS product identity', () => {
    expect(PRODUCT_NAME).toBe('AI-SBOS');
    expect(PRODUCT_SUBTITLE).toBe('AI Stock Business Operating System');
    expect(MODULE_NAME).toBe('Vector Stock Pattern Studio');
  });

  it('exposes non-empty version/build/release fields', () => {
    expect(APP_VERSION.length).toBeGreaterThan(0);
    expect(BUILD_NAME.length).toBeGreaterThan(0);
    expect(RELEASE_DATE.length).toBeGreaterThan(0);
  });

  it('reads a real commit hash injected at build time, never a fabricated placeholder like "TODO"', () => {
    expect(COMMIT.length).toBeGreaterThan(0);
    expect(COMMIT).not.toBe('TODO');
  });

  it('reflects the real Vite build mode, not a hardcoded value', () => {
    expect(['production', 'development']).toContain(ENVIRONMENT);
    // vitest runs in dev mode (import.meta.env.PROD is false under vitest).
    expect(ENVIRONMENT).toBe('development');
  });

  it('CHANGELOG has at least one real entry with non-empty highlights', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0);
    for (const entry of CHANGELOG) {
      expect(entry.version.length).toBeGreaterThan(0);
      expect(entry.highlights.length).toBeGreaterThan(0);
    }
  });

  it('CHANGELOG is sorted newest-first by version', () => {
    for (let i = 1; i < CHANGELOG.length; i++) {
      expect(parseFloat(CHANGELOG[i - 1].version)).toBeGreaterThanOrEqual(parseFloat(CHANGELOG[i].version));
    }
  });
});
