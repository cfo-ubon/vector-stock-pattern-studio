import { useEffect, useRef } from 'react';

/** Hotfix v1.0.2, BUG-006 — shared Escape-to-close + initial-focus-into-dialog
 * behavior for the `.portfolio-modal-backdrop` pattern. Three of the nine
 * consumers of that pattern (`CollectionAssignmentDialog.tsx`,
 * `CreateCollectionDialog.tsx`, `CollectionDetailPanel.tsx`) already
 * hand-wrote an `onKeyDown` Escape check; the other six had none. This hook
 * centralizes that real behavior — plus moving focus into the dialog on
 * open, which none of the nine did — so every `.portfolio-modal-backdrop`
 * consumer gets the same real, working behavior instead of duplicating (or
 * omitting) it per component. Applied only to the six that were missing it;
 * the three already-working dialogs are left as-is. */
export function useModalDismiss(onClose: () => void) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    backdropRef.current?.focus();
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  return { backdropRef, onKeyDown };
}
