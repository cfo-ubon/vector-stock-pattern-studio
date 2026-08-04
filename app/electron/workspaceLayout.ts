// Production Workspace folder taxonomy (Production Deployment Phase 1,
// Part 1). Single source of truth for what a Workspace root contains — the
// renderer never hardcodes this list; it asks `workspace:initialize` to
// create it and gets the real folder names back in the response.
//
// Domain mapping (confirmed against the existing, unmodified app code
// before writing this list — see PRODUCTION_WORKSPACE.md's "domain
// mapping" table for the file-level citations):
//   Portfolio          -> destination for portfolio asset exports (mirrors
//                          the existing `portfolioAssets`/`portfolioFiles`
//                          IndexedDB stores; IndexedDB stays the live data
//                          store, this is an export/backup destination).
//   CommercialPackages  -> `commercial/packageBuilder.ts` ZIP output.
//   Marketplace/<Site>  -> per-marketplace submission/export history.
//   Export              -> generic batch/single-asset export output.
//   Backups             -> `.vspsb` archives from `backup/appBackupBuilder.ts`.
//   Releases            -> this mission's own installer/portable build output.
//   Application         -> installed-app metadata (version, install date).
//   Logs                -> Electron main-process log file.
//   Archive             -> user-managed overflow/cold storage, app never
//                          writes here automatically.
export const WORKSPACE_MARKETPLACE_FOLDERS = ['Shutterstock', 'Adobe', 'Freepik', 'Getty', 'Etsy'] as const;

export const WORKSPACE_TOP_LEVEL_FOLDERS = [
  'Application',
  'Portfolio',
  'CommercialPackages',
  'Marketplace',
  'Export',
  'Backups',
  'Releases',
  'Logs',
  'Archive',
] as const;

/** Every folder `workspace:initialize` creates, relative to the Workspace
 * root, in creation order (top-level folders first, then the marketplace
 * subfolders nested under `Marketplace/`). */
export function listWorkspaceFolders(): string[] {
  const folders: string[] = [...WORKSPACE_TOP_LEVEL_FOLDERS];
  for (const site of WORKSPACE_MARKETPLACE_FOLDERS) folders.push(`Marketplace/${site}`);
  return folders;
}

export const WORKSPACE_MANIFEST_FILENAME = '.ai-sbos-workspace.json';

export interface WorkspaceManifest {
  schemaVersion: 1;
  createdAt: string;
  lastVerifiedAt: string;
  appVersion: string;
}
