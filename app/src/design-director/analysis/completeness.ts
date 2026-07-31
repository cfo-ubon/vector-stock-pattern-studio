import type { CollectionPlan } from '../domain/collectionPlan';

// Build 028B — Module 4: Collection Completeness. Six real, inspectable
// checks against the Collection Plan's own already-set fields — nothing
// here is a fabricated percentage; every point lost maps to one named,
// explained gap.

export interface CompletenessCheck {
  id: string;
  label: string;
  passed: boolean;
  explanation: string;
}

export interface CollectionCompleteness {
  percent: number;
  checks: CompletenessCheck[];
  missing: string[];
  commercialReadiness: string;
}

export function computeCollectionCompleteness(plan: CollectionPlan): CollectionCompleteness {
  const counts = plan.patternTypeCounts;
  const checks: CompletenessCheck[] = [
    {
      id: 'hero',
      label: 'Missing Hero',
      passed: counts.hero >= 1,
      explanation: counts.hero >= 1 ? `${counts.hero} hero pattern(s) planned.` : 'No hero pattern planned — a collection needs one clear focal design.',
    },
    {
      id: 'blender',
      label: 'Missing Blender',
      passed: counts.blender >= 1,
      explanation: counts.blender >= 1 ? `${counts.blender} blender pattern(s) planned.` : 'No blender pattern planned — blenders let buyers mix prints without clashing.',
    },
    {
      id: 'border',
      label: 'Missing Border',
      passed: counts.border >= 1,
      explanation: counts.border >= 1 ? `${counts.border} border pattern(s) planned.` : 'No border pattern planned — needed for ribbon/edge/panel product formats.',
    },
    {
      id: 'colorway',
      label: 'Missing Colorway',
      passed: plan.colorwayCount >= 2,
      explanation: plan.colorwayCount >= 2 ? `${plan.colorwayCount} colorways planned.` : 'Only 1 colorway planned — most marketplaces expect multiple colorway options per collection.',
    },
    {
      id: 'coordinate',
      label: 'Missing Coordinate',
      passed: counts.coordinate >= 1,
      explanation: counts.coordinate >= 1 ? `${counts.coordinate} coordinate pattern(s) planned.` : 'No coordinate pattern planned — coordinates are what makes a set of prints read as one collection.',
    },
    {
      id: 'variation',
      label: 'Missing Variation',
      passed: counts.secondary + counts.miniPattern >= 2,
      explanation:
        counts.secondary + counts.miniPattern >= 2
          ? `${counts.secondary + counts.miniPattern} secondary/mini pattern(s) planned for variety.`
          : 'Too few secondary/mini patterns planned — buyers expect more than one supporting motif variation.',
    },
  ];

  const passedCount = checks.filter((c) => c.passed).length;
  const percent = Math.round((passedCount / checks.length) * 100);
  const missing = checks.filter((c) => !c.passed).map((c) => c.label);

  const commercialReadiness =
    percent >= 90 ? 'Ready for production' : percent >= 70 ? 'Nearly ready — a few gaps to close' : percent >= 40 ? 'In progress — significant gaps remain' : 'Early stage — plan needs substantial work';

  return { percent, checks, missing, commercialReadiness };
}
