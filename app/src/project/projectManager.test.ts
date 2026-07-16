import { describe, it, expect } from 'vitest';
import { defaultParams } from '../engine/defaults';
import { generateCollection } from '../collection/collectionGenerator';
import {
  createProject,
  duplicateProject,
  renameProject,
  toggleFavorite,
  toggleArchive,
  addCollectionToProject,
  removeCollectionFromProject,
  setCollectionUploadStatus,
  setAssetSeoOverride,
  clearAssetSeoOverride,
  addSavedItemToProject,
  removeSavedItemFromProject,
  migrateLegacyDataIntoProject,
  normalizeProject,
  addDesignSpecToProject,
  addDesignSpecVersion,
  renameDesignSpecEntry,
  removeDesignSpecFromProject,
  removeDesignSpecVersion,
  LEGACY_PROJECT_NAME,
} from './projectManager';
import type { SavedItem } from '../components/SavedPanel';
import { buildDesignSpecification } from '../trend/designIntelligence';
import type { KeywordBundle } from '../trend/designSpecTypes';
import type { Project } from './projectTypes';

function makeBundle(overrides: Partial<KeywordBundle> = {}): KeywordBundle {
  return {
    primaryKeyword: 'Luxury Botanical',
    secondaryKeywords: ['Wallpaper'],
    marketplace: 'adobestock',
    season: 'spring',
    audience: 'editorial',
    commercialCategory: 'wallpaper',
    patternType: 'botanical',
    paletteDirection: 'muted green',
    difficulty: 'moderate',
    collectionSize: 8,
    ...overrides,
  };
}

describe('projectManager: Project CRUD', () => {
  it('creates a project with empty collections/savedItemIds/exportHistory', () => {
    const p = createProject('My Project');
    expect(p.name).toBe('My Project');
    expect(p.favorite).toBe(false);
    expect(p.archived).toBe(false);
    expect(p.collections).toEqual([]);
    expect(p.savedItemIds).toEqual([]);
    expect(p.exportHistory).toEqual([]);
  });

  it('duplicates a project with a new id and independent (non-shared-reference) arrays', () => {
    const p = createProject('Original');
    const withCollection = addCollectionToProject(p, generateCollection({ ...defaultParams(), seed: 'proj-dup' }));
    const dup = duplicateProject(withCollection);
    expect(dup.id).not.toBe(withCollection.id);
    expect(dup.name).toBe('Original (copy)');
    expect(dup.collections).toEqual(withCollection.collections);
    expect(dup.collections).not.toBe(withCollection.collections);
    expect(dup.favorite).toBe(false);
  });

  it('renames a project and bumps updatedAt', () => {
    const p = createProject('A');
    const renamed = renameProject(p, 'B');
    expect(renamed.name).toBe('B');
    expect(renamed.id).toBe(p.id);
  });

  it('toggles favorite and archived independently', () => {
    const p = createProject('A');
    const fav = toggleFavorite(p);
    expect(fav.favorite).toBe(true);
    expect(fav.archived).toBe(false);
    const archived = toggleArchive(fav);
    expect(archived.archived).toBe(true);
    expect(archived.favorite).toBe(true);
    const unarchived = toggleArchive(archived);
    expect(unarchived.archived).toBe(false);
  });
});

describe('projectManager: Collections', () => {
  it('adding a collection appends it and records exactly one export history entry', () => {
    const p = createProject('A');
    const collection = generateCollection({ ...defaultParams(), seed: 'proj-collection-1' });
    const next = addCollectionToProject(p, collection);
    expect(next.collections.length).toBe(1);
    expect(next.collections[0].collection.manifest.collectionId).toBe(collection.manifest.collectionId);
    expect(next.exportHistory.length).toBe(1);
    expect(next.exportHistory[0].collectionId).toBe(next.collections[0].id);
  });

  it('adding a second collection prepends it (newest first) and accumulates history', () => {
    const p = createProject('A');
    const c1 = generateCollection({ ...defaultParams(), seed: 'proj-collection-a' });
    const c2 = generateCollection({ ...defaultParams(), seed: 'proj-collection-b' });
    const withBoth = addCollectionToProject(addCollectionToProject(p, c1), c2);
    expect(withBoth.collections.length).toBe(2);
    expect(withBoth.collections[0].collection.manifest.collectionId).toBe(c2.manifest.collectionId);
    expect(withBoth.exportHistory.length).toBe(2);
  });

  it('removes a collection by its entry id without touching export history', () => {
    const p = createProject('A');
    const collection = generateCollection({ ...defaultParams(), seed: 'proj-collection-remove' });
    const withIt = addCollectionToProject(p, collection);
    const entryId = withIt.collections[0].id;
    const removed = removeCollectionFromProject(withIt, entryId);
    expect(removed.collections).toEqual([]);
    expect(removed.exportHistory.length).toBe(1);
  });

  it('sets upload status per site without disturbing other sites', () => {
    const p = createProject('A');
    const collection = generateCollection({ ...defaultParams(), seed: 'proj-upload-status' });
    const withIt = addCollectionToProject(p, collection);
    const entryId = withIt.collections[0].id;
    const updated = setCollectionUploadStatus(withIt, entryId, 'adobestock', 'uploaded');
    expect(updated.collections[0].uploadStatus.adobestock).toBe('uploaded');
    expect(updated.collections[0].uploadStatus.shutterstock).toBeUndefined();
    const updated2 = setCollectionUploadStatus(updated, entryId, 'shutterstock', 'rejected');
    expect(updated2.collections[0].uploadStatus.adobestock).toBe('uploaded');
    expect(updated2.collections[0].uploadStatus.shutterstock).toBe('rejected');
  });
});

describe('projectManager: Asset SEO storage (Project > Collection > Asset > SEO > {marketplace})', () => {
  function makeProjectWithCollection() {
    const p = createProject('A');
    const collection = generateCollection({ ...defaultParams(), seed: 'project-mgr-seo' });
    return { project: addCollectionToProject(p, collection), collection };
  }

  it('saves a marketplace override on the targeted asset only, without mutating the input project', () => {
    const { project, collection } = makeProjectWithCollection();
    const entryId = collection.manifest.collectionId;
    const assetId = collection.assets[0].id;
    const otherAssetId = collection.assets[1].id;

    const override = { title: 'Custom Adobe Stock Title', keywords: ['a', 'b'] };
    const updated = setAssetSeoOverride(project, entryId, assetId, 'adobestock', override);

    expect(project.collections[0].collection.assets[0].seo).toBeUndefined();

    const updatedAsset = updated.collections[0].collection.assets.find((a) => a.id === assetId)!;
    expect(updatedAsset.seo?.adobestock).toEqual(override);

    const otherAsset = updated.collections[0].collection.assets.find((a) => a.id === otherAssetId)!;
    expect(otherAsset.seo).toBeUndefined();
  });

  it('lets the same asset carry independent overrides for different marketplaces', () => {
    const { project, collection } = makeProjectWithCollection();
    const entryId = collection.manifest.collectionId;
    const assetId = collection.assets[0].id;

    let p = setAssetSeoOverride(project, entryId, assetId, 'shutterstock', { title: 'Shutterstock Title' });
    p = setAssetSeoOverride(p, entryId, assetId, 'etsy', { title: 'Etsy Title' });

    const asset = p.collections[0].collection.assets.find((a) => a.id === assetId)!;
    expect(asset.seo?.shutterstock?.title).toBe('Shutterstock Title');
    expect(asset.seo?.etsy?.title).toBe('Etsy Title');
  });

  it('overwrites a marketplace override when set again for the same asset', () => {
    const { project, collection } = makeProjectWithCollection();
    const entryId = collection.manifest.collectionId;
    const assetId = collection.assets[0].id;

    let p = setAssetSeoOverride(project, entryId, assetId, 'freepik', { title: 'First' });
    p = setAssetSeoOverride(p, entryId, assetId, 'freepik', { title: 'Second' });

    const asset = p.collections[0].collection.assets.find((a) => a.id === assetId)!;
    expect(asset.seo?.freepik?.title).toBe('Second');
  });

  it('clearAssetSeoOverride removes only the targeted marketplace, leaving others intact', () => {
    const { project, collection } = makeProjectWithCollection();
    const entryId = collection.manifest.collectionId;
    const assetId = collection.assets[0].id;

    let p = setAssetSeoOverride(project, entryId, assetId, 'shutterstock', { title: 'S' });
    p = setAssetSeoOverride(p, entryId, assetId, 'etsy', { title: 'E' });
    p = clearAssetSeoOverride(p, entryId, assetId, 'shutterstock');

    const asset = p.collections[0].collection.assets.find((a) => a.id === assetId)!;
    expect(asset.seo?.shutterstock).toBeUndefined();
    expect(asset.seo?.etsy?.title).toBe('E');
  });

  it('clearAssetSeoOverride on an asset with no seo store yet is a safe no-op', () => {
    const { project, collection } = makeProjectWithCollection();
    const entryId = collection.manifest.collectionId;
    const assetId = collection.assets[0].id;

    const p = clearAssetSeoOverride(project, entryId, assetId, 'shutterstock');
    const asset = p.collections[0].collection.assets.find((a) => a.id === assetId)!;
    expect(asset.seo).toBeUndefined();
  });

  it('backward compatibility: assets from freshly generated collections have no seo field until an override is saved', () => {
    const { collection } = makeProjectWithCollection();
    for (const asset of collection.assets) {
      expect(asset.seo).toBeUndefined();
    }
  });
});

describe('projectManager: Saved item references', () => {
  it('adds a saved item id without duplicating it', () => {
    const p = createProject('A');
    const once = addSavedItemToProject(p, 'saved-1');
    const twice = addSavedItemToProject(once, 'saved-1');
    expect(twice.savedItemIds).toEqual(['saved-1']);
  });

  it('removes a saved item id', () => {
    const p = addSavedItemToProject(createProject('A'), 'saved-1');
    const removed = removeSavedItemFromProject(p, 'saved-1');
    expect(removed.savedItemIds).toEqual([]);
  });
});

describe('projectManager: legacy migration', () => {
  it('creates a legacy project referencing every pre-existing saved item id', () => {
    const items: SavedItem[] = [
      { id: 's1', tileData: { params: defaultParams(), backgroundColor: '#fff', colors: [], svg: { tag: 'g', attrs: {}, children: [] } }, name: 'a', createdAt: 1, note: '', submissions: {} },
      { id: 's2', tileData: { params: defaultParams(), backgroundColor: '#fff', colors: [], svg: { tag: 'g', attrs: {}, children: [] } }, name: 'b', createdAt: 2, note: '', submissions: {} },
    ];
    const project = migrateLegacyDataIntoProject(items);
    expect(project.name).toBe(LEGACY_PROJECT_NAME);
    expect(project.savedItemIds).toEqual(['s1', 's2']);
    expect(project.collections).toEqual([]);
  });

  it('handles an empty saved library without error', () => {
    const project = migrateLegacyDataIntoProject([]);
    expect(project.savedItemIds).toEqual([]);
  });
});

describe('projectManager: normalizeProject (Design Workbench backward compatibility)', () => {
  it('fills in an empty designSpecs array for a record persisted before that field existed', () => {
    const legacy = { ...createProject('Old') } as Project;
    delete (legacy as Partial<Project>).designSpecs;
    expect(normalizeProject(legacy).designSpecs).toEqual([]);
  });

  it('leaves an already-normalized project untouched', () => {
    const project = createProject('A');
    expect(normalizeProject(project)).toEqual(project);
  });
});

describe('projectManager: Design Specification version history (Design Workbench Section 7)', () => {
  const spec = buildDesignSpecification({ keywordBundle: makeBundle(), trendPackId: '2026-Q1', createdAt: 1000 });

  it('addDesignSpecToProject creates a new entry with one version', () => {
    const project = addDesignSpecToProject(createProject('A'), 'Spring Botanical', spec);
    expect(project.designSpecs).toHaveLength(1);
    expect(project.designSpecs[0].name).toBe('Spring Botanical');
    expect(project.designSpecs[0].versions).toHaveLength(1);
    expect(project.designSpecs[0].versions[0].spec).toEqual(spec);
  });

  it('addDesignSpecVersion appends without dropping earlier versions', () => {
    let project = addDesignSpecToProject(createProject('A'), 'Spring Botanical', spec);
    const entryId = project.designSpecs[0].id;
    const editedSpec = { ...spec, density: 0.9 };
    project = addDesignSpecVersion(project, entryId, editedSpec, 'increased density');
    expect(project.designSpecs[0].versions).toHaveLength(2);
    expect(project.designSpecs[0].versions[0].spec).toEqual(spec);
    expect(project.designSpecs[0].versions[1].spec).toEqual(editedSpec);
    expect(project.designSpecs[0].versions[1].note).toBe('increased density');
  });

  it('renameDesignSpecEntry renames only the targeted entry', () => {
    let project = addDesignSpecToProject(createProject('A'), 'Draft 1', spec);
    project = addDesignSpecToProject(project, 'Draft 2', spec);
    const targetId = project.designSpecs[0].id;
    project = renameDesignSpecEntry(project, targetId, 'Final');
    expect(project.designSpecs[0].name).toBe('Final');
    expect(project.designSpecs[1].name).toBe('Draft 2');
  });

  it('removeDesignSpecFromProject removes the whole entry', () => {
    let project = addDesignSpecToProject(createProject('A'), 'Draft 1', spec);
    const targetId = project.designSpecs[0].id;
    project = removeDesignSpecFromProject(project, targetId);
    expect(project.designSpecs).toEqual([]);
  });

  it('removeDesignSpecVersion removes one version but never the last one', () => {
    let project = addDesignSpecToProject(createProject('A'), 'Draft 1', spec);
    const entryId = project.designSpecs[0].id;
    project = addDesignSpecVersion(project, entryId, { ...spec, density: 0.9 });
    expect(project.designSpecs[0].versions).toHaveLength(2);

    const firstVersionId = project.designSpecs[0].versions[0].id;
    project = removeDesignSpecVersion(project, entryId, firstVersionId);
    expect(project.designSpecs[0].versions).toHaveLength(1);

    const lastVersionId = project.designSpecs[0].versions[0].id;
    project = removeDesignSpecVersion(project, entryId, lastVersionId);
    expect(project.designSpecs[0].versions).toHaveLength(1); // refused — can't drop the last version
  });
});
