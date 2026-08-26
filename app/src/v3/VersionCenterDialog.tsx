import { useModalDismiss } from '../components/portfolio/useModalDismiss';
import { PRODUCT_NAME, PRODUCT_VERSION, BUILD_NAME, BUILD_DESCRIPTION, RELEASE_DATE, COMMIT, PRODUCTION_STATUS, REGRESSION_RESULT, VERSION_SELECTOR_PATH, CHANGELOG } from './appMeta';

interface Props {
  onClose: () => void;
}

/** AI-SBOS v3, Milestone 2 — Version Center ("About AI-SBOS v3"). Same
 * "every field is real or hand-maintained, nothing computed/invented"
 * discipline as v2's own Version Center. Reuses `useModalDismiss` (the
 * shared Escape-to-close + focus-management accessibility hook) rather
 * than re-implementing it. */
export function VersionCenterDialog({ onClose }: Props) {
  const { backdropRef, onKeyDown } = useModalDismiss(onClose);

  return (
    <div className="v3-modal-backdrop" ref={backdropRef} tabIndex={-1} onKeyDown={onKeyDown} role="dialog" aria-modal="true" aria-label={`About ${PRODUCT_NAME}`}>
      <div className="v3-modal">
        <div className="v3-modal-header">
          <h2>ℹ️ About {PRODUCT_NAME}</h2>
          <button type="button" className="v3-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <dl className="v3-brief-grid">
          <dt>Product</dt>
          <dd>{PRODUCT_NAME}</dd>

          <dt>Product Version</dt>
          <dd>v{PRODUCT_VERSION}</dd>

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

          <dt>Status</dt>
          <dd>{PRODUCTION_STATUS}</dd>

          <dt>Regression Result</dt>
          <dd>{REGRESSION_RESULT}</dd>
        </dl>

        <p className="v3-hint">
          <a className="v3-link" href={VERSION_SELECTOR_PATH} rel="noreferrer">
            🔁 Switch Version
          </a>
        </p>

        <section>
          <h3>What's New</h3>
          {CHANGELOG.map((entry) => (
            <div key={entry.version} className="v3-changelog-entry">
              <p>
                <strong>v{entry.version}</strong> — {entry.title} ({entry.date})
              </p>
              <ul>
                {entry.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
