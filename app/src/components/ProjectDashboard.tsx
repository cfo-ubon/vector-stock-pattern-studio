import { useMemo, useRef, useState } from 'react';
import type { Project } from '../project/projectTypes';
import { computeProjectStats } from '../project/projectStats';

interface Props {
  projects: Project[];
  activeProjectId: string | null;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onToggleArchive: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  onClose: () => void;
  onExportJson: (id: string) => void;
  onImportJson: (file: File) => void;
}

const METADATA_LABEL_TH: Record<string, string> = { complete: 'ครบ', partial: 'บางส่วน', missing: 'ยังไม่มี' };
const EXPORT_LABEL_TH: Record<string, string> = { exported: 'เคย export แล้ว', never: 'ยังไม่เคย export' };
const UPLOAD_LABEL_TH: Record<string, string> = {
  allReady: 'พร้อม/ส่งแล้วทุกเว็บ',
  inProgress: 'กำลังดำเนินการ',
  notStarted: 'ยังไม่เริ่ม',
  noCollections: 'ยังไม่มี Collection',
};

function ProjectThumb({ project }: { project: Project }) {
  const heroSvg = useMemo(() => {
    const hero = project.collections[0]?.collection.assets.find((a) => a.id === 'hero');
    return hero?.svg?.replace(/^<\?xml[^>]*\?>\s*/, '');
  }, [project.collections]);
  if (!heroSvg) return <div className="project-thumb project-thumb--empty">ยังไม่มีลาย</div>;
  return <div className="project-thumb" dangerouslySetInnerHTML={{ __html: heroSvg }} />;
}

/** Project Manager: the Project Dashboard listing every project (grid,
 * thumbnail + stats + actions), reachable via the Active-Project bar's
 * "📊 Project Dashboard" button without leaving the app's default editor
 * screen (per the chosen Active-Project-bar navigation model — this is a
 * full-screen view swap, not a route). */
export function ProjectDashboard({
  projects,
  activeProjectId,
  onOpen,
  onDuplicate,
  onRename,
  onToggleArchive,
  onToggleFavorite,
  onDelete,
  onCreate,
  onClose,
  onExportJson,
  onImportJson,
}: Props) {
  const [showArchived, setShowArchived] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const visible = projects.filter((p) => showArchived || !p.archived).sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt);

  return (
    <div className="project-dashboard">
      <div className="metadata-header">
        <h2>📊 Project Dashboard</h2>
        <div className="project-dashboard-toolbar">
          <label className="project-dashboard-archived-toggle">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            แสดงโปรเจกต์ที่ archive แล้ว
          </label>
          <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
            📥 นำเข้า Project JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportJson(f);
              e.target.value = '';
            }}
          />
          <button type="button" className="btn btn--primary" onClick={onCreate}>
            + โปรเจกต์ใหม่
          </button>
          <button type="button" className="btn" onClick={onClose}>
            ← กลับหน้าสร้างลาย
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="gallery-empty">ยังไม่มีโปรเจกต์ — กด "+ โปรเจกต์ใหม่" เพื่อเริ่ม</p>
      ) : (
        <div className="project-grid">
          {visible.map((project) => {
            const stats = computeProjectStats(project);
            const isActive = project.id === activeProjectId;
            return (
              <div key={project.id} className={`project-card${isActive ? ' project-card--active' : ''}${project.archived ? ' project-card--archived' : ''}`}>
                <ProjectThumb project={project} />
                <div className="project-card-body">
                  <div className="project-card-name-row">
                    <strong>{project.name}</strong>
                    <button type="button" className="project-fav-btn" onClick={() => onToggleFavorite(project.id)} title="Favorite">
                      {project.favorite ? '⭐' : '☆'}
                    </button>
                  </div>
                  <div className="project-card-stats">
                    <span>📦 Collections: {stats.collectionsCount}</span>
                    <span>🧩 Assets: {stats.assetsCount}</span>
                    <span>🖼 SVG: {stats.svgCount}</span>
                    <span>📝 Metadata: {METADATA_LABEL_TH[stats.metadataStatus]}</span>
                    <span>📤 Export: {EXPORT_LABEL_TH[stats.exportStatus]}</span>
                    <span>🏬 Upload: {UPLOAD_LABEL_TH[stats.uploadStatus]}</span>
                  </div>
                  <div className="project-card-actions">
                    <button type="button" className="link-btn" onClick={() => onOpen(project.id)}>
                      เปิด
                    </button>
                    <button type="button" className="link-btn" onClick={() => onDuplicate(project.id)}>
                      ทำสำเนา
                    </button>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        const name = window.prompt('ตั้งชื่อโปรเจกต์ใหม่', project.name);
                        if (name && name.trim()) onRename(project.id, name.trim());
                      }}
                    >
                      เปลี่ยนชื่อ
                    </button>
                    <button type="button" className="link-btn" onClick={() => onExportJson(project.id)}>
                      Export JSON
                    </button>
                    <button type="button" className="link-btn" onClick={() => onToggleArchive(project.id)}>
                      {project.archived ? 'เลิก Archive' : 'Archive'}
                    </button>
                    <button
                      type="button"
                      className="link-btn link-btn--danger"
                      onClick={() => {
                        if (window.confirm(`ลบโปรเจกต์ "${project.name}" ถาวร? (ลบเฉพาะโปรเจกต์ ไม่กระทบคลังลายที่บันทึกไว้)`)) onDelete(project.id);
                      }}
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
