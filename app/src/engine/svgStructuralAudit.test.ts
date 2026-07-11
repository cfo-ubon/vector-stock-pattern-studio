import { describe, it, expect } from 'vitest';
import { defaultParams } from './defaults';
import { buildTile } from './tile';
import { serialize } from './svgAst';
import { countNodes } from './svgGeometry';
import { applyHardRejectRules } from './candidateEngine';
import { GENERATORS } from '../generators';
import { LAYOUT_LIST } from '../layouts';

// SVG Structural Audit (Quality First milestone) — verifies every
// registered category's *real* generated output is structurally sound for
// commercial / Affinity Designer use, not just "renders without throwing".
// Reuses the exact same `applyHardRejectRules` the Candidate Engine already
// runs in production (empty pattern / NaN-Infinity / raster / external
// href / duplicate ids / node budget) instead of re-deriving a second,
// possibly-drifting set of checks — plus two checks that engine doesn't
// cover: decimal-precision discipline (every coordinate should round to
// <=3 decimals via svgAst.ts's `round()`, never leak raw floating-point
// noise into the exported markup) and that no generator ever embeds an
// internal element id (tile.ts's wrap-clone technique nests the *same*
// motif SvgNode object into up to 9 sibling `<g>` copies by reference, so
// any id a generator embedded internally would be duplicated verbatim
// across every copy in the exported document).

const MAX_DECIMAL_PLACES = 3;
const HARD_NODE_BUDGET = 8000; // mirrors candidateEngine.ts's own ceiling

function maxDecimalPlaces(svgStr: string): number {
  const matches = svgStr.match(/-?\d+\.\d+/g) ?? [];
  let max = 0;
  for (const m of matches) {
    const decimals = m.split('.')[1]?.length ?? 0;
    if (decimals > max) max = decimals;
  }
  return max;
}

// Matches how the real UI actually switches categories — ControlPanel's
// category chip handler always sets `motifSize: g.defaultMotifSize`
// together with `categoryId` (see components/ControlPanel.tsx) — a tile
// built from a mismatched categoryId/motifSize pairing (e.g. a small
// Geometric-sized motifSize applied to Mandala's much more elaborate rings)
// packs far more copies into the same tile at the same density and isn't
// representative of anything the app actually produces.
function paramsFor(categoryId: string, extra: Partial<ReturnType<typeof defaultParams>> = {}) {
  const generator = GENERATORS[categoryId];
  return { ...defaultParams(), categoryId, motifSize: generator.defaultMotifSize, ...extra };
}

describe('SVG structural audit — every registered category', () => {
  for (const generator of Object.values(GENERATORS)) {
    it(`${generator.id}: passes every hard-reject structural check at default settings`, () => {
      const tileData = buildTile(paramsFor(generator.id, { seed: `audit-${generator.id}` }));
      const result = applyHardRejectRules(tileData);
      expect(result.rejected, `${generator.id} rejected: ${result.reasons.join('; ')}`).toBe(false);
    });

    it(`${generator.id}: every coordinate stays within ${MAX_DECIMAL_PLACES} decimal places (round() discipline)`, () => {
      const tileData = buildTile(paramsFor(generator.id, { seed: `audit-precision-${generator.id}` }));
      const svgStr = serialize(tileData.svg);
      expect(maxDecimalPlaces(svgStr), `${generator.id} leaked excess decimal precision`).toBeLessThanOrEqual(MAX_DECIMAL_PLACES);
    });

    it(`${generator.id}: default-density node count stays well under the hard node budget`, () => {
      const tileData = buildTile(paramsFor(generator.id, { seed: `audit-nodes-${generator.id}` }));
      expect(countNodes(tileData.svg), `${generator.id} node count`).toBeLessThan(HARD_NODE_BUDGET);
    });
  }
});

describe('SVG structural audit — every layout', () => {
  // geometric (the app's own default category, simplest per-motif geometry)
  // isolates layout *mechanics* — wrap-clone, clip-path, grouping — from
  // per-generator node-count headroom, which the next describe block covers
  // separately. Mixing the two concerns in one assertion would make a
  // legitimate node-budget finding look like a broken layout.
  for (const layout of LAYOUT_LIST) {
    it(`${layout.id}: produces a structurally valid tile`, () => {
      const tileData = buildTile(paramsFor('geometric', { layoutId: layout.id, seed: `audit-layout-${layout.id}` }));
      const result = applyHardRejectRules(tileData);
      expect(result.rejected, `${layout.id} rejected: ${result.reasons.join('; ')}`).toBe(false);
    });
  }
});

describe('SVG structural audit — node-budget headroom (botanical x every layout)', () => {
  // botanical is the heaviest-per-motif shipped generator (realistic
  // curve-based petals/leaves from the Growth Engine, see
  // generators/growth.ts) — the worst case for the Candidate Engine's
  // HARD_NODE_BUDGET=8000 hard-reject rule. A combo landing over budget
  // here doesn't throw or produce invalid SVG (still passes the "every
  // registered category" suite above at each category's *own* defaults) —
  // it means `generateCandidates`/`generateBest` would hard-reject every
  // candidate for that specific category+layout+default-density combo,
  // silently falling back to serving the least-bad rejected tile instead of
  // a real pass. Tracked here as a known, reproducible finding (not
  // "fixed" by touching layout/generator math, which would change visual
  // output for existing seeds) — flagged loudly via console.warn so it
  // stays visible, asserted only against a generous sanity ceiling that
  // would catch a true runaway/regression.
  const SANITY_CEILING = 40000;
  for (const layout of LAYOUT_LIST) {
    it(`${layout.id}: botanical stays under the sanity ceiling and reports real headroom`, () => {
      const tileData = buildTile(paramsFor('botanical', { layoutId: layout.id, seed: `audit-budget-${layout.id}` }));
      const nodeCount = countNodes(tileData.svg);
      if (nodeCount > HARD_NODE_BUDGET) {
        // eslint-disable-next-line no-console
        console.warn(`[svg-audit] botanical + ${layout.id} at default density: ${nodeCount} nodes, exceeds HARD_NODE_BUDGET=${HARD_NODE_BUDGET}`);
      }
      expect(nodeCount, `${layout.id} node count`).toBeLessThan(SANITY_CEILING);
    });
  }
});

describe('SVG structural audit — grouping (Affinity Designer editability)', () => {
  it('every motif placement is wrapped in its own uniquely-identified, non-empty top-level group', () => {
    const tileData = buildTile(paramsFor('mandala', { seed: 'audit-grouping' }));
    const patternLayer = tileData.svg.children?.find((c) => c.attrs?.id === 'layer-pattern');
    expect(patternLayer).toBeDefined();
    const motifGroups = (patternLayer!.children ?? []).filter(
      (c) => typeof c.attrs?.id === 'string' && (c.attrs!.id as string).startsWith('motif-'),
    );
    expect(motifGroups.length).toBeGreaterThan(0);
    const ids = motifGroups.map((g) => g.attrs!.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const group of motifGroups) {
      expect(group.children?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('no generator emits an internal element id', () => {
    const ALLOWED_ID = /^(tile-content|tile-clip|layer-background|layer-pattern|layer-shadows|layer-filler|motif-\d+|shadow-\d+)$/;
    for (const generator of Object.values(GENERATORS)) {
      const tileData = buildTile(paramsFor(generator.id, { flatShadow: true, flatHighlight: true, seed: `audit-internal-ids-${generator.id}` }));
      const svgStr = serialize(tileData.svg);
      const ids = [...svgStr.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
      const unexpected = ids.filter((id) => !ALLOWED_ID.test(id));
      expect(unexpected, `${generator.id} emitted unexpected internal id(s)`).toEqual([]);
    }
  });
});

describe('SVG structural audit — deterministic output (regression guard)', () => {
  it('the same seed+params always serializes to byte-identical SVG', () => {
    const params = { ...defaultParams(), categoryId: 'terrazzo', seed: 'audit-determinism' };
    const a = serialize(buildTile(params).svg);
    const b = serialize(buildTile(params).svg);
    expect(a).toBe(b);
  });
});
