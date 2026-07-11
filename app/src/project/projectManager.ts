import type { AssetSeoOverride, GeneratedCollection } from '../collection/collectionGenerator';
import type { StockSiteId } from '../metadata/shutterstock';
import type { MarketplaceId } from '../metadata/marketplaceProfiles';
import type { SavedItem } from '../components/SavedPanel';
import type { Project, ProjectCollectionEntry, ProjectExportHistoryEntry, ProjectMoodboardItem, UploadStatus } from './projectTypes';

// Project Manager — pure, DOM-free functions for every Project Manager
// action (Create/Open/Duplicate/Rename/Archive/Delete/Favorite is "Open"
// handled by App.tsx setting activeProjectId; nothing to compute), plus the
// one-time legacy-data migration. Every function returns a new object
// (never mutates its input) so callers can pass the result straight to
// storage/projectStore.ts's putProject and to setState — same immutable-
// update convention every other reducer-shaped helper in this app follows.

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createProject(name: string): Project {
  const now = Date.now();
  return {
    id: newId('project'),
    name,
    favorite: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    concept: '',
    styleDnaId: undefined,
    moodboard: [],
    notes: '',
    savedItemIds: [],
    collections: [],
    exportHistory: [],
  };
}

export function duplicateProject(project: Project): Project {
  const now = Date.now();
  return {
    ...project,
    id: newId('project'),
    name: `${project.name} (copy)`,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    // Collections/moodboard/exportHistory are copied by value (structural
    // clone via JSON, since they contain nested arrays/objects) so editing
    // the duplicate never mutates the original project's data.
    moodboard: project.moodboard.map((m) => ({ ...m })),
    collections: project.collections.map((c) => ({ ...c, uploadStatus: { ...c.uploadStatus } })),
    exportHistory: project.exportHistory.map((h) => ({ ...h })),
    savedItemIds: [...project.savedItemIds],
  };
}

export function renameProject(project: Project, name: string): Project {
  return { ...project, name, updatedAt: Date.now() };
}

export function toggleFavorite(project: Project): Project {
  return { ...project, favorite: !project.favorite, updatedAt: Date.now() };
}

export function toggleArchive(project: Project): Project {
  return { ...project, archived: !project.archived, updatedAt: Date.now() };
}

export function updateConcept(project: Project, concept: string): Project {
  return { ...project, concept, updatedAt: Date.now() };
}

export function updateNotes(project: Project, notes: string): Project {
  return { ...project, notes, updatedAt: Date.now() };
}

export function setProjectStyleDna(project: Project, styleDnaId: string | undefined): Project {
  return { ...project, styleDnaId, updatedAt: Date.now() };
}

export function addMoodboardItem(project: Project, item: Omit<ProjectMoodboardItem, 'id'>): Project {
  const entry: ProjectMoodboardItem = { ...item, id: newId('mood') };
  return { ...project, moodboard: [...project.moodboard, entry], updatedAt: Date.now() };
}

export function removeMoodboardItem(project: Project, itemId: string): Project {
  return { ...project, moodboard: project.moodboard.filter((m) => m.id !== itemId), updatedAt: Date.now() };
}

/** Adds a freshly generated Collection to the project and records one
 * Export History entry for it — the two are the same real event (a
 * Collection only ever enters a project by being generated/exported), so
 * they're appended together rather than via two separate call sites that
 * could drift out of sync. */
export function addCollectionToProject(project: Project, collection: GeneratedCollection): Project {
  const now = Date.now();
  const entry: ProjectCollectionEntry = {
    id: collection.manifest.collectionId,
    createdAt: now,
    collection,
    uploadStatus: {},
  };
  const historyEntry: ProjectExportHistoryEntry = {
    id: newId('export'),
    date: now,
    version: collection.manifest.schemaVersion,
    collectionId: entry.id,
    collectionName: collection.manifest.collectionName,
  };
  return {
    ...project,
    collections: [entry, ...project.collections],
    exportHistory: [historyEntry, ...project.exportHistory],
    updatedAt: now,
  };
}

export function removeCollectionFromProject(project: Project, collectionEntryId: string): Project {
  return {
    ...project,
    collections: project.collections.filter((c) => c.id !== collectionEntryId),
    updatedAt: Date.now(),
  };
}

export function setCollectionUploadStatus(
  project: Project,
  collectionEntryId: string,
  site: StockSiteId,
  status: UploadStatus,
): Project {
  return {
    ...project,
    collections: project.collections.map((c) =>
      c.id === collectionEntryId ? { ...c, uploadStatus: { ...c.uploadStatus, [site]: status } } : c,
    ),
    updatedAt: Date.now(),
  };
}

/** Maps a Project/Collection/Asset to its per-marketplace SEO override —
 * the "Project > Collection > Asset > SEO > {marketplace}" storage tree the
 * Marketplace Profile System spec asks for. Immutable-update, same
 * convention as `setCollectionUploadStatus`: only the targeted asset's
 * `seo` map gains/replaces the one marketplace entry, everything else in
 * the (possibly large) collection tree is reused by reference. */
export function setAssetSeoOverride(
  project: Project,
  collectionEntryId: string,
  assetId: string,
  marketplaceId: MarketplaceId,
  override: AssetSeoOverride,
): Project {
  return {
    ...project,
    collections: project.collections.map((c) =>
      c.id !== collectionEntryId
        ? c
        : {
            ...c,
            collection: {
              ...c.collection,
              assets: c.collection.assets.map((a) =>
                a.id === assetId ? { ...a, seo: { ...a.seo, [marketplaceId]: override } } : a,
              ),
            },
          },
    ),
    updatedAt: Date.now(),
  };
}

/** Removes one marketplace's saved override from an asset (reverting that
 * marketplace back to "use the generated default"). Leaves other
 * marketplaces' overrides on the same asset untouched. */
export function clearAssetSeoOverride(
  project: Project,
  collectionEntryId: string,
  assetId: string,
  marketplaceId: MarketplaceId,
): Project {
  return {
    ...project,
    collections: project.collections.map((c) =>
      c.id !== collectionEntryId
        ? c
        : {
            ...c,
            collection: {
              ...c.collection,
              assets: c.collection.assets.map((a) => {
                if (a.id !== assetId || !a.seo) return a;
                const seo = { ...a.seo };
                delete seo[marketplaceId];
                return { ...a, seo };
              }),
            },
          },
    ),
    updatedAt: Date.now(),
  };
}

export function addSavedItemToProject(project: Project, savedItemId: string): Project {
  if (project.savedItemIds.includes(savedItemId)) return project;
  return { ...project, savedItemIds: [...project.savedItemIds, savedItemId], updatedAt: Date.now() };
}

export function removeSavedItemFromProject(project: Project, savedItemId: string): Project {
  return { ...project, savedItemIds: project.savedItemIds.filter((id) => id !== savedItemId), updatedAt: Date.now() };
}

/** Default name for the auto-created project that adopts pre-existing
 * Saved Library items the first time the Project System runs — chosen so
 * "everything belongs to a Project" holds immediately, not just for data
 * created going forward, with nothing orphaned or silently dropped. */
export const LEGACY_PROJECT_NAME = 'คลังลายเดิม (ก่อนมี Project)';

/** Builds the one-time migration project for a user who already has Saved
 * Library items from before the Project System existed. Pure — doesn't
 * touch storage itself; the caller persists the result exactly like any
 * other new project. */
export function migrateLegacyDataIntoProject(savedItems: SavedItem[]): Project {
  const project = createProject(LEGACY_PROJECT_NAME);
  return { ...project, savedItemIds: savedItems.map((s) => s.id) };
}
