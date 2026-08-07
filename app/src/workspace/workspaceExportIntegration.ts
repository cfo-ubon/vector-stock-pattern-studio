import { isDesktopRuntime, writeBlobToWorkspace } from './workspaceApi';

/** Maps a real `MarketplaceProfile.id` (see `src/marketplaces/*.json`) to
 * the literal Marketplace subfolder name Part 10 of the deployment spec
 * requires (`Shutterstock/Adobe/Freepik/Getty/Etsy`). The spec names 5
 * folders including "Getty", which has no wired profile in this app —
 * that folder is still created by `initializeWorkspaceFolders` (Part 1),
 * it simply never receives a routed file. Marketplace profiles the spec
 * doesn't name (creativefabrica, creativemarket) get their own
 * capitalized subfolder rather than being dropped or merged into an
 * unrelated one. */
const MARKETPLACE_ID_TO_FOLDER: Record<string, string> = {
  shutterstock: 'Shutterstock',
  adobestock: 'Adobe',
  freepik: 'Freepik',
  etsy: 'Etsy',
};

export function folderForMarketplaceId(marketplaceId: string): string {
  return MARKETPLACE_ID_TO_FOLDER[marketplaceId] ?? marketplaceId.charAt(0).toUpperCase() + marketplaceId.slice(1);
}

/** Part 9/10: additive Workspace destination for the existing, unmodified
 * batch export ZIP flow (`exportAssetsAsZip`). The in-browser download
 * stays the primary path; this only writes a second copy into
 * `<Workspace>/Export/` when running desktop with a configured Workspace.
 * No-ops outside Electron. */
export async function saveExportToWorkspace(result: { blob: Blob; filename: string }): Promise<{ path: string; bytes: number } | null> {
  if (!isDesktopRuntime()) return null;
  return writeBlobToWorkspace(`Export/${result.filename}`, result.blob);
}

/** Part 9: additive Workspace destination for the existing, unmodified
 * Commercial Package Builder output (`buildCommercialPackage`), routed to
 * `<Workspace>/CommercialPackages/`. No-ops outside Electron. */
export async function saveCommercialPackageToWorkspace(result: { blob: Blob; filename: string }): Promise<{ path: string; bytes: number } | null> {
  if (!isDesktopRuntime()) return null;
  return writeBlobToWorkspace(`CommercialPackages/${result.filename}`, result.blob);
}

/** Part 10: additive Workspace destination for the existing, unmodified
 * Submission Package Builder output (`buildSubmissionPackage`), routed to
 * the matching `<Workspace>/Marketplace/<Site>/` subfolder by the real
 * `MarketplaceProfile.id` used to build it. No-ops outside Electron. */
export async function saveSubmissionPackageToWorkspace(
  marketplaceId: string,
  result: { blob: Blob; filename: string },
): Promise<{ path: string; bytes: number } | null> {
  if (!isDesktopRuntime()) return null;
  return writeBlobToWorkspace(`Marketplace/${folderForMarketplaceId(marketplaceId)}/${result.filename}`, result.blob);
}
