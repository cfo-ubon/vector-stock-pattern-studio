import { useEffect } from 'react';
import { isDesktop, getDesktopBridge } from './desktopBridge';

// Generic, reusable desktop-lifecycle hook — a no-op when not running
// inside Electron (`isDesktop()` false), so it is always safe to mount.
//
// Build 027 — much smaller than `codex/offline-windows-desktop`'s
// original version, which wired a "reportState"/dirty-tracking round trip
// tied to a main-process-owned project file. That concept doesn't apply
// here: this app has no explicit save step at all (everything persists to
// IndexedDB continuously, exactly like the plain web app) — there is
// nothing to report as "unsaved." What's left, and still genuinely
// useful, is menu-event dispatch: the File-menu's Backup/Restore/Export
// items need a way to reach the renderer's actual UI.
export interface DesktopIntegrationHandlers {
  onMenuCreateBackup?: () => void;
  onMenuRestoreBackup?: () => void;
  onMenuExportCurrent?: () => void;
  onMenuOpenExportFolder?: () => void;
  onMenuPreferences?: () => void;
}

export function useDesktopIntegration(handlers: DesktopIntegrationHandlers): void {
  useEffect(() => {
    if (!isDesktop()) return;
    const bridge = getDesktopBridge();
    if (!bridge) return;

    const cleanups: Array<(() => void) | undefined> = [
      handlers.onMenuCreateBackup && bridge.onMenuEvent('menu:createBackup', handlers.onMenuCreateBackup),
      handlers.onMenuRestoreBackup && bridge.onMenuEvent('menu:restoreBackup', handlers.onMenuRestoreBackup),
      handlers.onMenuExportCurrent && bridge.onMenuEvent('menu:exportCurrent', handlers.onMenuExportCurrent),
      handlers.onMenuOpenExportFolder && bridge.onMenuEvent('menu:openExportFolder', handlers.onMenuOpenExportFolder),
      handlers.onMenuPreferences && bridge.onMenuEvent('menu:preferences', handlers.onMenuPreferences),
    ];
    return () => cleanups.forEach((fn) => fn?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
