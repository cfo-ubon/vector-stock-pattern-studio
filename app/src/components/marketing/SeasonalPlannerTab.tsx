import { useMemo, useState } from 'react';
import type { MarketingData } from './MarketingIntelligenceView';
import { createSeasonalEvent, isLateForProduction, isPastEvent } from '../../marketing/domain/seasonalEvent';
import { putSeasonalEvent, deleteSeasonalEvent } from '../../marketing/storage/seasonalEventStore';

interface Props {
  data: MarketingData;
  reload: () => Promise<void>;
}

/** Section 6 — Seasonal Production Calendar. Late-warning flags come
 * directly from seasonalEvent.ts's real date comparisons (isLateForProduction
 * / isPastEvent) against the actual current time — never a fabricated
 * urgency score. */
export function SeasonalPlannerTab({ data, reload }: Props) {
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newRegion, setNewRegion] = useState('global');
  const [busy, setBusy] = useState(false);

  const now = Date.now();

  const sorted = useMemo(() => [...data.seasonalEvents].sort((a, b) => a.eventDate - b.eventDate), [data.seasonalEvents]);
  const upcoming = sorted.filter((e) => !isPastEvent(e, now));
  const late = upcoming.filter((e) => isLateForProduction(e, now));
  const past = sorted.filter((e) => isPastEvent(e, now));

  const handleAdd = async () => {
    if (!newName.trim() || !newDate) return;
    setBusy(true);
    try {
      const eventDate = new Date(newDate).getTime();
      const record = createSeasonalEvent({ eventName: newName.trim(), eventDate, region: newRegion.trim() || 'global', isGlobal: false, isUserDefined: true });
      await putSeasonalEvent(record);
      setNewName('');
      setNewDate('');
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    try {
      await deleteSeasonalEvent(id);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const fmt = (ts: number) => new Date(ts).toISOString().slice(0, 10);

  return (
    <div className="marketing-tab seasonal-planner-tab">
      <section className="seasonal-add-form">
        <label>
          Event name: <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Autumn harvest collection deadline" />
        </label>
        <label>
          Event date: <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
        </label>
        <label>
          Region: <input type="text" value={newRegion} onChange={(e) => setNewRegion(e.target.value)} placeholder="global" />
        </label>
        <button type="button" className="btn btn--primary" disabled={busy || !newName.trim() || !newDate} onClick={() => void handleAdd()}>
          Add seasonal event
        </button>
      </section>

      {late.length > 0 && (
        <section className="seasonal-late-warnings">
          <h2>⚠ Late for production</h2>
          <ul>
            {late.map((e) => (
              <li key={e.id}>
                <strong>{e.eventName}</strong> ({fmt(e.eventDate)}) — recommended production start was {fmt(e.recommendedDesignStartDate)}. Design now to
                still make the demand window.
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="seasonal-timeline">
        <h2>Upcoming production schedule</h2>
        {upcoming.length === 0 && <p>No upcoming seasonal events tracked yet.</p>}
        <ul className="seasonal-event-list">
          {upcoming.map((e) => (
            <li key={e.id} className={isLateForProduction(e, now) ? 'seasonal-event--late' : undefined}>
              <strong>{e.eventName}</strong> — {e.region} {e.isGlobal ? '(global)' : ''}
              <dl>
                <div>
                  <dt>Event date</dt>
                  <dd>{fmt(e.eventDate)}</dd>
                </div>
                <div>
                  <dt>Recommended design start</dt>
                  <dd>{fmt(e.recommendedDesignStartDate)}</dd>
                </div>
                <div>
                  <dt>Recommended submission start</dt>
                  <dd>{fmt(e.recommendedSubmissionStartDate)}</dd>
                </div>
                <div>
                  <dt>Expected demand window</dt>
                  <dd>
                    {fmt(e.expectedDemandWindowFrom)} → {fmt(e.expectedDemandWindowTo)}
                  </dd>
                </div>
              </dl>
              {e.isUserDefined && (
                <button type="button" className="btn btn--danger" disabled={busy} onClick={() => void handleDelete(e.id)}>
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {past.length > 0 && (
        <section className="seasonal-past">
          <h2>Past events</h2>
          <ul>
            {past.map((e) => (
              <li key={e.id}>
                {e.eventName} — {fmt(e.eventDate)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
