import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { buildAppBackup } from './appBackupBuilder';
import { applyAppBackupRestore } from './appBackupRestore';
import { APP_BACKUP_STORE_NAMES } from './appBackupFormat';
import {
  AI_CEO_BRIEFS_STORE,
  BUSINESS_GOALS_STORE,
  AI_CONVERSATIONS_STORE,
  AI_CONVERSATION_MESSAGES_STORE,
  AI_MEMORY_CANDIDATES_STORE,
  AI_MEMORIES_STORE,
  PORTFOLIO_DIAGNOSES_STORE,
  BUSINESS_COACH_RECOMMENDATIONS_STORE,
  RECOMMENDATION_HISTORY_STORE,
} from '../storage/db';
import { putAiCeoBrief, clearAiCeoBriefs, getAiCeoBrief } from '../aiCeo/storage/aiCeoBriefStore';
import { putBusinessGoal, clearBusinessGoals, getBusinessGoal } from '../aiCeo/storage/businessGoalStore';
import { putAiConversation, putAiConversationMessage, clearAiConversations, clearAiConversationMessages, getAiConversation, loadAiConversationMessages } from '../aiCeo/storage/aiConversationStore';
import { putAiMemoryCandidate, putAiMemory, clearAiMemoryCandidates, clearAiMemories, getAiMemoryCandidate, getAiMemory } from '../aiCeo/storage/aiMemoryStore';
import { putPortfolioDiagnosis, clearPortfolioDiagnoses, getPortfolioDiagnosis } from '../aiCeo/storage/portfolioDiagnosisStore';
import { putBusinessCoachRun, clearBusinessCoachRuns, getBusinessCoachRun } from '../aiCeo/storage/businessCoachRunStore';
import { recordRecommendationOutcome, clearProactiveRecommendationHistory, loadProactiveRecommendationHistory } from '../aiCeo/storage/proactiveRecommendationHistoryStore';

// Build 030 Part 2 — .vspsb backup coverage for the 8 new stores plus the
// first real use of the pre-provisioned `recommendationHistory` store,
// following the exact template `appBackup029Stores.test.ts` established.

const originalBlob = globalThis.Blob;
beforeEach(async () => {
  globalThis.Blob = NodeBlob as unknown as typeof Blob;
  await Promise.all([
    clearAiCeoBriefs(),
    clearBusinessGoals(),
    clearAiConversations(),
    clearAiConversationMessages(),
    clearAiMemoryCandidates(),
    clearAiMemories(),
    clearPortfolioDiagnoses(),
    clearBusinessCoachRuns(),
    clearProactiveRecommendationHistory(),
  ]);
});
afterEach(() => {
  globalThis.Blob = originalBlob;
});

describe('.vspsb coverage — every Build 030 Part 2 store is registered', () => {
  it('APP_BACKUP_STORE_NAMES includes all 8 new stores plus recommendationHistory', () => {
    for (const store of [
      AI_CEO_BRIEFS_STORE,
      BUSINESS_GOALS_STORE,
      AI_CONVERSATIONS_STORE,
      AI_CONVERSATION_MESSAGES_STORE,
      AI_MEMORY_CANDIDATES_STORE,
      AI_MEMORIES_STORE,
      PORTFOLIO_DIAGNOSES_STORE,
      BUSINESS_COACH_RECOMMENDATIONS_STORE,
      RECOMMENDATION_HISTORY_STORE,
    ]) {
      expect(APP_BACKUP_STORE_NAMES).toContain(store);
    }
  });
});

describe('.vspsb — non-empty round trip across every new store', () => {
  it('backs up and restores real records from all 9 stores', async () => {
    await putAiCeoBrief({
      id: 'BRIEF-20260101-AAAAAA',
      createdAt: 1000,
      greeting: 'Good morning',
      dateLabel: '2026-01-01',
      dataStatus: 'INSUFFICIENT_DATA',
      dataStatusLabel: 'Insufficient Data',
      yesterdaySummary: null,
      topRecommendation: {
        id: 'CEOREC-20260101-AAAAAA',
        action: 'USE_EVERGREEN_FALLBACK',
        title: 'Use an evergreen fallback',
        reason: 'No evidence yet.',
        evidenceRefs: [],
        confidence: 'unknown',
        risks: [],
        alternativeAction: null,
        alternativeTitle: null,
        alternativeReason: null,
        dataFreshness: 'INSUFFICIENT_DATA',
        freshnessLabel: 'No data',
        expectedImpact: 'Unknown',
        autopilotAction: null,
        navigateTarget: null,
        memoryInfluence: [],
      },
      alternativeRecommendations: [],
      portfolioImpact: 'Unknown',
      productionSizeRecommendation: 'Unknown',
      confidence: 'unknown',
      freshnessLabel: 'No data',
      risks: [],
      missingInformation: ['No Market Snapshot'],
      primaryAction: null,
      explanation: {
        recommendation: 'Use an evergreen fallback',
        why: [],
        evidence: [],
        confidence: 'unknown',
        freshness: 'INSUFFICIENT_DATA',
        freshnessLabel: 'No data',
        assumptions: [],
        risks: [],
        alternative: null,
        memoryUsed: [],
        missingData: [],
      },
      schemaVersion: 1,
    });

    await putBusinessGoal({
      id: 'GOAL-20260101-AAAAAA',
      type: 'GROW_PORTFOLIO',
      title: 'Grow the portfolio',
      targetDate: null,
      targetQuantity: 50,
      preferredMarketplaces: ['Etsy'],
      availableTimePerDayMinutes: null,
      preferredWorkingDays: [],
      excludedCategoryIds: [],
      notes: '',
      revenueGoalDetected: false,
      status: 'ACTIVE',
      createdAt: 1000,
      updatedAt: 1000,
      schemaVersion: 1,
    });

    await putAiConversation({ id: 'CONV-20260101-AAAAAA', title: 'วันนี้ควรทำอะไร', createdAt: 1000, updatedAt: 1000, archived: false, schemaVersion: 1 });
    await putAiConversationMessage({
      id: 'MSG-20260101-AAAAAA',
      conversationId: 'CONV-20260101-AAAAAA',
      role: 'user',
      text: 'วันนี้ควรทำอะไร',
      createdAt: 1000,
      recognizedIntent: 'todaysFocus',
      extractedParameters: null,
      aiResponse: 'Start Today\'s Mission.',
      evidenceRefs: [],
      linkedMissionId: null,
      linkedGoalId: null,
      linkedAutonomousDesignRunId: null,
      linkedCollectionId: null,
      actionTaken: null,
      result: null,
      userFeedback: null,
      schemaVersion: 1,
    });

    await putAiMemoryCandidate({
      id: 'MEMC-20260101-AAAAAA',
      type: 'PREFERRED_MARKETPLACE',
      value: 'Etsy',
      evidence: 'You chose Etsy 3 times in a row.',
      observedCount: 3,
      status: 'SUGGESTED',
      createdAt: 1000,
      updatedAt: 1000,
      schemaVersion: 1,
    });
    await putAiMemory({ id: 'MEM-20260101-AAAAAA', type: 'PREFERRED_MARKETPLACE', value: 'Etsy', status: 'CONFIRMED', sourceCandidateId: null, confirmedAt: 1000, updatedAt: 1000, schemaVersion: 1 });

    await putPortfolioDiagnosis({ id: 'DIAG-20260101-AAAAAA', createdAt: 1000, overallVerdict: 'INSUFFICIENT_DATA', findings: [], schemaVersion: 1 });
    await putBusinessCoachRun({ id: 'COACH-20260101-AAAAAA', createdAt: 1000, cards: [], schemaVersion: 1 });
    await recordRecommendationOutcome({ refId: 'CEOREC-20260101-AAAAAA', action: 'USE_EVERGREEN_FALLBACK', outcome: 'shown' }, 1000);

    const backup = await buildAppBackup();
    expect(backup.manifest.stats.storeRecordCounts[AI_CEO_BRIEFS_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[BUSINESS_GOALS_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[AI_CONVERSATIONS_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[AI_CONVERSATION_MESSAGES_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[AI_MEMORY_CANDIDATES_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[AI_MEMORIES_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[PORTFOLIO_DIAGNOSES_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[BUSINESS_COACH_RECOMMENDATIONS_STORE]).toBe(1);
    expect(backup.manifest.stats.storeRecordCounts[RECOMMENDATION_HISTORY_STORE]).toBe(1);

    await Promise.all([
      clearAiCeoBriefs(),
      clearBusinessGoals(),
      clearAiConversations(),
      clearAiConversationMessages(),
      clearAiMemoryCandidates(),
      clearAiMemories(),
      clearPortfolioDiagnoses(),
      clearBusinessCoachRuns(),
      clearProactiveRecommendationHistory(),
    ]);

    const result = await applyAppBackupRestore(backup.blob);
    expect(result.storeRecordCounts[AI_CEO_BRIEFS_STORE]).toBe(1);
    expect(result.storeRecordCounts[RECOMMENDATION_HISTORY_STORE]).toBe(1);

    expect(await getAiCeoBrief('BRIEF-20260101-AAAAAA')).toBeDefined();
    expect(await getBusinessGoal('GOAL-20260101-AAAAAA')).toBeDefined();
    expect(await getAiConversation('CONV-20260101-AAAAAA')).toBeDefined();
    expect(await loadAiConversationMessages('CONV-20260101-AAAAAA')).toHaveLength(1);
    expect(await getAiMemoryCandidate('MEMC-20260101-AAAAAA')).toBeDefined();
    expect(await getAiMemory('MEM-20260101-AAAAAA')).toBeDefined();
    expect(await getPortfolioDiagnosis('DIAG-20260101-AAAAAA')).toBeDefined();
    expect(await getBusinessCoachRun('COACH-20260101-AAAAAA')).toBeDefined();
    expect(await loadProactiveRecommendationHistory()).toHaveLength(1);
  });
});

describe('.vspsb — empty-store behavior', () => {
  it('builds and restores cleanly when every new store is empty', async () => {
    const backup = await buildAppBackup();
    for (const store of [AI_CEO_BRIEFS_STORE, BUSINESS_GOALS_STORE, AI_MEMORIES_STORE, RECOMMENDATION_HISTORY_STORE]) {
      expect(backup.manifest.stats.storeRecordCounts[store]).toBe(0);
    }
    const result = await applyAppBackupRestore(backup.blob);
    for (const store of [AI_CEO_BRIEFS_STORE, BUSINESS_GOALS_STORE, AI_MEMORIES_STORE, RECOMMENDATION_HISTORY_STORE]) {
      expect(result.storeRecordCounts[store]).toBe(0);
    }
  });
});
