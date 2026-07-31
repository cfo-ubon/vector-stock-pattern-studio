import { useState } from 'react';
import type { DesignDirectorData } from './AIDesignDirectorView';
import type { CreativeBrief } from '../../design-director/domain/creativeBrief';
import type { CollectionPlan } from '../../design-director/domain/collectionPlan';
import type { GeneratorHandoff } from '../../design-director/domain/generatorHandoff';
import type { RecommendColorwayPlansResult } from '../../design-director/colorway/colorwayStrategist';
import { buildGeneratorHandoff } from '../../design-director/handoff/generatorHandoffBuilder';
import { putGeneratorHandoff } from '../../design-director/storage/generatorHandoffStore';

interface Props {
  data: DesignDirectorData;
  reload: () => Promise<void>;
  activeBrief: CreativeBrief | null;
  activePlan: CollectionPlan | null;
  activeHandoff: GeneratorHandoff | null;
  colorwayResult: RecommendColorwayPlansResult | null;
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

/** Section 11 — Generator Handoff. The one place that produces a real,
 * generator-ready configuration from the brief + plan — `buildGeneratorHandoff`
 * does the mapping, this component only renders the result and its audited
 * `mappingRationale` for every derived field. */
export function GeneratorHandoffTab({ data, reload, activeBrief, activePlan, activeHandoff, colorwayResult }: Props) {
  const [busy, setBusy] = useState(false);

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

  const versionCount = data.handoffs.filter((h) => h.collectionPlanId === activePlan.id).length;

  return (
    <div className="design-director-tab generator-handoff-tab">
      <h2>Generator Handoff</h2>
      <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void handleGenerate()}>
        {activeHandoff ? 'Regenerate Handoff Configuration' : 'Generate Handoff Configuration'}
      </button>

      {activeHandoff && (
        <>
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
    </div>
  );
}
