interface Props {
  factoryStatus: string;
  businessOutcomeScore: number | null;
  factoryEfficiency: number | null;
  ownerDecisionsToday: number;
  withinDailyDecisionTarget: boolean;
  ownerTimeSavedMinutes: number;
  commercialReadyCount: number;
  topRecommendationReason: string | null;
}

/** Part 7 — Factory Dashboard. Minimal by design (spec: "No unnecessary
 * charts"). Every value is passed in already-computed from the same real
 * engines the Home screen and Daily Brief already called — this
 * component never recomputes anything itself (Part 12). */
export function FactoryDashboardPanel({
  factoryStatus,
  businessOutcomeScore,
  factoryEfficiency,
  ownerDecisionsToday,
  withinDailyDecisionTarget,
  ownerTimeSavedMinutes,
  commercialReadyCount,
  topRecommendationReason,
}: Props) {
  return (
    <section aria-label="Factory Dashboard">
      <h2>Factory Dashboard</h2>
      <div className="pe-tiles">
        <div className="pe-tile">
          <span className="pe-tile-label">Factory Status</span>
          <span className="pe-tile-value">{factoryStatus}</span>
        </div>
        <div className="pe-tile">
          <span className="pe-tile-label">Business Outcome</span>
          <span className="pe-tile-value">{businessOutcomeScore !== null ? Math.round(businessOutcomeScore) : '—'}</span>
        </div>
        <div className="pe-tile" title="Share of factory tasks that finished successfully — not the same as how many packages are commercially Ready to sell.">
          <span className="pe-tile-label">Task Completion Rate</span>
          <span className="pe-tile-value">{factoryEfficiency !== null ? `${Math.round(factoryEfficiency)}%` : '—'}</span>
        </div>
        <div className="pe-tile">
          <span className="pe-tile-label">Owner Decisions Today</span>
          <span className="pe-tile-value">
            {ownerDecisionsToday} {withinDailyDecisionTarget ? '✓' : '⚠'}
          </span>
        </div>
        <div className="pe-tile">
          <span className="pe-tile-label">Owner Time Saved</span>
          <span className="pe-tile-value">{Math.round(ownerTimeSavedMinutes)} min</span>
        </div>
        <div className="pe-tile">
          <span className="pe-tile-label">Commercial Ready</span>
          <span className="pe-tile-value">{commercialReadyCount}</span>
        </div>
      </div>
      {topRecommendationReason && (
        <p>
          <strong>Top recommendation:</strong> {topRecommendationReason}
        </p>
      )}
    </section>
  );
}
