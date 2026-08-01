import type { AiConversation, AiConversationMessage } from './domain/types';
import { aiConversationId, aiConversationMessageId } from './domain/id';
import { parseConversationIntent, respondToConversationIntent, type ConversationContext, type ConversationResponse } from './conversationEngine';
import {
  loadAiConversations,
  getAiConversation,
  putAiConversation,
  putAiConversationMessage,
  loadAiConversationMessages,
  deleteAiConversation,
  exportAiConversationAsJson,
} from './storage/aiConversationStore';

// Build 030 Part 2, Module 7 — Conversation History. The persistence
// layer over Module 6's pure `parseConversationIntent`/
// `respondToConversationIntent` — every submitted message is stored as a
// real record pair (user message + AI response), linked to whatever real
// entity the response actually referenced (a run, a navigation target),
// never a transient in-memory-only exchange.

export interface SubmitConversationMessageResult {
  conversation: AiConversation;
  userMessage: AiConversationMessage;
  aiMessage: AiConversationMessage;
  response: ConversationResponse;
}

function linkedAutonomousDesignRunIdFromEvidence(evidenceRefs: string[]): string | null {
  const ref = evidenceRefs.find((r) => r.startsWith('autonomousDesignRun:'));
  return ref ? ref.slice('autonomousDesignRun:'.length) : null;
}

/** Starts a new conversation (or continues an existing one when
 * `conversationId` is supplied — Module 7's "continue previous
 * conversation") with one real user message and one real AI response,
 * both persisted immediately. */
export async function submitConversationMessage(
  text: string,
  context: ConversationContext,
  options: { conversationId?: string; now?: number } = {},
): Promise<SubmitConversationMessageResult> {
  const now = options.now ?? Date.now();
  let conversation: AiConversation | undefined = options.conversationId ? await getAiConversation(options.conversationId) : undefined;
  if (!conversation) {
    conversation = { id: aiConversationId.generate(now), title: text.trim().slice(0, 80) || 'Conversation', createdAt: now, updatedAt: now, archived: false, schemaVersion: 1 };
  }

  const parsed = parseConversationIntent(text);
  const response = respondToConversationIntent(parsed, text, context);

  const userMessage: AiConversationMessage = {
    id: aiConversationMessageId.generate(now),
    conversationId: conversation.id,
    role: 'user',
    text,
    createdAt: now,
    recognizedIntent: parsed.intent,
    extractedParameters: parsed.extractedParameters,
    aiResponse: null,
    evidenceRefs: [],
    linkedMissionId: null,
    linkedGoalId: null,
    linkedAutonomousDesignRunId: null,
    linkedCollectionId: null,
    actionTaken: null,
    result: null,
    userFeedback: null,
    schemaVersion: 1,
  };

  const linkedRunId = response.navigateTarget === 'autopilotHistory' ? linkedAutonomousDesignRunIdFromEvidence(context.topRecommendation.evidenceRefs.concat(context.continueYesterdayAction?.evidenceRefs ?? [])) : null;

  const aiMessage: AiConversationMessage = {
    id: aiConversationMessageId.generate(now + 1),
    conversationId: conversation.id,
    role: 'ai',
    text: response.responseText,
    createdAt: now + 1,
    recognizedIntent: parsed.intent,
    extractedParameters: parsed.extractedParameters,
    aiResponse: response.responseText,
    evidenceRefs: context.topRecommendation.evidenceRefs,
    linkedMissionId: null,
    linkedGoalId: null,
    linkedAutonomousDesignRunId: linkedRunId,
    linkedCollectionId: null,
    actionTaken: response.autopilotAction ? response.autopilotAction.mode : response.navigateTarget,
    result: null,
    userFeedback: null,
    schemaVersion: 1,
  };

  const updatedConversation: AiConversation = { ...conversation, updatedAt: aiMessage.createdAt };

  await putAiConversation(updatedConversation);
  await putAiConversationMessage(userMessage);
  await putAiConversationMessage(aiMessage);

  return { conversation: updatedConversation, userMessage, aiMessage, response };
}

export async function archiveConversation(id: string, now: number = Date.now()): Promise<AiConversation | undefined> {
  const conversation = await getAiConversation(id);
  if (!conversation) return undefined;
  const updated: AiConversation = { ...conversation, archived: true, updatedAt: now };
  await putAiConversation(updated);
  return updated;
}

export async function unarchiveConversation(id: string, now: number = Date.now()): Promise<AiConversation | undefined> {
  const conversation = await getAiConversation(id);
  if (!conversation) return undefined;
  const updated: AiConversation = { ...conversation, archived: false, updatedAt: now };
  await putAiConversation(updated);
  return updated;
}

export { loadAiConversations, getAiConversation, loadAiConversationMessages, deleteAiConversation, exportAiConversationAsJson };
