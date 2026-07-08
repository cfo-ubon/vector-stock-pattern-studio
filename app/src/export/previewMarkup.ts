import type { TileData } from '../engine/types';
import { serialize } from '../engine/svgAst';
import { namespaceIds } from './svgExporter';

/** Build the inner markup for a live preview using a native SVG <pattern>
 * element: the tile content is defined once and the browser's own renderer
 * repeats it `repeat` x `repeat` times. This is the most reliable way to
 * visually confirm seamlessness — any edge mismatch in the tile content
 * shows up immediately as a visible seam, with zero extra tiling logic on
 * our side to get wrong.
 *
 * `instanceId` must be unique among every preview markup mounted on the
 * page at once (main canvas + every gallery thumbnail): SVG ids are
 * document-global, not scoped to their own <svg>, so without namespacing
 * every instance would resolve `url(#tile-pattern)` to whichever
 * <pattern id="tile-pattern"> happens to appear first in the DOM. */
export function buildPreviewMarkup(tileData: TileData, repeat: number, instanceId: string): string {
  const { tileSize } = tileData.params;
  const content = namespaceIds(tileData.svg, instanceId);
  const patternId = `tile-pattern-${instanceId}`;
  const patternDef = `<defs><pattern id="${patternId}" width="${tileSize}" height="${tileSize}" patternUnits="userSpaceOnUse">${serialize(
    content,
  )}</pattern></defs>`;
  const rect = `<rect x="0" y="0" width="${tileSize * repeat}" height="${tileSize * repeat}" fill="url(#${patternId})" />`;
  return patternDef + rect;
}
