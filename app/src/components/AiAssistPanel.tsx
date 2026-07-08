import { useState } from 'react';
import { buildAiPrompt, parseAiJson } from '../ai/aiAssist';
import type { GenerateParams } from '../engine/types';

interface Props {
  onApply: (patches: Partial<GenerateParams>[], concepts: string[]) => void;
}

/** AI-assist workflow with zero API calls: copy the prompt → ask any AI
 * chat (ChatGPT/Claude/Gemini) yourself → paste the JSON reply back →
 * the app renders every suggested configuration into the gallery. */
export function AiAssistPanel({ onApply }: Props) {
  const [pasted, setPasted] = useState('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);

  const copyPrompt = async () => {
    const prompt = buildAiPrompt();
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = prompt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 1800);
  };

  const applyJson = () => {
    const result = parseAiJson(pasted);
    if (result.error) {
      setStatus({ kind: 'error', text: result.error });
      return;
    }
    onApply(result.patches, result.concepts);
    setStatus({ kind: 'ok', text: `สร้างแล้ว ${result.patches.length} ลายจาก AI — ดูใน Gallery` });
    setPasted('');
  };

  return (
    <section className="ai-assist">
      <h3>🤖 AI ช่วยคิดลาย</h3>
      <ol className="ai-steps">
        <li>กดคัดลอก prompt แล้วไปวางถาม ChatGPT / Claude</li>
        <li>คัดลอกคำตอบ (JSON) กลับมาวางด้านล่าง</li>
        <li>กด "สร้างลายจาก JSON" — ทุกไอเดียจะถูก gen เข้า Gallery</li>
      </ol>
      <button type="button" className="btn" onClick={copyPrompt}>
        {promptCopied ? '✓ คัดลอกแล้ว ไปวางถาม AI ได้เลย' : '1. คัดลอก Prompt ไปถาม AI'}
      </button>
      <textarea
        rows={4}
        placeholder='2. วางคำตอบ JSON จาก AI ที่นี่ เช่น [{"concept":"...","category":"botanical",...}]'
        value={pasted}
        onChange={(e) => {
          setPasted(e.target.value);
          setStatus(null);
        }}
      />
      <button type="button" className="btn btn--primary" onClick={applyJson} disabled={!pasted.trim()}>
        3. สร้างลายจาก JSON
      </button>
      {status && <p className={`ai-status ai-status--${status.kind}`}>{status.text}</p>}
    </section>
  );
}
