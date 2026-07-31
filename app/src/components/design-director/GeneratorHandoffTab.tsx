import { useEffect, useMemo, useState } from 'react';
import type { DesignDirectorData } from './AIDesignDirectorView';
import type { CreativeBrief } from '../../design-director/domain/creativeBrief';
import type { CollectionPlan } from '../../design-director/domain/collectionPlan';
import type { GeneratorHandoff } from '../../design-director/domain/generatorHandoff';
import type { MarketOpportunity } from '../../marketing/domain/marketOpportunity';
import type { RecommendColorwayPlansResult } from '../../design-director/colorway/colorwayStrategist';
import type { MappedGeneratorField, GeneratorHandoffApplication } from '../../design-director/handoff/applyGeneratorHandoff';
import { buildGeneratorHandoff } from '../../design-director/handoff/generatorHandoffBuilder';
import { buildGeneratorHandoffApplication } from '../../design-director/handoff/applyGeneratorHandoff';
import { putGeneratorHandoff } from '../../design-director/storage/generatorHandoffStore';
import { listBackupHistory } from '../../backup/appBackupHistoryStore';

interface Props {
  data: DesignDirectorData;
  reload: () => Promise<void>;
  activeBrief: CreativeBrief | null;
  activePlan: CollectionPlan | null;
  activeHandoff: GeneratorHandoff | null;
  activeOpportunity: MarketOpportunity | null;
  colorwayResult: RecommendColorwayPlansResult | null;
  /** Applies the reviewer-approved subset of mapped fields onto the real
   * editor's current `GenerateParams`, builds a fresh tile from them, and
   * switches the app to the editor view — owned by `App.tsx` since it's
   * the only place holding the live editor state this handoff merges
   * onto (never overwriting a field the reviewer excluded/"locked"). */
  onSendToGenerator: (application: GeneratorHandoffApplication, selectedFields: MappedGeneratorField[]) => void;
}

const FIELD_LABELS: Record<string, string> = {
  heroMotif: 'Hero motif',
  categoryId: 'Category',
  composition: 'Composition',
  density: 'Density',
  scale: 'Scale',
  spacing: 'Spacing',
  complexity: 'Complexity',
  palette: 'Palette',
  colorwayPlan: 'Colorway plan',
};

const SOURCE_LABELS: Record<string, string> = {
  marketOpportunity: 'From Market Opportunity',
  creativeBrief: 'From Creative Brief',
  collectionPlan: 'From Collection Plan',
  userOverride: 'User Override',
  generatorDefault: 'Generator Default',
};

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString();
}

/** Section 11 — Generator Handoff. `buildGeneratorHandoff` produces the
 * audited configuration; this component renders it, then (Build 028B
 * Hardening) offers "ส่งไปยังตัวสร้างลวดลาย" (Send to Pattern Generator) —
 * a review screen built by `buildGeneratorHandoffApplication` showing
 * every real generator field this handoff maps to (with provenance +
 * rationale) plus every field it honestly can't map, before anything is
 * applied. Also surfaces Backup Protected / Ready-for-Generator /
 * Generated status so the collection's real persistence state is visible
 * without leaving this tab. */
export function GeneratorHandoffTab({ data, reload, activeBrief, activePlan, activeHandoff, activeOpportunity, colorwayResult, onSendToGenerator }: Props) {
  const [busy, setBusy] = useState(false);
  const [reviewApplication, setReviewApplication] = useState<GeneratorHandoffApplication | null>(null);
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set());
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listBackupHistory().then((history) => {
      if (cancelled) return;
      const successful = history.filter((h) => h.result === 'success');
      setLastBackupAt(successful.length > 0 ? Math.max(...successful.map((h) => h.createdAt)) : null);
    });
    return () => {
      cancelled = true;
    };
  }, [data]);

  const backupProtected = useMemo(() => {
    if (!activeHandoff || lastBackupAt === null) return false;
    return lastBackupAt >= activeHandoff.createdAt;
  }, [activeHandoff, lastBackupAt]);

  if (!activeBrief || !activePlan) {
    return (
      <div className="design-director-tab generator-handoff-tab">
        <p>Create a Collection Plan first (see the Collection Planner tab).</p>
      </div>
    );
  }

  const handleGenerate = async () => {
    setBusy(true);
    try {
      const handoff = buildGeneratorHandoff(activeBrief, activePlan, colorwayResult?.plans ?? []);
      await putGeneratorHandoff(handoff);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const handleOpenReview = () => {
    if (!activeHandoff) return;
    const application = buildGeneratorHandoffApplication(activeHandoff, activeBrief, activePlan, activeOpportunity);
    setReviewApplication(application);
    setExcludedKeys(new Set());
  };

  const handleToggleField = (key: string) => {
    setExcludedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleConfirmApply = async () => {
    if (!reviewApplication || !activeHandoff) return;
    const selectedFields = reviewApplication.mappedFields.filter((f) => !excludedKeys.has(f.key));
    onSendToGenerator(reviewApplication, selectedFields);
    await putGeneratorHandoff({ ...activeHandoff, lastAppliedAt: Date.now() });
    await reload();
    setReviewApplication(null);
  };

  const versionCount = data.handoffs.filter((h) => h.collectionPlanId === activePlan.id).length;

  return (
    <div className="design-director-tab generator-handoff-tab">
      <h2>Generator Handoff</h2>
      <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void handleGenerate()}>
        {activeHandoff ? 'Regenerate Handoff Configuration' : 'Generate Handoff Configuration'}
      </button>

      {activeHandoff && (
        <>
          <dl className="handoff-status">
            <div>
              <dt>Configuration status</dt>
              <dd>Ready for Generator</dd>
            </div>
            <div>
              <dt>Generation status</dt>
              <dd>{activeHandoff.lastAppliedAt ? `Generated — last sent ${formatTimestamp(activeHandoff.lastAppliedAt)}` : 'Not Generated'}</dd>
            </div>
            <div>
              <dt>Backup status</dt>
              <dd>{backupProtected ? 'Backup Protected' : 'Not Yet Backed Up'}</dd>
            </div>
            <div>
              <dt>Source provenance</dt>
              <dd>
                {activeOpportunity ? `Market Opportunity "${activeOpportunity.title}" → ` : ''}
                Creative Brief "{activeBrief.collectionName}" → Collection Plan "{activePlan.name}" → this Generator Handoff
              </dd>
            </div>
          </dl>

          <button type="button" className="btn" onClick={handleOpenReview}>
            ส่งไปยังตัวสร้างลวดลาย (Send to Pattern Generator)
          </button>

          <dl className="handoff-fields">
            <div>
              <dt>{FIELD_LABELS.heroMotif}</dt>
              <dd>
                {activeHandoff.heroMotif}
                {activeHandoff.mappingRationale.heroMotif && <span className="field-why"> — {activeHandoff.mappingRationale.heroMotif}</span>}
              </dd>
            </div>
            <div>
              <dt>Secondary motifs</dt>
              <dd>{activeHandoff.secondaryMotifs.join(', ') || '—'}</dd>
            </div>
            <div>
              <dt>Pattern type</dt>
              <dd>{activeHandoff.patternType}</dd>
            </div>
            <div>
              <dt>{FIELD_LABELS.categoryId}</dt>
              <dd>
                {activeHandoff.categoryId}
                {activeHandoff.mappingRationale.categoryId && <span className="field-why"> — {activeHandoff.mappingRationale.categoryId}</span>}
              </dd>
            </div>
            <div>
              <dt>{FIELD_LABELS.composition}</dt>
              <dd>
                {activeHandoff.composition}
                {activeHandoff.mappingRationale.composition && <span className="field-why"> — {activeHandoff.mappingRationale.composition}</span>}
              </dd>
            </div>
            <div>
              <dt>{FIELD_LABELS.density}</dt>
              <dd>
                {activeHandoff.density}
                {activeHandoff.mappingRationale.density && <span className="field-why"> — {activeHandoff.mappingRationale.density}</span>}
              </dd>
            </div>
            <div>
              <dt>{FIELD_LABELS.scale}</dt>
              <dd>
                {activeHandoff.scale}
                {activeHandoff.mappingRationale.scale && <span className="field-why"> — {activeHandoff.mappingRationale.scale}</span>}
              </dd>
            </div>
            <div>
              <dt>{FIELD_LABELS.spacing}</dt>
              <dd>
                {activeHandoff.spacing}
                {activeHandoff.mappingRationale.spacing && <span className="field-why"> — {activeHandoff.mappingRationale.spacing}</span>}
              </dd>
            </div>
            <div>
              <dt>{FIELD_LABELS.complexity}</dt>
              <dd>
                {activeHandoff.complexity}
                {activeHandoff.mappingRationale.complexity && <span className="field-why"> — {activeHandoff.mappingRationale.complexity}</span>}
              </dd>
            </div>
            <div>
              <dt>{FIELD_LABELS.palette}</dt>
              <dd>
                <div className="colorway-swatches">
                  {activeHandoff.palette.map((c, i) => (
                    <span key={i} className="colorway-swatch" style={{ background: c }} title={c} />
                  ))}
                </div>
              </dd>
            </div>
            <div>
              <dt>{FIELD_LABELS.colorwayPlan}</dt>
              <dd>{activeHandoff.colorwayPlan.join(', ') || '—'}</dd>
            </div>
            <div>
              <dt>Commercial notes</dt>
              <dd>{activeHandoff.commercialNotes || '—'}</dd>
            </div>
            <div>
              <dt>Generator version</dt>
              <dd>{activeHandoff.generatorVersion}</dd>
            </div>
            <div>
              <dt>Seed strategy</dt>
              <dd>{activeHandoff.seedStrategy}</dd>
            </div>
          </dl>
          {versionCount > 1 && <p className="handoff-version-note">{versionCount} handoff versions saved for this plan — the most recent is shown.</p>}
        </>
      )}

      {reviewApplication && (
        <div className="handoff-review" role="dialog" aria-label="Review before sending to Pattern Generator">
          <h3>Review — Send to Pattern Generator</h3>
          <p className="handoff-review-intro">
            Uncheck any field you want to keep at its current editor value (locked). Every checked field below will overwrite that field in the editor.
          </p>
          <table className="handoff-review-table">
            <thead>
              <tr>
                <th>Apply</th>
                <th>Field</th>
                <th>Value</th>
                <th>Provenance</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {reviewApplication.mappedFields.map((field) => (
                <tr key={field.key}>
                  <td>
                    <input
                      type="checkbox"
                      checked={!excludedKeys.has(field.key)}
                      onChange={() => handleToggleField(field.key)}
                      aria-label={`Apply ${field.label}`}
                    />
                  </td>
                  <td>{field.label}</td>
                  <td>{field.displayValue}</td>
                  <td>{SOURCE_LABELS[field.source] ?? field.source}</td>
                  <td>{field.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {reviewApplication.unmappedNotes.length > 0 && (
            <>
              <h4>Reference only — not applied to any generator field</h4>
              <ul className="handoff-unmapped-list">
                {reviewApplication.unmappedNotes.map((note) => (
                  <li key={note.label}>
                    <strong>{note.label}:</strong> {note.value} <span className="field-why">— {note.note}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="handoff-review-actions">
            <button type="button" className="btn btn--primary" onClick={() => void handleConfirmApply()}>
              Apply to Generator
            </button>
            <button type="button" className="btn" onClick={() => setReviewApplication(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
