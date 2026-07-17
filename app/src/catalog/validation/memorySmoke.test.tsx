import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { Blob as NodeBlob } from 'node:buffer';
import { CollectionDetailPanel } from '../../components/portfolio/CollectionDetailPanel';
import { createCollection } from '../domain/collection';
import { createPortfolioAsset } from '../domain/asset';
import { putPortfolioAssetsBulk, clearPortfolioStores, importAssetTransaction } from '../storage/portfolioStore';
import { clearCollectionsStore } from '../storage/collectionStore';
import type { PortfolioAsset, PortfolioFileRecord } from '../domain/types';
import { MemorySampler, trackBlobUrlLifecycle } from './memoryInstrumentation';

// Portfolio Manager P2.5 Sprint 1, Section 8's "bounded memory smoke
// test": mounts/unmounts a real, bounded Collection page (20 members,
// each with a real — but tiny — preview Blob) repeatedly, exercising the
// exact same `PortfolioThumbnail` -> `usePreviewUrl` Blob-URL
// create/revoke lifecycle a real browsing session would, and confirms
// the create/revoke counters return to zero after every unmount (i.e.
// the existing cleanup `useEffect` returns actually run). No production
// hook is modified to make this observable — `trackBlobUrlLifecycle`
// only wraps the global `URL.createObjectURL`/`revokeObjectURL`.

const MEMBER_COUNT = 20; // small and bounded, per the brief's "bounded" requirement
const MOUNT_CYCLES = 5;

async function seedBoundedCollection(): Promise<{ collection: ReturnType<typeof createCollection>; members: PortfolioAsset[] }> {
  const members: PortfolioAsset[] = [];
  for (let i = 0; i < MEMBER_COUNT; i++) {
    const fileId = `smoke-file-${i}`;
    const asset = createPortfolioAsset({
      displayName: `Smoke Member ${i}`,
      originalFilename: `smoke-${i}.svg`,
      sourceFileReferences: [],
      previewReference: fileId,
      metadataReference: null,
    });
    const file: PortfolioFileRecord = {
      fileId,
      assetId: asset.assetId,
      role: 'preview',
      filename: `smoke-${i}.svg`,
      mimeType: 'image/svg+xml',
      fileSize: 32,
      sha256: `sha-${i}`,
      blob: new NodeBlob(['<svg/>']) as unknown as Blob,
      storedAt: Date.now(),
    };
    await importAssetTransaction(asset, [file]);
    members.push(asset);
  }
  const collection = createCollection({ name: 'Memory Smoke Collection', coverAssetId: members[0].assetId });
  const membersWithMembership = members.map((m) => ({ ...m, collectionIds: [collection.id] }));
  await putPortfolioAssetsBulk(membersWithMembership);
  return { collection, members: membersWithMembership };
}

afterEach(async () => {
  cleanup();
  await clearCollectionsStore();
  await clearPortfolioStores();
});

describe('bounded memory smoke test — Collection page mount/unmount cycles', () => {
  it('every created object URL is revoked after unmount, across repeated cycles', async () => {
    const { collection, members } = await seedBoundedCollection();
    const tracker = trackBlobUrlLifecycle();
    const sampler = new MemorySampler();
    sampler.sample(); // baseline

    try {
      for (let cycle = 0; cycle < MOUNT_CYCLES; cycle++) {
        const createdBeforeThisCycle = tracker.createdCount;
        const { unmount } = render(
          <CollectionDetailPanel
            collection={collection}
            memberAssets={members}
            duplicateAssetIds={new Set()}
            onRename={async () => {}}
            onUpdateDescription={async () => {}}
            onArchive={async () => {}}
            onUnarchive={async () => {}}
            onDelete={async () => {}}
            onSetCover={async () => {}}
            onRemoveAssets={async () => ({ requestedCount: 0, changedCount: 0, skippedCount: 0, failedCount: 0, failures: [] })}
            onOpenAsset={() => {}}
            onClose={() => {}}
          />,
        );
        // The cover/thumbnail Blob URLs resolve asynchronously (a real
        // IndexedDB read via `getPortfolioFile` sits between mount and
        // `URL.createObjectURL`) — wait for at least one to actually be
        // created before unmounting, otherwise this test could pass
        // vacuously (unmounting before anything was ever created).
        await waitFor(() => expect(tracker.createdCount).toBeGreaterThan(createdBeforeThisCycle));
        sampler.sample();
        unmount();
        expect(tracker.outstanding).toBe(0);
      }
      sampler.sample(); // final
    } finally {
      tracker.restore();
    }

    const summary = sampler.summarize();
    expect(summary.sampleCount).toBe(MOUNT_CYCLES + 2);
    expect(tracker.outstanding).toBe(0);
  });
});
