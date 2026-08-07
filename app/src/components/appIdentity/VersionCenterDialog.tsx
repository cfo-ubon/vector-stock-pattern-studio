import { useModalDismiss } from '../portfolio/useModalDismiss';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import {
  PRODUCT_NAME,
  PRODUCT_SUBTITLE,
  MODULE_NAME,
  APP_VERSION,
  BUILD_NAME,
  BUILD_DESCRIPTION,
  RELEASE_DATE,
  COMMIT,
  ENVIRONMENT,
  PRODUCTION_STATUS,
  COMMERCIAL_CERTIFICATION_STATUS,
  REGRESSION_RESULT,
  CHANGELOG,
} from '../../appMeta';
import './appIdentity.css';

interface Props {
  onClose: () => void;
}

/** AI-SBOS Mission, Part 2 — Version Center ("About AI-SBOS"). Every field
 * is either a real, live browser signal (Offline Status via
 * `useOnlineStatus`, Environment via Vite's own `import.meta.env.PROD`) or
 * a hand-maintained release constant from `appMeta.ts` — nothing computed
 * or invented at this layer. */
export function VersionCenterDialog({ onClose }: Props) {
  const { backdropRef, onKeyDown } = useModalDismiss(onClose);
  const online = useOnlineStatus();

  return (
    <div className="portfolio-modal-backdrop" ref={backdropRef} tabIndex={-1} onKeyDown={onKeyDown} role="dialog" aria-modal="true" aria-label={`About ${PRODUCT_NAME}`}>
      <div className="portfolio-modal version-center-modal">
        <div className="portfolio-detail-header">
          <h2>ℹ️ About {PRODUCT_NAME}</h2>
          <button type="button" className="btn" onClick={onClose}>
            ปิด
          </button>
        </div>

        <p className="metadata-hint">
          {PRODUCT_SUBTITLE} · โมดูล: {MODULE_NAME}
        </p>

        <dl className="version-center-grid">
          <dt>Product Name</dt>
          <dd>{PRODUCT_NAME}</dd>

          <dt>Version</dt>
          <dd>{APP_VERSION}</dd>

          <dt>Build</dt>
          <dd>
            {BUILD_NAME} — {BUILD_DESCRIPTION}
          </dd>

          <dt>Release Date</dt>
          <dd>{RELEASE_DATE}</dd>

          <dt>Commit</dt>
          <dd>
            <code>{COMMIT}</code>
          </dd>

          <dt>Environment</dt>
          <dd>
            <span className={`app-env-badge app-env-badge--${ENVIRONMENT}`}>{ENVIRONMENT === 'production' ? 'Production' : 'Development'}</span>
          </dd>

          <dt>Production Status</dt>
          <dd>{PRODUCTION_STATUS}</dd>

          <dt>Offline Status</dt>
          <dd>{online ? '🟢 Online' : '🔴 Offline — ทำงานได้ตามปกติ ข้อมูลทั้งหมดอยู่ใน IndexedDB เครื่องนี้'}</dd>

          <dt>Commercial Certification</dt>
          <dd>{COMMERCIAL_CERTIFICATION_STATUS}</dd>

          <dt>Regression Result</dt>
          <dd>{REGRESSION_RESULT}</dd>
        </dl>

        <section className="portfolio-detail-section">
          <h3>Latest Changes</h3>
          {CHANGELOG.map((entry) => (
            <div key={entry.version} className="version-center-changelog-entry">
              <p>
                <strong>v{entry.version}</strong> — {entry.title} ({entry.date})
              </p>
              <ul>
                {entry.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
