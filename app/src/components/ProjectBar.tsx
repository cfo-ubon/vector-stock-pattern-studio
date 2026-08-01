import type { Project } from '../project/projectTypes';

interface Props {
  projects: Project[];
  activeProjectId: string | null;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onOpenMissionControl: () => void;
  onOpenDashboard: () => void;
  onOpenTrendStudio: () => void;
  onOpenPortfolioManager: () => void;
  onOpenBackupManager: () => void;
  onOpenMarketing: () => void;
  onOpenDesignDirector: () => void;
  onOpenAutopilot: () => void;
  /** Build 030 — "unless Advanced Mode is explicitly opened": the classic
   * single-pattern editor (Style DNA/generator settings/manual export)
   * that Mission Control's business-language home screen intentionally
   * hides by default. Still one click away, never removed. */
  onOpenAdvancedMode: () => void;
}

/** Active-Project bar — persistent header strip (chosen over a Figma/Canva-
 * style dashboard-gate on the roadmap's explicit "Active-Project bar"
 * decision): the pattern editor stays the default screen, but every save/
 * collection/export is attributed to whichever project is active here.
 * "📂 Projects" opens the full Project Dashboard (Project Manager) to
 * create/open/duplicate/rename/archive/delete/favorite. */
export function ProjectBar({
  projects,
  activeProjectId,
  onSwitch,
  onCreate,
  onOpenMissionControl,
  onOpenDashboard,
  onOpenTrendStudio,
  onOpenPortfolioManager,
  onOpenBackupManager,
  onOpenMarketing,
  onOpenDesignDirector,
  onOpenAutopilot,
  onOpenAdvancedMode,
}: Props) {
  const visible = projects.filter((p) => !p.archived);
  const active = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="project-bar">
      <button type="button" className="btn project-bar-btn" onClick={onOpenMissionControl}>
        🏠 Mission Control
      </button>
      <button type="button" className="btn btn--primary project-bar-btn" onClick={onOpenAutopilot}>
        ✨ ออกแบบให้ฉันวันนี้
      </button>
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
        📊 Overview
      </button>
      <button type="button" className="btn project-bar-btn" onClick={onOpenTrendStudio}>
        🎨 Pattern Studio
      </button>
      <button type="button" className="btn project-bar-btn" onClick={onOpenPortfolioManager}>
        📂 Portfolio
      </button>
      <button type="button" className="btn project-bar-btn" onClick={onOpenBackupManager}>
        💾 Backup
      </button>
      <button type="button" className="btn project-bar-btn" onClick={onOpenMarketing}>
        📈 AI Market Advisor
      </button>
      <button type="button" className="btn project-bar-btn" onClick={onOpenDesignDirector}>
        🎨 AI Design Director
      </button>
      <button type="button" className="btn project-bar-btn" onClick={onOpenAdvancedMode}>
        ⚙️ Advanced Mode
      </button>
    </div>
  );
}
