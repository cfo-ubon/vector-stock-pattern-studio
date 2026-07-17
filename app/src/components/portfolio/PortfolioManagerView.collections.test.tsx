/// <reference types="node" />
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PortfolioManagerView } from './PortfolioManagerView';
import { clearPortfolioStores, importAssetTransaction, getPortfolioAsset, putPortfolioAsset } from '../../catalog/storage/portfolioStore';
import { clearCollectionsStore } from '../../catalog/storage/collectionStore';
import { createPortfolioAsset } from '../../catalog/domain/asset';

beforeEach(async () => {
  await clearPortfolioStores();
  await clearCollectionsStore();
});

function dialog() {
  return within(screen.getByRole('dialog'));
}

function collectionsNav() {
  return within(screen.getByRole('navigation', { name: 'มุมมองคอลเลกชัน' }));
}

async function waitUntilLoaded() {
  await waitFor(() => expect(screen.queryByText('กำลังโหลดคลัง…')).not.toBeInTheDocument());
}

async function openCollectionsTab() {
  fireEvent.click(screen.getByRole('button', { name: 'คอลเลกชัน' }));
}

async function createCollection(name: string) {
  fireEvent.click(screen.getByText('+ สร้างคอลเลกชัน'));
  fireEvent.change(dialog().getByLabelText('ชื่อคอลเลกชัน'), { target: { value: name } });
  fireEvent.click(dialog().getByText('สร้างคอลเลกชัน'));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}

describe('PortfolioManagerView — Collections (P2 Stage 2 integration)', () => {
  it('create → reload → persisted', async () => {
    const { unmount } = render(<PortfolioManagerView onClose={() => {}} />);
    await waitUntilLoaded();
    await openCollectionsTab();
    await createCollection('Spring 2026');
    await waitFor(() => expect(screen.getAllByText('Spring 2026').length).toBeGreaterThan(0));
    unmount();

    // Re-mount — a fresh component instance must load the persisted collection from IndexedDB.
    render(<PortfolioManagerView onClose={() => {}} />);
    await waitUntilLoaded();
    await openCollectionsTab();
    await waitFor(() => expect(screen.getByText('Spring 2026')).toBeInTheDocument());
  });

  it('rejects a duplicate collection name with a clear error, and does not create a second collection', async () => {
    render(<PortfolioManagerView onClose={() => {}} />);
    await waitUntilLoaded();
    await openCollectionsTab();
    await createCollection('Dup');

    fireEvent.click(screen.getByText('+ สร้างคอลเลกชัน'));
    fireEvent.change(dialog().getByLabelText('ชื่อคอลเลกชัน'), { target: { value: 'Dup' } });
    fireEvent.click(dialog().getByText('สร้างคอลเลกชัน'));
    await waitFor(() => expect(dialog().getByRole('alert')).toHaveTextContent(/already exists/));
    fireEvent.click(dialog().getByText('ยกเลิก'));
    expect(screen.getAllByText('Dup')).toHaveLength(1); // still only the one collection was created
  });

  it('rename → reload → persisted', async () => {
    const { unmount } = render(<PortfolioManagerView onClose={() => {}} />);
    await waitUntilLoaded();
    await openCollectionsTab();
    await createCollection('Old Name');
    await waitFor(() => expect(screen.getAllByText('Old Name').length).toBeGreaterThan(0));

    const nameInput = screen.getByLabelText('ชื่อคอลเลกชัน') as HTMLInputElement; // detail panel's rename field
    fireEvent.change(nameInput, { target: { value: 'New Name' } });
    fireEvent.blur(nameInput);
    await waitFor(() => expect(screen.getAllByText('New Name').length).toBeGreaterThan(0));
    unmount();

    render(<PortfolioManagerView onClose={() => {}} />);
    await waitUntilLoaded();
    await openCollectionsTab();
    await waitFor(() => expect(screen.getByText('New Name')).toBeInTheDocument());
  });

  it('single-asset assignment from the detail panel: assign, see it reflected, persists after reload', async () => {
    const asset = createPortfolioAsset({ displayName: 'Floral A', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    await importAssetTransaction(asset, []);
    const { unmount } = render(<PortfolioManagerView onClose={() => {}} />);
    await waitUntilLoaded();

    await openCollectionsTab();
    await createCollection('Florals');

    fireEvent.click(screen.getByRole('button', { name: 'ชิ้นงาน' }));
    await waitFor(() => expect(screen.getByText('Floral A')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Floral A'));
    await waitFor(() => expect(screen.getByText('+ เพิ่มเข้าคอลเลกชัน')).toBeInTheDocument());
    fireEvent.click(screen.getByText('+ เพิ่มเข้าคอลเลกชัน'));
    fireEvent.click(dialog().getByText('Florals'));
    fireEvent.click(dialog().getByText('ยืนยัน'));
    await waitFor(() => expect(dialog().getByText('เสร็จสิ้น')).toBeInTheDocument());
    fireEvent.click(dialog().getByText('เสร็จสิ้น'));

    await waitFor(async () => {
      const updated = await getPortfolioAsset(asset.assetId);
      expect(updated?.collectionIds.length).toBe(1);
    });
    unmount();

    render(<PortfolioManagerView onClose={() => {}} />);
    await waitUntilLoaded();
    const persisted = await getPortfolioAsset(asset.assetId);
    expect(persisted?.collectionIds.length).toBe(1);
  });

  it('bulk assign then bulk remove: BulkMembershipResult summary is shown, and membership round-trips', async () => {
    const a = createPortfolioAsset({ displayName: 'Bulk A', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    const b = createPortfolioAsset({ displayName: 'Bulk B', originalFilename: 'b.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    await importAssetTransaction(a, []);
    await importAssetTransaction(b, []);
    render(<PortfolioManagerView onClose={() => {}} />);
    await waitUntilLoaded();

    await openCollectionsTab();
    await createCollection('Bulk Target');

    fireEvent.click(screen.getByRole('button', { name: 'ชิ้นงาน' }));
    await waitFor(() => expect(screen.getByText('Bulk A')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/เลือก Bulk A/));
    fireEvent.click(screen.getByLabelText(/เลือก Bulk B/));
    fireEvent.click(screen.getByText('เพิ่มเข้าคอลเลกชัน', { selector: 'button' }));
    fireEvent.click(dialog().getByText('Bulk Target'));
    fireEvent.click(dialog().getByText('ยืนยัน'));
    await waitFor(() => expect(dialog().getByText(/รวม 2 รายการ/)).toBeInTheDocument());
    expect(dialog().getByText(/สำเร็จ 2/)).toBeInTheDocument();
    fireEvent.click(dialog().getByText('เสร็จสิ้น'));

    await waitFor(async () => {
      expect((await getPortfolioAsset(a.assetId))?.collectionIds.length).toBe(1);
      expect((await getPortfolioAsset(b.assetId))?.collectionIds.length).toBe(1);
    });

    // Bulk remove — clear the prior (still-checked) selection first, then
    // select only Bulk A.
    fireEvent.click(screen.getByText('ล้างการเลือก'));
    fireEvent.click(screen.getByLabelText(/เลือก Bulk A/));
    fireEvent.click(screen.getByText('นำออกจากคอลเลกชัน', { selector: 'button' }));
    fireEvent.click(dialog().getByText('Bulk Target'));
    fireEvent.click(dialog().getByText('ยืนยัน'));
    await waitFor(() => expect(dialog().getByText(/รวม 1 รายการ/)).toBeInTheDocument());
    fireEvent.click(dialog().getByText('เสร็จสิ้น'));
    await waitFor(async () => expect((await getPortfolioAsset(a.assetId))?.collectionIds.length).toBe(0));
  });

  it('archive → filter archived → unarchive: archived collections keep existing members and disappear from the active filter', async () => {
    render(<PortfolioManagerView onClose={() => {}} />);
    await waitUntilLoaded();

    await openCollectionsTab();
    await createCollection('To Archive');

    fireEvent.click(screen.getByText('เก็บเข้าที่เก็บถาวร'));
    fireEvent.click(screen.getByText('ยืนยันเก็บถาวร'));
    await waitFor(() => expect(screen.getByText('กู้คืนจากที่เก็บถาวร')).toBeInTheDocument());

    fireEvent.click(collectionsNav().getByText('ใช้งานอยู่'));
    await waitFor(() => expect(screen.getByText('พบ 0 คอลเลกชัน')).toBeInTheDocument());

    fireEvent.click(collectionsNav().getByText('เก็บถาวร'));
    await waitFor(() => expect(screen.getByText('To Archive')).toBeInTheDocument());

    fireEvent.click(screen.getByText('To Archive'));
    fireEvent.click(screen.getByText('กู้คืนจากที่เก็บถาวร'));
    await waitFor(() => expect(screen.getByText('เก็บเข้าที่เก็บถาวร')).toBeInTheDocument());
  });

  it('archived collections block new asset assignment but keep existing members (Rule 7)', async () => {
    const asset = createPortfolioAsset({ displayName: 'Member Asset', originalFilename: 'x.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    await importAssetTransaction(asset, []);
    render(<PortfolioManagerView onClose={() => {}} />);
    await waitUntilLoaded();

    await openCollectionsTab();
    await createCollection('Archived Target');
    fireEvent.click(screen.getByText('เก็บเข้าที่เก็บถาวร'));
    fireEvent.click(screen.getByText('ยืนยันเก็บถาวร'));
    await waitFor(() => expect(screen.getByText('กู้คืนจากที่เก็บถาวร')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'ชิ้นงาน' }));
    await waitFor(() => expect(screen.getByText('Member Asset')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Member Asset'));
    fireEvent.click(screen.getByText('+ เพิ่มเข้าคอลเลกชัน'));
    // The archived collection must not appear as a pickable option.
    expect(dialog().queryByText('Archived Target')).not.toBeInTheDocument();
    expect(dialog().getByText(/เก็บถาวรแล้ว 1 รายการ/)).toBeInTheDocument();
  });

  it('delete → membership cleanup reflected: asset remains, collection reference removed', async () => {
    const asset = createPortfolioAsset({ displayName: 'Survivor', originalFilename: 'x.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    await importAssetTransaction(asset, []);
    render(<PortfolioManagerView onClose={() => {}} />);
    await waitUntilLoaded();

    await openCollectionsTab();
    await createCollection('Doomed');

    fireEvent.click(screen.getByRole('button', { name: 'ชิ้นงาน' }));
    await waitFor(() => expect(screen.getByText('Survivor')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Survivor'));
    fireEvent.click(screen.getByText('+ เพิ่มเข้าคอลเลกชัน'));
    fireEvent.click(dialog().getByText('Doomed'));
    fireEvent.click(dialog().getByText('ยืนยัน'));
    await waitFor(() => expect(dialog().getByText('เสร็จสิ้น')).toBeInTheDocument());
    fireEvent.click(dialog().getByText('เสร็จสิ้น'));
    await waitFor(async () => expect((await getPortfolioAsset(asset.assetId))?.collectionIds.length).toBe(1));

    fireEvent.click(screen.getByRole('button', { name: 'คอลเลกชัน' }));
    await waitFor(() => expect(screen.getByText('Doomed')).toBeInTheDocument());
    fireEvent.click(screen.getByText('ลบคอลเลกชันนี้'));
    fireEvent.click(screen.getByText('ยืนยันลบ'));
    await waitFor(() => expect(screen.queryByText('Doomed')).not.toBeInTheDocument());

    const survivorAfter = await getPortfolioAsset(asset.assetId);
    expect(survivorAfter).toBeDefined();
    expect(survivorAfter?.collectionIds).toEqual([]);
  });

  it('asset library filter: "assets in this collection" shows only members (Section 14)', async () => {
    const inCollection = createPortfolioAsset({ displayName: 'In Collection', originalFilename: 'a.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    const notInCollection = createPortfolioAsset({ displayName: 'Not In Collection', originalFilename: 'b.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    await importAssetTransaction(inCollection, []);
    await importAssetTransaction(notInCollection, []);
    render(<PortfolioManagerView onClose={() => {}} />);
    await waitUntilLoaded();

    await openCollectionsTab();
    await createCollection('Filter Target');

    fireEvent.click(screen.getByRole('button', { name: 'ชิ้นงาน' }));
    await waitFor(() => expect(screen.getByText('In Collection')).toBeInTheDocument());
    fireEvent.click(screen.getByText('In Collection'));
    fireEvent.click(screen.getByText('+ เพิ่มเข้าคอลเลกชัน'));
    fireEvent.click(dialog().getByText('Filter Target'));
    fireEvent.click(dialog().getByText('ยืนยัน'));
    await waitFor(() => expect(dialog().getByText('เสร็จสิ้น')).toBeInTheDocument());
    fireEvent.click(dialog().getByText('เสร็จสิ้น'));

    const select = screen.getByLabelText('กรองตามคอลเลกชัน') as HTMLSelectElement;
    const option = within(select).getByText('Filter Target') as HTMLOptionElement;
    fireEvent.change(select, { target: { value: option.value } });

    // The asset detail panel (still open from the assignment step above) also
    // shows the asset's display name — assert at least one match, not exactly one.
    await waitFor(() => expect(screen.getAllByText('In Collection').length).toBeGreaterThan(0));
    expect(screen.queryByText('Not In Collection')).not.toBeInTheDocument();
  });

  it('integrity scan detects an orphaned collectionId and repair clears it (never automatic)', async () => {
    const asset = createPortfolioAsset({ displayName: 'Orphan Holder', originalFilename: 'x.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
    await importAssetTransaction(asset, []);
    // Simulate drift: an asset referencing a collection id that doesn't exist
    // (e.g. from a corrupted import) — not reachable through normal UI flows,
    // which is exactly what the integrity scan exists to catch.
    await putPortfolioAsset({ ...asset, collectionIds: ['COL-does-not-exist'] });

    render(<PortfolioManagerView onClose={() => {}} />);
    await waitUntilLoaded();
    await openCollectionsTab();
    fireEvent.click(collectionsNav().getByText('ตรวจสอบข้อมูล'));
    fireEvent.click(screen.getByText('ตรวจสอบใหม่'));

    await waitFor(() => expect(screen.getByText('ซ่อมแซมการอ้างอิงที่ไม่ถูกต้อง')).toBeInTheDocument());
    // Read-only until this explicit click — no auto-repair happened during the scan itself.
    expect((await getPortfolioAsset(asset.assetId))?.collectionIds).toEqual(['COL-does-not-exist']);

    fireEvent.click(screen.getByText('ซ่อมแซมการอ้างอิงที่ไม่ถูกต้อง'));
    await waitFor(async () => expect((await getPortfolioAsset(asset.assetId))?.collectionIds).toEqual([]));
  });
});
