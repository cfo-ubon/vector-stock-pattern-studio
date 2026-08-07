import { useCallback, useEffect, useState } from 'react';
import {
  getDefaultSuggestedWorkspacePath,
  initializeWorkspace,
  selectWorkspaceFolder,
  setConfiguredWorkspacePath,
  verifyWorkspace,
  type WorkspaceVerifyResult,
} from './workspaceApi';
import './workspaceOnboarding.css';

// Production Deployment Phase 1, Part 2 — "Where is your Workspace?" First-
// launch screen, shown only inside the Electron desktop shell (see
// `App.tsx`'s `isDesktopRuntime()` gate) and only when no Workspace path is
// configured yet. Never shown in the browser/GitHub-Pages build. Offers
// exactly the four actions the spec names: Create (at the suggested
// default), Move (choose a different folder to create at), Verify (check
// an already-chosen folder before committing), Open Existing (point at a
// Workspace created by a previous install).

interface Props {
  onDone: () => void;
}

type Stage = 'choose' | 'working' | 'result';

export function WorkspaceOnboarding({ onDone }: Props) {
  const [defaultPath, setDefaultPath] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('choose');
  const [chosenPath, setChosenPath] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<WorkspaceVerifyResult | null>(null);
  const [createdFolders, setCreatedFolders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDefaultSuggestedWorkspacePath().then(setDefaultPath);
  }, []);

  const setupWorkspaceAt = useCallback(async (path: string) => {
    setStage('working');
    setError(null);
    setChosenPath(path);
    try {
      const initResult = await initializeWorkspace(path);
      const verify = await verifyWorkspace(path);
      if (!verify || !verify.writable) {
        setError('ไม่สามารถเขียนไฟล์ในโฟลเดอร์นี้ได้ กรุณาเลือกโฟลเดอร์อื่น');
        setStage('choose');
        return;
      }
      await setConfiguredWorkspacePath(path);
      setCreatedFolders(initResult?.created ?? []);
      setVerifyResult(verify);
      setStage('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage('choose');
    }
  }, []);

  const openExistingWorkspace = useCallback(async () => {
    const picked = await selectWorkspaceFolder();
    if (!picked) return;
    setStage('working');
    setError(null);
    setChosenPath(picked);
    const verify = await verifyWorkspace(picked);
    if (!verify) {
      setError('ไม่สามารถตรวจสอบโฟลเดอร์นี้ได้');
      setStage('choose');
      return;
    }
    // "Open Existing" still runs initialize — idempotent, only fills in
    // whatever folders are missing rather than erroring on a Workspace
    // that predates a newer app version's folder list.
    await setupWorkspaceAt(picked);
  }, [setupWorkspaceAt]);

  const chooseDifferentFolder = useCallback(async () => {
    const picked = await selectWorkspaceFolder();
    if (picked) await setupWorkspaceAt(picked);
  }, [setupWorkspaceAt]);

  return (
    <div className="workspace-onboarding-overlay">
      <div className="workspace-onboarding-card">
        <h1>Production Workspace</h1>
        <p className="workspace-onboarding-lede">
          AI-SBOS เก็บ Portfolio, Commercial Packages, Backup, และไฟล์ผลผลิตทั้งหมดไว้ในโฟลเดอร์เดียวบนเครื่องของคุณ —
          เลือกตำแหน่งที่จะใช้เก็บข้อมูลเหล่านี้
        </p>

        {stage === 'choose' && (
          <div className="workspace-onboarding-actions">
            {defaultPath && (
              <button type="button" className="workspace-onboarding-btn primary" onClick={() => setupWorkspaceAt(defaultPath)}>
                ✅ สร้าง Workspace ที่ {defaultPath}
              </button>
            )}
            <button type="button" className="workspace-onboarding-btn" onClick={chooseDifferentFolder}>
              📁 เลือกโฟลเดอร์อื่น (สร้างใหม่)
            </button>
            <button type="button" className="workspace-onboarding-btn" onClick={openExistingWorkspace}>
              📂 เปิด Workspace ที่มีอยู่แล้ว
            </button>
            {error && <p className="workspace-onboarding-error">{error}</p>}
          </div>
        )}

        {stage === 'working' && <p className="workspace-onboarding-status">กำลังตั้งค่า Workspace ที่ {chosenPath} ...</p>}

        {stage === 'result' && verifyResult && (
          <div className="workspace-onboarding-result">
            <p>
              ✅ Workspace พร้อมใช้งานที่ <code>{chosenPath}</code>
            </p>
            <p>
              พื้นที่ว่าง: {verifyResult.freeBytes != null ? `${(verifyResult.freeBytes / 1024 ** 3).toFixed(1)} GB` : 'ไม่ทราบ'} — สร้างโฟลเดอร์ใหม่{' '}
              {createdFolders.length} รายการ
            </p>
            <button type="button" className="workspace-onboarding-btn primary" onClick={onDone}>
              เริ่มใช้งาน
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
