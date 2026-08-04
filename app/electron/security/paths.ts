import * as path from 'node:path';

// Security utilities shared by every IPC handler that touches the file
// system. The renderer never gets a raw filesystem handle — every path the
// renderer supplies (a folder to write into, a file to read back) is
// validated here before any `fs` call happens in the main process. Ported
// from the established pattern in `codex/offline-windows-desktop`'s
// `electron/security/paths.ts` (same file-system trust-boundary problem —
// letting the renderer supply free-form paths into `fs` calls — applies
// here unchanged); reused near-verbatim since it is pure `node:path` logic
// with zero coupling to that branch's SQLite/.vsps project format.

const RESERVED_WINDOWS_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

/** Strips path separators and Windows-reserved characters/names from a
 * filename or folder name. Never throws; always returns a usable name. */
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
 * escapes it (path traversal via `../`, an absolute path pointing
 * elsewhere). Returns the resolved absolute path, or `null` if it escapes.
 * Every Workspace read/write IPC handler must route through this before
 * touching `fs` — it is the one thing standing between "renderer asks to
 * write to Backups/foo.vspsb" and "renderer asks to write to
 * ~/.ssh/authorized_keys". */
export function resolveWithinBase(baseDir: string, candidate: string): string | null {
  const resolvedBase = path.resolve(baseDir);
  const resolved = path.resolve(resolvedBase, candidate);
  const rel = path.relative(resolvedBase, resolved);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) return resolved;
  return null;
}

export const ALLOWED_WORKSPACE_EXTENSIONS = new Set(['.svg', '.eps', '.png', '.jpg', '.json', '.zip', '.csv', '.vspsb', '.txt', '.sha256']);

export function hasAllowedExtension(filePath: string): boolean {
  return ALLOWED_WORKSPACE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}
