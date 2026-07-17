import type { SourceFileReference } from '../domain/types';

// Sprint P1, Section 9 (Thumbnail and Preview Rules) — priority order:
// 1. a provided preview PNG/JPG, 2. the SVG itself (browsers render an SVG
// document natively from a blob URL — no rasterization step needed, so
// "safely rendered SVG" is just "display the file"), 3. anything else
// previewable (falls through to whatever raster/vector file exists), 4. a
// file-type placeholder (the UI's job when `previewReference` is null).
// Never touches file bytes — pure selection over already-known roles.

const PREVIEW_ROLE_PRIORITY: SourceFileReference['role'][] = ['preview', 'png', 'jpg', 'svg', 'eps', 'ai'];

export function selectPreviewReference(refs: SourceFileReference[]): string | null {
  for (const role of PREVIEW_ROLE_PRIORITY) {
    const found = refs.find((r) => r.role === role);
    if (found) return found.fileId;
  }
  return null;
}
