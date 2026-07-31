import type { CollectionPlan } from '../../design-director/domain/collectionPlan';
import { buildCollectionRoadmap, totalRoadmapHours } from '../../design-director/roadmap/collectionRoadmap';

interface Props {
  activePlan: CollectionPlan | null;
}

/** Section 3 — Collection Roadmap. Purely renders `buildCollectionRoadmap`'s
 * output — no step ordering or hour estimate is computed in this file. */
export function RoadmapTab({ activePlan }: Props) {
  if (!activePlan) {
    return (
      <div className="design-director-tab roadmap-tab">
        <p>Create a Collection Plan first (see the Collection Planner tab).</p>
      </div>
    );
  }

  const steps = buildCollectionRoadmap(activePlan);

  return (
    <div className="design-director-tab roadmap-tab">
      <h2>Production Roadmap — {activePlan.name}</h2>
      <p>Total estimated time: {totalRoadmapHours(steps)}h</p>
      <ol className="roadmap-steps">
        {steps.map((step) => (
          <li key={step.order} className="roadmap-step">
            <strong>Step {step.order}: {step.label}</strong>
            <span className="roadmap-step-hours"> — est. {step.estimatedHours}h</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
