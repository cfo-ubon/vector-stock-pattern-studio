import type { AssetSeoOverride, GeneratedCollection } from '../collection/collectionGenerator';
import { buildTile } from '../engine/tile';
import type { StockSiteId } from '../metadata/shutterstock';
import type { MarketplaceId } from '../metadata/marketplaceProfiles';
import type { SavedItem } from '../components/SavedPanel';
import type {
  Project,
  ProjectCollectionEntry,
  ProjectDesignSpecEntry,
  ProjectExportHistoryEntry,
  ProjectMoodboardItem,
  UploadStatus,
} from './projectTypes';
import type { DesignSpecification } from '../trend/designSpecTypes';

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
    designSpecs: [],
  };
}

/** Fills in fields added to `Project` (or to a nested `GeneratedCollection`
 * a Project stores) after the record could already have been persisted —
 * `designSpecs` (Design Workbench) and each collection's `patternTiles`
 * (Commercial Collection Engine Phase 4) — with a real, correctly-derived
 * default rather than an empty placeholder. Every loader (`storage/
 * projectStore.ts`'s `loadProjects`, `project/projectJson.ts`'s import)
 * runs records through this before they reach app state, so the rest of
 * the codebase can treat every field as always-present per the `Project`/
 * `GeneratedCollection` types instead of re-checking for `undefined` at
 * every call site — collection/collectionScore.ts's Layout/Motif Shape
 * Diversity dimensions rely on this for collections saved before
 * `patternTiles` existed. */
export function normalizeProject(project: Project): Project {
  return {
    ...project,
    designSpecs: project.designSpecs ?? [],
    collections: project.collections.map((entry) => ({
      ...entry,
      collection: {
        ...entry.collection,
        // A pre-Phase-4 persisted collection has no `patternTiles` field at
        // all (old data, not an empty array) — rebuild it from the
        // `patternParams` every collection has always carried, via the
        // same pure `buildTile` the generator itself uses. This recovers
        // the 5 core pattern tiles exactly; it cannot recover a Background
        // Texture that was never generated for that older collection,
        // which is the correct, honest outcome (nothing to recover).
        patternTiles: entry.collection.patternTiles ?? entry.collection.patternParams.map((p) => buildTile(p)),
      },
    })),
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
    designSpecs: project.designSpecs.map((e) => ({ ...e, versions: e.versions.map((v) => ({ ...v })) })),
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

/** Creates a new Design Spec entry (Design Workbench Section 7) inside the
 * project, seeded with one version. */
export function addDesignSpecToProject(project: Project, name: string, spec: DesignSpecification, note?: string): Project {
  const now = Date.now();
  const entry: ProjectDesignSpecEntry = {
    id: newId('designspec'),
    name,
    createdAt: now,
    updatedAt: now,
    versions: [{ id: newId('dsver'), savedAt: now, note, spec }],
  };
  return { ...project, designSpecs: [...project.designSpecs, entry], updatedAt: now };
}

/** Appends a new version to an existing Design Spec entry — the entry's
 * full edit history stays intact (Section 6/7's "Snapshot" + "Maintain
 * version history"), nothing is overwritten in place. */
export function addDesignSpecVersion(project: Project, entryId: string, spec: DesignSpecification, note?: string): Project {
  const now = Date.now();
  return {
    ...project,
    designSpecs: project.designSpecs.map((entry) =>
      entry.id === entryId
        ? { ...entry, updatedAt: now, versions: [...entry.versions, { id: newId('dsver'), savedAt: now, note, spec }] }
        : entry,
    ),
    updatedAt: now,
  };
}

export function renameDesignSpecEntry(project: Project, entryId: string, name: string): Project {
  const now = Date.now();
  return {
    ...project,
    designSpecs: project.designSpecs.map((entry) => (entry.id === entryId ? { ...entry, name, updatedAt: now } : entry)),
    updatedAt: now,
  };
}

export function removeDesignSpecFromProject(project: Project, entryId: string): Project {
  return { ...project, designSpecs: project.designSpecs.filter((entry) => entry.id !== entryId), updatedAt: Date.now() };
}

/** Removes one version from an entry's history. Refuses to remove an
 * entry's last remaining version (use `removeDesignSpecFromProject`
 * instead) so an entry can never end up with an empty `versions` array. */
export function removeDesignSpecVersion(project: Project, entryId: string, versionId: string): Project {
  const now = Date.now();
  return {
    ...project,
    designSpecs: project.designSpecs.map((entry) =>
      entry.id === entryId && entry.versions.length > 1
        ? { ...entry, updatedAt: now, versions: entry.versions.filter((v) => v.id !== versionId) }
        : entry,
    ),
    updatedAt: now,
  };
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
