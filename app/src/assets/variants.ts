import type { SvgNode, Rng } from '../engine/types';
import { createRng } from '../engine/rng';
import { countNodes } from '../engine/svgGeometry';
import { applyHeroDetailOverlay } from '../engine/heroComplexity';
import { adjustLightness, adjustSaturation } from '../palettes/colorTransform';
import { buildAsset } from './extraction';
import type { Asset, AssetVariantType } from './types';

// Asset Ecosystem Engine (Phase 9) — Section 4 "Asset Variants". Every
// variant is a presentation-level transform walking an asset's already-
// real `SvgNode` tree (rewriting fill/stroke/opacity attributes, or —
// for `minimal`/`detailed` — pruning/adding nodes) — never a re-run of
// any generator's shape-drawing logic. `detailed` specifically reuses
// `engine/heroComplexity.ts`'s real detail-overlay builder (Project
// Phoenix V2) instead of inventing a second "add more detail" primitive.
// `vintage` reuses `palettes/colorTransform.ts`'s real HSL math instead
// of hand-rolling a sepia formula.

const COMPLEXITY_NODE_CEILING = 60;

function cloneWithAttrs(node: SvgNode, transform: (attrs: Record<string, string | number>) => Record<string, string | number>): SvgNode {
  return {
    tag: node.tag,
    attrs: transform({ ...(node.attrs ?? {}) }),
    children: (node.children ?? []).map((c) => cloneWithAttrs(c, transform)),
  };
}

function toOutline(node: SvgNode): SvgNode {
  return cloneWithAttrs(node, (attrs) => {
    const next = { ...attrs };
    const source = typeof next.fill === 'string' && next.fill !== 'none' ? next.fill : typeof next.stroke === 'string' ? next.stroke : '#000000';
    next.stroke = source;
    next.fill = 'none';
    if (next['stroke-width'] === undefined) next['stroke-width'] = 2;
    return next;
  });
}

function toFilled(node: SvgNode): SvgNode {
  return cloneWithAttrs(node, (attrs) => {
    const next = { ...attrs };
    if (!next.fill || next.fill === 'none') next.fill = typeof next.stroke === 'string' ? next.stroke : '#000000';
    delete next.stroke;
    delete next['stroke-width'];
    return next;
  });
}

/** Prunes each group to its first `maxChildren` children, recursively —
 * a real, structural complexity reduction (fewer real nodes, not a
 * cosmetic simplification), so the recomputed complexity score genuinely
 * drops for a "minimal" variant rather than just looking sparser. */
function toMinimal(node: SvgNode, maxChildren = 3): SvgNode {
  return {
    tag: node.tag,
    attrs: node.attrs ? { ...node.attrs } : undefined,
    children: (node.children ?? []).slice(0, maxChildren).map((c) => toMinimal(c, maxChildren)),
  };
}

function toBold(node: SvgNode): SvgNode {
  return cloneWithAttrs(node, (attrs) => {
    const next = { ...attrs };
    const current = typeof next['stroke-width'] === 'number' ? next['stroke-width'] : typeof next['stroke-width'] === 'string' ? parseFloat(next['stroke-width']) : 0;
    next['stroke-width'] = Math.max(current * 1.8, 3);
    if (!next.stroke && typeof next.fill === 'string' && next.fill !== 'none') next.stroke = next.fill;
    return next;
  });
}

function toMonoline(node: SvgNode, color: string): SvgNode {
  return cloneWithAttrs(node, (attrs) => ({ ...attrs, fill: 'none', stroke: color, 'stroke-width': 2.5 }));
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function toVintage(node: SvgNode): SvgNode {
  return cloneWithAttrs(node, (attrs) => {
    const next = { ...attrs };
    for (const key of ['fill', 'stroke'] as const) {
      const v = next[key];
      if (typeof v === 'string' && HEX_RE.test(v)) next[key] = adjustLightness(adjustSaturation(v, -35), -12);
    }
    return next;
  });
}

function complexityFromNode(node: SvgNode): number {
  return Math.round(Math.max(0, Math.min(100, (countNodes(node) / COMPLEXITY_NODE_CEILING) * 100)));
}

const VARIANT_LABELS: Record<AssetVariantType, string> = {
  outline: 'Outline', filled: 'Filled', minimal: 'Minimal', detailed: 'Detailed', bold: 'Bold', monoline: 'Monoline', vintage: 'Vintage',
};

/** Produces a brand-new `Asset` (new id, `version` bumped) whose geometry
 * is a real transform of the source asset's real node tree — never
 * mutates the source asset in place, matching every other engine's
 * "patches produce a new record" discipline. */
export function applyVariant(asset: Asset, type: AssetVariantType, rng?: Rng): Asset {
  let node: SvgNode;
  switch (type) {
    case 'outline':
      node = toOutline(asset.node);
      break;
    case 'filled':
      node = toFilled(asset.node);
      break;
    case 'minimal':
      node = toMinimal(asset.node);
      break;
    case 'detailed': {
      const colors = asset.metadata.colorRoles.length > 0 ? asset.metadata.colorRoles : ['#000000', '#666666'];
      // Forced to 'hero' regardless of the source asset's own role — a
      // "Detailed" variant request is explicitly asking for the highest
      // real detail tier `heroComplexity.ts` supports, which would be a
      // no-op for a filler/accent role otherwise.
      node = applyHeroDetailOverlay(asset.node, { role: 'hero', radius: asset.radius, colors }, rng ?? createRng(`variant-detailed::${asset.metadata.id}`));
      break;
    }
    case 'bold':
      node = toBold(asset.node);
      break;
    case 'monoline':
      node = toMonoline(asset.node, asset.metadata.colorRoles[0] ?? '#000000');
      break;
    case 'vintage':
      node = toVintage(asset.node);
      break;
  }

  return buildAsset({
    id: `${asset.metadata.id}::variant::${type}`,
    name: `${asset.metadata.name} — ${VARIANT_LABELS[type]}`,
    kind: asset.metadata.kind,
    family: asset.metadata.family,
    role: asset.metadata.role,
    categoryId: asset.metadata.categoryId,
    styleDnaId: asset.metadata.styleDnaId,
    complexity: complexityFromNode(node),
    node,
    width: asset.width,
    height: asset.height,
    radius: asset.radius,
    sourceCollectionId: asset.metadata.sourceCollectionId,
    sourceMotifIds: asset.metadata.sourceMotifIds,
    colorRoles: asset.metadata.colorRoles,
    version: asset.metadata.version + 1,
  });
}
