import { describe, it, expect } from 'vitest';
import { parseConversationIntent, respondToConversationIntent, CONVERSATION_UNSUPPORTED_MESSAGE, type ConversationContext } from './conversationEngine';
import type { AiCeoRecommendation } from './domain/types';

function fakeRecommendation(overrides: Partial<AiCeoRecommendation> = {}): AiCeoRecommendation {
  return {
    id: 'CEOREC-1',
    action: 'CREATE_NEW_COLLECTION',
    title: 'Create a collection: botanical florals',
    reason: 'Highest-scoring active Market Opportunity.',
    evidenceRefs: ['obs:OBS-1'],
    confidence: 'high',
    risks: [],
    alternativeAction: null,
    alternativeTitle: null,
    alternativeReason: null,
    dataFreshness: 'LIVE_DATA',
    freshnessLabel: 'Live within this session',
    expectedImpact: 'Targets Etsy using real market evidence.',
    autopilotAction: { mode: 'FULL_AUTOPILOT', requestedCount: 10, marketplace: null, productionGoal: 'auto' },
    navigateTarget: null,
    memoryInfluence: [],
    ...overrides,
  };
}

function baseContext(overrides: Partial<ConversationContext> = {}): ConversationContext {
  return { topRecommendation: fakeRecommendation(), continueYesterdayAction: null, portfolioDiagnosis: null, defaultRequestedCount: 10, ...overrides };
}

describe('parseConversationIntent — deterministic Thai intents (spec\'s own list)', () => {
  const cases: Array<[string, string]> = [
    ['วันนี้ควรทำอะไร', 'todaysFocus'],
    ['เริ่มภารกิจวันนี้', 'startTodaysMission'],
    ['สร้าง 10 ลาย', 'generateCount'],
    ['สร้าง Collection สำหรับ Adobe Stock', 'createCollectionForMarketplace'],
    ['เพิ่ม Portfolio', 'addToPortfolio'],
    ['เติมหมวดที่ขาด', 'fillMissingCategory'],
    ['ทำงานต่อจากเมื่อวาน', 'continueYesterday'],
    ['ตรวจ Portfolio', 'checkPortfolio'],
    ['ดูงานที่ยังไม่เสร็จ', 'viewUnfinishedWork'],
    ['สร้าง Colorway เพิ่ม', 'createMoreColorways'],
    ['เตรียมงานพร้อมส่งขาย', 'prepareForSubmission'],
    ['เปิดโหมดขั้นสูง', 'openAdvancedMode'],
  ];
  it.each(cases)('recognizes Thai command %s as %s', (text, expected) => {
    expect(parseConversationIntent(text).intent).toBe(expected);
  });
});

describe('parseConversationIntent — deterministic English equivalents', () => {
  const cases: Array<[string, string]> = [
    ['What should I do today', 'todaysFocus'],
    ["Start today's mission", 'startTodaysMission'],
    ['Create 10 patterns', 'generateCount'],
    ['Create a collection for Adobe Stock', 'createCollectionForMarketplace'],
    ['Add to Portfolio', 'addToPortfolio'],
    ['Fill the missing category', 'fillMissingCategory'],
    ['Continue from yesterday', 'continueYesterday'],
    ['Check my Portfolio', 'checkPortfolio'],
    ['View unfinished work', 'viewUnfinishedWork'],
    ['Create more colorways', 'createMoreColorways'],
    ['Prepare work for submission', 'prepareForSubmission'],
    ['Open advanced mode', 'openAdvancedMode'],
  ];
  it.each(cases)('recognizes English command %s as %s', (text, expected) => {
    expect(parseConversationIntent(text).intent).toBe(expected);
  });
});

describe('parseConversationIntent — extracted parameters are real, never fabricated', () => {
  it('extracts the real count from "สร้าง 10 ลาย"', () => {
    const parsed = parseConversationIntent('สร้าง 10 ลาย');
    expect(parsed.extractedParameters).toEqual({ count: 10 });
  });
  it('extracts the real marketplace from "Create a collection for Adobe Stock"', () => {
    const parsed = parseConversationIntent('Create a collection for Adobe Stock');
    expect(parsed.extractedParameters).toEqual({ marketplace: 'Adobe Stock' });
  });
});

describe('parseConversationIntent — falls back to the real existing Command Bar / Custom Goal interpreters', () => {
  it('an unmatched goal-mode sentence falls back to parseCommandBarInput\'s goalMode result', () => {
    expect(parseConversationIntent('Help me earn faster').intent).toBe('goalMode');
  });
  it('an unmatched action-oriented sentence falls back to customGoal, never a fabricated interpretation', () => {
    const parsed = parseConversationIntent('Create 20 Botanical patterns');
    expect(parsed.intent).toBe('customGoal');
    expect(parsed.customGoal?.count).toBe(20);
  });
});

describe('parseConversationIntent — honest unsupported fallback', () => {
  it('genuinely unrecognizable chit-chat is marked unsupported, never silently treated as a generation goal', () => {
    expect(parseConversationIntent('What is the weather like today').intent).toBe('unsupported');
  });
  it('empty input is unsupported', () => {
    expect(parseConversationIntent('   ').intent).toBe('unsupported');
  });
});

describe('respondToConversationIntent — real evidence-carrying responses', () => {
  it('todaysFocus reuses the real top recommendation, never a generic reply', () => {
    const response = respondToConversationIntent({ intent: 'todaysFocus', extractedParameters: null }, 'วันนี้ควรทำอะไร', baseContext());
    expect(response.responseText).toContain('Create a collection: botanical florals');
    expect(response.autopilotAction).toEqual({ mode: 'FULL_AUTOPILOT', requestedCount: 10, marketplace: null, productionGoal: 'auto' });
  });

  it('generateCount uses the real extracted count, not the default, when present', () => {
    const response = respondToConversationIntent({ intent: 'generateCount', extractedParameters: { count: 5 } }, 'สร้าง 5 ลาย', baseContext());
    expect(response.autopilotAction?.requestedCount).toBe(5);
  });

  it('checkPortfolio reflects a real PortfolioDiagnosis when one exists', () => {
    const response = respondToConversationIntent(
      { intent: 'checkPortfolio', extractedParameters: null },
      'ตรวจ Portfolio',
      baseContext({ portfolioDiagnosis: { id: 'DIAG-1', createdAt: 1, overallVerdict: 'NEEDS_ATTENTION', findings: [{ code: 'x', verdict: 'NEEDS_ATTENTION', finding: 'Real finding text.', evidence: 'e', affectedCount: 1, confidence: 'high', recommendedAction: 'do x', sendToAutopilotAction: null }], schemaVersion: 1 } }),
    );
    expect(response.responseText).toContain('NEEDS_ATTENTION');
    expect(response.responseText).toContain('Real finding text.');
    expect(response.navigateTarget).toBe('portfolio');
  });

  it('unsupported intent returns the exact honest message, never a fabricated success', () => {
    const response = respondToConversationIntent({ intent: 'unsupported', extractedParameters: null }, 'gibberish', baseContext());
    expect(response.responseText).toBe(CONVERSATION_UNSUPPORTED_MESSAGE);
    expect(response.autopilotAction).toBeNull();
  });
});
