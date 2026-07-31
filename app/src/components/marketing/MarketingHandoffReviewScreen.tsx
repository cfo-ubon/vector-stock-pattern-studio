import { useState } from 'react';
import type { MarketingHandoffApplication, MarketingHandoffField } from '../../design-director/handoff/buildMarketingHandoffApplication';
import { ConfidenceBadge } from './evidenceDisplay';

interface Props {
  application: MarketingHandoffApplication;
  onConfirm: (fields: MarketingHandoffField[]) => void;
  onCancel: () => void;
}

const SOURCE_LABELS: Record<string, string> = {
  marketOpportunity: 'From Market Opportunity',
  marketSnapshot: 'From Market Snapshot',
  dailyMission: 'From Daily Mission',
  marketGap: 'From Market Gap',
  userOverride: 'User Override',
  generatorDefault: 'Generator Default',
};

const STATUS_LABELS: Record<string, string> = {
  provided: 'Provided',
  needsUserDecision: 'Needs User Decision',
  notSupportedByEvidence: 'Not Supported by Evidence',
  notProvided: 'Not Provided',
};

const ARRAY_FIELD_KEYS = new Set(['targetProducts', 'palette']);

function toEditableText(value: unknown): string {
  return Array.isArray(value) ? value.join(', ') : (value ?? '') as string;
}

/** Build 028C, requirement #4/#5 — the Handoff Review screen shown before
 * saving anything, for the Marketing -> Creative Director workflow. Every
 * row shows source/confidence/evidence/an editable value/a lock toggle
 * (mirroring the established Generator Handoff review screen's checkbox
 * convention from Build 028B Hardening, extended here with a real text
 * editor per field and a visible missing-data status badge). Editing a
 * field's value marks its provenance as 'userOverride' — the review
 * screen's own honest signal that this value no longer traces back to the
 * original marketing evidence. */
export function MarketingHandoffReviewScreen({ application, onConfirm, onCancel }: Props) {
  const [fields, setFields] = useState<MarketingHandoffField[]>(application.fields);

  const handleToggleLock = (key: string) => {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, locked: !f.locked } : f)));
  };

  const handleEditValue = (key: string, text: string) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.key !== key) return f;
        const value = ARRAY_FIELD_KEYS.has(key) ? text.split(',').map((s) => s.trim()).filter(Boolean) : text;
        return { ...f, value, displayValue: text || '—', source: 'userOverride' };
      }),
    );
  };

  return (
    <div className="marketing-handoff-review" role="dialog" aria-label="Review before sending to Creative Director">
      <h3>Review — Send to Creative Director</h3>
      <p className="marketing-handoff-review-intro">
        Every field below shows where its value came from and how confident that value is. Uncheck "Apply" to lock a field at its default (it will not
        be included in the Creative Brief draft). Edit any value directly — an edited field is marked "User Override".
      </p>
      <div className="marketing-handoff-review-table-wrap">
        <table className="marketing-handoff-review-table">
          <thead>
            <tr>
              <th>Apply</th>
              <th>Field</th>
              <th>Value</th>
              <th>Source</th>
              <th>Confidence</th>
              <th>Evidence</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.key}>
                <td>
                  <input type="checkbox" checked={!field.locked} onChange={() => handleToggleLock(field.key)} aria-label={`Apply ${field.label}`} />
                </td>
                <td>{field.label}</td>
                <td>
                  <input
                    type="text"
                    value={toEditableText(field.value)}
                    onChange={(e) => handleEditValue(field.key, e.target.value)}
                    disabled={field.locked}
                    aria-label={`${field.label} value`}
                  />
                </td>
                <td>{SOURCE_LABELS[field.source] ?? field.source}</td>
                <td>
                  <ConfidenceBadge confidence={field.confidence} />
                </td>
                <td>{field.evidence.join('; ') || '—'}</td>
                <td>{field.status === 'provided' ? STATUS_LABELS.provided : <span className="marketing-handoff-status-flag">{STATUS_LABELS[field.status]}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="marketing-handoff-review-actions">
        <button type="button" className="btn btn--primary" onClick={() => onConfirm(fields)}>
          Send to Creative Director
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
