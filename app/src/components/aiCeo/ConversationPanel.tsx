import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { loadAiCeoDecisionContext } from '../../aiCeo/loadDecisionContext';
import { rankAiCeoRecommendations } from '../../aiCeo/decisionEngine';
import { findContinueYesterdayAction } from '../../aiCeo/continueYesterday';
import { generateAndSavePortfolioDiagnosis } from '../../aiCeo/portfolioDoctor';
import { submitConversationMessage, loadAiConversationMessages } from '../../aiCeo/conversationHistory';
import type { ConversationContext } from '../../aiCeo/conversationEngine';
import type { AiConversationMessage, AiCeoAutopilotHandoff } from '../../aiCeo/domain/types';
import type { AiCeoNavigateTarget } from './BusinessCoachPanel';

// Build 030 Part 2, Modules 6-7 — AI Conversation Engine + Conversation
// History. The upgraded AI Command Bar: every submitted message is parsed
// locally (no cloud call), answered with a real evidence-carrying
// response, and persisted so the thread survives a reload.

interface Props {
  requestedCount: number;
  onAction: (autopilotAction: AiCeoAutopilotHandoff | null, navigateTarget: AiCeoNavigateTarget | null) => void;
}

export function ConversationPanel({ requestedCount, onAction }: Props) {
  const [context, setContext] = useState<ConversationContext | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiConversationMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const contextRef = useRef<ConversationContext | null>(null);

  const loadContext = useCallback(async () => {
    const [loaded, diagnosis] = await Promise.all([loadAiCeoDecisionContext(), generateAndSavePortfolioDiagnosis()]);
    const recommendations = rankAiCeoRecommendations({ ...loaded, requestedCount, now: Date.now() });
    const built: ConversationContext = {
      topRecommendation: recommendations[0],
      continueYesterdayAction: findContinueYesterdayAction(recommendations),
      portfolioDiagnosis: diagnosis,
      defaultRequestedCount: requestedCount,
    };
    contextRef.current = built;
    setContext(built);
  }, [requestedCount]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmed = text.trim();
      if (!trimmed || !contextRef.current) return;
      try {
        const result = await submitConversationMessage(trimmed, contextRef.current, { conversationId: conversationId ?? undefined });
        setConversationId(result.conversation.id);
        const all = await loadAiConversationMessages(result.conversation.id);
        setMessages(all);
        setText('');
        setError(null);
        onAction(result.response.autopilotAction, result.response.navigateTarget as AiCeoNavigateTarget | null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [text, conversationId, onAction],
  );

  return (
    <section className="aiceo-conversation">
      <h3>Ask AI</h3>
      {error && (
        <p role="alert" className="aiceo-error">
          {error}
        </p>
      )}
      {!context && <p className="aiceo-loading">Loading…</p>}
      <ul className="aiceo-conversation-log">
        {messages.map((m) => (
          <li key={m.id} className={`aiceo-conversation-message aiceo-conversation-message--${m.role}`}>
            {m.text}
          </li>
        ))}
      </ul>
      <form className="aiceo-conversation-form" onSubmit={handleSubmit}>
        <input
          id="aiceo-conversation-input"
          type="text"
          placeholder='Talk to your AI CEO... e.g. วันนี้ควรทำอะไร, "What should I do today", "สร้าง 10 ลาย"'
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn--primary" disabled={!context}>
          Send
        </button>
      </form>
    </section>
  );
}
