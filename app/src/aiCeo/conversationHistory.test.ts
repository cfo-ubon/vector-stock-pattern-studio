import { describe, it, expect, beforeEach } from 'vitest';
import { submitConversationMessage, archiveConversation, loadAiConversations, loadAiConversationMessages, deleteAiConversation, exportAiConversationAsJson } from './conversationHistory';
import { clearAiConversations, clearAiConversationMessages } from './storage/aiConversationStore';
import type { ConversationContext } from './conversationEngine';
import type { AiCeoRecommendation } from './domain/types';

function fakeRecommendation(overrides: Partial<AiCeoRecommendation> = {}): AiCeoRecommendation {
  return {
    id: 'CEOREC-1',
    action: 'CREATE_NEW_COLLECTION',
    title: 'Create a collection: botanical florals',
    reason: 'Highest-scoring active Market Opportunity.',
    evidenceRefs: [],
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

beforeEach(async () => {
  await clearAiConversations();
  await clearAiConversationMessages();
});

describe('submitConversationMessage — persists a real user+AI message pair', () => {
  it('creates a new conversation and persists both messages', async () => {
    const result = await submitConversationMessage('วันนี้ควรทำอะไร', baseContext(), { now: 1000 });
    expect(result.userMessage.role).toBe('user');
    expect(result.aiMessage.role).toBe('ai');
    expect(result.aiMessage.text).toContain('botanical florals');

    const conversations = await loadAiConversations();
    expect(conversations).toHaveLength(1);
    const messages = await loadAiConversationMessages(result.conversation.id);
    expect(messages).toHaveLength(2);
  });

  it('continuing an existing conversation appends messages instead of creating a new conversation', async () => {
    const first = await submitConversationMessage('วันนี้ควรทำอะไร', baseContext(), { now: 1000 });
    const second = await submitConversationMessage('สร้าง 5 ลาย', baseContext(), { conversationId: first.conversation.id, now: 2000 });
    expect(second.conversation.id).toBe(first.conversation.id);

    const conversations = await loadAiConversations();
    expect(conversations).toHaveLength(1);
    const messages = await loadAiConversationMessages(first.conversation.id);
    expect(messages).toHaveLength(4);
  });
});

describe('archiveConversation / deleteAiConversation', () => {
  it('archives a real conversation', async () => {
    const { conversation } = await submitConversationMessage('ตรวจ Portfolio', baseContext(), { now: 1000 });
    const archived = await archiveConversation(conversation.id, 2000);
    expect(archived?.archived).toBe(true);
  });

  it('deleting a conversation removes its messages too', async () => {
    const { conversation } = await submitConversationMessage('ตรวจ Portfolio', baseContext(), { now: 1000 });
    await deleteAiConversation(conversation.id);
    expect(await loadAiConversations()).toHaveLength(0);
    expect(await loadAiConversationMessages(conversation.id)).toHaveLength(0);
  });
});

describe('exportAiConversationAsJson', () => {
  it('exports a real conversation + its messages as JSON', async () => {
    const { conversation } = await submitConversationMessage('วันนี้ควรทำอะไร', baseContext(), { now: 1000 });
    const json = await exportAiConversationAsJson(conversation.id);
    const parsed = JSON.parse(json);
    expect(parsed.conversation.id).toBe(conversation.id);
    expect(parsed.messages).toHaveLength(2);
  });
});
