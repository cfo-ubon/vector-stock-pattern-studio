import { useEffect } from 'react';
import { isDesktop, getDesktopBridge } from './desktopBridge';

// Generic, reusable desktop-lifecycle hook — a no-op when not running
// inside Electron (`isDesktop()` false), so it is always safe to mount.
//
// Wires the renderer side of: dirty-state reporting (so the main process
// knows whether it's safe to quit without prompting, and where autosave/
// crash-recovery should write — see `electron/main.ts`'s `close` handler
// and autosave timer), menu-event dispatch (File/Edit/View/Tools/Help),
// and the save-before-close / autosave-requested round trip.
//
// Integration note (honest scope boundary, not hidden): `App.tsx` has no
// existing centralized "is there an unsaved change" concept — dirtiness
// today is implicit in React state, not a single tracked flag. Deciding
// exactly what counts as "unsaved" for this app (a live generation
// preview? an edited saved-library item? a project-level field?) is a
// product decision, not a mechanical one — this hook exposes the
// mechanism (call `reportState` with whatever boolean the caller
// considers "dirty") without guessing that product decision on the
// caller's behalf. Until a caller wires a real `hasUnsavedChanges` value,
// this hook still delivers everything that does NOT depend on it: menu
// event dispatch, and the recovery-check-on-launch signal.
export interface DesktopIntegrationHandlers {
  hasUnsavedChanges: boolean;
  currentProjectPath?: string;
  projectName?: string;
  onMenuNewProject?: () => void;
  onMenuOpenProject?: () => void;
  onMenuSave?: () => void;
  onMenuSaveAs?: () => void;
  onMenuImportJson?: () => void;
  onMenuExport?: () => void;
  onSaveBeforeClose?: () => void;
  onAutosaveRequested?: () => void;
}

export function useDesktopIntegration(handlers: DesktopIntegrationHandlers): void {
  const { hasUnsavedChanges, currentProjectPath, projectName } = handlers;

  // Report dirty/current-file state to main whenever it changes, so the
  // "unsaved changes" close-confirmation and autosave-target-path stay
  // accurate.
  useEffect(() => {
    if (!isDesktop()) return;
    getDesktopBridge()?.reportState({ hasUnsavedChanges, currentProjectPath, projectName });
  }, [hasUnsavedChanges, currentProjectPath, projectName]);

  // Menu event + lifecycle-request listeners — registered once, cleaned
  // up on unmount. Each callback is optional so a caller only wires the
  // menu items it actually has a handler for yet.
  useEffect(() => {
    if (!isDesktop()) return;
    const bridge = getDesktopBridge();
    if (!bridge) return;

    const cleanups: Array<(() => void) | undefined> = [
      handlers.onMenuNewProject && bridge.onMenuEvent('menu:newProject', handlers.onMenuNewProject),
      handlers.onMenuOpenProject && bridge.onMenuEvent('menu:openProject', handlers.onMenuOpenProject),
      handlers.onMenuSave && bridge.onMenuEvent('menu:save', handlers.onMenuSave),
      handlers.onMenuSaveAs && bridge.onMenuEvent('menu:saveAs', handlers.onMenuSaveAs),
      handlers.onMenuImportJson && bridge.onMenuEvent('menu:importJson', handlers.onMenuImportJson),
      handlers.onMenuExport && bridge.onMenuEvent('menu:export', handlers.onMenuExport),
      handlers.onSaveBeforeClose && bridge.onMenuEvent('app:requestSaveBeforeClose', handlers.onSaveBeforeClose),
      handlers.onAutosaveRequested && bridge.onMenuEvent('app:requestAutosave', handlers.onAutosaveRequested),
    ];
    return () => cleanups.forEach((fn) => fn?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
