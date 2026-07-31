import { describe, it, expect } from 'vitest';
import { buildTile } from '../../engine/tile';
import { defaultParams } from '../../engine/defaults';
import { buildSingleTileSvg } from '../../export/svgExporter';
import { buildGeneratorHandoffApplication, applyMappedFieldsToParams } from './applyGeneratorHandoff';
import { createCreativeBrief } from '../domain/creativeBrief';
import { createCollectionPlan } from '../domain/collectionPlan';
import { createGeneratorHandoff } from '../domain/generatorHandoff';

// Build 028B Hardening — traceability requirement: a pattern generated via
// "ส่งไปยังตัวสร้างลวดลาย" must retain its full lineage (Market Snapshot ID,
// Market Opportunity ID, Design Brief ID, Collection Plan ID, Collection
// Item ID, Generator Handoff ID, configuration, seed, generator version,
// creation time) through reload / IndexedDB persistence / .vspsb backup
// and restore. `GenerateParams.sourceLineage` (engine/types.ts) is the one
// place this lives — it rides inside `GenerateParams` deliberately, so it
// survives everywhere params already do (a project's saved patterns, a
// Portfolio asset's JSON sidecar, and therefore the Application Backup
// System) with zero new persistence code. This file verifies that
// assumption holds at the two real points where it could silently break:
// (1) `buildTile` genuinely threads the same `params` object (with its
// lineage) through into the returned `TileData`, and (2) the lineage
// survives a real JSON.stringify/parse round trip — the exact operation
// `svgExporter`'s JSON sidecar and `catalog/import/jsonCompat.ts` both
// perform.

describe('GenerateParams.sourceLineage traceability', () => {
  it('buildTile preserves sourceLineage unchanged in the returned TileData.params', () => {
    const brief = createCreativeBrief({ collectionName: 'Christmas Botanical', theme: 'christmas botanical', sourceOpportunityId: 'OPP-1', now: 1 });
    const plan = createCollectionPlan({
      briefId: brief.id,
      name: 'Plan',
      theme: 'christmas botanical',
      totalSize: 5,
      patternTypeCounts: { hero: 1, secondary: 1, blender: 1, stripe: 1, border: 1, coordinate: 0, miniPattern: 0, texture: 0 },
      now: 2,
    });
    const handoff = createGeneratorHandoff({ briefId: brief.id, collectionPlanId: plan.id, heroMotif: 'Poinsettia', categoryId: 'botanical', now: 3 });
    const application = buildGeneratorHandoffApplication(handoff, brief, plan, null);
    const params = applyMappedFieldsToParams(defaultParams(), application.mappedFields, application.lineage);

    const tileData = buildTile(params);
    expect(tileData.params.sourceLineage).toEqual(application.lineage);
    expect(tileData.params.sourceLineage?.designBriefId).toBe(brief.id);
    expect(tileData.params.sourceLineage?.collectionPlanId).toBe(plan.id);
    expect(tileData.params.sourceLineage?.generatorHandoffId).toBe(handoff.id);

    // The SVG export path (the JSON sidecar callers actually persist)
    // still produces real, valid SVG content — the new field is inert to
    // the export pipeline, not a schema break.
    const svg = buildSingleTileSvg(tileData);
    expect(svg.length).toBeGreaterThan(0);
  });

  it('survives a real JSON.stringify/parse round trip (the exact operation the JSON sidecar and portfolio import perform)', () => {
    const brief = createCreativeBrief({ collectionName: 'Spring Florals', theme: 'spring florals', now: 10 });
    const plan = createCollectionPlan({
      briefId: brief.id,
      name: 'Plan',
      theme: 'spring florals',
      totalSize: 5,
      patternTypeCounts: { hero: 1, secondary: 1, blender: 1, stripe: 1, border: 1, coordinate: 0, miniPattern: 0, texture: 0 },
      now: 11,
    });
    const handoff = createGeneratorHandoff({ briefId: brief.id, collectionPlanId: plan.id, heroMotif: 'Tulip', categoryId: 'botanical', now: 12 });
    const application = buildGeneratorHandoffApplication(handoff, brief, plan, null);
    const params = applyMappedFieldsToParams(defaultParams(), application.mappedFields, application.lineage);

    const roundTripped = JSON.parse(JSON.stringify(params));
    expect(roundTripped.sourceLineage).toEqual(application.lineage);
  });

  it('leaves sourceLineage undefined for every pattern generated the normal way (no fabrication)', () => {
    const tileData = buildTile(defaultParams());
    expect(tileData.params.sourceLineage).toBeUndefined();
  });
});
