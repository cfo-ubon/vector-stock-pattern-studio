import { useMemo, useState } from 'react';
import type { DesignSpecification } from '../../trend/designSpecTypes';
import { PROMPT_PLATFORM_LIST, buildPrompt, type PromptPlatformId } from '../../trend/promptTemplates';
import { CopyButton } from '../MetadataPanel';

// Design Workbench Section 6 ("Prompt Panel") — promoted out of Live
// Preview's own "Prompt" tab into its own dockable panel, per the Phase 6
// brief naming it as a standalone panel. No new prompt logic: every
// template lives in trend/promptTemplates.ts (Section 6's own "Use Prompt
// Templates. No hardcoded prompts." requirement, already satisfied before
// this phase) — this component only renders a platform picker and the
// already-resolved prompt text. Supports all 7 registered platforms
// (Claude/ChatGPT/Gemini/Adobe Firefly/Midjourney/Stable Diffusion/FLUX —
// a superset of the 6 the brief names by name).

interface Props {
  spec: DesignSpecification;
}

export function PromptPanel({ spec }: Props) {
  const [platform, setPlatform] = useState<PromptPlatformId>('midjourney');
  const prompt = useMemo(() => buildPrompt(spec, platform), [spec, platform]);
  const activePlatform = PROMPT_PLATFORM_LIST.find((p) => p.id === platform);

  return (
    <div className="workbench-prompt-panel">
      <div className="marketplace-chips">
        {PROMPT_PLATFORM_LIST.map((p) => (
          <button key={p.id} type="button" className={`marketplace-chip${p.id === platform ? ' active' : ''}`} onClick={() => setPlatform(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <p className="metadata-hint">{activePlatform?.kind === 'conversational' ? 'Conversational — creative brainstorming, not an image generator.' : 'Image generation — a moodboard/reference prompt, not an editable vector pattern.'}</p>
      <div className="metadata-field">
        <div className="metadata-field-top">
          <label>{activePlatform?.label} Prompt</label>
          <CopyButton text={prompt} label=" Prompt" />
        </div>
        <textarea rows={7} readOnly value={prompt} />
      </div>
    </div>
  );
}
