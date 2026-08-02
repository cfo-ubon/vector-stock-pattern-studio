import type { FactoryTask, FactoryTaskType } from '../factory/domain/types';
import type { Opportunity, OpportunityType } from './domain/types';

// Mission 2, Part 5 — Opportunity Finder. Every opportunity is READY
// work that already exists in the queue — never a recommendation to
// generate anything new (that would require Decision OS's own
// `generate`/`resumeExistingWork` support, which this module never
// calls). Sorted by count descending, the only real, non-fabricated
// ordering available without inventing a business-value estimate.

const OPPORTUNITY_DEFINITIONS: { type: OpportunityType; taskType: FactoryTaskType; title: string }[] = [
  { type: 'FINISH_SEO', taskType: 'seo', title: 'Finish SEO' },
  { type: 'COMPLETE_COLLECTION', taskType: 'collectionCompletion', title: 'Complete Collection' },
  { type: 'REPAIR_READY_ITEMS', taskType: 'repair', title: 'Repair READY Items' },
  { type: 'PACKAGE_EXISTING_WORK', taskType: 'package', title: 'Package Existing Work' },
  { type: 'EXPORT_READY_PACKAGES', taskType: 'exportValidation', title: 'Export Existing READY Packages' },
];

export function findOpportunities(tasks: FactoryTask[]): Opportunity[] {
  const opportunities: Opportunity[] = [];

  for (const def of OPPORTUNITY_DEFINITIONS) {
    const ready = tasks.filter((t) => t.type === def.taskType && t.status === 'READY');
    if (ready.length === 0) continue;
    opportunities.push({
      type: def.type,
      title: def.title,
      reason: `${ready.length} ${def.taskType} task(s) are READY to run right now.`,
      taskIds: ready.map((t) => t.id),
      count: ready.length,
    });
  }

  return opportunities.sort((a, b) => b.count - a.count);
}
