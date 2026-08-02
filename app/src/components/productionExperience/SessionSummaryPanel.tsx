import type { ProductionCompletionReview } from '../../productionAutopilot/domain/types';

interface Props {
  review: ProductionCompletionReview;
  onDone: () => void;
}

/** Part 10 — Session Summary. Every field is `ProductionCompletionReview`
 * as-is (Mission 4's own real completion review, composed from Build
 * 032's Factory Review + Business Outcome Score + Build 033's real
 * improvement candidates) — nothing recomputed here. */
export function SessionSummaryPanel({ review, onDone }: Props) {
  return (
    <section aria-label="Session Summary">
      <h2>Session Summary</h2>
      <div className="pe-tiles">
        <div className="pe-tile">
          <span className="pe-tile-label">Packages Produced</span>
          <span className="pe-tile-value">{review.packagesProduced}</span>
        </div>
        <div className="pe-tile">
          <span className="pe-tile-label">Ready</span>
          <span className="pe-tile-value">{review.commercialReady}</span>
        </div>
        <div className="pe-tile">
          <span className="pe-tile-label">Review</span>
          <span className="pe-tile-value">{review.review}</span>
        </div>
        <div className="pe-tile">
          <span className="pe-tile-label">Repair</span>
          <span className="pe-tile-value">{review.repair}</span>
        </div>
        <div className="pe-tile">
          <span className="pe-tile-label">Owner Time Saved</span>
          <span className="pe-tile-value">{Math.round(review.ownerTimeSavedMinutes)} min</span>
        </div>
        <div className="pe-tile">
          <span className="pe-tile-label">Business Outcome</span>
          <span className="pe-tile-value">{review.businessOutcomeScore !== null ? Math.round(review.businessOutcomeScore) : '—'}</span>
        </div>
        <div className="pe-tile">
          <span className="pe-tile-label">Factory Efficiency</span>
          <span className="pe-tile-value">{review.factoryEfficiency !== null ? `${Math.round(review.factoryEfficiency)}%` : '—'}</span>
        </div>
        <div className="pe-tile">
          <span className="pe-tile-label">Improvement Created</span>
          <span className="pe-tile-value">{review.improvementTasksCreated}</span>
        </div>
      </div>
      <p>
        <strong>Next recommendation:</strong> {review.nextRecommendation.reason}
      </p>
      <button type="button" className="btn btn--primary" onClick={onDone}>
        Done
      </button>
    </section>
  );
}
