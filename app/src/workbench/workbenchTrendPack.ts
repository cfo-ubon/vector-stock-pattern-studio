import type { DesignSpecification } from '../trend/designSpecTypes';
import type { TrendPack } from '../trend/trendPacks';

// Design Workbench Section 9 ("Import Trend Pack") support. The shipped
// engine's `trend/designIntelligence.ts` only resolves a Trend Pack by id
// against its own fixed `TREND_PACKS` record (keyword-signal resolution,
// palette/style matching, the works) — there's no seam to feed it an
// arbitrary imported pack without changing that engine code, which this
// milestone must not do. This module instead applies an imported pack's
// *own* fields directly onto an already-built spec — a plain, literal
// field mapping (not a re-run of keyword/signal resolution), so an
// imported Trend Pack is still genuinely usable in the Workbench without
// touching trend/designIntelligence.ts.

export function applyTrendPackToSpec(spec: DesignSpecification, pack: TrendPack): DesignSpecification {
  return {
    ...spec,
    trend: { trendPackId: pack.id, theme: pack.theme, mood: pack.mood },
    styleDnaId: pack.styleDnaId,
    composition: pack.compositionStyle,
    negativeSpace: pack.negativeSpace,
    colorRoles: { ...pack.colorRoles },
  };
}
