import { useEffect, useMemo, useState } from 'react';
import type { DesignDirectorData } from './AIDesignDirectorView';
import type { CreativeBrief, CommercialPriority, ExpectedDifficulty } from '../../design-director/domain/creativeBrief';
import { COMMERCIAL_PRIORITY_VALUES, EXPECTED_DIFFICULTY_VALUES, transitionCreativeBriefStatus } from '../../design-director/domain/creativeBrief';
import { buildCreativeBriefFromOpportunity } from '../../design-director/brief/briefGenerator';
import { putCreativeBrief } from '../../design-director/storage/creativeBriefStore';
import { ConfidenceBadge } from '../marketing/evidenceDisplay';

interface Props {
  data: DesignDirectorData;
  reload: () => Promise<void>;
  selectedBriefId: string | null;
  onSelectBrief: (id: string | null) => void;
  activeBrief: CreativeBrief | null;
}

const STATUS_ACTIONS: Array<[CreativeBrief['status'], string]> = [
  ['APPROVED', 'Approve'],
  ['IN_PLANNING', 'Move to Planning'],
  ['ARCHIVED', 'Archive'],
];

/** Section 1 — Creative Brief. Turns an approved Market Opportunity into a
 * real, persisted, editable Creative Brief via `buildCreativeBriefFromOpportunity`
 * (the AI Design Director's Module 1) — this component never derives a
 * field itself, it only renders what that function returned and lets the
 * user override any value before saving. */
export function CreativeBriefTab({ data, reload, selectedBriefId, onSelectBrief, activeBrief }: Props) {
  const [sourceOpportunityId, setSourceOpportunityId] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<CreativeBrief | null>(activeBrief);

  useEffect(() => {
    setForm(activeBrief);
  }, [activeBrief]);

  const eligibleOpportunities = useMemo(() => data.opportunities.filter((o) => o.status !== 'ARCHIVED'), [data.opportunities]);

  const handleGenerate = async () => {
    const opportunity = data.opportunities.find((o) => o.id === sourceOpportunityId);
    if (!opportunity) return;
    setBusy(true);
    try {
      const snapshot = data.snapshots.find((s) => s.id === opportunity.snapshotId) ?? null;
      const brief = buildCreativeBriefFromOpportunity(opportunity, snapshot);
      await putCreativeBrief(brief);
      await reload();
      onSelectBrief(brief.id);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!form) return;
    setBusy(true);
    try {
      await putCreativeBrief(form);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const handleTransition = async (status: CreativeBrief['status']) => {
    if (!form) return;
    setBusy(true);
    try {
      const updated = transitionCreativeBriefStatus(form, status);
      await putCreativeBrief(updated);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const update = <K extends keyof CreativeBrief>(key: K, value: CreativeBrief[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  return (
    <div className="design-director-tab creative-brief-tab">
      <section className="brief-generate">
        <h2>Generate from an approved Market Opportunity</h2>
        <label>
          Opportunity:{' '}
          <select value={sourceOpportunityId} onChange={(e) => setSourceOpportunityId(e.target.value)}>
            <option value="">— select —</option>
            {eligibleOpportunities.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title} — {o.score.overall}/100 ({o.status})
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn--primary" disabled={busy || !sourceOpportunityId} onClick={() => void handleGenerate()}>
          Generate Creative Brief
        </button>
      </section>

      <section className="brief-picker">
        <h2>Existing briefs</h2>
        {data.briefs.length === 0 && <p>No Creative Briefs yet — generate one above.</p>}
        <ul className="brief-list">
          {data.briefs.map((b) => (
            <li key={b.id}>
              <button type="button" className={`link-btn${b.id === selectedBriefId ? ' link-btn--active' : ''}`} onClick={() => onSelectBrief(b.id)}>
                {b.collectionName} ({b.status})
              </button>
            </li>
          ))}
        </ul>
      </section>

      {form && (
        <section className="brief-form">
          <h2>{form.collectionName}</h2>
          <ConfidenceBadge confidence={form.confidence} />
          <div className="brief-field-grid">
            <label>
              Collection Name
              <input type="text" value={form.collectionName} onChange={(e) => update('collectionName', e.target.value)} />
            </label>
            <label>
              Theme
              <input type="text" value={form.theme} onChange={(e) => update('theme', e.target.value)} />
            </label>
            <label>
              Target Marketplace
              <input type="text" value={form.targetMarketplace} onChange={(e) => update('targetMarketplace', e.target.value)} />
            </label>
            <label>
              Buyer Persona
              {form.fieldRationale.buyerPersona && <span className="field-why"> — {form.fieldRationale.buyerPersona}</span>}
              <input type="text" value={form.buyerPersona} onChange={(e) => update('buyerPersona', e.target.value)} />
            </label>
            <label>
              Hero Style
              {form.fieldRationale.heroStyle && <span className="field-why"> — {form.fieldRationale.heroStyle}</span>}
              <input type="text" value={form.heroStyle} onChange={(e) => update('heroStyle', e.target.value)} />
            </label>
            <label>
              Secondary Assets (comma-separated)
              {form.fieldRationale.secondaryAssets && <span className="field-why"> — {form.fieldRationale.secondaryAssets}</span>}
              <input
                type="text"
                value={form.secondaryAssets.join(', ')}
                onChange={(e) => update('secondaryAssets', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
              />
            </label>
            <label>
              Color Direction (comma-separated)
              {form.fieldRationale.colorDirection && <span className="field-why"> — {form.fieldRationale.colorDirection}</span>}
              <input
                type="text"
                value={form.colorDirection.join(', ')}
                onChange={(e) => update('colorDirection', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
              />
            </label>
            <label>
              Commercial Goal
              {form.fieldRationale.commercialGoal && <span className="field-why"> — {form.fieldRationale.commercialGoal}</span>}
              <input type="text" value={form.commercialGoal} onChange={(e) => update('commercialGoal', e.target.value)} />
            </label>
            <label>
              Collection Size
              <input type="number" min={1} value={form.collectionSize} onChange={(e) => update('collectionSize', Math.max(1, Number(e.target.value)))} />
            </label>
            <label>
              Commercial Priority
              {form.fieldRationale.commercialPriority && <span className="field-why"> — {form.fieldRationale.commercialPriority}</span>}
              <select value={form.commercialPriority} onChange={(e) => update('commercialPriority', e.target.value as CommercialPriority)}>
                {COMMERCIAL_PRIORITY_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Expected Difficulty
              {form.fieldRationale.expectedDifficulty && <span className="field-why"> — {form.fieldRationale.expectedDifficulty}</span>}
              <select value={form.expectedDifficulty} onChange={(e) => update('expectedDifficulty', e.target.value as ExpectedDifficulty)}>
                {EXPECTED_DIFFICULTY_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Estimated Time (hours)
              {form.fieldRationale.estimatedTimeHours && <span className="field-why"> — {form.fieldRationale.estimatedTimeHours}</span>}
              <input type="number" min={0} value={form.estimatedTimeHours} onChange={(e) => update('estimatedTimeHours', Math.max(0, Number(e.target.value)))} />
            </label>
            <label className="brief-field-full">
              Commercial Notes
              <textarea value={form.commercialNotes} onChange={(e) => update('commercialNotes', e.target.value)} />
            </label>
          </div>

          {form.evidenceRefs.length > 0 && (
            <div className="brief-evidence">
              <strong>Evidence references</strong>
              <ul>
                {form.evidenceRefs.map((ref) => (
                  <li key={ref}>{ref}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="brief-actions">
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void handleSave()}>
              Save Brief
            </button>
            {STATUS_ACTIONS.map(([status, label]) => (
              <button key={status} type="button" className="btn" disabled={busy || form.status === status} onClick={() => void handleTransition(status)}>
                {label}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
