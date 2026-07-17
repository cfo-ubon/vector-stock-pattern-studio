import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PortfolioDetailPanel } from './PortfolioDetailPanel';
import { createPortfolioAsset } from '../../catalog/domain/asset';

function makeAsset() {
  return createPortfolioAsset({ displayName: 'Test Asset', originalFilename: 'test.svg', sourceFileReferences: [], previewReference: null, metadataReference: null });
}

describe('PortfolioDetailPanel', () => {
  it('shows the asset name and ID', () => {
    const asset = makeAsset();
    render(
      <PortfolioDetailPanel asset={asset} isDuplicate={false} onUpdate={() => {}} onDeleteRecordOnly={() => {}} onDeleteRecordAndFiles={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByText('Test Asset')).toBeInTheDocument();
    expect(screen.getByText(asset.assetId)).toBeInTheDocument();
  });

  it('clicking a rating star calls onUpdate with the new rating', () => {
    const asset = makeAsset();
    const onUpdate = vi.fn();
    render(
      <PortfolioDetailPanel asset={asset} isDuplicate={false} onUpdate={onUpdate} onDeleteRecordOnly={() => {}} onDeleteRecordAndFiles={() => {}} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByLabelText('ให้คะแนน 4 ดาว'));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ rating: 4 }));
  });

  it('changing workflow status calls onUpdate', () => {
    const asset = makeAsset();
    const onUpdate = vi.fn();
    render(
      <PortfolioDetailPanel asset={asset} isDuplicate={false} onUpdate={onUpdate} onDeleteRecordOnly={() => {}} onDeleteRecordAndFiles={() => {}} onClose={() => {}} />,
    );
    fireEvent.change(screen.getByDisplayValue('ฉบับร่าง'), { target: { value: 'APPROVED' } });
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ workflowStatus: 'APPROVED' }));
  });

  it('archiving then restoring toggles isArchived', () => {
    const asset = makeAsset();
    const onUpdate = vi.fn();
    render(
      <PortfolioDetailPanel asset={asset} isDuplicate={false} onUpdate={onUpdate} onDeleteRecordOnly={() => {}} onDeleteRecordAndFiles={() => {}} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByText('เก็บเข้าที่เก็บถาวร'));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ isArchived: true }));

    const archived = { ...asset, isArchived: true };
    const onUpdate2 = vi.fn();
    render(
      <PortfolioDetailPanel asset={archived} isDuplicate={false} onUpdate={onUpdate2} onDeleteRecordOnly={() => {}} onDeleteRecordAndFiles={() => {}} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByText('กู้คืนจากที่เก็บถาวร'));
    expect(onUpdate2).toHaveBeenCalledWith(expect.objectContaining({ isArchived: false }));
  });

  it('adding a tag calls onUpdate with the tag appended', () => {
    const asset = makeAsset();
    const onUpdate = vi.fn();
    render(
      <PortfolioDetailPanel asset={asset} isDuplicate={false} onUpdate={onUpdate} onDeleteRecordOnly={() => {}} onDeleteRecordAndFiles={() => {}} onClose={() => {}} />,
    );
    fireEvent.change(screen.getByPlaceholderText('เพิ่มแท็ก…'), { target: { value: 'floral' } });
    fireEvent.click(screen.getByText('เพิ่ม'));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ tags: ['floral'] }));
  });

  it('shows a duplicate warning badge when isDuplicate is true', () => {
    const asset = makeAsset();
    render(
      <PortfolioDetailPanel asset={asset} isDuplicate={true} onUpdate={() => {}} onDeleteRecordOnly={() => {}} onDeleteRecordAndFiles={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByText(/พบไฟล์ซ้ำในคลัง/)).toBeInTheDocument();
  });

  it('the destructive delete requires an explicit confirmation step, defaulting to the safer "record only" option', () => {
    const asset = makeAsset();
    const onDeleteRecordOnly = vi.fn();
    const onDeleteRecordAndFiles = vi.fn();
    render(
      <PortfolioDetailPanel
        asset={asset}
        isDuplicate={false}
        onUpdate={() => {}}
        onDeleteRecordOnly={onDeleteRecordOnly}
        onDeleteRecordAndFiles={onDeleteRecordAndFiles}
        onClose={() => {}}
      />,
    );
    // Deletion is not immediate — clicking "ลบออกจากคลัง" only opens a confirm dialog.
    fireEvent.click(screen.getByText('ลบออกจากคลัง'));
    expect(onDeleteRecordOnly).not.toHaveBeenCalled();
    expect(onDeleteRecordAndFiles).not.toHaveBeenCalled();

    // Default radio selection is the safer "record only" mode.
    const recordOnlyRadio = screen.getByLabelText(/ลบเฉพาะรายการในคลัง/) as HTMLInputElement;
    expect(recordOnlyRadio.checked).toBe(true);

    fireEvent.click(screen.getByText('ยืนยันลบ'));
    expect(onDeleteRecordOnly).toHaveBeenCalledWith(asset.assetId);
    expect(onDeleteRecordAndFiles).not.toHaveBeenCalled();
  });

  it('can switch to the destructive "record and files" delete mode explicitly', () => {
    const asset = makeAsset();
    const onDeleteRecordAndFiles = vi.fn();
    render(
      <PortfolioDetailPanel
        asset={asset}
        isDuplicate={false}
        onUpdate={() => {}}
        onDeleteRecordOnly={() => {}}
        onDeleteRecordAndFiles={onDeleteRecordAndFiles}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('ลบออกจากคลัง'));
    fireEvent.click(screen.getByLabelText(/ลบรายการและไฟล์ที่เก็บไว้ทั้งหมด/));
    fireEvent.click(screen.getByText('ยืนยันลบ'));
    expect(onDeleteRecordAndFiles).toHaveBeenCalledWith(asset.assetId);
  });
});
