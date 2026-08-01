import { AI_CONVERSATIONS_STORE, AI_CONVERSATION_MESSAGES_STORE } from '../../storage/db';
import { createGenericStore } from './genericStore';
import { isValidAiConversation, isValidAiConversationMessage, type AiConversation, type AiConversationMessage } from '../domain/types';

const conversationStore = createGenericStore<AiConversation>(AI_CONVERSATIONS_STORE, 'Conversation History', isValidAiConversation);
const messageStore = createGenericStore<AiConversationMessage>(AI_CONVERSATION_MESSAGES_STORE, 'Conversation History messages', isValidAiConversationMessage);

export async function loadAiConversations(): Promise<AiConversation[]> {
  const all = await conversationStore.loadAll();
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}
export const getAiConversation = conversationStore.get;
export const putAiConversation = conversationStore.put;
export const clearAiConversations = conversationStore.clear;

export async function deleteAiConversation(id: string): Promise<void> {
  const messages = await loadAiConversationMessages(id);
  await Promise.all(messages.map((m) => messageStore.remove(m.id)));
  await conversationStore.remove(id);
}

export async function loadAiConversationMessages(conversationId: string): Promise<AiConversationMessage[]> {
  const all = await messageStore.loadAll();
  return all.filter((m) => m.conversationId === conversationId).sort((a, b) => a.createdAt - b.createdAt);
}
export const putAiConversationMessage = messageStore.put;
export const clearAiConversationMessages = messageStore.clear;

export interface ExportedAiConversation {
  conversation: AiConversation;
  messages: AiConversationMessage[];
}

/** Module 7's "export conversation JSON" — a plain, self-contained object
 * (the conversation record plus every one of its messages), never a Blob,
 * matching `snapshotService.ts`'s own `exportSnapshotAsJson` convention of
 * returning a JSON string the caller decides how to save/download. */
export async function exportAiConversationAsJson(conversationId: string): Promise<string> {
  const conversation = await getAiConversation(conversationId);
  if (!conversation) throw new Error(`Conversation "${conversationId}" was not found.`);
  const messages = await loadAiConversationMessages(conversationId);
  const exported: ExportedAiConversation = { conversation, messages };
  return JSON.stringify(exported, null, 2);
}
