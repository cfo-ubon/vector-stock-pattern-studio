import { useState } from 'react';
import { useModalDismiss } from '../portfolio/useModalDismiss';
import { APP_VERSION, CHANGELOG } from '../../appMeta';
import { markVersionSeen, setDontShowAgain } from './whatsNewStore';
import './appIdentity.css';

interface Props {
  onDismiss: () => void;
}

/** AI-SBOS Mission, Part 3 — What's New. Shows the real latest
 * `CHANGELOG` entry from `appMeta.ts` (the exact same data source the
 * Version Center's "Latest Changes" section reads, never a second copy) —
 * once per version, with an explicit opt-out. */
export function WhatsNewDialog({ onDismiss }: Props) {
  const { backdropRef, onKeyDown } = useModalDismiss(onDismiss);
  const [dontShowAgainChecked, setDontShowAgainChecked] = useState(false);
  const latest = CHANGELOG[0];

  const handleClose = () => {
    markVersionSeen(APP_VERSION);
    if (dontShowAgainChecked) setDontShowAgain(true);
    onDismiss();
  };

  return (
    <div className="portfolio-modal-backdrop" ref={backdropRef} tabIndex={-1} onKeyDown={onKeyDown} role="dialog" aria-modal="true" aria-label="What's New">
      <div className="portfolio-modal whats-new-modal">
        <div className="portfolio-detail-header">
          <h2>✨ What's New — v{latest.version}</h2>
        </div>

        <p className="metadata-hint">
          {latest.title} · {latest.date}
        </p>

        <ul className="whats-new-highlights">
          {latest.highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>

        <div className="whats-new-footer">
          <label>
            <input type="checkbox" checked={dontShowAgainChecked} onChange={(e) => setDontShowAgainChecked(e.target.checked)} /> ไม่ต้องแสดงอีก (Don't show
            again)
          </label>
          <button type="button" className="btn btn--primary" onClick={handleClose}>
            เข้าใจแล้ว
          </button>
        </div>
      </div>
    </div>
  );
}
