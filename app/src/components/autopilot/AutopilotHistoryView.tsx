import { useCallback, useEffect, useState } from 'react';
import { loadAutonomousDesignRuns } from '../../autopilot/storage/autonomousDesignRunStore';
import type { AutonomousDesignRun } from '../../autopilot/domain/autonomousDesignRun';
import { isAutonomousRunArchived, archiveAutonomousDesignRun, unarchiveAutonomousDesignRun } from '../../autopilot/domain/autonomousDesignRun';
import { putAutonomousDesignRun } from '../../autopilot/storage/autonomousDesignRunStore';
import { AUTOPILOT_MODE_LABEL_TH, AUTOPILOT_MODE_LABEL_EN } from '../../autopilot/domain/autopilotMode';
import { downloadBlobFile } from '../../export/svgExporter';

// Build 029, Module 11 — Autopilot History. Reads the real, already-
// persisted `AutonomousDesignRun` records (same store every other
// Autopilot screen reads/writes) — no separate history log is kept.
// "Duplicate with new seed" and "Resume" never call the generator
// themselves; both hand a real run back to `AutopilotView`, which still
// requires the user's own "สร้างทันที" press before anything regenerates
// (Module 11's "do not auto-regenerate identical output" rule).

interface Props {
  onResume: (run: AutonomousDesignRun) => void;
  onOpenCompleted: (run: AutonomousDesignRun) => void;
  onDuplicate: (run: AutonomousDesignRun) => void;
  onClose: () => void;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m ${seconds % 60}s`;
}

export function AutopilotHistoryView({ onResume, onOpenCompleted, onDuplicate, onClose }: Props) {
  const [runs, setRuns] = useState<AutonomousDesignRun[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const all = await loadAutonomousDesignRuns();
      setRuns(all);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleArchiveToggle = useCallback(
    async (run: AutonomousDesignRun) => {
      const updated = isAutonomousRunArchived(run) ? unarchiveAutonomousDesignRun(run) : archiveAutonomousDesignRun(run);
      await putAutonomousDesignRun(updated);
      await reload();
    },
    [reload],
  );

  const handleExportReport = useCallback((run: AutonomousDesignRun) => {
    const report = {
      id: run.id,
      mode: run.mode,
      status: run.status,
      requestedCount: run.requestedCount,
      completedCount: run.completedCount,
      readyCount: run.readyCount,
      reviewCount: run.reviewCount,
      rejectCount: run.rejectCount,
      sourceEvidence: run.sourceEvidence,
      designPlan: run.designPlan,
      items: run.items,
      history: run.history,
      errors: run.errors,
      createdAt: new Date(run.createdAt).toISOString(),
      updatedAt: new Date(run.updatedAt).toISOString(),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    downloadBlobFile(`autopilot-run-${run.id}.json`, blob);
  }, []);

  const visibleRuns = runs.filter((r) => isAutonomousRunArchived(r) === showArchived);

  return (
    <div className="autopilot-step">
      <div className="autopilot-header">
        <h2>📜 ประวัติ Autopilot</h2>
        <button type="button" className="btn" onClick={onClose}>
          ← กลับ
        </button>
      </div>

      <div className="autopilot-quick-actions">
        <button type="button" className={`btn${!showArchived ? ' btn--primary' : ''}`} onClick={() => setShowArchived(false)}>
          รันปัจจุบัน
        </button>
        <button type="button" className={`btn${showArchived ? ' btn--primary' : ''}`} onClick={() => setShowArchived(true)}>
          เก็บถาวรแล้ว
        </button>
      </div>

      {loadError && (
        <div className="autopilot-error" role="alert">
          {loadError}
        </div>
      )}

      {visibleRuns.length === 0 && <p>ไม่มีประวัติการรัน</p>}

      <ul className="autopilot-decision-list">
        {visibleRuns.map((run) => (
          <li key={run.id}>
            <strong>
              {new Date(run.createdAt).toLocaleString()} — {AUTOPILOT_MODE_LABEL_EN[run.mode]} ({AUTOPILOT_MODE_LABEL_TH[run.mode]})
            </strong>
            <div className="autopilot-rationale">
              Marketplace: {run.designPlan?.targetMarketplace ?? 'N/A'} · Collection: {run.designPlan?.summary ?? 'N/A'}
              <br />
              Requested/Generated: {run.requestedCount}/{run.completedCount} · READY {run.readyCount} · REVIEW {run.reviewCount} · REJECT {run.rejectCount}
              <br />
              Status: {run.status} · Source snapshot: {run.sourceEvidence.marketSnapshotId ?? 'N/A'} · Confidence: {run.designPlan?.confidence ?? 'unknown'}
              <br />
              Duration: {formatDuration(run.updatedAt - run.createdAt)}
            </div>
            <div className="autopilot-generation-actions">
              {(run.status === 'GENERATING' || run.status === 'PAUSED') && (
                <button type="button" className="btn btn--primary" onClick={() => onResume(run)}>
                  ดำเนินการต่อ
                </button>
              )}
              {run.status === 'COMPLETED' && (
                <button type="button" className="btn" onClick={() => onOpenCompleted(run)}>
                  เปิด
                </button>
              )}
              {run.designPlan && (
                <button type="button" className="btn" onClick={() => onDuplicate(run)}>
                  ทำซ้ำด้วย Seed ใหม่
                </button>
              )}
              <button type="button" className="btn" onClick={() => handleArchiveToggle(run)}>
                {isAutonomousRunArchived(run) ? 'เลิกเก็บถาวร' : 'เก็บถาวร'}
              </button>
              <button type="button" className="btn" onClick={() => handleExportReport(run)}>
                ส่งออกรายงาน
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
