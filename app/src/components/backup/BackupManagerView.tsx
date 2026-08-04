import { useCallback, useEffect, useState } from 'react';
import { buildAppBackup } from '../../backup/appBackupBuilder';
import type { AppBackupProgressEvent, AppBackupBuildResult } from '../../backup/appBackupBuilder';
import { previewAppBackupRestore, applyAppBackupRestore } from '../../backup/appBackupRestore';
import type { AppBackupRestorePreview, AppBackupRestoreResult } from '../../backup/appBackupRestore';
import { validateAppBackupArchive } from '../../backup/appBackupValidation';
import type { AppBackupValidationResult } from '../../backup/appBackupValidation';
import { listBackupHistory, deleteBackupHistoryRecord, addBackupHistoryRecord, pruneBackupHistory } from '../../backup/appBackupHistoryStore';
import type { AppBackupHistoryRecord } from '../../backup/appBackupHistoryStore';
import { loadAutoBackupSettings, saveAutoBackupSettings } from '../../backup/autoBackupSettings';
import type { AutoBackupSettings, AutoBackupFrequency, AutoBackupRetention } from '../../backup/autoBackupSettings';
import { isDesktopRuntime } from '../../workspace/workspaceApi';
import { saveBackupToWorkspace } from '../../workspace/workspaceBackupIntegration';
import './backupManager.css';

// Application Backup System — first UI for `backup/appBackup*.ts` (built
// and independently verified via Node-side round-trip scripts before this
// component existed — see docs/BACKUP_SYSTEM.md). This is the first
// FULL-APPLICATION backup UI in the app: it is distinct from, and does
// not replace, the two existing narrower backup flows already shipped
// (`App.tsx`'s "library-backup.json" saved-pattern export, and
// `ProductionCenterView.tsx`'s "backup" tab for the 8 Build 026
// production stores) — neither of those covers actual portfolio artwork
// files or app-wide settings, which is exactly the gap this closes.

interface Props {
  onClose: () => void;
}

type BackupManagerTab = 'backup' | 'restore' | 'auto' | 'history' | 'verify';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

const STAGE_LABEL_TH: Record<AppBackupProgressEvent['stage'], string> = {
  preparing: 'กำลังเตรียมข้อมูล',
  compressing: 'กำลังบีบอัด',
  verifying: 'กำลังตรวจสอบ',
  completed: 'เสร็จสมบูรณ์',
};

export function BackupManagerView({ onClose }: Props) {
  const [tab, setTab] = useState<BackupManagerTab>('backup');

  return (
    <div className="backup-center">
      <div className="backup-center-header">
        <h1>💾 Backup Manager (สำรอง/กู้คืนข้อมูลทั้งหมด)</h1>
        <button type="button" className="btn" onClick={onClose}>
          ← กลับ
        </button>
      </div>
      <nav className="backup-tab-nav" aria-label="แท็บ Backup Manager">
        {(
          [
            ['backup', 'สำรองข้อมูล'],
            ['restore', 'กู้คืนข้อมูล'],
            ['auto', 'สำรองอัตโนมัติ'],
            ['history', 'ประวัติการสำรอง'],
            ['verify', 'ตรวจสอบไฟล์สำรอง'],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" className={`btn${tab === key ? ' btn--primary' : ''}`} aria-pressed={tab === key} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'backup' && <CreateBackupTab />}
      {tab === 'restore' && <RestoreTab />}
      {tab === 'auto' && <AutoBackupTab />}
      {tab === 'history' && <BackupHistoryTab />}
      {tab === 'verify' && <VerifyBackupTab />}
    </div>
  );
}

// --- Backup -----------------------------------------------------------

function CreateBackupTab() {
  const [deviceLabel, setDeviceLabel] = useState('');
  const [progress, setProgress] = useState<AppBackupProgressEvent | null>(null);
  const [result, setResult] = useState<AppBackupBuildResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [workspaceSaveStatus, setWorkspaceSaveStatus] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(null);
    setWorkspaceSaveStatus(null);
    const startedAt = Date.now();
    try {
      const backup = await buildAppBackup({
        deviceLabel: deviceLabel.trim() || undefined,
        onProgress: setProgress,
      });
      setResult(backup);
      if (isDesktopRuntime()) {
        const saved = await saveBackupToWorkspace(backup).catch(() => null);
        setWorkspaceSaveStatus(saved ? `บันทึกสำเนาไว้ที่ Workspace แล้ว: ${saved.path}` : 'บันทึกสำเนาไปยัง Workspace ไม่สำเร็จ (ยังมีไฟล์ดาวน์โหลดปกติให้ใช้งาน)');
      }
      const settings = loadAutoBackupSettings();
      await addBackupHistoryRecord({
        historyId: backup.manifest.backupId,
        createdAt: startedAt,
        fileName: backup.fileName,
        destination: deviceLabel.trim() || 'This device',
        result: 'success',
        durationMs: Date.now() - startedAt,
        trigger: 'manual',
        appVersionLabel: backup.manifest.appVersionLabel,
        dbVersion: backup.manifest.metadata.dbVersion,
        fileCount: backup.manifest.stats.fileCount,
        assetFileCount: backup.manifest.stats.assetFileCount,
        originalSize: backup.manifest.stats.originalSize,
        compressedSize: backup.manifest.stats.compressedSize,
        blob: backup.blob,
      });
      await pruneBackupHistory(settings.retention);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [deviceLabel]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const percent = progress && progress.totalBytes > 0 ? Math.round((progress.bytesProcessed / progress.totalBytes) * 100) : progress ? 0 : null;
  const compressionRatioPct =
    result && result.manifest.stats.originalSize > 0
      ? Math.round((1 - result.manifest.stats.compressedSize / result.manifest.stats.originalSize) * 100)
      : null;

  return (
    <div className="backup-panel">
      <section className="backup-card">
        <h2>สร้างไฟล์สำรองข้อมูลทั้งหมด (.vspsb)</h2>
        <p>
          ครอบคลุมทุกอย่าง: ฐานข้อมูลทั้งหมด, ไฟล์ต้นฉบับทุกชิ้น (SVG/PNG/EPS ฯลฯ), คอลเลกชัน, การส่งงาน, คิวการผลิต และการตั้งค่า/พรีเซ็ตทั้งหมด —
          เป็นไฟล์เดียวที่พกพาไปเครื่องอื่นได้ (Windows/แล็ปท็อป/iPad ผ่าน Files/iCloud Drive/External SSD/USB Drive)
        </p>
        <div className="backup-form-grid">
          <label>
            ชื่ออุปกรณ์ (ไม่บังคับ)
            <input type="text" value={deviceLabel} onChange={(e) => setDeviceLabel(e.target.value)} placeholder="เช่น Windows Desktop, iPad" />
          </label>
        </div>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void handleCreate()}>
          {busy ? 'กำลังสร้างไฟล์สำรอง…' : '+ สร้างไฟล์สำรองใหม่'}
        </button>
        {progress && (
          <div>
            <p>
              {STAGE_LABEL_TH[progress.stage]} {percent !== null ? `(${percent}%)` : ''} — {progress.filesProcessed}/{progress.totalFiles} ไฟล์,{' '}
              {formatBytes(progress.bytesProcessed)} / {formatBytes(progress.totalBytes)}
            </p>
            <div className="backup-progress-track">
              <div className="backup-progress-fill" style={{ width: `${percent ?? 0}%` }} />
            </div>
          </div>
        )}
        {error && <p className="backup-error-text">สร้างไฟล์สำรองไม่สำเร็จ: {error}</p>}
        {result && (
          <div>
            <p className="backup-success-text">
              สร้างไฟล์สำรองสำเร็จ: {result.manifest.stats.fileCount} ไฟล์ ({result.manifest.stats.assetFileCount} ไฟล์งานศิลป์,{' '}
              {result.manifest.stats.settingsKeyCount} การตั้งค่า) — ขนาดต้นฉบับ {formatBytes(result.manifest.stats.originalSize)}, บีบอัดเหลือ{' '}
              {formatBytes(result.manifest.stats.compressedSize)}
              {compressionRatioPct !== null ? ` (เล็กลง ${compressionRatioPct}%)` : ''}
            </p>
            <button type="button" className="btn" onClick={handleDownload}>
              ดาวน์โหลดไฟล์ {result.fileName}
            </button>
            {workspaceSaveStatus && <p>{workspaceSaveStatus}</p>}
          </div>
        )}
      </section>
    </div>
  );
}

// --- Restore ------------------------------------------------------------

function RestoreTab() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AppBackupRestorePreview | null>(null);
  const [result, setResult] = useState<AppBackupRestoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState('');

  const handleSelectFile = useCallback(async (f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
    setPreview(null);
    setBusy(true);
    try {
      const p = await previewAppBackupRestore(f);
      setPreview(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const handleConfirmRestore = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const r = await applyAppBackupRestore(file, { deviceLabel: deviceLabel.trim() || undefined });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [file, deviceLabel]);

  return (
    <div className="backup-panel">
      <section className="backup-card">
        <h2>กู้คืนจากไฟล์ .vspsb</h2>
        <p>
          ระบบจะตรวจสอบไฟล์สำรองก่อนเสมอ และสร้าง "Safety Backup" ของข้อมูลปัจจุบันโดยอัตโนมัติก่อนเขียนทับสิ่งใด — ข้อมูลเดิมที่ไม่มีในไฟล์สำรองจะไม่ถูกลบ
          (กู้คืนแบบเพิ่ม/เขียนทับเท่านั้น ไม่ใช่การล้างข้อมูล)
        </p>
        <input type="file" accept=".vspsb" onChange={(e) => e.target.files?.[0] && void handleSelectFile(e.target.files[0])} />
        {busy && !preview && <p>กำลังตรวจสอบไฟล์…</p>}
        {preview && (
          <div>
            <p
              className={
                preview.validation.verdict === 'PASS' ? 'backup-success-text' : preview.validation.verdict === 'WARNING' ? 'backup-warning-text' : 'backup-error-text'
              }
            >
              ผลตรวจสอบ: {preview.validation.verdict}
              {preview.validation.manifest && ` — สร้างเมื่อ ${new Date(preview.validation.manifest.createdAt).toLocaleString('th-TH')} จาก ${preview.validation.manifest.metadata.deviceLabel}`}
            </p>
            {preview.validation.manifest && (
              <p>
                ไฟล์ทั้งหมด {preview.validation.manifest.stats.fileCount}, งานศิลป์ {preview.validation.manifest.stats.assetFileCount} — ตรวจสอบ checksum แล้ว{' '}
                {preview.validation.checkedFileCount} รายการ, ไม่ตรง {preview.validation.mismatchedFileCount} รายการ
              </p>
            )}
            {preview.validation.issues.length > 0 && (
              <ul className="backup-issue-list">
                {preview.validation.issues.map((issue, i) => (
                  <li key={i} className={issue.severity === 'error' ? 'backup-error-text' : 'backup-warning-text'}>
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
            {preview.canRestore && !result && (
              <>
                <div className="backup-form-grid">
                  <label>
                    ชื่ออุปกรณ์สำหรับ Safety Backup (ไม่บังคับ)
                    <input type="text" value={deviceLabel} onChange={(e) => setDeviceLabel(e.target.value)} />
                  </label>
                </div>
                <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void handleConfirmRestore()}>
                  {busy ? 'กำลังกู้คืน…' : 'ยืนยันกู้คืนข้อมูล'}
                </button>
              </>
            )}
          </div>
        )}
        {error && <p className="backup-error-text">{error}</p>}
        {result && (
          <p className="backup-success-text">
            กู้คืนสำเร็จ: งานศิลป์ {result.assetFilesRestored} ไฟล์, การตั้งค่า {result.settingsKeysRestored} รายการ (สร้าง Safety Backup ของข้อมูลเดิมไว้ในประวัติการสำรองแล้ว)
          </p>
        )}
      </section>
    </div>
  );
}

// --- Auto Backup --------------------------------------------------------

const FREQUENCY_LABEL_TH: Record<AutoBackupFrequency, string> = {
  off: 'ปิดใช้งาน',
  everyLaunch: 'ทุกครั้งที่เปิดแอป',
  daily: 'ทุกวัน',
  weekly: 'ทุกสัปดาห์',
  monthly: 'ทุกเดือน',
};

function AutoBackupTab() {
  const [settings, setSettings] = useState<AutoBackupSettings>(() => loadAutoBackupSettings());
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    saveAutoBackupSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [settings]);

  return (
    <div className="backup-panel">
      <section className="backup-card">
        <h2>สำรองข้อมูลอัตโนมัติ</h2>
        <div className="backup-form-grid">
          <label>
            ความถี่
            <select value={settings.frequency} onChange={(e) => setSettings((s) => ({ ...s, frequency: e.target.value as AutoBackupFrequency }))}>
              {(Object.keys(FREQUENCY_LABEL_TH) as AutoBackupFrequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABEL_TH[f]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input type="checkbox" checked={settings.backupOnExit} onChange={(e) => setSettings((s) => ({ ...s, backupOnExit: e.target.checked }))} /> สำรองข้อมูลก่อนปิดแอป
          </label>
          <label>
            จำนวนไฟล์สำรองที่เก็บไว้ (เก่าสุดจะถูกลบอัตโนมัติ)
            <select
              value={String(settings.retention)}
              onChange={(e) => setSettings((s) => ({ ...s, retention: (e.target.value === 'unlimited' ? 'unlimited' : Number(e.target.value)) as AutoBackupRetention }))}
            >
              <option value="5">5 ไฟล์</option>
              <option value="10">10 ไฟล์</option>
              <option value="20">20 ไฟล์</option>
              <option value="unlimited">ไม่จำกัด</option>
            </select>
          </label>
        </div>
        <p>สำรองครั้งล่าสุด (อัตโนมัติ): {settings.lastAutoBackupAt ? new Date(settings.lastAutoBackupAt).toLocaleString('th-TH') : 'ยังไม่เคย'}</p>
        <button type="button" className="btn btn--primary" onClick={handleSave}>
          บันทึกการตั้งค่า
        </button>
        {saved && <p className="backup-success-text">บันทึกแล้ว</p>}
        <p className="backup-warning-text">หมายเหตุ: การสำรองก่อนกู้คืนข้อมูล (Safety Backup) จะทำงานเสมอโดยอัตโนมัติ ไม่ต้องตั้งค่าใด ๆ เพิ่มเติม</p>
      </section>
    </div>
  );
}

// --- Backup History -------------------------------------------------------

const TRIGGER_LABEL_TH: Record<AppBackupHistoryRecord['trigger'], string> = {
  manual: 'ด้วยตนเอง',
  auto: 'อัตโนมัติ',
  safety: 'Safety Backup',
};

function BackupHistoryTab() {
  const [history, setHistory] = useState<AppBackupHistoryRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setHistory(await listBackupHistory());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleRestore = useCallback(
    async (record: AppBackupHistoryRecord) => {
      if (!record.blob) {
        setStatus('ไม่มีไฟล์สำรองเก็บไว้สำหรับรายการนี้');
        return;
      }
      setBusy(record.historyId);
      setStatus(null);
      try {
        const preview = await previewAppBackupRestore(record.blob);
        if (!preview.canRestore) {
          setStatus(`ไม่สามารถกู้คืนได้: ${preview.validation.issues[0]?.message ?? 'ตรวจสอบไม่ผ่าน'}`);
          return;
        }
        const result = await applyAppBackupRestore(record.blob);
        setStatus(`กู้คืนสำเร็จ: งานศิลป์ ${result.assetFilesRestored} ไฟล์, การตั้งค่า ${result.settingsKeysRestored} รายการ`);
        await reload();
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [reload]
  );

  const handleDelete = useCallback(
    async (historyId: string) => {
      await deleteBackupHistoryRecord(historyId);
      await reload();
    },
    [reload]
  );

  const handleDownload = useCallback((record: AppBackupHistoryRecord) => {
    if (!record.blob) return;
    const url = URL.createObjectURL(record.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = record.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="backup-panel">
      <section className="backup-card">
        <h2>ประวัติการสำรองข้อมูล ({history.length})</h2>
        {status && <p>{status}</p>}
        <table className="backup-table">
          <thead>
            <tr>
              <th>วันที่</th>
              <th>ขนาด</th>
              <th>ปลายทาง</th>
              <th>ผลลัพธ์</th>
              <th>ระยะเวลา</th>
              <th>เวอร์ชัน</th>
              <th>ประเภท</th>
              <th>การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {history.map((r) => (
              <tr key={r.historyId}>
                <td>{new Date(r.createdAt).toLocaleString('th-TH')}</td>
                <td>{formatBytes(r.compressedSize)}</td>
                <td>{r.destination}</td>
                <td className={r.result === 'success' ? 'backup-success-text' : 'backup-error-text'}>{r.result === 'success' ? 'สำเร็จ' : 'ล้มเหลว'}</td>
                <td>{(r.durationMs / 1000).toFixed(1)}s</td>
                <td>{r.appVersionLabel ?? '—'}</td>
                <td>{TRIGGER_LABEL_TH[r.trigger]}</td>
                <td>
                  {r.blob && (
                    <button type="button" className="btn btn--small" disabled={busy === r.historyId} onClick={() => void handleRestore(r)}>
                      กู้คืน
                    </button>
                  )}
                  {r.blob && (
                    <button type="button" className="btn btn--small" onClick={() => handleDownload(r)}>
                      ดาวน์โหลด
                    </button>
                  )}
                  <button type="button" className="btn btn--small" onClick={() => void handleDelete(r.historyId)}>
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {history.length === 0 && <p>ยังไม่มีประวัติการสำรองข้อมูล</p>}
      </section>
    </div>
  );
}

// --- Verify Backup --------------------------------------------------------

function VerifyBackupTab() {
  const [result, setResult] = useState<AppBackupValidationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setBusy(true);
    setFileName(file.name);
    setResult(null);
    try {
      const r = await validateAppBackupArchive(file);
      setResult(r);
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="backup-panel">
      <section className="backup-card">
        <h2>ตรวจสอบไฟล์สำรอง (Verify Backup)</h2>
        <p>ตรวจสอบความสมบูรณ์ของไฟล์ .vspsb โดยไม่แก้ไขข้อมูลใด ๆ ในแอป — ตรวจโครงสร้าง ZIP, manifest, และ checksum ของทุกไฟล์</p>
        <input type="file" accept=".vspsb" onChange={(e) => e.target.files?.[0] && void handleFile(e.target.files[0])} />
        {busy && <p>กำลังตรวจสอบ…</p>}
        {result && (
          <div>
            <p className={result.verdict === 'PASS' ? 'backup-success-text' : result.verdict === 'WARNING' ? 'backup-warning-text' : 'backup-error-text'}>
              ผลการตรวจสอบ {fileName}: {result.verdict}
            </p>
            <p>
              จำนวนไฟล์ในไฟล์เก็บถาวร: {result.entryCount}, ตรวจสอบ checksum {result.checkedFileCount} รายการ, ไม่ตรง {result.mismatchedFileCount} รายการ
            </p>
            {result.manifest && (
              <p>
                สร้างเมื่อ {new Date(result.manifest.createdAt).toLocaleString('th-TH')} จาก {result.manifest.metadata.deviceLabel} — Application Version{' '}
                {result.manifest.appVersionLabel ?? '—'}, Database Schema v{result.manifest.metadata.dbVersion}
              </p>
            )}
            {result.issues.length > 0 && (
              <ul className="backup-issue-list">
                {result.issues.map((issue, i) => (
                  <li key={i} className={issue.severity === 'error' ? 'backup-error-text' : 'backup-warning-text'}>
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
