import { describe, it, expect } from 'vitest';
import { getActiveCloudAiProvider, isCloudAiProviderConnected } from './cloudProvider';

describe('Module 15 — Cloud AI Provider Boundary', () => {
  it('no provider is connected in this build — local deterministic AI CEO behavior remains fully active', () => {
    expect(getActiveCloudAiProvider()).toBeNull();
    expect(isCloudAiProviderConnected()).toBe(false);
  });
});
