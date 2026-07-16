import { describe, it, expect } from 'vitest';
import { h, serialize, computeBoundingBox } from './svgAst';
import { optimizeSvgTree, optimizeTileData } from './svgOptimizer';
import { countNodes, extractInstances } from './svgGeometry';
import { defaultParams } from './defaults';
import { buildTile } from './tile';
import type { LayoutId, SvgNode } from './types';

describe('svgOptimizer: redundant-group collapse', () => {
  it('collapses a transform-only wrapper <g> around a single <g> child into one node', () => {
    const tree = h('g', { transform: 'translate(10 20)' }, [h('g', {}, [h('path', { d: 'M 0 0 L 1 1' })])]);
    const { node, report } = optimizeSvgTree(tree);
    expect(report.groupsCollapsed).toBe(1);
    expect(report.nodesRemoved).toBe(1);
    expect(node.tag).toBe('g');
    expect(node.attrs?.transform).toBe('translate(10 20)');
    expect(node.children).toHaveLength(1);
    expect(node.children![0].tag).toBe('path');
  });

  it('concatenates both transforms (exact string composition, no reformatting) when both wrapper and child carry one', () => {
    const tree = h('g', { transform: 'translate(10 20) rotate(5) scale(1.2)' }, [
      h('g', { transform: 'rotate(-8)' }, [h('path', { d: 'M 0 0 L 1 1' })]),
    ]);
    const { node } = optimizeSvgTree(tree);
    expect(node.attrs?.transform).toBe('translate(10 20) rotate(5) scale(1.2) rotate(-8)');
  });

  it('does not collapse a group that carries an id (identity must never be dropped)', () => {
    const tree = h('g', { id: 'motif-1', transform: 'translate(10 20)' }, [h('g', {}, [h('path', { d: 'M 0 0 L 1 1' })])]);
    const { node, report } = optimizeSvgTree(tree);
    expect(report.groupsCollapsed).toBe(0);
    expect(node.attrs?.id).toBe('motif-1');
    expect(node.children![0].tag).toBe('g'); // inner g still present, untouched
  });

  it('does not collapse a group that carries data-role', () => {
    const tree = h('g', { transform: 'translate(1 1)', 'data-role': 'hero' }, [h('g', {}, [h('path', { d: 'M 0 0 Z' })])]);
    const { report } = optimizeSvgTree(tree);
    expect(report.groupsCollapsed).toBe(0);
  });

  it('does not collapse a wrapper with more than one child', () => {
    const tree = h('g', { transform: 'translate(1 1)' }, [h('g', {}, [h('path', { d: 'M 0 0 Z' })]), h('circle', { cx: 0, cy: 0, r: 1 })]);
    const { report } = optimizeSvgTree(tree);
    expect(report.groupsCollapsed).toBe(0);
  });

  it('does not collapse a wrapper whose single child is not a <g> (e.g. a bare path)', () => {
    const tree = h('g', { transform: 'translate(1 1)' }, [h('path', { d: 'M 0 0 Z' })]);
    const { report } = optimizeSvgTree(tree);
    expect(report.groupsCollapsed).toBe(0);
  });

  it('collapses recursively — a chain of 3 nested transform-only groups becomes 1 wrapping the path', () => {
    const tree = h('g', { transform: 'translate(1 0)' }, [
      h('g', { transform: 'translate(0 1)' }, [h('g', { transform: 'scale(2)' }, [h('path', { d: 'M 0 0 Z' })])]),
    ]);
    const { node, report } = optimizeSvgTree(tree);
    // 3 g's collapse pairwise into 1 (the innermost g-wrapping-a-path can't
    // collapse further since a <path> can't absorb a transform in this
    // design — see the module doc comment — so 2 collapses, not 3).
    expect(report.groupsCollapsed).toBe(2);
    expect(node.tag).toBe('g');
    expect(node.attrs?.transform).toBe('translate(1 0) translate(0 1) scale(2)');
    expect(node.children).toHaveLength(1);
    expect(node.children![0].tag).toBe('path');
  });
});

describe('svgOptimizer: no-op transform stripping', () => {
  it('removes a lone identity transform (rotate(0)) entirely', () => {
    const tree = h('g', { id: 'x', transform: 'rotate(0)' }, [h('path', { d: 'M 0 0 Z' })]);
    const { node, report } = optimizeSvgTree(tree);
    expect(report.transformsStripped).toBe(1);
    expect(node.attrs?.transform).toBeUndefined();
    expect(node.attrs?.id).toBe('x'); // other attrs untouched
  });

  it('leaves a genuinely non-identity transform alone', () => {
    const tree = h('g', { id: 'x', transform: 'rotate(45)' }, [h('path', { d: 'M 0 0 Z' })]);
    const { node, report } = optimizeSvgTree(tree);
    expect(report.transformsStripped).toBe(0);
    expect(node.attrs?.transform).toBe('rotate(45)');
  });
});

describe('svgOptimizer: never changes rendered geometry', () => {
  it('produces an identical bounding box before and after optimization for a synthetic tree', () => {
    const tree = h('g', {}, [
      h('g', { transform: 'translate(50 50)' }, [h('g', { transform: 'rotate(30)' }, [h('circle', { cx: 0, cy: 0, r: 10 })])]),
    ]);
    const before = computeBoundingBox(tree);
    const { node } = optimizeSvgTree(tree);
    const after = computeBoundingBox(node);
    expect(after.minX).toBeCloseTo(before.minX, 6);
    expect(after.maxX).toBeCloseTo(before.maxX, 6);
    expect(after.minY).toBeCloseTo(before.minY, 6);
    expect(after.maxY).toBeCloseTo(before.maxY, 6);
  });

  it('never mutates the input tree', () => {
    const original: SvgNode = h('g', { transform: 'translate(1 1)' }, [h('g', {}, [h('path', { d: 'M 0 0 Z' })])]);
    const snapshot = JSON.parse(JSON.stringify(original));
    optimizeSvgTree(original);
    expect(original).toEqual(snapshot);
  });
});

describe('svgOptimizer: on real generated output', () => {
  it('reduces node count on a real built tile without changing its rendered bounding box', () => {
    const params = { ...defaultParams(), categoryId: 'botanical', layoutId: 'grid' as LayoutId, seed: 'optimizer-real-1' };
    const tileData = buildTile(params);
    const before = computeBoundingBox(tileData.svg);
    const { tileData: optimized, report } = optimizeTileData(tileData);
    const after = computeBoundingBox(optimized.svg);

    expect(report.nodesAfter).toBeLessThanOrEqual(report.nodesBefore);
    expect(after.minX).toBeCloseTo(before.minX, 6);
    expect(after.maxX).toBeCloseTo(before.maxX, 6);
    expect(after.minY).toBeCloseTo(before.minY, 6);
    expect(after.maxY).toBeCloseTo(before.maxY, 6);
  });

  it('is deterministic — optimizing the same tile twice produces byte-identical output', () => {
    const params = { ...defaultParams(), categoryId: 'mandala', layoutId: 'radial' as LayoutId, seed: 'optimizer-real-2' };
    const tileData = buildTile(params);
    const a = optimizeTileData(tileData);
    const b = optimizeTileData(tileData);
    expect(serialize(a.tileData.svg)).toBe(serialize(b.tileData.svg));
  });

  it('reduces node count across every registered category (never increases it)', () => {
    const categories = ['geometric', 'botanical', 'organic', 'tropical', 'boho', 'mandala', 'damask', 'paisley', 'terrazzo'];
    for (const categoryId of categories) {
      const params = { ...defaultParams(), categoryId, layoutId: 'grid' as LayoutId, seed: `optimizer-cat-${categoryId}` };
      const tileData = buildTile(params);
      const nodesBefore = countNodes(tileData.svg);
      const { report } = optimizeTileData(tileData);
      expect(report.nodesBefore).toBe(nodesBefore);
      expect(report.nodesAfter).toBeLessThanOrEqual(nodesBefore);
    }
  });

  it('leaves the real wrap-instance transform format intact when the motif has no own transform (the common case), so extractInstances-style parsing still works', () => {
    const params = { ...defaultParams(), categoryId: 'geometric', layoutId: 'grid' as LayoutId, seed: 'optimizer-instances' };
    const tileData = buildTile(params);
    const instancesBefore = extractInstances(tileData);
    const { tileData: optimized } = optimizeTileData(tileData);
    const instancesAfter = extractInstances(optimized);
    // Position/rotation/scale/role parsing is unaffected by optimization —
    // `nodeCount` (Project Phoenix V2) is deliberately excluded from this
    // comparison: collapsing redundant wrapper `<g>`s is exactly what the
    // optimizer does, so a *lower* nodeCount after optimization is the
    // expected, correct outcome, not a regression.
    const strip = (instances: typeof instancesBefore) => instances.map(({ nodeCount: _nodeCount, ...rest }) => rest);
    expect(strip(instancesAfter)).toEqual(strip(instancesBefore));
    expect(instancesAfter.every((inst, i) => inst.nodeCount <= instancesBefore[i].nodeCount)).toBe(true);
  });
});
