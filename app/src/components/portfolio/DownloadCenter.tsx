import type { BulkExportResult } from '../../commercial/exportWorkflow';
import { downloadBlobFile } from '../../export/svgExporter';
import { isDesktopRuntime, openWorkspacePath, getConfiguredWorkspacePath } from '../../workspace/workspaceApi';
import { folderForMarketplaceId } from '../../workspace/workspaceExportIntegration';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  packages: BulkExportResult[];
  onClose: () => void;
}

/** Hotfix v1.0.1, Part 6 — Download Center. `packages` is session-scoped
 * state the caller (`PortfolioManagerView.tsx`) appends to after each
 * bulk export completes — this component only displays and downloads,
 * it never builds anything. "Open Folder" is desktop-only (the browser
 * has no folder to open): it reuses M5's `openWorkspacePath()`, which
 * already routes bulk-export ZIPs into `<Workspace>/Marketplace/<Site>/`
 * or `<Workspace>/Export/` via `saveSubmissionPackageToWorkspace`/
 * `saveExportToWorkspace`. */
export function DownloadCenter({ packages, onClose }: Props) {
  const desktop = isDesktopRuntime();

  const handleOpenFolder = async (marketplaceId: string) => {
    const workspacePath = await getConfiguredWorkspacePath();
    if (!workspacePath) return;
    await openWorkspacePath(`${workspacePath}/Marketplace/${folderForMarketplaceId(marketplaceId)}`);
  };

  return (
    <div className="portfolio-modal-backdrop" role="dialog" aria-modal="true" aria-label="Download Center">
      <div className="portfolio-modal download-center-dialog">
        <div className="portfolio-detail-header">
          <h2>📦 Download Center</h2>
          <button type="button" className="btn" onClick={onClose}>
            ปิด
          </button>
        </div>

        {packages.length === 0 ? (
          <p className="metadata-hint">ยังไม่มีแพ็กเกจที่พร้อมดาวน์โหลดในเซสชันนี้</p>
        ) : (
          <ul className="download-center-list">
            {packages.map((pkg, index) => (
              <li key={`${pkg.marketplaceId}-${pkg.createdAt}-${index}`} className="download-center-item">
                <div className="download-center-item-info">
                  <strong>{pkg.marketplaceLabel}</strong>
                  <span>{formatBytes(pkg.blob.size)}</span>
                  <span>{pkg.fileCount} ไฟล์</span>
                  <span>{new Date(pkg.createdAt).toLocaleString('th-TH')}</span>
                  {pkg.skipped.length > 0 && <span className="portfolio-badge portfolio-badge--warning">ข้าม {pkg.skipped.length} ชิ้นงาน</span>}
                </div>
                <div className="download-center-item-actions">
                  <button type="button" className="btn btn--small btn--primary" onClick={() => downloadBlobFile(pkg.filename, pkg.blob)}>
                    ดาวน์โหลด ZIP
                  </button>
                  {desktop && (
                    <button type="button" className="btn btn--small" onClick={() => void handleOpenFolder(pkg.marketplaceId)}>
                      เปิดโฟลเดอร์
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
