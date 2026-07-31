import { describe, it, expect, beforeEach } from 'vitest';
import { createScoringProfile } from '../domain/scoringProfile';
import { loadScoringProfiles, putScoringProfile, clearScoringProfiles, ensureDefaultScoringProfile } from './scoringProfileStore';

beforeEach(async () => {
  await clearScoringProfiles();
});

describe('scoringProfileStore', () => {
  it('persists a profile', async () => {
    const profile = createScoringProfile({ name: 'Test', now: 1000 });
    await putScoringProfile(profile);
    expect(await loadScoringProfiles()).toEqual([profile]);
  });
});

describe('ensureDefaultScoringProfile', () => {
  it('creates a default profile when none exists', async () => {
    const profile = await ensureDefaultScoringProfile(1000);
    expect(profile.isDefault).toBe(true);
    expect(await loadScoringProfiles()).toHaveLength(1);
  });

  it('never overwrites an existing user-edited default', async () => {
    const existing = createScoringProfile({ name: 'My Custom Default', weights: { demandSignal: 7 }, isDefault: true, now: 1000 });
    await putScoringProfile(existing);
    const result = await ensureDefaultScoringProfile(2000);
    expect(result.id).toBe(existing.id);
    expect(result.weights.demandSignal).toBe(7);
    expect(await loadScoringProfiles()).toHaveLength(1);
  });
});
