import * as path from 'node:path';

// Security utilities shared by every IPC handler that touches the file
// system. The renderer never gets a raw filesystem handle — every path
// this app writes to comes from an OS-native `dialog.showSaveDialog`/
// `showOpenDialog` result the main process itself requested, never a
// bare string supplied by the renderer, so there is no directory-
// traversal surface here to defend against in the first place. These
// helpers exist for the one case that does need them: sanitizing a
// content-derived filename before it's offered as the dialog's default,
// and validating file extensions against an explicit allowlist.
//
// Forward-ported from `codex/offline-windows-desktop`'s
// `electron/security/paths.ts` — genuinely reusable as-is, since none of
// it depended on the old `.vsps`/SQLite architecture. Only
// `ALLOWED_EXPORT_EXTENSIONS` changed, to swap `.vsps` for `.vspsb`.

const RESERVED_WINDOWS_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

/** Strips path separators and Windows-reserved characters/names from a
 * filename the app derived from pattern/backup content. Never throws;
 * always returns a usable filename. */
export function sanitizeFilename(name: string, fallback = 'untitled'): string {
  let cleaned = name
    .replace(/[<>:"/\\|?* -]/g, '_')
    .replace(/\.+$/, '')
    .trim();
  if (!cleaned) cleaned = fallback;
  const base = cleaned.split('.')[0].toUpperCase();
  if (RESERVED_WINDOWS_NAMES.has(base)) cleaned = `_${cleaned}`;
  return cleaned.slice(0, 200);
}

/** Resolves `candidate` against `baseDir` and rejects anything that
 * escapes it (path traversal via `../` or an absolute path pointing
 * elsewhere). Used to double-check an OS dialog's own result lands where
 * expected before writing — belt-and-suspenders, not the primary
 * defense (the primary defense is that renderer-supplied paths are never
 * trusted for writes at all). */
export function resolveWithinBase(baseDir: string, candidate: string): string | null {
  const resolvedBase = path.resolve(baseDir);
  const resolved = path.resolve(resolvedBase, candidate);
  const rel = path.relative(resolvedBase, resolved);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) return resolved;
  return null;
}

export const ALLOWED_EXPORT_EXTENSIONS = new Set(['.svg', '.eps', '.png', '.jpg', '.jpeg', '.json', '.zip', '.csv', '.vspsb']);

export function hasAllowedExtension(filePath: string): boolean {
  return ALLOWED_EXPORT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}
