import { useEffect, useState } from 'react';
import { listBackupHistory, pruneBackupHistory } from '../../backup/appBackupHistoryStore';
import { formatBytes } from '../../pwa/storageQuota';

interface Props {
  onClose: () => void;
}

// Build 027 Phase 3 — the user-controlled cleanup tool the brief
// requires. Deliberately narrow in scope: it only ever prunes
// *non-safety, successful* Backup History entries (the same retention
// logic Auto Backup already uses), never portfolio projects or assets —
// per the brief's "never delete projects automatically" rule, this tool
// gives the user a button to press, it does not decide on its own.
export function StorageCleanupPanel({ onClose }: Props) {
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  const [historyBytes, setHistoryBytes] = useState(0);
  const [pruning, setPruning] = useState(false);
  const [prunedMessage, setPrunedMessage] = useState<string | null>(null);

  const refresh = async () => {
    const history = await listBackupHistory();
    setHistoryCount(history.length);
    setHistoryBytes(history.reduce((sum, h) => sum + (h.blob?.size ?? 0), 0));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handlePrune = async (retention: 5 | 10 | 20) => {
    setPruning(true);
    setPrunedMessage(null);
    try {
      const removed = await pruneBackupHistory(retention);
      setPrunedMessage(
        removed > 0
          ? `ลบประวัติสำรองเก่าไป ${removed} รายการ (สำรองความปลอดภัยและรายการที่ล้มเหลวจะไม่ถูกลบ)`
          : 'ไม่มีรายการเก่าให้ลบ',
      );
      await refresh();
    } finally {
      setPruning(false);
    }
  };

  return (
    <div className="offline-guide-overlay" role="dialog" aria-modal="true" aria-label="เครื่องมือล้างพื้นที่จัดเก็บ">
      <div className="offline-guide-panel">
        <div className="offline-guide-header">
          <h2>ล้างพื้นที่จัดเก็บ</h2>
          <button type="button" className="offline-guide-close" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>
        <p>
          โปรเจกต์และผลงานของคุณจะไม่ถูกลบโดยอัตโนมัติเด็ดขาด เครื่องมือนี้ลบได้เฉพาะ
          <strong> ประวัติการสำรองข้อมูลเก่า</strong> (ไฟล์ .vspsb ที่เก็บไว้ในเครื่อง) ตามจำนวนที่คุณเลือกเก็บไว้เท่านั้น
          — สำรองความปลอดภัยอัตโนมัติก่อนกู้คืนและรายการที่ล้มเหลวจะไม่ถูกลบเสมอ
        </p>
        <p>
          ประวัติการสำรองข้อมูลที่เก็บอยู่ตอนนี้: <strong>{historyCount ?? '…'}</strong> รายการ (
          {formatBytes(historyBytes)})
        </p>
        <div className="offline-guide-steps" style={{ display: 'flex', gap: '8px', paddingLeft: 0, listStyle: 'none' }}>
          {[5, 10, 20].map((n) => (
            <button
              key={n}
              type="button"
              className="btn"
              disabled={pruning}
              onClick={() => handlePrune(n as 5 | 10 | 20)}
            >
              เก็บล่าสุด {n} รายการ
            </button>
          ))}
        </div>
        {prunedMessage && <p className="offline-status-pill">{prunedMessage}</p>}
        <div className="offline-guide-caveats">
          <p>
            <strong>แนะนำ:</strong> สำรอง .vspsb ไปยัง iCloud Drive, USB, หรืออุปกรณ์อื่นเป็นประจำ
            ก่อนล้างพื้นที่ — เพื่อไม่ให้เสียสำเนาที่ยังต้องการใช้
          </p>
        </div>
      </div>
    </div>
  );
}
