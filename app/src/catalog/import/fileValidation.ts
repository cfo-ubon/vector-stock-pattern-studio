import type { SourceFileRole } from '../domain/types';
import { extensionOf } from './basenameGrouping';

// Sprint P1, Section 5, step 1 (Validate file type).

const EXTENSION_TO_ROLE: Record<string, SourceFileRole> = {
  svg: 'svg',
  json: 'json',
  eps: 'eps',
  ai: 'ai',
  png: 'png',
  jpg: 'jpg',
  jpeg: 'jpg',
};

const EXTENSION_TO_MIME: Record<string, string> = {
  svg: 'image/svg+xml',
  json: 'application/json',
  eps: 'application/postscript',
  ai: 'application/postscript',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

/** A recognized-but-generic design file (anything not in the map above,
 * e.g. `.cdr`/`.pdf`/`.psd`) is still importable — it lands with role
 * `'other'` and gets stored byte-for-byte like everything else, it just
 * can't drive metadata extraction or serve as a preview. Only genuinely
 * inappropriate file types for a stock-vector catalog (executables,
 * scripts, archives — never a design source) are rejected outright. */
export function classifyFile(filename: string): { role: SourceFileRole; mimeType: string } {
  const ext = extensionOf(filename);
  const role = EXTENSION_TO_ROLE[ext] ?? 'other';
  const mimeType = EXTENSION_TO_MIME[ext] ?? 'application/octet-stream';
  return { role, mimeType };
}

const UNSUPPORTED_EXTENSIONS = new Set(['exe', 'sh', 'bat', 'cmd', 'dll', 'js', 'ts', 'msi', 'app', 'zip', 'rar', '7z']);

export function isUnsupportedFileType(filename: string): boolean {
  return UNSUPPORTED_EXTENSIONS.has(extensionOf(filename));
}
