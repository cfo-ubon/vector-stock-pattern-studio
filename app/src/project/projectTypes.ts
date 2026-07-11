import type { GeneratedCollection } from '../collection/collectionGenerator';
import type { StockSiteId } from '../metadata/shutterstock';

// Project Studio Engine — everything the app produces (Concept, Moodboard,
// Style DNA, Collections, Assets, Metadata/SEO, Export History, Upload
// Status, Notes) now lives inside a Project. A Project is the persisted
// envelope; Collections/assets/metadata inside it are the same real data
// every other engine module already produces (GeneratedCollection from
// collection/collectionGenerator.ts, SavedItem from storage/savedStore.ts)
// — this module doesn't reinvent that data, it just gives it a durable home.

export type UploadStatus = 'ready' | 'uploaded' | 'pending' | 'rejected';

export interface ProjectMoodboardItem {
  id: string;
  /** Hex color swatch or a short reference note — kept lightweight (no
   * image upload) to match the app's "everything runs in your browser, no
   * external calls" scope; a color/note board is enough to capture design
   * intent without adding file-storage-size concerns to IndexedDB. */
  color?: string;
  note: string;
}

/** One Collection, generated via collection/collectionGenerator.ts and
 * persisted here (previously, pre-Project-System, a Collection existed
 * only in ephemeral React state and vanished on refresh). Upload status is
 * tracked per stock site directly on the collection, since a whole
 * collection is what gets batch-submitted to a site. */
export interface ProjectCollectionEntry {
  id: string;
  createdAt: number;
  collection: GeneratedCollection;
  uploadStatus: Partial<Record<StockSiteId, UploadStatus>>;
}

export interface ProjectExportHistoryEntry {
  id: string;
  date: number;
  /** The collection's own manifest schema version at the time it was
   * generated (collection/collectionGenerator.ts's COLLECTION_SCHEMA_VERSION)
   * — a real value, not a separate app-version label that could drift from
   * what was actually produced. */
  version: number;
  collectionId: string;
  collectionName: string;
}

export interface Project {
  id: string;
  name: string;
  favorite: boolean;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  /** Free-text design brief. */
  concept: string;
  styleDnaId?: string;
  moodboard: ProjectMoodboardItem[];
  notes: string;
  /** References into storage/savedStore.ts's IndexedDB-backed Saved
   * Library — a Project doesn't duplicate saved patterns, it just tracks
   * which ones belong to it (the Saved Library itself is unchanged). */
  savedItemIds: string[];
  collections: ProjectCollectionEntry[];
  exportHistory: ProjectExportHistoryEntry[];
}

/** Schema version for the exported Project JSON file — independent of
 * COLLECTION_SCHEMA_VERSION (a Project can contain collections generated
 * under different collection-schema versions over its lifetime). */
export const PROJECT_SCHEMA_VERSION = 1;

export interface ProjectExport {
  schemaVersion: number;
  exportedAt: number;
  project: Project;
}
