import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import {
  getConnectivityStatus,
  subscribeToConnectivity,
  hasActiveServiceWorkerController,
  CONNECTIVITY_LABEL_TH,
  type ConnectivityStatus,
} from '../../pwa/offlineStatus';
import { resolveOfflineReadiness, describeOfflineReadiness } from '../../pwa/updatePrompt';
import {
  estimateStorageUsage,
  requestPersistentStorage,
  isStoragePersisted,
  classifyStorageRisk,
  formatBytes,
  type StorageEstimateInfo,
} from '../../pwa/storageQuota';
import { InstallGuide } from './InstallGuide';
import { StorageCleanupPanel } from './StorageCleanupPanel';
import './pwaStatus.css';

// Build 027 Phase 2 — a single always-visible status strip (not a
// separate view) so offline/update/storage state is legible from every
// screen in the app without threading props through App.tsx's large view
// switch. `useRegisterSW` comes from vite-plugin-pwa's virtual module: in
// a plain Vite dev/test run (no production SW) it resolves to a no-op
// stub per the plugin's own documented dev behavior, so this component is
// safe to mount unconditionally.
export function OfflineStatusBar() {
  const [connectivity, setConnectivity] = useState<ConnectivityStatus>(getConnectivityStatus());
  const [storageInfo, setStorageInfo] = useState<StorageEstimateInfo | null>(null);
  const [persisted, setPersisted] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);

  const { offlineReady: [offlineReady], needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Poll for a waiting update roughly hourly while the tab stays open —
      // there is no push-notification channel to tell us otherwise, and
      // this matches the "checkpoint" cadence Phase 7 documents for
      // realistic (non-guaranteed-background) update/backup reminders.
      if (!registration) return;
      window.setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    return subscribeToConnectivity(setConnectivity);
  }, []);

  useEffect(() => {
    let cancelled = false;
    estimateStorageUsage().then((info) => {
      if (!cancelled) setStorageInfo(info);
    });
    isStoragePersisted().then((value) => {
      if (!cancelled) setPersisted(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const readiness = resolveOfflineReadiness(offlineReady, needRefresh, hasActiveServiceWorkerController());
  const storageRisk = storageInfo ? classifyStorageRisk(storageInfo.usageRatio) : 'ok';

  const handleRequestPersist = async () => {
    const granted = await requestPersistentStorage();
    setPersisted(granted);
  };

  return (
    <div className="offline-status-bar" data-connectivity={connectivity}>
      <span className={`offline-status-pill offline-status-pill--${connectivity}`}>
        {connectivity === 'online' ? '🟢' : '🔴'} {CONNECTIVITY_LABEL_TH[connectivity]}
      </span>
      <span className="offline-status-pill offline-status-pill--readiness">{describeOfflineReadiness(readiness)}</span>
      {storageInfo && storageRisk !== 'ok' && (
        <span className={`offline-status-pill offline-status-pill--${storageRisk}`}>
          ⚠️ พื้นที่จัดเก็บใกล้เต็ม ({formatBytes(storageInfo.usageBytes)} / {formatBytes(storageInfo.quotaBytes)})
        </span>
      )}
      {!persisted && (
        <button type="button" className="offline-status-link" onClick={handleRequestPersist}>
          ป้องกันข้อมูลถูกลบอัตโนมัติ
        </button>
      )}
      <button type="button" className="offline-status-link" onClick={() => setGuideOpen(true)}>
        📴 วิธีติดตั้งใช้งานออฟไลน์
      </button>
      <button type="button" className="offline-status-link" onClick={() => setCleanupOpen(true)}>
        🧹 ล้างพื้นที่จัดเก็บ
      </button>
      {needRefresh && (
        <div className="offline-update-banner" role="alert">
          <span>มีอัปเดตใหม่ของแอปพร้อมติดตั้ง งานที่ยังไม่บันทึกจะไม่หายไป แต่แนะนำให้บันทึกก่อน</span>
          <button type="button" className="btn btn--primary" onClick={() => updateServiceWorker(true)}>
            อัปเดตตอนนี้
          </button>
        </div>
      )}
      {guideOpen && <InstallGuide onClose={() => setGuideOpen(false)} />}
      {cleanupOpen && <StorageCleanupPanel onClose={() => setCleanupOpen(false)} />}
    </div>
  );
}
