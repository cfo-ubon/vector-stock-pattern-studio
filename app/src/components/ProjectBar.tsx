import type { Project } from '../project/projectTypes';

interface Props {
  projects: Project[];
  activeProjectId: string | null;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onOpenDashboard: () => void;
}

/** Active-Project bar — persistent header strip (chosen over a Figma/Canva-
 * style dashboard-gate on the roadmap's explicit "Active-Project bar"
 * decision): the pattern editor stays the default screen, but every save/
 * collection/export is attributed to whichever project is active here.
 * "📂 Projects" opens the full Project Dashboard (Project Manager) to
 * create/open/duplicate/rename/archive/delete/favorite. */
export function ProjectBar({ projects, activeProjectId, onSwitch, onCreate, onOpenDashboard }: Props) {
  const visible = projects.filter((p) => !p.archived);
  const active = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="project-bar">
      <span className="project-bar-label">📁 Project:</span>
      <select
        className="project-bar-select"
        value={activeProjectId ?? ''}
        onChange={(e) => onSwitch(e.target.value)}
        aria-label="Active project"
      >
        {!active && <option value="">— เลือกโปรเจกต์ —</option>}
        {visible.map((p) => (
          <option key={p.id} value={p.id}>
            {p.favorite ? '⭐ ' : ''}
            {p.name}
          </option>
        ))}
      </select>
      <button type="button" className="btn project-bar-btn" onClick={onCreate}>
        + โปรเจกต์ใหม่
      </button>
      <button type="button" className="btn project-bar-btn" onClick={onOpenDashboard}>
        📊 Project Dashboard
      </button>
    </div>
  );
}
