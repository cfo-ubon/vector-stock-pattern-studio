import { describe, it, expect, beforeEach } from 'vitest';
import { detectMarketplacePreferenceCandidate, generateAndSaveMemoryCandidates, confirmAiMemoryCandidate, rejectAiMemoryCandidate } from './memory';
import { clearAiMemoryCandidates, clearAiMemories, loadOpenAiMemoryCandidates, loadConfirmedAiMemories } from './storage/aiMemoryStore';
import { createAutonomousDesignRun, transitionAutonomousDesignRun } from '../autopilot/domain/autonomousDesignRun';
import { emptyAutopilotConstraints } from '../autopilot/domain/constraints';
import type { AutonomousDesignRun } from '../autopilot/domain/autonomousDesignRun';

function completedRunWithMarketplace(marketplace: string | null, now: number): AutonomousDesignRun {
  let run = createAutonomousDesignRun({ mode: 'FULL_AUTOPILOT', requestedCount: 5, constraints: { ...emptyAutopilotConstraints(), preferredMarketplace: marketplace }, now });
  run = transitionAutonomousDesignRun(run, 'PLAN_READY', now + 1);
  run = transitionAutonomousDesignRun(run, 'GENERATING', now + 2);
  run = transitionAutonomousDesignRun(run, 'COMPLETED', now + 3);
  return run;
}

beforeEach(async () => {
  await clearAiMemoryCandidates();
  await clearAiMemories();
});

describe('detectMarketplacePreferenceCandidate — Module 8: never inferred from anything but a real repeated choice', () => {
  it('suggests nothing with fewer than 3 completed runs', () => {
    const runs = [completedRunWithMarketplace('Etsy', 1), completedRunWithMarketplace('Etsy', 2)];
    expect(detectMarketplacePreferenceCandidate(runs, 1000)).toBeNull();
  });

  it('suggests nothing when the last 3 runs disagree', () => {
    const runs = [completedRunWithMarketplace('Etsy', 1), completedRunWithMarketplace('Adobe Stock', 2), completedRunWithMarketplace('Etsy', 3)];
    expect(detectMarketplacePreferenceCandidate(runs, 1000)).toBeNull();
  });

  it('suggests a real candidate when the last 3 completed runs all chose the same marketplace', () => {
    const runs = [completedRunWithMarketplace('Etsy', 1), completedRunWithMarketplace('Etsy', 2), completedRunWithMarketplace('Etsy', 3)];
    const candidate = detectMarketplacePreferenceCandidate(runs, 1000);
    expect(candidate?.type).toBe('PREFERRED_MARKETPLACE');
    expect(candidate?.value).toBe('Etsy');
    expect(candidate?.status).toBe('SUGGESTED');
    expect(candidate?.evidence).toContain('Etsy');
  });
});

describe('SUGGESTED -> CONFIRMED/REJECTED workflow', () => {
  it('a candidate never influences recommendations until explicitly confirmed', async () => {
    const runs = [completedRunWithMarketplace('Etsy', 1), completedRunWithMarketplace('Etsy', 2), completedRunWithMarketplace('Etsy', 3)];
    const saved = await generateAndSaveMemoryCandidates(runs, 1000);
    expect(saved).not.toBeNull();
    expect(await loadOpenAiMemoryCandidates()).toHaveLength(1);
    expect(await loadConfirmedAiMemories()).toHaveLength(0);
  });

  it('confirming a candidate creates a real CONFIRMED memory and removes it from the open-suggestions list', async () => {
    const runs = [completedRunWithMarketplace('Etsy', 1), completedRunWithMarketplace('Etsy', 2), completedRunWithMarketplace('Etsy', 3)];
    const saved = await generateAndSaveMemoryCandidates(runs, 1000);
    const confirmed = await confirmAiMemoryCandidate(saved!.id, 2000);
    expect(confirmed?.status).toBe('CONFIRMED');
    expect(confirmed?.value).toBe('Etsy');
    expect(await loadOpenAiMemoryCandidates()).toHaveLength(0);
    expect(await loadConfirmedAiMemories()).toHaveLength(1);
  });

  it('rejecting a candidate never creates a memory', async () => {
    const runs = [completedRunWithMarketplace('Etsy', 1), completedRunWithMarketplace('Etsy', 2), completedRunWithMarketplace('Etsy', 3)];
    const saved = await generateAndSaveMemoryCandidates(runs, 1000);
    const rejected = await rejectAiMemoryCandidate(saved!.id, 2000);
    expect(rejected?.status).toBe('REJECTED');
    expect(await loadConfirmedAiMemories()).toHaveLength(0);
  });

  it('never re-suggests an already-confirmed value', async () => {
    const runs = [completedRunWithMarketplace('Etsy', 1), completedRunWithMarketplace('Etsy', 2), completedRunWithMarketplace('Etsy', 3)];
    const saved = await generateAndSaveMemoryCandidates(runs, 1000);
    await confirmAiMemoryCandidate(saved!.id, 2000);
    const secondAttempt = await generateAndSaveMemoryCandidates(runs, 3000);
    expect(secondAttempt).toBeNull();
  });
});
