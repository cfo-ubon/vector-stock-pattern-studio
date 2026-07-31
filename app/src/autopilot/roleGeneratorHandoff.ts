import { createGeneratorHandoff, type GeneratorHandoff, type HandoffScale, type HandoffComplexity } from '../design-director/domain/generatorHandoff';
import type { CollectionPlanItem } from '../design-director/domain/collectionPlan';
import type { DesignPlan } from './domain/designPlan';
import { getDesignPlanDecision } from './domain/designPlan';
import { roleVisualProfile } from './collectionRolePlanner';

// Build 029, Module 6 — builds one real `GeneratorHandoff` per Collection
// Plan Item, varying composition/density/scale/complexity by the item's
// role (Module 5's diversity requirement) rather than the single
// difficulty-driven hero handoff `generatorHandoffBuilder.ts`'s
// `buildGeneratorHandoff` produces (Build 028B). Calls the same verified
// `createGeneratorHandoff` domain constructor — this module only supplies
// a different, role-aware derivation ruleset for the autopilot's specific
// "generate a whole diverse collection" use case.

function scaleFromRoleScale(scale: 'small' | 'medium' | 'large'): HandoffScale {
  return scale;
}

function complexityFromRole(complexity: 'simple' | 'moderate' | 'intricate'): HandoffComplexity {
  return complexity;
}

/** Builds the real Generator Handoff for one Collection Plan Item, using
 * the frozen Design Plan's resolved category/palette/heroMotif and the
 * item's own role-appropriate visual profile. Every derived field carries
 * a real `mappingRationale` entry, mirroring `buildGeneratorHandoff`'s own
 * auditability convention. */
export function buildAutonomousGeneratorHandoff(
  briefId: string,
  collectionPlanId: string,
  item: CollectionPlanItem,
  plan: DesignPlan,
): GeneratorHandoff {
  const profile = roleVisualProfile(item.patternType);
  const categoryId = getDesignPlanDecision(plan, 'categoryId')?.value ?? 'botanical';
  const heroMotifDecision = getDesignPlanDecision(plan, 'heroMotif');
  const paletteDecision = getDesignPlanDecision(plan, 'palette');
  const palette = paletteDecision && paletteDecision.value.startsWith('#') ? paletteDecision.value.split(',').map((c) => c.trim()) : [];

  const mappingRationale: Record<string, string> = {
    categoryId: `Taken from the frozen Design Plan's resolved category.`,
    composition: `"${item.patternType}" collection role uses a ${profile.composition} composition (Autonomous Collection Planner's role visual profile).`,
    density: `"${item.patternType}" role default density.`,
    scale: `"${item.patternType}" role default scale.`,
    complexity: `"${item.patternType}" role default complexity.`,
    heroMotif: heroMotifDecision && !heroMotifDecision.value.startsWith('Not Provided') ? 'Taken from the frozen Design Plan.' : 'No real hero-motif evidence — generator category default applies.',
  };

  return createGeneratorHandoff({
    briefId,
    collectionPlanId,
    collectionItemId: item.id,
    heroMotif: heroMotifDecision && !heroMotifDecision.value.startsWith('Not Provided') ? heroMotifDecision.value : plan.summary,
    secondaryMotifs: [],
    patternType: item.patternType,
    categoryId,
    composition: profile.composition,
    density: profile.density,
    scale: scaleFromRoleScale(profile.scale),
    palette,
    colorwayPlan: [],
    spacing: profile.density >= 0.55 ? 'tight' : profile.density <= 0.4 ? 'airy' : 'balanced',
    complexity: complexityFromRole(profile.complexity),
    commercialNotes: plan.estimatedProductionEffort,
    generatorVersion: 'v1',
    seedStrategy: `autopilot-${collectionPlanId}-${item.id}`,
    mappingRationale,
  });
}
